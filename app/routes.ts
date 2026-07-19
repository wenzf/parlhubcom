import { type RouteConfig, index, route, layout, prefix } from "@react-router/dev/routes";

import { URL_PATH_SEGMENTS } from './configs/site.config'

const { PEOPLE, VOTES, LOBBY, MEMBERSHIPS, VOTINGS,
    CONTRIBUTIONS, INTERESTS, SPEECHES, IMAGES, BODIES, AFFAIRS, CONTRIBUTORS, DOCS, EVENTS, AGENDAS, TEXTS,
    GROUPS, MEETINGS, VOCABULARY, LOYALTY, ALIGNMENT, ORGANIZATIONS, ABOUT, FAQ, PROJECT, DATA_MAP, DATA_GUIDE, METHODOLOGY, IMPRINT, START, DISCUSSION,
    EXPERIMENTS, WORDFISH, SUSTAINABILITY, ACCESSIBILITY, TRAFFIC_STATS } = URL_PATH_SEGMENTS

export default [
    // Answer Chrome DevTools' automatic /.well-known/appspecific/com.chrome.devtools.json
    // probe with a clean 404 (kept OUTSIDE the ':lang?' prefix so it matches at the root).
    route("actions/cu-settings", "./routes/actions_and_loaders/site_set_settings.tsx"),
    route(".well-known/appspecific/com.chrome.devtools.json", "./routes/wellknown_devtools.ts"),
    // SEO resource routes — root-level, OUTSIDE ':lang?' so there is one robots
    // file / sitemap index. `/sitemaps/:file` serves the paged child <urlset>s.
    route("robots.txt", "./routes/sitemap/robots.tsx"),
    // /carbon.txt — sustainability disclosure (carbontxt.org). Root-level and
    // outside ':lang?' for the same reason as robots: the spec mandates one file
    // at the domain root.
    route("carbon.txt", "./routes/sitemap/carbon_txt.ts"),
    // /llms.txt — curated site map for LLMs / AI agents (llmstxt.org). Root-level
    // and outside ':lang?' like robots/carbon: the convention places one file at
    // the domain root.
    route("llms.txt", "./routes/sitemap/llms_txt.ts"),
    route("sitemap.xml", "./routes/sitemap/sitemap_index.ts"),
    route("sitemaps/:file", "./routes/sitemap/sitemap_shard.ts"),
    ...prefix(':lang?', [
        // Bulk data-export resource routes (loader-only). Registered as SIBLINGS
        // of lang_layout — outside both it and data_dashboard_layout — so a
        // download runs ONLY its own loader, not the chrome's locale loaders.
        // Detail pages carry an :id; catalogues don't.
        route(`${BODIES}/:id/export/:dataset/:format`, './routes/pages/opd/bodies/bodies_id_export.tsx'),
        route(`${PEOPLE}/:id/export/:dataset/:format`, './routes/pages/opd/people/people_id_export.tsx'),
        route(`${AFFAIRS}/:id/export/:dataset/:format`, './routes/pages/opd/affairs/affairs_id_export.tsx'),
        route(`${GROUPS}/:id/export/:dataset/:format`, './routes/pages/opd/groups/groups_id_export.tsx'),
        route(`${MEETINGS}/:id/export/:dataset/:format`, './routes/pages/opd/meetings/meetings_id_export.tsx'),
        route(`${PEOPLE}/export/:dataset/:format`, './routes/pages/opd/people/people_export.tsx'),
        route(`${BODIES}/export/:dataset/:format`, './routes/pages/opd/bodies/bodies_export.tsx'),
        route(`${AFFAIRS}/export/:dataset/:format`, './routes/pages/opd/affairs/affairs_export.tsx'),
        route(`${GROUPS}/export/:dataset/:format`, './routes/pages/opd/groups/groups_export.tsx'),
        route(`${VOTINGS}/export/:dataset/:format`, './routes/pages/opd/votings/votings_export.tsx'),
        route(`${MEETINGS}/export/:dataset/:format`, './routes/pages/opd/meetings/meetings_export.tsx'),
        route(`${INTERESTS}/export/:dataset/:format`, './routes/pages/opd/interests/interests_export.tsx'),
        route(`${ORGANIZATIONS}/export/:dataset/:format`, './routes/pages/opd/organizations/organizations_export.tsx'),
        route(`${TEXTS}/export/:dataset/:format`, './routes/pages/opd/texts/texts_export.tsx'),
        route(`${DOCS}/export/:dataset/:format`, './routes/pages/opd/docs/docs_export.tsx'),
        route(`${SPEECHES}/export/:dataset/:format`, './routes/pages/opd/speeches/speeches_export.tsx'),
        layout("./routes/layouts/lang_layout.tsx", [
            index("routes/home.tsx"),

            // /start — "Start here" quicklinks landing page. Sits directly under
            // lang_layout (header chrome, no data sidebar), like the home index.
            route(START, "./routes/pages/start/start.tsx"),

            // /project/* — standalone project pages under their own layout
            // (brand wordmark top-left, no data sidebar). More sub-pages hang
            // off this prefix over time.
            layout("./routes/layouts/project_layout.tsx",
                prefix(PROJECT, [
                    index('./routes/pages/project/project_index.tsx'),
                    route(ABOUT, './routes/pages/project/about/about.tsx'),
                    route(FAQ, './routes/pages/project/faq/faq.tsx'),
                    route(SUSTAINABILITY, './routes/pages/project/sustainability/sustainability.tsx'),
                    route(ACCESSIBILITY, './routes/pages/project/accessibility/accessibility.tsx'),
                    route(TRAFFIC_STATS, './routes/pages/project/traffic_stats/traffic_stats.tsx'),
                    route(DATA_MAP, './routes/pages/project/data_map/data_map.tsx'),
                    route(DATA_GUIDE, './routes/pages/project/data_guide/data_guide.tsx'),
                    route(METHODOLOGY, './routes/pages/project/methodology/methodology.tsx'),
                    route(IMPRINT, './routes/pages/project/imprint/imprint.tsx'),
                ]),
            ),

            // /experiments/* — standalone experiment / methodology pages under
            // their own layout (same chrome as project: wordmark + breadcrumbs,
            // no data sidebar).
            layout("./routes/layouts/experiments_layout.tsx",
                prefix(EXPERIMENTS, [
                    index('./routes/pages/experiments/experiments_index.tsx'),
                    route(WORDFISH, './routes/pages/experiments/experiments_wordfish.tsx'),
                ]),
            ),

            layout("./routes/layouts/data_dashboard_layout.tsx", [

                ...prefix(PEOPLE, [
                    index('./routes/pages/opd/people/people_index.tsx'),
                    ...prefix(':id', [
                        layout("./routes/layouts/people_result_layout.tsx", [
                            index('./routes/pages/opd/people/people_id_overview.tsx'),
                            route(VOTES, './routes/pages/opd/people/people_id_votes.tsx'),
                            route(ALIGNMENT, './routes/pages/opd/people/people_id_alignment.tsx'),
                            route(LOBBY, './routes/pages/opd/people/people_id_access_badges.tsx'),
                            route(CONTRIBUTIONS, './routes/pages/opd/people/people_id_contributors.tsx'),
                            route(INTERESTS, './routes/pages/opd/people/people_id_interests.tsx'),
                            route(MEMBERSHIPS, './routes/pages/opd/people/people_id_memberships.tsx'),
                            route(SPEECHES, './routes/pages/opd/people/people_id_speeches.tsx'),
                            route(IMAGES, './routes/pages/opd/people/people_id_images.tsx'),
                            route(VOCABULARY, './routes/pages/opd/people/people_id_vocabulary.tsx'),
                        ]),
                    ])
                ]),
                ...prefix(BODIES, [
                    index('./routes/pages/opd/bodies/bodies_index.tsx'),
                    ...prefix(':id', [
                        layout("./routes/layouts/bodies_result_layout.tsx", [
                            index('./routes/pages/opd/bodies/bodies_id_overview.tsx'),
                            route(PEOPLE, './routes/pages/opd/bodies/bodies_id_people.tsx'),
                            route(VOTINGS, './routes/pages/opd/bodies/bodies_id_votings.tsx'),
                            route(AFFAIRS, './routes/pages/opd/bodies/bodies_id_affairs.tsx'),
                            route(DOCS, './routes/pages/opd/bodies/bodies_id_docs.tsx'),
                            route(TEXTS, './routes/pages/opd/bodies/bodies_id_texts.tsx'),
                            route(LOYALTY, './routes/pages/opd/bodies/bodies_id_loyalty.tsx'),
                            route(ALIGNMENT, './routes/pages/opd/bodies/bodies_id_alignment.tsx'),
                            route(LOBBY, './routes/pages/opd/bodies/bodies_id_lobby.tsx'),
                            route(DISCUSSION, './routes/pages/opd/bodies/bodies_id_discussion.tsx')
                        ]),
                    ]
                    ),
                ]),
                ...prefix(AFFAIRS, [
                    index('./routes/pages/opd/affairs/affairs_index.tsx'),
                    ...prefix(':id', [
                        layout("./routes/layouts/affairs_result_layout.tsx", [
                            index('./routes/pages/opd/affairs/affairs_id_overview.tsx'),
                            route(VOTINGS, './routes/pages/opd/affairs/affairs_id_votings.tsx'),
                            route(CONTRIBUTORS, './routes/pages/opd/affairs/affairs_id_contributors.tsx'),
                            route(SPEECHES, './routes/pages/opd/affairs/affairs_id_speeches.tsx'),
                            route(DOCS, './routes/pages/opd/affairs/affairs_id_docs.tsx'),
                            route(EVENTS, './routes/pages/opd/affairs/affairs_id_events.tsx'),
                            route(TEXTS, './routes/pages/opd/affairs/affairs_id_texts.tsx'),
                        ]),
                    ]),
                ]),
                ...prefix(GROUPS, [
                    index('./routes/pages/opd/groups/groups_index.tsx'),
                    ...prefix(':id', [
                        layout("./routes/layouts/groups_result_layout.tsx", [
                            index('./routes/pages/opd/groups/groups_id_overview.tsx'),
                            route(CONTRIBUTIONS, './routes/pages/opd/groups/groups_id_contributions.tsx'),
                            route(MEETINGS, './routes/pages/opd/groups/groups_id_meetings.tsx'),
                            route(MEMBERSHIPS, './routes/pages/opd/groups/groups_id_memberships.tsx'),
                            route(VOTINGS, './routes/pages/opd/groups/groups_id_votings.tsx'),
                        ]),
                    ]),
                ]),
                ...prefix(VOTINGS, [
                    index('./routes/pages/opd/votings/votings_index.tsx'),
                    ...prefix(':id', [
                        index('./routes/pages/opd/votings/votings_id_overview.tsx'),
                    ]),
                ]),
                ...prefix(MEETINGS, [
                    index('./routes/pages/opd/meetings/meetings_index.tsx'),
                    ...prefix(':id', [
                        layout("./routes/layouts/meetings_result_layout.tsx", [
                            index('./routes/pages/opd/meetings/meetings_id_overview.tsx'),
                            route(AGENDAS, './routes/pages/opd/meetings/meetings_id_agendas.tsx'),
                            route(VOTINGS, './routes/pages/opd/meetings/meetings_id_votings.tsx'),
                            route(SPEECHES, './routes/pages/opd/meetings/meetings_id_speeches.tsx'),
                            route(DOCS, './routes/pages/opd/meetings/meetings_id_docs.tsx'),
                            route(EVENTS, './routes/pages/opd/meetings/meetings_id_events.tsx'),
                            route(CONTRIBUTORS, './routes/pages/opd/meetings/meetings_id_contributors.tsx'),
                        ]),
                    ]),
                ]),
                ...prefix(INTERESTS, [
                    index('./routes/pages/opd/interests/interests_index.tsx'),
                    ...prefix(':id', [
                        layout("./routes/layouts/interests_result_layout.tsx", [
                            index('./routes/pages/opd/interests/interests_id_overview.tsx'),
                        ]),
                    ]),
                ]),
                ...prefix(ORGANIZATIONS, [
                    index('./routes/pages/opd/organizations/organizations_index.tsx'),
                    ...prefix(':id', [
                        layout("./routes/layouts/organizations_result_layout.tsx", [
                            index('./routes/pages/opd/organizations/organizations_id_overview.tsx'),
                        ]),
                    ]),
                ]),
                ...prefix(TEXTS, [
                    index('./routes/pages/opd/texts/texts_index.tsx'),
                    ...prefix(':id', [
                        index('./routes/pages/opd/texts/texts_id_overview.tsx'),
                    ]),
                ]),
                ...prefix(DOCS, [
                    index('./routes/pages/opd/docs/docs_index.tsx'),
                    ...prefix(':id', [
                        index('./routes/pages/opd/docs/docs_id_overview.tsx'),
                    ]),
                ]),
                ...prefix(SPEECHES, [
                    index('./routes/pages/opd/speeches/speeches_index.tsx'),
                    ...prefix(':id', [
                        index('./routes/pages/opd/speeches/speeches_id_overview.tsx'),
                    ]),
                ]),
            ])
            // route("/dashboard", "./routes/dashboard.tsx")
        ])
    ])
] satisfies RouteConfig;