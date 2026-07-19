// Daily traffic aggregation — runs as a Fargate task (sst.aws.Task "Analytics").
//
// CloudWatch keeps the app's request logs for 30 days and then deletes them
// forever. This task is the ONLY thing that reads them, and the only reason any
// history survives: it rolls each finished UTC day into a small immutable facts
// file on S3, which is the permanent archive. A day that is never aggregated is
// lost for good once it ages out.
//
//   1. list analytics/daily/*.json already on S3
//   2. for every finished day inside the retention window that has no file yet,
//      run one Logs Insights query and write analytics/daily/<date>.json
//   3. rebuild analytics/summary.json from ALL daily files — the compact,
//      dictionary-encoded cube /project/traffic-stats reads
//
// Step 2 backfills rather than only doing yesterday, so a run that fails (or a
// container that never started) repairs itself on the next run instead of
// silently punching a permanent hole in the archive. Only a gap longer than
// LOOKBACK_DAYS is unrecoverable.
//
// Two layers, and the split is the whole design:
//
//   • daily files are FACTS — immutable, never rewritten (same rule as the DB
//     snapshots), and keyed by the RAW user-agent. No interpretation is baked in.
//   • summary.json is a VIEW — derived, rebuilt from scratch every run, with
//     ~/lib/analytics/agents applied to turn user-agents into visitor/device.
//
// So the classifier can be improved whenever a new crawler shows up and the whole
// archive re-derives from the facts on the next run. Had the daily files stored
// "bot:other" instead of the user-agent, that bot would have been anonymous
// forever, because the logs proving otherwise are already gone.
//
// Env: LOG_GROUP + DB_S3_BUCKET (required).

import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    GetQueryResultsCommand,
    StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

import { classifyDevice, classifyVisitor } from "~/lib/analytics/agents";
import { PAGE_CONFIG, SITE_LANGS } from "~/configs/site.config";

const BUCKET = process.env.DB_S3_BUCKET;
const LOG_GROUP = process.env.LOG_GROUP;
if (!BUCKET) throw new Error("DB_S3_BUCKET is required");
if (!LOG_GROUP) throw new Error("LOG_GROUP is required");

/**
 * LOG_GROUP is a comma-separated LIST of log-group names; one Logs Insights query
 * runs over all of them (StartQuery `logGroupNames`). Names that don't exist are
 * dropped at startup instead of failing the whole run — a group name can lag
 * reality (sst.config.ts pins "/parlhub/web", but the deployed SST version ignores
 * `logging.name` on a Service, so the web app still writes to the SST-generated
 * group). Listing both means whichever exists gets queried, and if a rename ever
 * does land, the overlap window keeps the split day whole.
 */
const REQUESTED_LOG_GROUPS = LOG_GROUP.split(",").map((s) => s.trim()).filter(Boolean);
/** Resolved at startup: the requested groups that actually exist. */
let LOG_GROUPS: string[] = [];

async function resolveLogGroups(): Promise<string[]> {
    const names: string[] = [];
    for (const name of REQUESTED_LOG_GROUPS) {
        const res = await logs.send(new DescribeLogGroupsCommand({ logGroupNamePrefix: name }));
        if (res.logGroups?.some((g) => g.logGroupName === name)) names.push(name);
        else console.warn(`analytics: log group ${name} does not exist — skipping`);
    }
    if (!names.length)
        throw new Error(`none of the configured log groups exist: ${REQUESTED_LOG_GROUPS.join(", ")}`);
    return names;
}

const DAILY_PREFIX = "analytics/daily/";
const SUMMARY_KEY = "analytics/summary.json";
/** How far back to look for gaps. Must stay under the log group's 30d retention. */
const LOOKBACK_DAYS = 25;
/**
 * First day the archive covers. Logs older than this predate the user-agent in
 * morgan's format (added with server.js), so the parse below finds no `ua` and
 * the day yields zero rows. Without this floor the backfill would write an
 * immutable "no traffic" file for days that were in fact busy — a permanent lie,
 * since the raw logs proving otherwise expire. Never move this backwards.
 */
const ARCHIVE_START = "2026-07-15";
/** Days newer than this keep per-day grain in the summary; older roll up to months. */
const SUMMARY_FULL_DAYS = 90;
/** Upper bound of latency buckets, in ms. Counts per bucket are additive, so the
 *  client can derive an approximate p95 at ANY slice — a stored p95 could not be
 *  re-aggregated (percentiles don't merge). */
const LATENCY_BUCKETS = [50, 100, 200, 500, 1000, 2000, 5000, Infinity];
const N_BUCKETS = LATENCY_BUCKETS.length;

const s3 = new S3Client({});
const logs = new CloudWatchLogsClient({});

/**
 * Non-default UI language prefixes (`de|fr|it|…`), derived from SITE_LANGS so the
 * query's prefix-stripping tracks the languages actually served. Without this a
 * request to `/pt/people` would reduce to route "pt" and then fall into (other);
 * hard-coding the list let it drift the moment a language was added.
 */
const LANG_ALT = SITE_LANGS.filter((l) => !l.default).map((l) => l.lang_param).join("|");

/**
 * Route folding for the summary VIEW (not the daily facts).
 *
 * The route dimension is the URL's first path segment, so random TOP-LEVEL paths
 * — a scanner probing `/wp-login.php`, a mistyped URL, a 404 sweep — each become
 * a distinct route and would grow summary.json without bound. Anything not in the
 * known set folds into one `(other)` row per period×lang×visitor×device, so junk
 * paths cost a single bucket no matter how many distinct URLs are tried.
 *
 * Content routes are DERIVED from PAGE_CONFIG's first path segment (people,
 * parliaments, project, …) so they can't drift from the real routes; the handful
 * of legitimate non-page top-level paths (root resource routes in app/routes.ts +
 * `/health` from server.js) are listed explicitly and stay named. Folding is a
 * property of the view only — the immutable daily files keep the raw route, so
 * the known set can change and the whole archive re-derives on the next rebuild.
 */
const OTHER_ROUTE = "(other)";
const KNOWN_ROUTES = new Set<string>([
    "(home)",
    "robots.txt", "sitemap.xml", "sitemaps", "carbon.txt", "llms.txt",
    "health", ".well-known", "actions",
    ...Object.values(PAGE_CONFIG)
        .map((p) => p.absolute_path?.split("/")[1])
        .filter((s): s is string => Boolean(s)),
]);
const canonRoute = (route: string) => (KNOWN_ROUTES.has(route) ? route : OTHER_ROUTE);

/** A day's facts: one row per route × lang × raw user-agent. */
type Row = {
    route: string;
    lang: string;
    ua: string;
    reqs: number;
    /** SUM, not average — averages can't be re-aggregated. avg = sum_ms / reqs. */
    sum_ms: number;
    max_ms: number;
    /** Counts per LATENCY_BUCKETS entry. */
    hist: number[];
};

/**
 * One row per route × lang × user-agent for a single day.
 *
 * Parses morgan's format (see server.js):
 *   GET /fr/docs/123 200 - - 391.2 ms "Mozilla/5.0 ... ClaudeBot/1.0 ..."
 *
 * The path is logged in full (needed to debug a specific slow page) and reduced
 * to its first segment here. English lives at the root with no prefix while
 * de/fr/it/es are prefixed, so the first segment is a language ONLY if it looks
 * like one — otherwise it is already the route and the language is English.
 *
 * The user-agent is grouped RAW: classifying it here would freeze today's
 * understanding of it into an immutable file. Measured cardinality is ~110
 * route×lang×ua combinations and ~23 distinct agents per day, far under the
 * 10,000-row ceiling.
 */
const QUERY = `
fields @message
| parse @message "* * * * - * ms \\"*\\"" as method, path, status, len, dur, ua
| filter ispresent(path)
| parse path /^\\/(?<s1>[^\\/?#]*)(?:\\/(?<s2>[^\\/?#]*))?/
| fields if(s1 like /^(${LANG_ALT})$/, s1, "en") as lang
| fields if(s1 like /^(${LANG_ALT})$/, s2, s1) as sec
| fields if(sec = "", "(home)", sec) as route
| fields if(dur < 50, 1, 0) as h0, if(dur >= 50 and dur < 100, 1, 0) as h1,
         if(dur >= 100 and dur < 200, 1, 0) as h2, if(dur >= 200 and dur < 500, 1, 0) as h3,
         if(dur >= 500 and dur < 1000, 1, 0) as h4, if(dur >= 1000 and dur < 2000, 1, 0) as h5,
         if(dur >= 2000 and dur < 5000, 1, 0) as h6, if(dur >= 5000, 1, 0) as h7
| stats count() as reqs, sum(dur) as sum_ms, max(dur) as max_ms,
        sum(h0) as b0, sum(h1) as b1, sum(h2) as b2, sum(h3) as b3,
        sum(h4) as b4, sum(h5) as b5, sum(h6) as b6, sum(h7) as b7
        by route, lang, ua
| limit 10000`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Run one Logs Insights query over [start, end) and return its rows. */
async function queryDay(date: string): Promise<Row[]> {
    const start = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
    const end = start + 86_400;

    const { queryId } = await logs.send(
        new StartQueryCommand({
            logGroupNames: LOG_GROUPS,
            startTime: start,
            endTime: end,
            queryString: QUERY,
            limit: 10_000,
        }),
    );
    if (!queryId) throw new Error(`no queryId for ${date}`);

    // Insights is async; poll until it leaves Running/Scheduled.
    for (let i = 0; i < 150; i++) {
        const res = await logs.send(new GetQueryResultsCommand({ queryId }));
        if (res.status === "Running" || res.status === "Scheduled") {
            await sleep(2000);
            continue;
        }
        if (res.status !== "Complete") throw new Error(`query for ${date} ended ${res.status}`);

        return (res.results ?? []).map((r) => {
            const f: Record<string, string> = {};
            for (const c of r) if (c.field) f[c.field] = c.value ?? "";
            return {
                route: f.route || "(none)",
                lang: f.lang || "en",
                ua: f.ua || "-",
                reqs: Number(f.reqs ?? 0),
                sum_ms: Math.round(Number(f.sum_ms ?? 0)),
                max_ms: Math.round(Number(f.max_ms ?? 0)),
                hist: Array.from({ length: N_BUCKETS }, (_, i) => Number(f[`b${i}`] ?? 0)),
            };
        });
    }
    throw new Error(`query for ${date} timed out`);
}

const getJson = async (key: string) => {
    try {
        const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        return JSON.parse(await r.Body!.transformToString());
    } catch {
        return null;
    }
};

const putJson = (key: string, body: unknown) =>
    s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: JSON.stringify(body),
            ContentType: "application/json",
        }),
    );

/**
 * Rebuild summary.json from every daily file, applying the agent classifier.
 *
 * Full rebuild rather than an append: it costs one GET per day-file (trivial at
 * this scale) and makes the output a pure function of the immutable facts plus the
 * current classifier. That is what lets the classifier change — improve
 * ~/lib/analytics/agents, run the task, and the entire history re-derives with the
 * new names. A bad run can't corrupt anything; re-running fixes it.
 *
 * Rows are dictionary-encoded so a year (~22k rows) stays ~250KB gzipped and the
 * page can pivot every dimension client-side from one fetch.
 */
async function rebuildSummary() {
    const keys: string[] = [];
    let token: string | undefined;
    do {
        const page = await s3.send(
            new ListObjectsV2Command({ Bucket: BUCKET, Prefix: DAILY_PREFIX, ContinuationToken: token }),
        );
        for (const o of page.Contents ?? []) if (o.Key?.endsWith(".json")) keys.push(o.Key);
        token = page.NextContinuationToken;
    } while (token);
    keys.sort();

    const cutoff = dayKey(new Date(Date.now() - SUMMARY_FULL_DAYS * 86_400_000));
    const routes: string[] = [];
    const langs: string[] = [];
    const visitors: string[] = [];
    const devices: string[] = [];
    const periods: string[] = [];
    const idx = (arr: string[], v: string) => {
        const i = arr.indexOf(v);
        return i === -1 ? arr.push(v) - 1 : i;
    };
    // One classify() per distinct agent string, not per row.
    const seen = new Map<string, { visitor: string; device: string }>();
    const classify = (ua: string) => {
        let c = seen.get(ua);
        if (!c) seen.set(ua, (c = { visitor: classifyVisitor(ua), device: classifyDevice(ua) }));
        return c;
    };

    // period|route|lang|visitor|device -> merged measures
    const merged = new Map<string, number[]>();
    for (const key of keys) {
        const day = await getJson(key);
        if (!day?.rows) continue;
        // Days past the full-grain window collapse to their month, so the file
        // stops growing without losing the long-range shape.
        const period: string = day.date >= cutoff ? day.date : day.date.slice(0, 7);
        for (const r of day.rows as Row[]) {
            const { visitor, device } = classify(r.ua);
            const route = canonRoute(r.route);
            // A junk path carries no real site language — the query's prefix
            // fallback would have parsed it as "en", silently inflating English in
            // the language view. Fold it to "na", the same not-applicable value the
            // device dimension already uses for non-browsers.
            const lang = route === OTHER_ROUTE ? "na" : r.lang;
            const k = `${idx(periods, period)}|${idx(routes, route)}|${idx(langs, lang)}|${idx(visitors, visitor)}|${idx(devices, device)}`;
            const prev = merged.get(k);
            if (!prev) {
                merged.set(k, [r.reqs, r.sum_ms, r.max_ms, ...r.hist]);
            } else {
                prev[0] += r.reqs;
                prev[1] += r.sum_ms;
                prev[2] = Math.max(prev[2], r.max_ms);
                for (let i = 0; i < r.hist.length; i++) prev[3 + i] += r.hist[i];
            }
        }
    }

    const rows = [...merged.entries()].map(([k, m]) => [...k.split("|").map(Number), ...m]);
    await putJson(SUMMARY_KEY, {
        schema: 1,
        generated_at: new Date().toISOString(),
        // avg is derived (sum_ms/reqs) and p95 from the buckets — neither is stored.
        cols: ["period", "route", "lang", "visitor", "device", "reqs", "sum_ms", "max_ms", "hist0..7"],
        buckets: LATENCY_BUCKETS.map((b) => (b === Infinity ? null : b)),
        periods,
        routes,
        langs,
        visitors,
        devices,
        rows,
    });
    console.log(
        `analytics: summary.json rebuilt — ${rows.length} rows, ${periods.length} periods, ` +
            `${seen.size} distinct agents -> ${visitors.length} visitor classes`,
    );
}

const run = async () => {
    LOG_GROUPS = await resolveLogGroups();
    console.log(`analytics: querying log group(s): ${LOG_GROUPS.join(", ")}`);

    const existing = new Set<string>();
    let token: string | undefined;
    do {
        const page = await s3.send(
            new ListObjectsV2Command({ Bucket: BUCKET, Prefix: DAILY_PREFIX, ContinuationToken: token }),
        );
        for (const o of page.Contents ?? []) {
            const m = o.Key?.match(/(\d{4}-\d{2}-\d{2})\.json$/);
            if (m) existing.add(m[1]);
        }
        token = page.NextContinuationToken;
    } while (token);

    // Only finished days: today is still accumulating, so aggregating it would
    // freeze a partial count into an immutable file.
    const today = dayKey(new Date());
    const wanted: string[] = [];
    for (let i = 1; i <= LOOKBACK_DAYS; i++) {
        const d = dayKey(new Date(Date.now() - i * 86_400_000));
        if (d !== today && d >= ARCHIVE_START && !existing.has(d)) wanted.push(d);
    }
    wanted.sort();

    if (!wanted.length) console.log("analytics: no missing days");
    else console.log(`analytics: aggregating ${wanted.length} missing day(s): ${wanted.join(", ")}`);

    let wrote = 0;
    for (const date of wanted) {
        const rows = await queryDay(date);
        if (!rows.length) {
            // A genuinely empty day still gets a file — otherwise every future run
            // retries it forever, and it never becomes "done".
            console.log(`analytics: ${date} — no rows (writing empty marker)`);
        }
        await putJson(`${DAILY_PREFIX}${date}.json`, {
            schema: 1,
            date,
            generated_at: new Date().toISOString(),
            rows,
        });
        wrote++;
        console.log(
            `analytics: ${date} — ${rows.length} rows, ${rows.reduce((s, r) => s + r.reqs, 0)} requests, ` +
                `${new Set(rows.map((r) => r.ua)).size} distinct agents`,
        );
    }

    if (wrote || !wanted.length) await rebuildSummary();
};

run().catch((err) => {
    console.error("analytics: FAILED —", err);
    process.exit(1);
});
