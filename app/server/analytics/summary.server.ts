// summary.server.ts            → ~/server/analytics/summary.server.ts
//
// Fetches the traffic cube that deploy/analytics.ts writes daily to
// s3://<DB_S3_BUCKET>/analytics/summary.json.
//
// Plain fetch(), no AWS SDK: that object is the ONE key made world-readable by the
// bucket policy in sst.config.ts (it is public anyway — /project/traffic-stats
// renders it), which keeps @aws-sdk/client-s3 out of the app's runtime deps and
// out of the SSR bundle. Every other key in that bucket, including the daily files
// with their raw user-agents, stays private.
//
// Fetching S3 is not the boot-deadlock hazard that fetching the site's OWN url is
// (see docs/conventions.md): S3 is up regardless of whether this container has
// passed its health check yet.
//
// Cached in module scope with a TTL. The task rewrites the object once a day, and
// the container runs for days, so caching per-boot would go stale and caching not
// at all would hit S3 on every request.

import type { Cube } from "~/lib/analytics/cube";

const TTL_MS = 60 * 60 * 1000;
/** Don't let a hung S3 stall the page; the caller falls back. */
const TIMEOUT_MS = 5_000;

let cache: { at: number; cube: Cube | null } | null = null;

/**
 * The live cube, or null when there is none to show.
 *
 * Null means "no archive yet" (nothing written before ARCHIVE_START) or that S3
 * could not be reached. The caller decides what to render — this never invents
 * data to paper over a failure.
 */
export async function loadSummary(): Promise<Cube | null> {
    const url = process.env.ANALYTICS_SUMMARY_URL;
    if (!url) return null;

    if (cache && Date.now() - cache.at < TTL_MS) return cache.cube;

    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        // A 403/404 is the normal state before the first daily run lands, not an
        // error worth logging on every request.
        if (!res.ok) {
            cache = { at: Date.now(), cube: null };
            return null;
        }
        const cube = (await res.json()) as Cube;
        // Guard against a half-written or schema-drifted object rendering as an
        // empty page: treat anything unrecognisable as "no data".
        if (!Array.isArray(cube?.rows) || !Array.isArray(cube?.periods)) {
            console.warn("analytics: summary.json has an unexpected shape — ignoring");
            cache = { at: Date.now(), cube: null };
            return null;
        }
        cache = { at: Date.now(), cube };
        return cube;
    } catch (err) {
        console.warn("analytics: could not fetch summary.json —", (err as Error).message);
        // Cache the miss too, so an S3 outage doesn't mean a fetch per request.
        cache = { at: Date.now(), cube: null };
        return null;
    }
}
