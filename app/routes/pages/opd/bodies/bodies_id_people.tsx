import * as React from "react"
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/bodies_id_people"
import { PAGE_CONFIG } from "~/configs/site.config"

import { runPersonPaginatedFiltered } from "~/server/db/core"
import bodyPeopleSql from "~/server/db/sql/bodies/body_people_by_id.sql?raw"
import type { BodyChamber, BodyChamberMember, BodyPeopleResult } from "@/types/opd_paginated_client"
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router"
import { parseOffsetParam } from "~/lib/urls/params"

import { parseRaw, resolveOrderBy, resolveLimit } from "~/lib/dimensions/filters"
import { bodyPeopleDescriptor, withCodeOptions } from "~/lib/dimensions/descriptors"
import PeopleList from "~/components/opd_views/person/PeopleList"
import VotingChart from "~/components/opd_views/votings/VotingChart"
import { bodyDimensionMeta } from "~/lib/seo/metas"
import { Card, CardContent } from "@/components/ui/card"
import { makeT, SectionCardHeader } from "~/components/opd_views/opd_micros"

export const handle = PAGE_CONFIG.NS_BODIES_PEOPLE.handle

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return bodyDimensionMeta(ld?.data, "people", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now()

    // SQL localization priority: the page language first, then the standard CH
    // fallbacks. loc() reads up to 5 slots ($2..$6); duplicates are harmless.
    const langs = contentLangs(context, params.lang)

    // URL → validated criteria (unknown sorts / out-of-set facets / bad input dropped).
    const criteria = parseRaw(bodyPeopleDescriptor, url.searchParams)
    const limit = resolveLimit(bodyPeopleDescriptor, criteria)
    const offset = parseOffsetParam(url.searchParams.get("offset") ?? 0, limit) ?? 0

    // PERSON family runner, but $1 is the BODY id (the scope slot). The body facet
    // is fixed to the route id inside body_people_by_id.sql; the descriptor only
    // contributes $9..$13 (search / active / gender / party / chamber).
    const data = await runPersonPaginatedFiltered<NonNullable<BodyPeopleResult>>(
        bodyPeopleSql,
        {
            personId: Number(params.id), // $1 = the body id (scope)
            langs,
            limit, // $7
            offset, // $8
            filters: bodyPeopleDescriptor.toSqlParams(criteria), // $9..$11
            orderBy: resolveOrderBy(bodyPeopleDescriptor, criteria),
        },
    )

    return Response.json({ data, perf: performance.now() - start })
}

/** SQL chamber-member struct → VotingChartVote (roster mode, no votes). */
function toSeat(m: any) {
    return {
        person_id: m.id,
        fullname: m.fullname,
        party: m.party,
        party_key: m.party_harmonized_wikidata_id,
        parliamentary_group: m.parliamentary_group_name ?? null,
        parliament_seat: m.parliament_seat ?? null,
        parliament_sector: m.parliament_sector ?? null,
    }
}

export default function BodyPeople() {
    const loaderData = useLoaderData()
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const [params] = useSearchParams()

    // Mirror the loader so the pager + page size match the server's slice.
    const limit = resolveLimit(bodyPeopleDescriptor, parseRaw(bodyPeopleDescriptor, params))
    const offset = parseOffsetParam(params.get("offset") ?? 0, limit) ?? 0

    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels as
        | Record<string, string>
        | undefined
    const locale = layoutRouteLoaderData?.locale ?? "de-CH"
    const t = React.useMemo(() => makeT(loc ?? {}), [loc])

    const body = loaderData?.data?.body
    const chambers: BodyChamber[] = loaderData?.data?.chambers ?? []
    const executives: BodyChamber[] = loaderData?.data?.executives ?? []
    const multiChamber = chambers.length >= 2

    // Multi-chamber body (CH federal): one hemicycle PER CHAMBER from the
    // membership rosters — never pooled, never mixing the executive in.
    const rostersByChamber = React.useMemo(() => {
        const m = new Map<number, ReturnType<typeof toSeat>[]>()
        if (!multiChamber) return m
        for (const cm of (loaderData?.data?.chamber_members?.items ?? []) as BodyChamberMember[]) {
            const arr = m.get(cm.chamber_id)
            if (arr) arr.push(toSeat(cm))
            else m.set(cm.chamber_id, [toSeat(cm)])
        }
        return m
    }, [multiChamber, loaderData?.data?.chamber_members?.items])

    // Single-chamber body: the jurisdiction-wide active roster, as before.
    const members = ((loaderData?.data?.members?.items ?? []) as any[]).map(toSeat)

    // Chamber facet: options injected for multi-chamber bodies, dropped otherwise
    // (same pattern as BodyVotings; here the filter matches memberships).
    const descriptor = React.useMemo(
        () =>
            multiChamber
                ? withCodeOptions(
                    bodyPeopleDescriptor,
                    "chamber",
                    chambers as unknown as Record<string, unknown>[],
                    "id",
                    (r) => {
                        const c = r as unknown as BodyChamber
                        return c.name ?? c.abbreviation ?? String(c.id)
                    },
                )
                : {
                    ...bodyPeopleDescriptor,
                    facets: bodyPeopleDescriptor.facets.filter(
                        (f) => !(f.kind === "select" && f.param === "chamber"),
                    ),
                },
        [multiChamber, chambers],
    )

    const showChart = body?.has_parliament === true && members.length > 0

    return (
        <div className="space-y-6">
            {multiChamber ? (
                <>
                    {/* At-a-glance composition: chambers + executive, per council. */}
                    <Card>
                        <SectionCardHeader
                            icon="users-2"
                            title={t("body_composition_title")}
                        />
                        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
                            {[...chambers, ...executives].map((c) => (
                                <span
                                    key={c.id}
                                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                                >
                                    <span className="font-medium">{c.name ?? c.abbreviation}</span>
                                    <span className="tabular-nums">{c.seats ?? "—"}</span>
                                    {executives.includes(c) ? (
                                        <span className="text-muted-foreground">
                                            {t("body_executive")}
                                        </span>
                                    ) : null}
                                </span>
                            ))}
                        </CardContent>
                    </Card>
                    {chambers.map((c) => {
                        const roster = rostersByChamber.get(c.id) ?? []
                        if (roster.length === 0) return null
                        return (
                            <VotingChart
                                key={c.id}
                                votes={roster}
                                legislativeSeats={c.seats ?? roster.length}
                                bodyTitle={c.name ?? c.abbreviation ?? null}
                                chartOnly
                                headerTitle={c.name ?? c.abbreviation ?? String(c.id)}
                                iconName="users-2"
                                loc={loc}
                                locale={locale}
                            />
                        )
                    })}
                </>
            ) : showChart ? (
                <VotingChart
                    votes={members}
                    legislativeSeats={body?.legislative_seats ?? null}
                    bodyTitle={body?.legislative_name ?? body?.name ?? null}
                    chartOnly
                    titleKey="body_composition_title"
                    iconName="users-2"
                    loc={loc}
                    locale={locale}
                />
            ) : null}
            <PeopleList
                people={loaderData?.data?.people}
                identities={loaderData?.data?.person_identities?.items}
                bodies={loaderData?.data?.bodies?.items}
                descriptor={descriptor}
                titleKey="body_people_directory_title"
                loc={loc}
                offset={offset}
                limit={limit}
            />
        </div>
    )
}