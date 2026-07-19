// agents.ts                            → ~/lib/analytics/agents.ts
//
// Classify a user-agent string into the `visitor` and `device` dimensions of the
// traffic cube. Used by deploy/analytics.ts when it builds analytics/summary.json
// from the daily facts.
//
// Deliberately NOT applied when the daily files are written: those store the raw
// user-agent, and this runs at summary-rebuild time. CloudWatch drops the raw logs
// after 30 days, so a classification baked into an immutable daily file could
// never be revised — a bot lumped into "bot:other" today would stay anonymous
// forever. Keeping the raw string in the facts means this function can be improved
// at any point and the whole archive re-derived from it.
//
// Detection vs naming — two different jobs, two different tools:
//
//   • isbot() decides bot-or-not. Its 205 entries are *heuristics*, not a
//     registry: ClaudeBot matches `(?<! cu)bots?(?:\b|_)`, while CensysInspect and
//     libredtail-http BOTH match `(?<!(?:lib))http`. So isbot cannot say which bot
//     it found — isbotMatch() returns fragments like "Bot" or "grab" — but it
//     recognises agents no hand-written pattern here would (zgrab, libredtail-http,
//     python-httpx), and it is maintained upstream.
//   • BOT_NAME extracts the name, when the agent follows the usual convention of
//     announcing itself as `<Name>/<version>`. Anything isbot flags but this can't
//     name becomes "bot:other" — the honest answer, and revisable later.

import { isbot } from "isbot";

/** Requests the load balancer makes to /health, ~5,760/day. Ours, not a visitor. */
const HEALTHCHECK = /^ELB-HealthChecker\//;

/**
 * The agent's self-declared name.
 *
 * Matches the `<Name>` in `<Name>/<version>`, for the conventional suffixes bots
 * actually use — `ClaudeBot/1.0`, `GPTBot/1.0`, `Googlebot/2.1`, `CensysInspect/1.1`,
 * `facebookexternalhit/1.1`. The leading segment is optional (`*`, not `+`) so a
 * bare token like `zgrab` still matches. Version is deliberately excluded: keying
 * on it would split one crawler into a new series on every release.
 */
const BOT_NAME = /([A-Za-z0-9._-]*(?:[Bb]ot|[Ss]pider|[Cc]rawler|[Ss]canner|Inspect|externalhit|zgrab))/;

/** HTTP libraries and CLIs — bots by isbot's reckoning, but not crawlers. */
const TOOL = /^(curl|wget|python-requests|python-httpx|Python|Go-http-client|libredtail-http|node-fetch|axios|okhttp|Java|PostmanRuntime)\b/i;

/** Coarse visitor class. `bot:*` names the crawler where the UA allows. */
export function classifyVisitor(ua: string): string {
    if (!ua || ua === "-") return "unknown";
    if (HEALTHCHECK.test(ua)) return "internal:healthcheck";
    // isbot flags tools too; split them out first so "tool" doesn't read as a crawler.
    if (TOOL.test(ua)) return "tool";
    if (!isbot(ua)) return "browser";
    const name = BOT_NAME.exec(ua)?.[1];
    return name ? `bot:${name}` : "bot:other";
}

/**
 * Device class, inferred from the UA. "na" for anything that isn't a browser —
 * a crawler has no device, and guessing one from the OS token it copies out of a
 * browser UA would invent a fact.
 */
export function classifyDevice(ua: string): string {
    if (!ua || classifyVisitor(ua) !== "browser") return "na";
    if (/iPad|Tablet/.test(ua)) return "tablet";
    if (/iPhone|Android|Mobile/.test(ua)) return "mobile";
    if (/Windows|Macintosh|X11|Linux/.test(ua)) return "desktop";
    return "na";
}
