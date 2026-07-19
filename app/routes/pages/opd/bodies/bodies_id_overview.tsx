import { localizedPath } from "~/lib/lang"
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/bodies_id_overview"
import { PAGE_CONFIG } from "~/configs/site.config"

import { runByIdLocalized } from "~/server/db/core"
import bodySql from "~/server/db/sql/bodies/body_by_id.sql?raw"
import type { BodyByIdResult } from "@/types/opd_client"
import type { BodyChamber } from "@/types/opd_paginated_client"
import { useLoaderData, useParams, useRouteLoaderData } from "react-router"

import BodyFull from "~/components/opd_views/bodies/BodyFull"
import BodyVotings from "~/components/opd_views/bodies/BodyVotings"
import BodyAffairs from "~/components/opd_views/bodies/BodyAffairs"
import BodyTexts from "~/components/opd_views/bodies/BodyTexts"
import { bodyMeta } from "~/lib/seo/metas"
import { Card, CardContent } from "@/components/ui/card"
import { makeT, SectionCardHeader, InternalLink, MetaItem, AttributionFooter } from "~/components/opd_views/opd_micros"

export const handle = PAGE_CONFIG.NS_BODIES_OVERVIEW.handle

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return bodyMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ params, context }: Route.LoaderArgs) {
    const start = performance.now()


    // SQL localization priority: the page language first, then the standard CH
    // fallbacks. loc() reads up to 5 slots ($2..$6); duplicates are harmless.
    const langs = contentLangs(context, params.lang)

    const data = await runByIdLocalized<NonNullable<BodyByIdResult>>(bodySql, {
        id: Number(params.id),
        langs,
    })

    // Unknown body id → the result layout renders EntityNotFound; send 404.
    return Response.json({ data, perf: performance.now() - start }, { status: data ? 200 : 404 })
}

export default function BodyOverview() {
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const loaderData = useLoaderData()
    const params = useParams()


    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels
    const t = makeT(loc ?? {})
    const bodyId = Number(params.id)
    const votings = loaderData?.data?.votings
    const affairs = loaderData?.data?.affairs
    const texts = loaderData?.data?.texts
    const chambers: BodyChamber[] = loaderData?.data?.chambers ?? []

    return (
        <div className="space-y-6 inset_page_transition">
            <BodyFull
                body={loaderData?.data?.body}
                loc={loc}
            />

            {/* Chambers — multi-chamber bodies only (CH federal): one feed-style row
                per voting chamber, seat count from active memberships, linking to the
                chamber's own /groups/:id page. Single-chamber bodies skip this. */}
            {chambers.length >= 2 ? (
                <Card>
                    <SectionCardHeader icon="landmark" title={t("body_chambers_title")} count={chambers.length} />
                    <CardContent>
                        <ul className="divide-y divide-border/60">
                            {chambers.map((c) => (
                                <li key={c.id} className="py-3">
                                    <div className="min-w-0 space-y-1">
                                        <div className="text-sm font-medium leading-snug">
                                            <InternalLink to={localizedPath(params.lang, "NS_GROUPS_OVERVIEW", { id: String(c.id) })}>
                                                <span>{c.name ?? c.abbreviation ?? String(c.id)}</span>
                                            </InternalLink>
                                        </div>
                                        {c.seats != null ? (
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                <MetaItem icon="users-2">
                                                    <span className="tabular-nums">{c.seats}</span> {t("body_seats")}
                                                </MetaItem>
                                            </div>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            ) : null}

            {/* Activity snippets — newest few, each linking to its full feed. Hidden
                when the body has none (an empty institution shows just its profile).
                The id anchors back the sidebar overview hashes ("votings" / "affairs");
                scroll-mt keeps the heading clear of the sticky header. */}
            {votings && votings.total_count > 0 ? (
                <div id="votings" className="scroll-mt-24">
                    <BodyVotings
                        votings={votings}
                        loc={loc}
                        variant="snippet"
                        bodyId={bodyId}
                    />
                </div>
            ) : null}

            {affairs && affairs.total_count > 0 ? (
                <div id="affairs" className="scroll-mt-24">
                    <BodyAffairs
                        affairs={affairs}
                        loc={loc}
                        variant="snippet"
                        bodyId={bodyId}
                    />
                </div>
            ) : null}

            {texts && texts.total_count > 0 ? (
                <div id="texts" className="scroll-mt-24">
                    <BodyTexts
                        texts={texts}
                        loc={loc}
                        variant="snippet"
                        bodyId={bodyId}
                    />
                </div>
            ) : null}

            <AttributionFooter t={t} />
        </div>
    )
}