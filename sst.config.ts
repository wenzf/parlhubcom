/// <reference path="./.sst/platform/config.d.ts" />

// Deployment: Fargate service with the 32GB+ read-only DuckDB downloaded from
// S3 to local disk at boot, plus a weekly Fargate task that rebuilds the DB
// (incremental import) and rolls the service. Design + costs:
// docs/aws-deployment.md
//
// CLI:
//   npx sst deploy --stage production   deploy (profile parlhubcom, Frankfurt)
//   npx sst dev                         local dev against deployed resources
//   sh deploy/upload-db.sh <bucket>     one-time DB bootstrap before the
//                                       first deploy can go healthy

export default $config({
    app(input) {
        return {
            name: "parlhubcom",
            removal: input?.stage === "production" ? "retain" : "remove",
            home: "aws",
            providers: {
                aws: {
                    // Local deploy convenience, read from the untracked .env
                    // (SST auto-loads it); no tracked file carries it.
                    profile: process.env.AWS_PROFILE,
                    region: "eu-central-1",
                },
            },
        };
    },
    async run() {
        const isProd = $app.stage === "production";

        // Signs the cosmetic __settings cookie. Stored in SSM, injected into
        // the task definition at deploy time, never baked into the image.
        // Set out of band: npx sst secret set CookieSecret <value> --stage production
        const cookieSecret = new sst.Secret("CookieSecret");

        // No NAT: containers sit in public subnets (SST default without `nat`),
        // so the 32GB boot download goes S3 → internet gateway → task for free.
        const vpc = new sst.aws.Vpc("Vpc");
        const cluster = new sst.aws.Cluster("Cluster", { vpc });

        // Holds immutable DB snapshots (db/data-<stamp>.duckdb) + the db/latest
        // pointer. Never overwritten in place — see deploy/update-db.ts. Also holds
        // the traffic archive under analytics/ (deploy/analytics.ts).
        //
        // ONE key is world-readable: analytics/summary.json, which the
        // /project/traffic-stats loader fetches. It is already public by
        // construction — the page renders it — and reading it with plain fetch()
        // keeps the AWS SDK out of the app's runtime dependencies.
        //
        // Scoping matters a lot here, so it is spelled out rather than inherited:
        //   • `access: "public"` is NOT used — it grants s3:GetObject on
        //     `${bucket.arn}/*`, i.e. the 35GB DB snapshots and every daily file.
        //   • the statement below is pinned to the single summary key via `paths`.
        //     analytics/daily/* stays private: those hold raw user-agent strings.
        //   • blockPublicPolicy / restrictPublicBuckets must be false or the
        //     anonymous statement is silently inert. ACL-based access stays blocked
        //     (blockPublicAcls / ignorePublicAcls default to true) — a policy is the
        //     only way anything here is reachable.
        //   • enforceHttps (SST default) still denies any non-TLS request.
        const dbBucket = new sst.aws.Bucket("DbBucket", {
            policy: [
                {
                    actions: ["s3:GetObject"],
                    principals: "*",
                    paths: ["analytics/summary.json"],
                },
            ],
            transform: {
                publicAccessBlock: {
                    blockPublicAcls: true,
                    ignorePublicAcls: true,
                    blockPublicPolicy: false,
                    restrictPublicBuckets: false,
                },
            },
        });

        /** Public URL of the traffic cube — the only object the policy above exposes. */
        const analyticsSummaryUrl = $interpolate`https://${dbBucket.name}.s3.${aws.getRegionOutput().name}.amazonaws.com/analytics/summary.json`;

        // ALB target-group health check, keyed by the rules' forward target.
        // Points at /health (served straight from Express in server.js) instead
        // of SST's default "/" — "/" renders the full DuckDB-backed homepage, so
        // a slow query or a crawler burst can fail the check and get an
        // otherwise-healthy task killed.
        //
        // The thresholds are deliberately asymmetric. A false kill is expensive:
        // the replacement re-downloads the ~35GB DB (~4min) and then has to pass
        // `healthyThreshold` checks before it takes traffic, so nobody is served
        // in the meantime. A genuinely dead process, by contrast, exits and gets
        // replaced by ECS regardless of this check. Hence: slow to condemn
        // (4 x 30s = 2min of sustained failure), quick to restore (2 x 30s, vs
        // 2.5min at SST's default of 5).
        // Fixed name so the Analytics task can reference the group (SST's generated
        // name has a random suffix). Also greppable in the console.
        //
        // CAVEAT (verified 2026-07-18): the deployed SST version IGNORES
        // `logging.name` on a Service — after a full deploy the web task still
        // logged to the generated group below, and /parlhub/web was never created.
        // So the REAL group is WEB_LOG_GROUP_LEGACY; the pin stays because it is
        // where the name lands if a future SST honors it. The Analytics task is
        // handed BOTH (comma-separated LOG_GROUP); deploy/analytics.ts drops
        // whichever doesn't exist at runtime and queries the rest, so neither the
        // current reality nor a future rename can 404 the cron or hole the archive.
        const WEB_LOG_GROUP = "/parlhub/web";
        // The group the deployed service actually writes to (SST-generated; suffix
        // is stable in Pulumi state for the lifetime of the Web component).
        const WEB_LOG_GROUP_LEGACY =
            "/sst/cluster/parlhubcom-production-ClusterCluster-cxdtstnr/parlhubcom-production-Web-crvvzvkm/Web";

        const health = {
            "5555/http": {
                path: "/health",
                healthyThreshold: 2,
                unhealthyThreshold: 4,
            },
        };

        const web = new sst.aws.Service("Web", {
            cluster,
            // arm64: ~20% cheaper on Fargate. SST maps this to the image build
            // platform (Linux_arm64), so this flag is the only switch — but
            // cross-building from an x86_64 machine needs qemu registered first,
            // and it does NOT survive a reboot:
            //   npm run deploy:binfmt
            // Without it the deploy fails at image build ("exec format error" /
            // no arm64 platform). With it, expect a slower build: rolldown,
            // tailwind-oxide and lightningcss run their arm64 binaries under
            // emulation. Every native dep (duckdb, rolldown, oxide, lightningcss)
            // publishes linux-arm64-musl builds, so `npm ci` resolves on alpine.
            architecture: "arm64",
            // 4 vCPU: DuckDB parallelizes scans across cores — 2 vCPU made the
            // heavy analytics pages ~4x slower than dev and blow the 30s stream
            // timeout. 16 GB: lets the DuckDB buffer pool (DUCKDB_MEMORY_LIMIT
            // below) keep hot tables cached between requests.
            cpu: "4 vCPU",
            memory: "16 GB",
            // DB (~35GB) + headroom + 15GB DuckDB temp spill; 20GB are free
            storage: "100 GB",
            // Spot ≈ 65-70% off; rare reclaims mean ~5-10 min of downtime while a
            // replacement boots. Change to "fargate" for on-demand.
            capacity: "spot",
            image: {
                context: ".",
                dockerfile: "Dockerfile",
            },
            link: [dbBucket],
            environment: {
                NODE_ENV: "production",
                COOKIE_SECRET: cookieSecret.value,
                DB_S3_BUCKET: dbBucket.name,
                DB_PATH: "/data/data.duckdb",
                DUCKDB_TMP: "/data/.duckdb_tmp",
                DUCKDB_MEMORY_LIMIT: "10GB",
                // Read by /project/traffic-stats. Unset in dev, where the page then
                // renders its "no figures yet" state.
                ANALYTICS_SUMMARY_URL: analyticsSummaryUrl,
            },
            // Pinned rather than left to SST's default
            // (/sst/cluster/<cluster>/<service>/<container>), which carries a random
            // suffix and so can't be referenced from another component. The Analytics
            // task below has to name this group to query it. Retention is 30 days —
            // that is the whole reason the daily aggregation exists.
            logging: { name: WEB_LOG_GROUP, retention: "1 month" },
            loadBalancer: isProd
                ? {
                    // www is in the cert + DNS (alias); the ListenerRule below 301s
                    // it to the apex.
                    domain: {
                        name: "parlhub.com",
                        aliases: ["www.parlhub.com"],
                    },
                    rules: [
                        { listen: "80/http", redirect: "443/https" },
                        { listen: "443/https", forward: "5555/http" },
                    ],
                    health,
                }
                : {
                    rules: [{ listen: "80/http", forward: "5555/http" }],
                    health,
                },
            scaling: { min: 1, max: 1 },
            transform: {
                service: {
                    // SST doesn't set this and hardcodes the deployment circuit
                    // breaker with rollback — without a grace period the ALB kills the
                    // task during the multi-minute DB download and deploys never
                    // converge.
                    healthCheckGracePeriodSeconds: 900,
                },
            },
            // `sst dev` runs the app locally (linked env injected); the container
            // path is production-only.
            dev: {
                command: "npm run dev",
                url: "http://localhost:5555",
            },
        });

        // Redirect www.parlhub.com → parlhub.com (301) on the HTTPS listener.
        // SST's Service domain has no `redirects` option (only `aliases`, which
        // would serve duplicate content), so the rule is added directly on the
        // ALB. Port 80 already redirects to 443, where this rule then fires.
        // Guarded: `nodes.loadBalancer` is not accessible in `sst dev`.
        if (isProd && !$dev) {
            // dependsOn defers the lookup until the Service (incl. its listeners)
            // is created — without it the invoke fires at the start of a fresh
            // deploy and fails with "no matching ELBv2 Listener found".
            const httpsListener = aws.lb.getListenerOutput(
                {
                    loadBalancerArn: web.nodes.loadBalancer.arn,
                    port: 443,
                },
                { dependsOn: [web] },
            );
            new aws.lb.ListenerRule("WwwRedirect", {
                listenerArn: httpsListener.arn,
                priority: 10,
                conditions: [{ hostHeader: { values: ["www.parlhub.com"] } }],
                actions: [
                    {
                        type: "redirect",
                        redirect: {
                            host: "parlhub.com",
                            port: "443",
                            protocol: "HTTPS",
                            statusCode: "HTTP_301",
                        },
                    },
                ],
            });
        }

        // Weekly DB rebuild. No runtime limit (Fargate task, not Lambda); a
        // failed run leaves the app on the previous DB. See deploy/update-db.ts.
        const updateDb = new sst.aws.Task("UpdateDb", {
            cluster,
            // arm64: ~20% cheaper on Fargate. SST maps this to the image build
            // platform (Linux_arm64), so this flag is the only switch — but
            // cross-building from an x86_64 machine needs qemu registered first,
            // and it does NOT survive a reboot:
            //   npm run deploy:binfmt
            // Without it the deploy fails at image build ("exec format error" /
            // no arm64 platform). With it, expect a slower build: rolldown,
            // tailwind-oxide and lightningcss run their arm64 binaries under
            // emulation. Every native dep (duckdb, rolldown, oxide, lightningcss)
            // publishes linux-arm64-musl builds, so `npm ci` resolves on alpine.
            architecture: "arm64",
            cpu: "2 vCPU",
            memory: "8 GB",
            // previous DB + rebuilt DB + shard temp + 15GB spill
            storage: "100 GB",
            image: {
                context: ".",
                dockerfile: "deploy/update.Dockerfile",
            },
            link: [dbBucket],
            environment: {
                DB_S3_BUCKET: dbBucket.name,
                ECS_CLUSTER: cluster.nodes.cluster.arn,
                ECS_SERVICE: web.nodes.service.name,
            },
            permissions: [
                {
                    actions: ["ecs:UpdateService", "ecs:DescribeServices"],
                    resources: [web.nodes.service.id],
                },
            ],
        });

        new sst.aws.CronV2("UpdateDbCron", {
            // Mondays 03:00 UTC — adjust freely (daily/weekly/monthly)
            schedule: "cron(0 3 ? * MON *)",
            task: updateDb,
        });

        // Daily traffic aggregation. Tiny job (one Logs Insights query + small JSON
        // to S3), but it is the ONLY thing that turns 30-day CloudWatch retention
        // into permanent history — see deploy/analytics.ts. It backfills any missing
        // days it can still see, so a failed run self-repairs.
        const analytics = new sst.aws.Task("Analytics", {
            cluster,
            architecture: "arm64",
            cpu: "0.5 vCPU",
            memory: "1 GB",
            image: {
                context: ".",
                dockerfile: "deploy/analytics.Dockerfile",
            },
            link: [dbBucket],
            environment: {
                DB_S3_BUCKET: dbBucket.name,
                // Both names — the pinned one and the one the service really logs
                // to; the task drops whichever doesn't exist (see WEB_LOG_GROUP).
                LOG_GROUP: `${WEB_LOG_GROUP},${WEB_LOG_GROUP_LEGACY}`,
            },
            permissions: [
                {
                    actions: ["logs:StartQuery"],
                    resources: [
                        $interpolate`arn:aws:logs:${aws.getRegionOutput().name}:${aws.getCallerIdentityOutput().accountId}:log-group:${WEB_LOG_GROUP}:*`,
                        $interpolate`arn:aws:logs:${aws.getRegionOutput().name}:${aws.getCallerIdentityOutput().accountId}:log-group:${WEB_LOG_GROUP_LEGACY}:*`,
                    ],
                },
                {
                    // GetQueryResults/StopQuery don't support resource-level
                    // permissions (the query id is not an ARN); DescribeLogGroups
                    // is the startup existence check and is list-scoped by nature.
                    actions: ["logs:GetQueryResults", "logs:StopQuery", "logs:DescribeLogGroups"],
                    resources: ["*"],
                },
            ],
        });

        new sst.aws.CronV2("AnalyticsCron", {
            // 02:10 UTC daily — comfortably after midnight so the previous UTC day is
            // closed, and before UpdateDbCron so the two never contend for the cluster.
            // (Verified live 2026-07-18 via a temporary lunchtime schedule: from an
            // empty analytics/ prefix the cron backfilled all days and rebuilt the
            // summary — the pipeline self-heals from any gap within LOOKBACK_DAYS.)
            schedule: "cron(10 2 * * ? *)",
            task: analytics,
        });

        return {
            url: web.url,
            bucket: dbBucket.name,
        };
    },
});
