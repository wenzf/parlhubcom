import type { DataFromConfig, PageConfig, PageEntry, PageNamespaces, Settings, SiteLangs } from "../../types/site"
// Type-only import (elided at build): keeps this file out of the react-router
// config loader's runtime graph, which can't resolve the `~` alias or load a
// component module. Must stay `import type` for that reason.
import type { IconName } from "../components/icons/opd_icons"


export const SITE_LANGS = [
    {
        lang_code: "en", // alpha-2
        lang_html: "en",
        lang_param: '',
        default: true,
        label: "English",
        charset: "latin"
    },
    {
        lang_code: "de",
        lang_html: "de",
        lang_param: 'de',
        default: false,
        label: "Deutsch",
        charset: "latin"
    },
    {
        lang_code: "fr",
        lang_html: "fr",
        lang_param: 'fr',
        default: false,
        label: "Francaise",
        charset: "latin"
    },
    {
        lang_code: "it",
        lang_html: "it",
        lang_param: 'it',
        default: false,
        label: "Italiano",
        charset: "latin"
    },
    {
        lang_code: "es",
        lang_html: "es",
        lang_param: 'es',
        default: false,
        label: "Español",
        charset: "latin"
    },
    {
        lang_code: "pt",
        lang_html: "pt",
        lang_param: 'pt',
        default: false,
        label: "Português",
        charset: "latin"
    },
    {
        lang_code: "rm",
        lang_html: "rm",
        lang_param: 'rm',
        default: false,
        label: "Rumantsch",
        charset: "latin"
    }
] as const satisfies SiteLangs[]

/** The project's public source repository: the header's Project menu links it,
 *  and /about's JSON-LD claims it as `sameAs` (lib/seo/metas/about.ts). The page
 *  prose keeps its own copy in loc_about (`about.maintainer.code_href`), where it
 *  sits alongside its sibling hrefs — keep the two in sync. */
export const REPO_URL = "https://github.com/wenzf/parlhubcom"

// --- FRAGMENTS

// Every data section's sidebar reads its item labels from the same
// loc_data_dashboard block, so one fragment serves all of them. (This stood
// duplicated verbatim as 11 per-entity consts.)
export const SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT = {
    labels_loc_object: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.labels"
    }
} as const

export const SIDEBAR_PEOPLE_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title"
    },
    icon_namespace: "People"
} as const


// Bodies counterparts. The labels map is shared (locs.sidebar.labels already holds
// the body item keys: overview / personal_data / members / votings / affairs), so
// the label fragment points at the same path; only the section title + icon differ.
export const SIDEBAR_BODIES_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_bodies"
    },
    icon_namespace: "Bodies"
} as const


// Affairs counterparts (single overview route for now). Labels map is shared
// (locs.sidebar.labels already holds `overview` / `personal_data`); only the
// section title + icon differ.
export const SIDEBAR_AFFAIRS_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_affairs"
    },
    icon_namespace: "Affairs"
} as const


export const BREADCRUMB_HOME_1_FRAGMENT = {
    path: "NS_LANG_LAYOUT",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.home",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

// First crumb for /project/* pages. Those pages sit under project_layout, NOT
// data_dashboard_layout, so they can't resolve the data-dashboard "Home" label
// above — instead the trail starts at "Project", sourced from loc_main.nav
// (loaded by the lang layout, an ancestor of every project page).
export const BREADCRUMB_PROJECT_1_FRAGMENT = {
    path: "NS_PROJECT_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.nav.project",
        data_origin: "NS_LANG_LAYOUT"
    }
} as const

// First crumb for /experiments/* pages — same rationale as the project fragment:
// standalone pages under experiments_layout (not data_dashboard_layout), so the
// trail starts at "Experiments", sourced from loc_main.nav (loaded by the lang
// layout, an ancestor of every experiments page).
export const BREADCRUMB_EXPERIMENTS_1_FRAGMENT = {
    path: "NS_EXPERIMENTS_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.nav.experiments",
        data_origin: "NS_LANG_LAYOUT"
    }
} as const


export const BREADCRUMBS_PEOPLE_FRAGMENT = {
    path: "NS_PEOPLE_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.people",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

export const BREADCRUMBS_BODIES_FRAGMENT = {
    path: "NS_BODIES_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.bodies",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

export const BREADCRUMBS_AFFAIRS_FRAGMENT = {
    path: "NS_AFFAIRS_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.affairs",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const


// Votings counterparts (a leaf entity: catalogue + single overview route).
// Labels map is shared (locs.sidebar.labels holds `overview` / `personal_data`).
export const SIDEBAR_VOTINGS_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_votings"
    },
    icon_namespace: "Votings"
} as const


export const BREADCRUMBS_VOTINGS_FRAGMENT = {
    path: "NS_VOTINGS_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.votings",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

// Texts counterparts (a leaf catalogue: search all texts; no detail route).
// Labels map is shared (locs.sidebar.labels holds `texts`).
export const SIDEBAR_TEXTS_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_texts"
    },
    icon_namespace: "Texts"
} as const


export const BREADCRUMBS_TEXTS_FRAGMENT = {
    path: "NS_TEXTS_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.texts",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

// Docs counterparts (a catalogue /docs + a leaf detail /docs/:id, like texts).
// Labels map is shared (locs.sidebar.labels holds `docs_overview` / `doc_details`).
export const SIDEBAR_DOCS_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_docs"
    },
    // Docs get their own namespace → maps to the `paperclip` sprite glyph in the
    // sidebar renderer's icon_namespace map (author must add "Docs" → paperclip).
    icon_namespace: "Docs"
} as const


export const BREADCRUMBS_DOCS_FRAGMENT = {
    path: "NS_DOCS_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.docs",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

// Speeches counterparts (a catalogue + single overview route, like texts).
export const SIDEBAR_SPEECHES_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_speeches"
    },
    // NOTE: icon_namespace is a typed union (User|Landmark|FileText|Vote in the
    // snapshot). Using "FileText" to compile out-of-the-box; switch to a "Mic"
    // namespace once it's added to the IconNamespace union + the header icon map.
    icon_namespace: "Speeches"
} as const


export const BREADCRUMBS_SPEECHES_FRAGMENT = {
    path: "NS_SPEECHES_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.speeches",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

// Groups counterparts (a detail family: catalogue + overview + two feeds —
// contributions / meetings). Labels map is shared (locs.sidebar.labels).
export const SIDEBAR_GROUPS_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_groups"
    },
    // icon_namespace is a typed union (User|Landmark|FileText|Vote in the snapshot).
    icon_namespace: "Groups"
} as const


export const BREADCRUMBS_GROUPS_FRAGMENT = {
    path: "NS_GROUPS_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.groups",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

// Meetings counterparts (a leaf entity: catalogue /meetings + single overview
// route /meetings/:id under a result layout, like groups). Labels map is shared
// (locs.sidebar.labels holds `meetings_overview` / `meeting_details`).
export const SIDEBAR_MEETINGS_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_meetings"
    },
    // icon_namespace is a typed union (User|Landmark|FileText|Vote in the snapshot).
    icon_namespace: "Meetings"
} as const


export const BREADCRUMBS_MEETINGS_FRAGMENT = {
    path: "NS_MEETINGS_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.meetings",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

// Interests counterparts (a leaf entity: catalogue /interests + single overview
// route /interests/:id, like votings). Labels map is shared (locs.sidebar.labels
// holds `interests_overview` / `interest_details`).
export const SIDEBAR_INTERESTS_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_interests"
    },
    // icon_namespace is a typed union (User|Landmark|FileText|Vote in the snapshot).
    icon_namespace: "Interests"
} as const


export const BREADCRUMBS_ORGANIZATIONS_FRAGMENT = {
    path: "NS_ORGANIZATIONS_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.organizations",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

export const SIDEBAR_ORGANIZATIONS_SECTION_TITLE_FRAGMENT = {
    section_title: {
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
        data_key_type: "dotprop",
        data_key: "locs.sidebar.section_title_organizations"
    },
    icon_namespace: "Organizations"
} as const

export const BREADCRUMBS_INTERESTS_FRAGMENT = {
    path: "NS_INTERESTS_INDEX",
    label: {
        data_key_type: "dotprop",
        data_key: "locs.breadcrumbs.interests",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT"
    }
} as const

// ----

export const URL_PATH_SEGMENTS = {
    PEOPLE: "people",
    BODIES: "parliaments",
    VOTES: "votes",
    AGENDAS: "agendas",
    VOTINGS: "votings",
    AFFAIRS: "affairs",
    SPEECHES: "speeches",
    CONTRIBUTIONS: "contributions",
    CONTRIBUTORS: "contributors",
    DOCS: "docs",
    EVENTS: "events",
    TEXTS: "texts",
    MEMBERSHIPS: "memberships",
    INTERESTS: "interests",
    ORGANIZATIONS: "organizations",
    LOBBY: "lobby",
    IMAGES: "images",
    VOCABULARY: "vocabulary",
    LOYALTY: "loyalty",
    GROUPS: "groups",
    MEETINGS: "meetings",
    ALIGNMENT: "alignment",
    DISCUSSION: "discussion",
    ABOUT: "about",
    FAQ: "faq",
    PROJECT: "project",
    SUSTAINABILITY: "sustainability",
    ACCESSIBILITY: "accessibility",
    TRAFFIC_STATS: "traffic-stats",
    DATA_MAP: "data-map",
    DATA_GUIDE: "data-guide",
    METHODOLOGY: "methodology",
    IMPRINT: "imprint",
    START: "start",
    EXPERIMENTS: "experiments",
    WORDFISH: "wordfish"
}


export const SETTINGS_DEFAULT = {
    theme: "system",
    font_size: 100,
    show_cookie_consent_message: true,
    ui_high_contrast: false,
    ui_grayscale: false,
    msg_lang_hint: true,
    content_lang: null
} as const satisfies Settings;

// Font size percent bounds: the header stepper offers MIN..MAX in STEP
// increments, and the settings action clamps persisted values to the same
// range so a forged payload cannot store an absurd size.
export const FONT_SIZE_MIN = 80
export const FONT_SIZE_MAX = 150
export const FONT_SIZE_STEP = 10


// ── data-section feed pages ──────────────────────────────────────────────────
//
// The 34 sub-feeds under /people/:id, /parliaments/:id, /affairs/:id,
// /groups/:id and /meetings/:id all share one entry shape; only the section
// they hang off and their own leaf differ. FEED_SECTIONS holds the per-section
// half, feedPage() stamps out the entry. Everything irregular stays an explicit
// argument, so a page that deviates reads as a deviation at its call site.
const FEED_SECTIONS = {
    affairs: {
        index_key: "NS_AFFAIRS_INDEX", index_loc: "locs.breadcrumbs.affairs",
        overview_key: "NS_AFFAIRS_OVERVIEW", label_key: "data.affair.type_name",
        icon: "Affairs", title_loc: "locs.sidebar.section_title_affairs",
        is_primary: false,
    },
    bodies: {
        index_key: "NS_BODIES_INDEX", index_loc: "locs.breadcrumbs.bodies",
        overview_key: "NS_BODIES_OVERVIEW", label_key: "data.body.legislative_name",
        // bodies that carry no legislative_name (cantons, communes) fall back to name
        label_fallback: "data.body.name",
        icon: "Bodies", title_loc: "locs.sidebar.section_title_bodies",
        is_primary: true,
    },
    groups: {
        index_key: "NS_GROUPS_INDEX", index_loc: "locs.breadcrumbs.groups",
        overview_key: "NS_GROUPS_OVERVIEW", label_key: "data.group.name",
        icon: "Groups", title_loc: "locs.sidebar.section_title_groups",
        is_primary: false,
    },
    meetings: {
        index_key: "NS_MEETINGS_INDEX", index_loc: "locs.breadcrumbs.meetings",
        overview_key: "NS_MEETINGS_OVERVIEW", label_key: "data.meeting.name",
        icon: "Meetings", title_loc: "locs.sidebar.section_title_meetings",
        is_primary: false,
    },
    persons: {
        index_key: "NS_PEOPLE_INDEX", index_loc: "locs.breadcrumbs.people",
        overview_key: "NS_PEOPLE_OVERVIEW", label_key: "data.persons.fullname",
        icon: "People", title_loc: "locs.sidebar.section_title",
        is_primary: true,
    },
} as const

type FeedSection = keyof typeof FEED_SECTIONS

/** One `/{section}/:id/{leaf}` feed entry.
 *
 *  `leaf_loc` defaults to `locs.breadcrumbs.{sub_section}` — pass it only where
 *  the crumb key and the data key genuinely diverge (e.g. NS_GROUPS_VOTINGS is
 *  data_sub_section "votes" but reads the "votings" crumb). `subtitle` overrides
 *  the sidebar subtitle for the one page that names itself rather than its
 *  record (NS_BODIES_DISCUSSION). */
function feedPage(
    page_key: PageNamespaces,
    section: FeedSection,
    absolute_path: string,
    data_sub_section: NonNullable<PageEntry["data_sub_section"]>,
    opts: { leaf_loc?: string; subtitle?: DataFromConfig } = {},
): PageEntry {
    const S = FEED_SECTIONS[section]
    const fallback = "label_fallback" in S ? { data_key_fallback: S.label_fallback } : {}
    const record: DataFromConfig = {
        data_key: S.label_key,
        data_key_type: "dotprop",
        data_origin: page_key,
        ...fallback,
    }
    const loc = (data_key: string): DataFromConfig => ({
        data_key,
        data_key_type: "dotprop",
        data_origin: "NS_DATA_DASHBOARD_LAYOUT",
    })
    return {
        handle: {
            page_key,
            is_primary_data_match: S.is_primary,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                { path: S.index_key, label: loc(S.index_loc) },
                { path: S.overview_key, label: record },
                { path: page_key, label: loc(opts.leaf_loc ?? `locs.breadcrumbs.${data_sub_section}`) },
            ],
        },
        absolute_path,
        data_section: section,
        data_sub_section,
        sidebar: {
            section_title: loc(S.title_loc),
            section_subtitle: opts.subtitle ?? record,
            icon_namespace: S.icon,
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT,
        },
    }
}

export const PAGE_CONFIG = {
    // /start — the "Start here" quicklinks landing page. A guided entry point for
    // users who find the abstract catalogue too hard: curated links to the federal
    // chambers + their sub-pages, the full 26-canton grid, and a client-side search
    // over the ~460 communal parliaments. Mounted directly under lang_layout (like
    // the home index) — NOT a data section, so no data sidebar. Copy lives in
    // /public/locales/<lang>/loc_start.json; body/chamber/canton/commune links are
    // built from live data by getStartData (start_data.server).
    NS_START: {
        handle: {
            page_key: "NS_START",
            is_primary_data_match: false,
            breadcrumbs: [],
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.START}`,
        sidebar: null,
    },
    // /project index — the project section landing page (links to About, FAQ and
    // the Data map). Under project_layout, not a data section. Its trail is the
    // single "Project" crumb; child pages prepend it (BREADCRUMB_PROJECT_1_FRAGMENT).
    // On-page copy is loc_main.nav; SEO copy in metas/project.ts.
    NS_PROJECT_INDEX: {
        handle: {
            page_key: "NS_PROJECT_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}`,
        sidebar: null,
    },
    // /experiments index — landing for experimental / methodological showcases.
    // Standalone page under experiments_layout (not a data section). Trail is the
    // single "Experiments" crumb; child pages prepend it. On-page copy is
    // loc_main.nav; SEO copy in metas/experiments.ts.
    NS_EXPERIMENTS_INDEX: {
        handle: {
            page_key: "NS_EXPERIMENTS_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_EXPERIMENTS_1_FRAGMENT,
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.EXPERIMENTS}`,
        sidebar: null,
    },
    // /experiments/wordfish — the Wordfish scaling write-up + the list of
    // parliaments whose speech data is rich enough to render the discussion chart.
    NS_EXPERIMENTS_WORDFISH: {
        handle: {
            page_key: "NS_EXPERIMENTS_WORDFISH",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_EXPERIMENTS_1_FRAGMENT,
                {
                    path: "NS_EXPERIMENTS_WORDFISH",
                    label: {
                        data_key_type: "dotprop",
                        data_key: "locs.nav.wordfish",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.EXPERIMENTS}/${URL_PATH_SEGMENTS.WORDFISH}`,
        sidebar: null,
    },
    // Static site page — the About / project page. Not a data section
    // (data_section "NONE" → the sidebar renders the generic site nav). Its copy
    // lives in /public/locales/<lang>/loc_about.json; SEO copy in metas/about.ts.
    NS_ABOUT: {
        handle: {
            page_key: "NS_ABOUT",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
                {
                    path: "NS_ABOUT",
                    // Label from the lang layout's loc_main.nav (like every other
                    // crumb) rather than this leaf's own loader — keeps breadcrumb
                    // resolution on one reliable, always-present source.
                    label: {
                        data_key_type: "dotprop",
                        data_key: "locs.nav.about",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}/${URL_PATH_SEGMENTS.ABOUT}`,
        sidebar: {
            section_title: {
                data_origin: "NS_ABOUT",
                data_key_type: "dotprop",
                data_key: "locs.about.title"
            },
            section_subtitle: null,
            icon_namespace: "About",
            labels_loc_object: null
        },
    },
    // Static site page — FAQ. Same shape as NS_ABOUT: copy in
    // /public/locales/<lang>/loc_faq.json, SEO copy in metas/faq.ts.
    NS_FAQ: {
        handle: {
            page_key: "NS_FAQ",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
                {
                    path: "NS_FAQ",
                    label: {
                        data_key_type: "dotprop",
                        data_key: "locs.nav.faq",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}/${URL_PATH_SEGMENTS.FAQ}`,
        sidebar: {
            section_title: {
                data_origin: "NS_FAQ",
                data_key_type: "dotprop",
                data_key: "locs.faq.title"
            },
            section_subtitle: null,
            icon_namespace: "Faq",
            labels_loc_object: null
        },
    },
    // Static site page — Sustainability. Same shape as NS_ABOUT / NS_FAQ: copy in
    // /public/locales/<lang>/loc_sustainability.json, SEO copy in that namespace's
    // `metas` block via metas/sustainability.ts. Doubles as the disclosure document
    // that /carbon.txt (routes/sitemap/carbon_txt.ts) points its org.disclosures at,
    // so the page must stay publicly reachable at a stable URL — the carbon.txt
    // validator fetches it.
    NS_SUSTAINABILITY: {
        handle: {
            page_key: "NS_SUSTAINABILITY",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
                {
                    path: "NS_SUSTAINABILITY",
                    label: {
                        data_key_type: "dotprop",
                        data_key: "locs.nav.sustainability",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}/${URL_PATH_SEGMENTS.SUSTAINABILITY}`,
        sidebar: {
            section_title: {
                data_origin: "NS_SUSTAINABILITY",
                data_key_type: "dotprop",
                data_key: "locs.sustainability.title"
            },
            section_subtitle: null,
            icon_namespace: "Sustainability",
            labels_loc_object: null
        },
    },
    // Static site page — public traffic statistics. Same shape as NS_SUSTAINABILITY:
    // page copy in /public/locales/<lang>/loc_traffic_stats.json, SEO copy in that
    // namespace's `metas` block via metas/traffic_stats.ts.
    //
    // The figures come from the server's own request log, aggregated once a day by
    // deploy/analytics.ts. Nothing here is a tracker: no cookies, no IP addresses,
    // no third-party script — which is why the page can sit next to the privacy and
    // sustainability disclosures rather than needing consent.
    NS_TRAFFIC_STATS: {
        handle: {
            page_key: "NS_TRAFFIC_STATS",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
                {
                    path: "NS_TRAFFIC_STATS",
                    label: {
                        data_key_type: "dotprop",
                        // loc_main.nav, not this page's own namespace: a crumb resolves
                        // only from a *matched* route, and /project/* sits under
                        // project_layout, whose nearest loc-bearing layout is the lang
                        // layout. Same reason as the sibling project pages.
                        data_key: "locs.nav.traffic_stats",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}/${URL_PATH_SEGMENTS.TRAFFIC_STATS}`,
        sidebar: {
            section_title: {
                data_origin: "NS_TRAFFIC_STATS",
                data_key_type: "dotprop",
                data_key: "locs.traffic_stats.title"
            },
            section_subtitle: null,
            icon_namespace: "TrafficStats",
            labels_loc_object: null
        },
    },
    // Static site page — Accessibility statement. Same shape as NS_ABOUT / NS_FAQ:
    // copy in /public/locales/<lang>/loc_accessibility.json, SEO copy in that
    // namespace's `metas` block via metas/accessibility.ts.
    //
    // A VOLUNTARY self-declaration: parlhub is a private non-profit, so neither the
    // Swiss BehiG/eCH-0059 regime nor the EU Web Accessibility Directive (and its
    // model statement, Implementing Decision (EU) 2018/1523) binds it. The section
    // order still follows that model — conformance status, measures, known
    // limitations, feedback channel, preparation method + dates — because it is the
    // shape readers and screen-reader users expect.
    NS_ACCESSIBILITY: {
        handle: {
            page_key: "NS_ACCESSIBILITY",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
                {
                    path: "NS_ACCESSIBILITY",
                    label: {
                        data_key_type: "dotprop",
                        data_key: "locs.nav.accessibility",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}/${URL_PATH_SEGMENTS.ACCESSIBILITY}`,
        sidebar: {
            section_title: {
                data_origin: "NS_ACCESSIBILITY",
                data_key_type: "dotprop",
                data_key: "locs.accessibility.title"
            },
            section_subtitle: null,
            icon_namespace: "Accessibility",
            labels_loc_object: null
        },
    },
    // Standalone /project/imprint — the legal notice / Impressum (NS_IMPRINT):
    // operator, contact, and a one-line pointer to the code (Apache-2.0) and data
    // (OpenParlData.ch, CC BY 4.0) licenses. Not a data section. Copy lives in
    // /public/locales/<lang>/loc_imprint.json; SEO copy in metas/imprint.ts.
    NS_IMPRINT: {
        handle: {
            page_key: "NS_IMPRINT",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
                {
                    path: "NS_IMPRINT",
                    label: {
                        data_key_type: "dotprop",
                        data_key: "locs.nav.imprint",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}/${URL_PATH_SEGMENTS.IMPRINT}`,
        sidebar: {
            section_title: {
                data_origin: "NS_IMPRINT",
                data_key_type: "dotprop",
                data_key: "locs.imprint.title"
            },
            section_subtitle: null,
            icon_namespace: "Imprint",
            labels_loc_object: null
        },
    },
    // Standalone /project/data-map — the Data Map: a diagram of the data model
    // (entities + how they interconnect), each node linking to its catalogue.
    // Not a data section (data_section "NONE" → generic site nav). Copy lives in
    // /public/locales/<lang>/loc_data_map.json; SEO copy in metas/data_map.ts.
    NS_PROJECT_DATA_MAP: {
        handle: {
            page_key: "NS_PROJECT_DATA_MAP",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
                {
                    path: "NS_PROJECT_DATA_MAP",
                    label: {
                        data_key_type: "dotprop",
                        data_key: "locs.nav.data_map",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}/${URL_PATH_SEGMENTS.DATA_MAP}`,
        sidebar: {
            section_title: {
                data_origin: "NS_PROJECT_DATA_MAP",
                data_key_type: "dotprop",
                data_key: "locs.data_map.title"
            },
            section_subtitle: null,
            icon_namespace: "About",
            labels_loc_object: null
        },
    },
    // Standalone /project/data-guide — the "what you can explore" field guide: a
    // grouped catalogue of every data type in plain terms, each with a link to its
    // section + one concrete example page. Not a data section (generic site nav).
    // On-page copy is loc_guide.json; SEO copy in metas/data_guide.ts.
    NS_PROJECT_DATA_GUIDE: {
        handle: {
            page_key: "NS_PROJECT_DATA_GUIDE",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
                {
                    path: "NS_PROJECT_DATA_GUIDE",
                    label: {
                        data_key_type: "dotprop",
                        data_key: "locs.nav.data_guide",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}/${URL_PATH_SEGMENTS.DATA_GUIDE}`,
        sidebar: {
            section_title: {
                data_origin: "NS_PROJECT_DATA_GUIDE",
                data_key_type: "dotprop",
                data_key: "locs.guide.title"
            },
            section_subtitle: null,
            icon_namespace: "About",
            labels_loc_object: null
        },
    },
    // Standalone /project/methodology — the Methodology page: how each computed
    // metric (voting alignment, party loyalty, lobby network, vocabulary, Wordfish
    // discussion scaling, …) is calculated, with the exact formula and a link to
    // the source code on GitHub. Not a data section (generic site nav). On-page
    // copy is loc_methodology.json; SEO copy in metas/methodology.ts.
    NS_PROJECT_METHODOLOGY: {
        handle: {
            page_key: "NS_PROJECT_METHODOLOGY",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_PROJECT_1_FRAGMENT,
                {
                    path: "NS_PROJECT_METHODOLOGY",
                    label: {
                        data_key_type: "dotprop",
                        data_key: "locs.nav.methodology",
                        data_origin: "NS_LANG_LAYOUT"
                    }
                }
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PROJECT}/${URL_PATH_SEGMENTS.METHODOLOGY}`,
        sidebar: {
            section_title: {
                data_origin: "NS_PROJECT_METHODOLOGY",
                data_key_type: "dotprop",
                data_key: "locs.methodology.title"
            },
            section_subtitle: null,
            icon_namespace: "About",
            labels_loc_object: null
        },
    },
    NS_SPEECHES_INDEX: {
        handle: {
            page_key: "NS_SPEECHES_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_SPEECHES_FRAGMENT
            ]
        },
        data_section: "speeches",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.SPEECHES}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_speeches"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Speeches",
            labels_loc_object: null
        },
    },
    NS_SPEECHES_OVERVIEW: {
        handle: {
            page_key: "NS_SPEECHES_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_SPEECHES_FRAGMENT, // speeches
                {
                    path: "NS_SPEECHES_OVERVIEW",
                    label: {
                        data_key: "data.speech.type_external",
                        data_key_type: "dotprop",
                        data_origin: "NS_SPEECHES_OVERVIEW",
                        // Speeches often have no type → fall back to the localized
                        // "Speech" placeholder from the dashboard layout's locs.
                        data_key_fallback: "locs.pages.person.labels.speech_type_fallback",
                        data_key_fallback_origin: "NS_DATA_DASHBOARD_LAYOUT"
                    }
                } // <speech type / heading>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.SPEECHES}/:id`,
        data_section: "speeches",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_SPEECHES_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_SPEECHES_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.speech.type_external"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_TEXTS_INDEX: {
        handle: {
            page_key: "NS_TEXTS_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_TEXTS_FRAGMENT
            ]
        },
        data_section: "texts",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.TEXTS}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_texts"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Texts",
            labels_loc_object: null
        },
    },
    NS_TEXTS_OVERVIEW: {
        handle: {
            page_key: "NS_TEXTS_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_TEXTS_FRAGMENT, // texts
                {
                    path: "NS_TEXTS_OVERVIEW",
                    label: {
                        data_key: "data.text.type",
                        data_key_type: "dotprop",
                        data_origin: "NS_TEXTS_OVERVIEW"
                    }
                } // <text type / heading>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.TEXTS}/:id`,
        data_section: "texts",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_TEXTS_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_TEXTS_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.text.type"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_DOCS_INDEX: {
        handle: {
            page_key: "NS_DOCS_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_DOCS_FRAGMENT
            ]
        },
        data_section: "docs",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.DOCS}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_docs"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Docs",
            labels_loc_object: null
        },
    },
    NS_DOCS_OVERVIEW: {
        handle: {
            page_key: "NS_DOCS_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_DOCS_FRAGMENT, // docs
                {
                    path: "NS_DOCS_OVERVIEW",
                    label: {
                        data_key: "data.doc.name",
                        data_key_type: "dotprop",
                        data_origin: "NS_DOCS_OVERVIEW"
                    }
                } // <doc name>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.DOCS}/:id`,
        data_section: "docs",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_DOCS_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_DOCS_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.doc.name"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_VOTINGS_INDEX: {
        handle: {
            page_key: "NS_VOTINGS_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_VOTINGS_FRAGMENT
            ]
        },
        data_section: "votings",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.VOTINGS}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_votings"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Votings",
            labels_loc_object: null
        },
    },
    NS_VOTINGS_OVERVIEW: {
        handle: {
            page_key: "NS_VOTINGS_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_VOTINGS_FRAGMENT, // votings
                {
                    path: "NS_VOTINGS_OVERVIEW",
                    label: {
                        data_key: "data.voting.title",
                        data_key_type: "dotprop",
                        data_origin: "NS_VOTINGS_OVERVIEW"
                    }
                } // <voting title>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.VOTINGS}/:id`,
        data_section: "votings",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_VOTINGS_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_VOTINGS_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.voting.title"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_MEETINGS_INDEX: {
        handle: {
            page_key: "NS_MEETINGS_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_MEETINGS_FRAGMENT
            ]
        },
        data_section: "meetings",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.MEETINGS}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_meetings"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Meetings",
            labels_loc_object: null
        },
    },
    NS_MEETINGS_OVERVIEW: {
        handle: {
            page_key: "NS_MEETINGS_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_MEETINGS_FRAGMENT, // meetings
                {
                    path: "NS_MEETINGS_OVERVIEW",
                    label: {
                        data_key: "data.meeting.name",
                        data_key_type: "dotprop",
                        data_origin: "NS_MEETINGS_OVERVIEW"
                    }
                } // <meeting name>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.MEETINGS}/:id`,
        data_section: "meetings",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_MEETINGS_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_MEETINGS_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.meeting.name"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_MEETINGS_AGENDAS: feedPage("NS_MEETINGS_AGENDAS", "meetings", `/${URL_PATH_SEGMENTS.MEETINGS}/:id/${URL_PATH_SEGMENTS.AGENDAS}`, "agendas"),
    NS_MEETINGS_VOTINGS: feedPage("NS_MEETINGS_VOTINGS", "meetings", `/${URL_PATH_SEGMENTS.MEETINGS}/:id/${URL_PATH_SEGMENTS.VOTINGS}`, "votes", { leaf_loc: "locs.breadcrumbs.votings" }),
    NS_MEETINGS_SPEECHES: feedPage("NS_MEETINGS_SPEECHES", "meetings", `/${URL_PATH_SEGMENTS.MEETINGS}/:id/${URL_PATH_SEGMENTS.SPEECHES}`, "speeches"),
    NS_MEETINGS_DOCS: feedPage("NS_MEETINGS_DOCS", "meetings", `/${URL_PATH_SEGMENTS.MEETINGS}/:id/${URL_PATH_SEGMENTS.DOCS}`, "docs"),
    NS_MEETINGS_EVENTS: feedPage("NS_MEETINGS_EVENTS", "meetings", `/${URL_PATH_SEGMENTS.MEETINGS}/:id/${URL_PATH_SEGMENTS.EVENTS}`, "events"),
    NS_MEETINGS_CONTRIBUTORS: feedPage("NS_MEETINGS_CONTRIBUTORS", "meetings", `/${URL_PATH_SEGMENTS.MEETINGS}/:id/${URL_PATH_SEGMENTS.CONTRIBUTORS}`, "contributors"),

    NS_INTERESTS_INDEX: {
        handle: {
            page_key: "NS_INTERESTS_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_INTERESTS_FRAGMENT
            ]
        },
        data_section: "interests",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.INTERESTS}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_interests"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Interests",
            labels_loc_object: null
        },
    },
    NS_INTERESTS_OVERVIEW: {
        handle: {
            page_key: "NS_INTERESTS_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_INTERESTS_FRAGMENT, // interests
                {
                    path: "NS_INTERESTS_OVERVIEW",
                    label: {
                        data_key: "data.interest.name",
                        data_key_type: "dotprop",
                        data_origin: "NS_INTERESTS_OVERVIEW"
                    }
                } // <interest name>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.INTERESTS}/:id`,
        data_section: "interests",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_INTERESTS_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_INTERESTS_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.interest.name"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_ORGANIZATIONS_INDEX: {
        handle: {
            page_key: "NS_ORGANIZATIONS_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_ORGANIZATIONS_FRAGMENT
            ]
        },
        data_section: "organizations",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.ORGANIZATIONS}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_organizations"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Organizations",
            labels_loc_object: null
        },
    },
    NS_ORGANIZATIONS_RESULT_LAYOUT: {
        handle: {
            page_key: "NS_ORGANIZATIONS_RESULT_LAYOUT",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_ORGANIZATIONS_FRAGMENT
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.ORGANIZATIONS}/:id`,
        data_section: "organizations",
        data_sub_section: "NONE",
        sidebar: {
            ...SIDEBAR_ORGANIZATIONS_SECTION_TITLE_FRAGMENT,
            section_subtitle: null,
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_ORGANIZATIONS_OVERVIEW: {
        handle: {
            page_key: "NS_ORGANIZATIONS_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_ORGANIZATIONS_FRAGMENT, // organizations
                {
                    path: "NS_ORGANIZATIONS_OVERVIEW",
                    label: {
                        data_key: "data.organization.name",
                        data_key_type: "dotprop",
                        data_origin: "NS_ORGANIZATIONS_OVERVIEW"
                    }
                } // <organization name>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.ORGANIZATIONS}/:id`,
        data_section: "organizations",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_ORGANIZATIONS_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_ORGANIZATIONS_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.organization.name"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_LANG_LAYOUT: {
        absolute_path: "",
        handle: {
            page_key: "NS_LANG_LAYOUT"
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        sidebar: null
    },
    NS_PEOPLE_RESULT_LAYOUT: {
        handle: {
            page_key: "NS_PEOPLE_RESULT_LAYOUT",
            is_primary_data_match: false
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PEOPLE}`,
        sidebar: {
            ...SIDEBAR_PEOPLE_SECTION_TITLE_FRAGMENT,
            section_subtitle: null,
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_BODIES_RESULT_LAYOUT: {
        handle: {
            page_key: "NS_BODIES_RESULT_LAYOUT",
            is_primary_data_match: false
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.BODIES}`,
        sidebar: {
            ...SIDEBAR_BODIES_SECTION_TITLE_FRAGMENT,
            section_subtitle: null,
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_DATA_DASHBOARD_LAYOUT: {
        handle: {
            page_key: "NS_DATA_DASHBOARD_LAYOUT",
            is_primary_data_match: false,
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PEOPLE}`,
        sidebar: {
            ...SIDEBAR_PEOPLE_SECTION_TITLE_FRAGMENT,
            section_subtitle: null,
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }

    },
    NS_PEOPLE_INDEX: {
        handle: {
            page_key: "NS_PEOPLE_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_PEOPLE_FRAGMENT
            ]
        },
        data_section: "NONE",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.PEOPLE}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "People",
            labels_loc_object: null
        },

    },
    NS_BODIES_INDEX: {
        handle: {
            page_key: "NS_BODIES_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_BODIES_FRAGMENT
            ]
        },
        data_section: "bodies",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.BODIES}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_bodies"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Bodies",
            labels_loc_object: null
        },

    },
    NS_BODIES_OVERVIEW: {
        handle: {
            page_key: "NS_BODIES_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_BODIES_FRAGMENT, // bodies
                {
                    path: "NS_BODIES_OVERVIEW",
                    label: {
                        data_key: "data.body.legislative_name",
                        data_key_fallback: "data.body.name",
                        data_key_type: "dotprop",
                        data_origin: "NS_BODIES_OVERVIEW"
                    }
                } // <body name>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.BODIES}/:id`,
        data_section: "bodies",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_BODIES_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_BODIES_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.body.legislative_name",
                data_key_fallback: "data.body.name"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_BODIES_PEOPLE: feedPage("NS_BODIES_PEOPLE", "bodies", `/${URL_PATH_SEGMENTS.BODIES}/:id/${URL_PATH_SEGMENTS.PEOPLE}`, "persons", { leaf_loc: "locs.breadcrumbs.people" }),
    NS_BODIES_VOTINGS: feedPage("NS_BODIES_VOTINGS", "bodies", `/${URL_PATH_SEGMENTS.BODIES}/:id/${URL_PATH_SEGMENTS.VOTINGS}`, "votes"),
    NS_BODIES_AFFAIRS: feedPage("NS_BODIES_AFFAIRS", "bodies", `/${URL_PATH_SEGMENTS.BODIES}/:id/${URL_PATH_SEGMENTS.AFFAIRS}`, "affairs"),
    // Affairs catalogue (NS_AFFAIRS_INDEX) — top-level /affairs directory.
    // Body docs feed (NS_BODIES_DOCS) — /bodies/:id/docs.
    NS_BODIES_DOCS: feedPage("NS_BODIES_DOCS", "bodies", `/${URL_PATH_SEGMENTS.BODIES}/:id/${URL_PATH_SEGMENTS.DOCS}`, "docs"),
    // Body texts feed (NS_BODIES_TEXTS) — /bodies/:id/texts.
    NS_BODIES_TEXTS: feedPage("NS_BODIES_TEXTS", "bodies", `/${URL_PATH_SEGMENTS.BODIES}/:id/${URL_PATH_SEGMENTS.TEXTS}`, "texts"),
    NS_BODIES_LOYALTY: feedPage("NS_BODIES_LOYALTY", "bodies", `/${URL_PATH_SEGMENTS.BODIES}/:id/${URL_PATH_SEGMENTS.LOYALTY}`, "loyalty"),
    NS_BODIES_ALIGNMENT: feedPage("NS_BODIES_ALIGNMENT", "bodies", `/${URL_PATH_SEGMENTS.BODIES}/:id/${URL_PATH_SEGMENTS.ALIGNMENT}`, "alignment"),
    NS_BODIES_LOBBY: feedPage("NS_BODIES_LOBBY", "bodies", `/${URL_PATH_SEGMENTS.BODIES}/:id/${URL_PATH_SEGMENTS.LOBBY}`, "lobby"),
    NS_BODIES_DISCUSSION: feedPage("NS_BODIES_DISCUSSION", "bodies", `/${URL_PATH_SEGMENTS.BODIES}/:id/${URL_PATH_SEGMENTS.DISCUSSION}`, "discussion", { subtitle: { data_key: "locs.sidebar.section_subtitle_discussion", data_key_type: "dotprop", data_origin: "NS_DATA_DASHBOARD_LAYOUT" } }),
    NS_AFFAIRS_INDEX: {
        handle: {
            page_key: "NS_AFFAIRS_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_AFFAIRS_FRAGMENT
            ]
        },
        data_section: "affairs",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.AFFAIRS}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_affairs"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Affairs",
            labels_loc_object: null
        },
    },
    // Affair overview (NS_AFFAIRS_OVERVIEW).
    NS_AFFAIRS_OVERVIEW: {
        handle: {
            page_key: "NS_AFFAIRS_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_AFFAIRS_FRAGMENT, // affairs
                {
                    path: "NS_AFFAIRS_OVERVIEW",
                    label: {
                        data_key: "data.affair.type_name",
                        data_key_type: "dotprop",
                        data_origin: "NS_AFFAIRS_OVERVIEW"
                    }
                } // <affair title>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.AFFAIRS}/:id`,
        data_section: "affairs",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_AFFAIRS_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_AFFAIRS_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.affair.type_name"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    // Affair votings feed (NS_AFFAIRS_VOTINGS) — /affairs/:id/votings.
    NS_AFFAIRS_VOTINGS: feedPage("NS_AFFAIRS_VOTINGS", "affairs", `/${URL_PATH_SEGMENTS.AFFAIRS}/:id/${URL_PATH_SEGMENTS.VOTINGS}`, "votes"),
    // Affair contributors feed (NS_AFFAIRS_CONTRIBUTORS) — /affairs/:id/contributors.
    NS_AFFAIRS_CONTRIBUTORS: feedPage("NS_AFFAIRS_CONTRIBUTORS", "affairs", `/${URL_PATH_SEGMENTS.AFFAIRS}/:id/${URL_PATH_SEGMENTS.CONTRIBUTORS}`, "contributors"),
    // Affair speeches feed (NS_AFFAIRS_SPEECHES) — /affairs/:id/speeches.
    NS_AFFAIRS_SPEECHES: feedPage("NS_AFFAIRS_SPEECHES", "affairs", `/${URL_PATH_SEGMENTS.AFFAIRS}/:id/${URL_PATH_SEGMENTS.SPEECHES}`, "speeches"),
    // Affair docs feed (NS_AFFAIRS_DOCS) — /affairs/:id/docs.
    NS_AFFAIRS_DOCS: feedPage("NS_AFFAIRS_DOCS", "affairs", `/${URL_PATH_SEGMENTS.AFFAIRS}/:id/${URL_PATH_SEGMENTS.DOCS}`, "docs"),
    // Affair events feed (NS_AFFAIRS_EVENTS) — /affairs/:id/events.
    NS_AFFAIRS_EVENTS: feedPage("NS_AFFAIRS_EVENTS", "affairs", `/${URL_PATH_SEGMENTS.AFFAIRS}/:id/${URL_PATH_SEGMENTS.EVENTS}`, "events"),
    // Affair texts feed (NS_AFFAIRS_TEXTS) — /affairs/:id/texts.
    NS_AFFAIRS_TEXTS: feedPage("NS_AFFAIRS_TEXTS", "affairs", `/${URL_PATH_SEGMENTS.AFFAIRS}/:id/${URL_PATH_SEGMENTS.TEXTS}`, "texts"),
    NS_PEOPLE_OVERVIEW: {
        handle: {
            page_key: "NS_PEOPLE_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_PEOPLE_FRAGMENT,
                {
                    path: "NS_PEOPLE_OVERVIEW",
                    label: {
                        data_key: "data.persons.fullname",
                        data_key_type: "dotprop",
                        data_origin: "NS_PEOPLE_OVERVIEW"
                    }
                }
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.PEOPLE}/:id`,

        data_section: "persons",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_PEOPLE_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_PEOPLE_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.persons.fullname"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    NS_PEOPLE_ACCESS_BADGES: feedPage("NS_PEOPLE_ACCESS_BADGES", "persons", `/${URL_PATH_SEGMENTS.PEOPLE}/:id/${URL_PATH_SEGMENTS.LOBBY}`, "access_badges", { leaf_loc: "locs.breadcrumbs.lobby" }),
    NS_PEOPLE_CONTRIBUTORS: feedPage("NS_PEOPLE_CONTRIBUTORS", "persons", `/${URL_PATH_SEGMENTS.PEOPLE}/:id/${URL_PATH_SEGMENTS.CONTRIBUTIONS}`, "contributions", { leaf_loc: "locs.breadcrumbs.contributors" }),
    NS_PEOPLE_INTERESTS: feedPage("NS_PEOPLE_INTERESTS", "persons", `/${URL_PATH_SEGMENTS.PEOPLE}/:id/${URL_PATH_SEGMENTS.INTERESTS}`, "interests"),
    NS_PEOPLE_MEMBERSHIPS: feedPage("NS_PEOPLE_MEMBERSHIPS", "persons", `/${URL_PATH_SEGMENTS.PEOPLE}/:id/${URL_PATH_SEGMENTS.MEMBERSHIPS}`, "memberships"),
    NS_PEOPLE_VOCABULARY: feedPage("NS_PEOPLE_VOCABULARY", "persons", `/${URL_PATH_SEGMENTS.PEOPLE}/:id/${URL_PATH_SEGMENTS.VOCABULARY}`, "vocabulary"),
    NS_PEOPLE_SPEECHES: feedPage("NS_PEOPLE_SPEECHES", "persons", `/${URL_PATH_SEGMENTS.PEOPLE}/:id/${URL_PATH_SEGMENTS.SPEECHES}`, "speeches"),
    NS_PEOPLE_VOTES: feedPage("NS_PEOPLE_VOTES", "persons", `/${URL_PATH_SEGMENTS.PEOPLE}/:id/${URL_PATH_SEGMENTS.VOTES}`, "votes"),
    NS_PEOPLE_IMAGES: feedPage("NS_PEOPLE_IMAGES", "persons", `/${URL_PATH_SEGMENTS.PEOPLE}/:id/${URL_PATH_SEGMENTS.IMAGES}`, "images"),
    NS_PEOPLE_ALIGNMENT: feedPage("NS_PEOPLE_ALIGNMENT", "persons", `/${URL_PATH_SEGMENTS.PEOPLE}/:id/${URL_PATH_SEGMENTS.ALIGNMENT}`, "alignment"),
    // ------------------------------------------------------------------ groups
    // Groups catalogue (NS_GROUPS_INDEX) — /groups.
    NS_GROUPS_INDEX: {
        handle: {
            page_key: "NS_GROUPS_INDEX",
            is_primary_data_match: false,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT,
                BREADCRUMBS_GROUPS_FRAGMENT
            ]
        },
        data_section: "groups",
        data_sub_section: "NONE",
        absolute_path: `/${URL_PATH_SEGMENTS.GROUPS}`,
        sidebar: {
            section_title: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_title_groups"
            },
            section_subtitle: {
                data_origin: "NS_DATA_DASHBOARD_LAYOUT",
                data_key_type: "dotprop",
                data_key: "locs.sidebar.section_subtitle_search"
            },
            icon_namespace: "Groups",
            labels_loc_object: null
        },
    },
    // Group overview (NS_GROUPS_OVERVIEW) — /groups/:id.
    NS_GROUPS_OVERVIEW: {
        handle: {
            page_key: "NS_GROUPS_OVERVIEW",
            is_primary_data_match: true,
            breadcrumbs: [
                BREADCRUMB_HOME_1_FRAGMENT, // home
                BREADCRUMBS_GROUPS_FRAGMENT, // groups
                {
                    path: "NS_GROUPS_OVERVIEW",
                    label: {
                        data_key: "data.group.name",
                        data_key_type: "dotprop",
                        data_origin: "NS_GROUPS_OVERVIEW"
                    }
                } // <group name>
            ]
        },
        absolute_path: `/${URL_PATH_SEGMENTS.GROUPS}/:id`,
        data_section: "groups",
        data_sub_section: "overview",
        sidebar: {
            ...SIDEBAR_GROUPS_SECTION_TITLE_FRAGMENT,
            section_subtitle: {
                data_origin: "NS_GROUPS_OVERVIEW",
                data_key_type: "dotprop",
                data_key: "data.group.name"
            },
            ...SIDEBAR_SECTION_LABEL_LOC_OBJECT_FRAGMENT
        }
    },
    // Group contributions feed (NS_GROUPS_CONTRIBUTIONS) — /groups/:id/contributions.
    NS_GROUPS_CONTRIBUTIONS: feedPage("NS_GROUPS_CONTRIBUTIONS", "groups", `/${URL_PATH_SEGMENTS.GROUPS}/:id/${URL_PATH_SEGMENTS.CONTRIBUTIONS}`, "contributions", { leaf_loc: "locs.breadcrumbs.contributors" }),
    // Group meetings feed (NS_GROUPS_MEETINGS) — /groups/:id/meetings.
    NS_GROUPS_MEETINGS: feedPage("NS_GROUPS_MEETINGS", "groups", `/${URL_PATH_SEGMENTS.GROUPS}/:id/${URL_PATH_SEGMENTS.MEETINGS}`, "meetings", { leaf_loc: "locs.sidebar.labels.meetings" }),
    // Group memberships feed (NS_GROUPS_MEMBERSHIPS) — /groups/:id/memberships.
    NS_GROUPS_MEMBERSHIPS: feedPage("NS_GROUPS_MEMBERSHIPS", "groups", `/${URL_PATH_SEGMENTS.GROUPS}/:id/${URL_PATH_SEGMENTS.MEMBERSHIPS}`, "memberships"),
    // Group votings feed (NS_GROUPS_VOTINGS) — /groups/:id/votings.
    NS_GROUPS_VOTINGS: feedPage("NS_GROUPS_VOTINGS", "groups", `/${URL_PATH_SEGMENTS.GROUPS}/:id/${URL_PATH_SEGMENTS.VOTINGS}`, "votes", { leaf_loc: "locs.breadcrumbs.votings" }),
} as const satisfies PageConfig


export const SST_APP_NAMESPACE = 'parlhub'
export const SCHEMA_ORG_SELF_IDENTITY = "https://parlhub.ch#contact"

export const AWS_DEPLOYMENT = {
    aws_region: "eu-central-1"
}

export const SITE_DEPLOYMENT: Record<string, string> = {
    DISTRIBUTION_URL: 'https://parlhub.com', // bucked for ltf
    DOMAIN_URL: 'https://parlhub.com',
}

export const ENV_DEVELOPMENT = {
    LOCALHOST: "http://localhost:5555/"
}
