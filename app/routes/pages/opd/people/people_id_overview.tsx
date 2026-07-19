//import person_by_id from '../'
import person_by_id from '~/server/db/sql/person/person_by_id.sql?raw'
import macro_loc_sql from '~/server/db/sql/macro_loc.sql?raw'
import { useLoaderData, useRouteLoaderData } from "react-router";
import { db } from '~/server/db/core';

import PersonFull from '~/components/opd_views/person/PersonFull';
import type { PersonByIdResponse } from '../../../../../types/opd_client';
import PersonVotes from '~/components/opd_views/person/PersonVotes';
import PersonAccessBadges from '~/components/opd_views/person/PersonAccessBadges';
import PersonInterests from '~/components/opd_views/person/PersonInterests';
import PersonContributions from '~/components/opd_views/person/PersonContributions';
import PersonSpeeches from '~/components/opd_views/person/PersonSpeeches';
import PersonMemberships from '~/components/opd_views/person/PersonMemberships';
import PersonImages from '~/components/opd_views/person/PersonImages';
import { makeT, AttributionFooter } from '~/components/opd_views/opd_micros';
import { PAGE_CONFIG } from '~/configs/site.config';
import type { Route } from './+types/people_id_overview';
import { personMeta } from '~/lib/seo/metas';
import { contentLangs } from "~/server/content_langs.server";


export const handle = PAGE_CONFIG.NS_PEOPLE_OVERVIEW.handle


// DRAFT — rich, data-driven <title>/<meta> for /people/:id.
// The loader returns a raw `Response.json(...)`, so RR types `loaderData` as
// `never`; cast to the known payload shape ({ data: PersonByIdResponse, perf }).
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PersonByIdResponse | null }
    return personMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}


// 18613

export async function loader({ params, context }: Route.LoaderArgs) {
    const start = performance.now()


    await db.run(macro_loc_sql)
    const prepared = await db.prepare(person_by_id)

    function bindPersonFullParams(
        prepared: any,
        personId: number,
        langs: string[],
        limit: number
    ) {
        const l = Array.from({ length: 5 }, (_, i) => langs[i] ?? '')
        prepared.bindInteger(1, personId)  // $1
        prepared.bindVarchar(2, l[0])      // $2 l1
        prepared.bindVarchar(3, l[1])      // $3 l2
        prepared.bindVarchar(4, l[2])      // $4 l3
        prepared.bindVarchar(5, l[3])      // $5 l4
        prepared.bindVarchar(6, l[4])      // $6 l5
        prepared.bindInteger(7, limit)     // $7
    }

    bindPersonFullParams(prepared, Number(params.id), contentLangs(context, params.lang), 5)
    const reader = await prepared.runAndReadAll()
    const rows = reader.getRowObjectsJson() as unknown as any[];


    let data

    if (rows?.length) {
        data = rows[0] as PersonByIdResponse
    } else {
        data = null
    }

    const end = performance.now()

    // Unknown person id → the result layout renders EntityNotFound; send 404.
    return Response.json({ data, perf: end - start }, { status: data ? 200 : 404 });
}



export default function PeopleId() {
    const loaderData = useLoaderData()
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')




    //    let personById
    let personById = loaderData.data as PersonByIdResponse
    const t = makeT(layoutRouteLoaderData?.locs?.pages?.person?.labels ?? {})
    // if (RecordWithDataObjectSchema.allows(loaderData)
    //     && PersonByIdResponseSchema.allows(loaderData.data)
    // ) {
    //     personById = loaderData.data as PersonByIdResponse
    // } else {
    //     return null
    // }


    return (
        <>
            <div className="scroll-mt-24">
                <PersonFull
                    persons={personById.persons}
                    bodies={personById.bodies.items}
                    identities={personById.person_identities.items}
                    loc={layoutRouteLoaderData.locs?.pages?.person?.labels}
                    className="inset_page_transition"
                />
            </div>

            <PersonVotes
                persons={loaderData?.data?.persons}
                votes={loaderData?.data?.votes}
                identities={loaderData?.data?.person_identities?.items}
                bodies={loaderData?.data?.bodies?.items}
                affairs={loaderData?.data?.affairs?.items}
                groups={loaderData?.data?.groups?.items}
                meetings={loaderData?.data?.meetings?.items}
                loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                limit={25}
                variant="snippet"
            />

            <div id="interests" className="scroll-mt-24">
                <PersonInterests
                    persons={loaderData?.data?.persons}
                    identities={loaderData?.data?.person_identities?.items}
                    bodies={loaderData?.data?.bodies?.items}
                    interests={loaderData?.data?.interests}
                    loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                    variant="snippet"
                />
            </div>

            <div id="lobby" className="scroll-mt-24">
                <PersonAccessBadges
                    persons={loaderData?.data?.persons}
                    identities={loaderData?.data?.person_identities?.items}
                    bodies={loaderData?.data?.bodies?.items}
                    access_badges={loaderData?.data?.access_badges}
                    loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                    variant="snippet"
                />
            </div>

            <div id="speeches" className="scroll-mt-24">
                <PersonSpeeches
                    agendas={loaderData?.data?.agendas?.items}
                    persons={loaderData?.data?.persons}
                    meetings={loaderData?.data?.meetings?.items}
                    speeches={loaderData?.data?.speeches}
                    identities={loaderData?.data?.person_identities?.items}
                    bodies={loaderData?.data?.bodies?.items}
                    affairs={loaderData?.data?.affairs?.items}
                    loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                    variant="snippet"
                />
            </div>

            <div id="contributors" className="scroll-mt-24">
                <PersonContributions
                    persons={loaderData?.data?.persons}
                    identities={loaderData?.data?.person_identities?.items}
                    bodies={loaderData?.data?.bodies?.items}
                    contributors={loaderData?.data?.contributors}
                    groups={loaderData?.data?.groups?.items}
                    affairs={loaderData?.data?.affairs?.items}
                    loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                    variant="snippet"
                />
            </div>

            <div id="memberships" className="scroll-mt-24">
                <PersonMemberships
                    persons={loaderData?.data?.persons}
                    identities={loaderData?.data?.person_identities?.items}
                    bodies={loaderData?.data?.bodies?.items}
                    groups={loaderData?.data?.groups?.items}
                    membershipGroups={loaderData?.data?.membership_groups}
                    loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                    variant="snippet"
                />
            </div>

            <div id="images" className="scroll-mt-24">
                <PersonImages
                    persons={loaderData?.data?.persons}
                    identities={loaderData?.data?.person_identities?.items}
                    bodies={loaderData?.data?.bodies?.items}
                    person_images={loaderData?.data?.person_images}
                    loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                    variant="snippet"
                />
            </div>

            <AttributionFooter t={t} />
        </>
    )
}