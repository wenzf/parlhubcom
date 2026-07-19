// ── Methodology page (/project/methodology) ──────────────────────────────────
//
// The page is data-driven: one entry per computed metric, grouped. `title`/`body`
// are LOCALIZED (looked up by `key` in loc_methodology.json); everything here — the
// anchor, formula, source paths and route patterns — is universal, so it lives in
// config rather than in prose. Source files link into REPO_URL at the default
// branch; the `anchor` is the stable deep-link target the per-chart MethodologyLink
// points at (must match a `methods.<key>` in loc_methodology and a chart's anchor).

import type { IconName } from "~/components/icons/opd_icons"

export type MethodologyMethod = {
    /** loc_methodology `methods.<key>` for the title + body. */
    key: string
    /** Stable #fragment on the page; the MethodologyLink `anchor`. */
    anchor: string
    icon: IconName
    /** Route pattern(s) the metric appears on (shown verbatim, not linked). */
    routes: string[]
    /** Repo-relative source paths, linked into REPO_URL. */
    sources: string[]
    /** External data sources / upstream libraries, linked verbatim (label shown as-is). */
    references?: { label: string; url: string }[]
    /** Universal formula lines (math notation; symbols defined in the loc body). */
    formula: string[]
}
export type MethodologyGroup = { key: string; methods: MethodologyMethod[] }

export const METHODOLOGY_GROUPS: MethodologyGroup[] = [
    {
        key: "parliaments",
        methods: [
            {
                key: "alignment",
                anchor: "alignment",
                icon: "scatter-chart",
                routes: ["/parliaments/:id/alignment"],
                sources: [
                    "app/server/db/sql/bodies/body_alignment_by_id.sql",
                    "app/server/db/analytics/body_alignment.ts",
                    "app/server/db/analytics/members.ts",
                ],
                formula: [
                    "agreement(a,b) = |{ ballots where vote_a = vote_b }| / |shared(a,b)|",
                    "distance      d = 1 − agreement",
                    "B  = −½ · J · (D∘D) · J            (double-centred squared distances)",
                    "B' = B + σ·I,   σ = maxᵢ Σⱼ |Bᵢⱼ|   (Gershgorin PSD shift)",
                    "coords = 2 most-positive eigenvectors of B'",
                ],
            },
            {
                key: "loyalty",
                anchor: "loyalty",
                icon: "scatter-chart",
                routes: ["/parliaments/:id/loyalty"],
                sources: [
                    "app/server/db/sql/bodies/body_loyalty_by_id.sql",
                    "app/server/db/analytics/body_loyalty.ts",
                ],
                formula: [
                    "group line      = strict plurality of {yes, no, abstain}   (≥ 4 voters, no tie)",
                    "dissent_rate(m) = dissents(m) / scored_ballots(m)           (m needs ≥ 10 ballots)",
                    "cohesion (AI)   = [ max(Y,N,A) − ½·((Y+N+A) − max(Y,N,A)) ] / (Y+N+A)",
                ],
            },
            {
                key: "lobby",
                anchor: "lobby",
                icon: "share-2",
                routes: ["/parliaments/:id/lobby"],
                sources: [
                    "app/server/db/sql/bodies/body_lobby_by_id.sql",
                    "app/server/db/analytics/body_lobby.ts",
                ],
                formula: [
                    "graph     = members ↔ organisations declared by ≥ 2 members",
                    "k         = √(area / n)                    (ideal edge length)",
                    "repulsion = k² / distance,   attraction = distance² / k",
                    "layout    = 300 Fruchterman–Reingold iterations, cooling ×0.985",
                ],
            },
            {
                key: "discussion",
                anchor: "discussion",
                icon: "scatter-chart",
                routes: ["/parliaments/:id/discussion", "/experiments/wordfish"],
                sources: [
                    "app/server/db/sql/bodies/body_discussion_speeches.sql",
                    "app/server/db/analytics/body_discussion.ts",
                    "app/lib/domain/wordfish.ts",
                ],
                references: [
                    { label: "stopwords-iso (de / fr / it)", url: "https://www.npmjs.com/package/stopwords-iso" },
                ],
                formula: [
                    "E[y_ij] = exp( α_i + ψ_j + β_j · θ_i )      (Wordfish, Poisson)",
                    "  θ_i = speaker position    α_i = talkativeness",
                    "  ψ_j = word frequency      β_j = word discrimination",
                    "η²  = SS_between(party) / SS_total          (θ variance explained by party)",
                ],
            },
        ],
    },
    {
        key: "people",
        methods: [
            {
                key: "vocabulary",
                anchor: "vocabulary",
                icon: "whole-word",
                routes: ["/people/:id/vocabulary"],
                sources: [
                    "app/server/db/sql/person/person_vocabulary_by_id.sql",
                    "app/server/db/analytics/person_vocabulary.ts",
                ],
                references: [
                    { label: "stopwords-iso (de / fr / it)", url: "https://www.npmjs.com/package/stopwords-iso" },
                ],
                formula: [
                    "tokens = lowercase(strip_html(text)) split on [^\\p{L}]+,  length > 1",
                    "keep   = tokens NOT IN stopwords[ speech language ]",
                    "result = top 120 words with count ≥ 2   →   squarified treemap",
                ],
            },
            {
                key: "coVoting",
                anchor: "co-voting",
                icon: "scatter-chart",
                routes: ["/people/:id/alignment"],
                sources: ["app/server/db/sql/person/person_alignment_by_id.sql"],
                formula: [
                    "agreement(subject, other) = matches / shared_ballots   (absent = absent)",
                    "keep pairs with shared_ballots ≥ 10   →   ranked neighbour list",
                ],
            },
            {
                key: "interests",
                anchor: "interests",
                icon: "briefcase",
                routes: ["/people/:id/interests"],
                sources: [
                    "app/components/opd_views/_shared/interestHelpers.ts",
                    "app/server/db/sql/person/person_interests_by_id.sql",
                ],
                formula: [
                    "class = paid    if harmonised code = paid",
                    "        unpaid  if code ∈ {unpaid, honorary}   else de/fr/it text match",
                    "        else unknown        (paid ≻ unpaid ≻ unknown, per organisation)",
                ],
            },
        ],
    },
    {
        key: "votings",
        methods: [
            {
                key: "hemicycle",
                anchor: "hemicycle",
                icon: "vote",
                routes: ["/votings/:id"],
                sources: [
                    "app/components/opd_views/votings/VotingChart.tsx",
                    "app/lib/export/colors.ts",
                ],
                formula: [
                    "rings grown until Σ capacity ≥ N voters",
                    "seats per ring = largest-remainder allocation weighted by ring radius",
                    "coordinates rounded to 2 dp   (identical SSR + client render)",
                ],
            },
        ],
    },
    {
        key: "site",
        methods: [
            {
                key: "traffic",
                anchor: "traffic",
                icon: "scatter-chart",
                routes: ["/project/traffic-stats"],
                sources: [
                    "app/lib/analytics/cube.ts",
                    "app/lib/analytics/agents.ts",
                    "deploy/analytics.ts",
                ],
                formula: [
                    "fact = (period, route, lang, visitor, device) → reqs, sum_ms, max_ms, hist[8]",
                    "avg  = sum_ms / reqs",
                    "p95  ≈ upper edge of the latency bucket holding the 95th request",
                ],
            },
        ],
    },
]