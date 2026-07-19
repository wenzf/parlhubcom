import type { DataSectionsNamespaces, PageNamespaces } from "@/types/site"
import { type IconName } from "~/components/icons/opd_icons"


export type SidebarConfig = {
    label: string
    icon: IconName
    data_section: DataSectionsNamespaces
    is_collapsible: boolean,
    data_sub_section?: DataSectionsNamespaces | "overview"
    page_key: PageNamespaces
    items?: {
        label: string
        hash: string
    }[]
}


export const persons: SidebarConfig[] = [
    {
        label: "overview",
        icon: "layout-dashboard",
        data_section: "persons",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_PEOPLE_OVERVIEW",
        items: [
            {
                label: "personal_data",
                hash: ""
            },
            {
                label: "interests",
                hash: "interests"
            },
            {
                label: "access_badges",
                hash: "lobby"
            },
            {
                label: "speeches",
                hash: "speeches"
            },
            {
                label: "contributors",
                hash: "contributors"
            },
            {
                label: "memberships",
                hash: "memberships"
            },

            {
                label: "images",
                hash: "images"
            },
        ],
    },

    {
        label: "votes",
        icon: "vote",
        data_section: "persons",
        data_sub_section: "votes",
        is_collapsible: false,
        page_key: "NS_PEOPLE_VOTES",

    },
    {
        label: "alignment",
        icon: "scatter-chart",
        data_section: "persons",
        data_sub_section: "alignment",
        is_collapsible: false,
        page_key: "NS_PEOPLE_ALIGNMENT",

    },
    {
        label: "interests",
        icon: "briefcase",
        data_section: "persons",
        data_sub_section: "interests",
        is_collapsible: false,
        page_key: "NS_PEOPLE_INTERESTS",

    },
    {
        label: "access_badges",
        icon: "building-2",
        data_section: "persons",
        data_sub_section: "access_badges",
        is_collapsible: false,
        page_key: "NS_PEOPLE_ACCESS_BADGES",

    },
    {
        label: "speeches",
        icon: "mic",
        data_section: "persons",
        data_sub_section: "speeches",
        is_collapsible: false,
        page_key: "NS_PEOPLE_SPEECHES",

    },
    {
        label: "contributors",
        icon: "file-signature",
        data_section: "persons",
        data_sub_section: "contributions",
        is_collapsible: false,
        page_key: "NS_PEOPLE_CONTRIBUTORS",
    },
    {
        label: "memberships",
        icon: "id-card",
        data_section: "persons",
        data_sub_section: "memberships",
        is_collapsible: false,
        page_key: "NS_PEOPLE_MEMBERSHIPS",

    },
    {
        label: "vocabulary",
        icon: "whole-word",
        data_section: "persons",
        data_sub_section: "vocabulary",
        is_collapsible: false,
        page_key: "NS_PEOPLE_VOCABULARY",

    },
    {
        label: "images",
        icon: "image",
        data_section: "persons",
        data_sub_section: "images",
        is_collapsible: false,
        page_key: "NS_PEOPLE_IMAGES",

    },

]

// Bodies (parliaments / cantons / communal institutions). Mirrors `persons`:
// the collapsible `overview` entry maps to /bodies/:id and lists the hash-anchored
// sections actually on that page — the body profile (hash ""), plus the recent
// votings / affairs snippets (those hashes need matching id="votings" / id="affairs"
// targets on the overview; the members feed is NOT on the overview, so it has no
// anchor here). The flat entries below are the dedicated sub-route feeds. Each
// `data_section` / `data_sub_section` matches the route handle in site.config.ts,
// and every `label` resolves through `sidebar.labels` in the loc files.
export const bodies: SidebarConfig[] = [
    {
        label: "overview",
        icon: "layout-dashboard",
        data_section: "bodies",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_BODIES_OVERVIEW",
        items: [
            {
                label: "personal_data",
                hash: ""
            },
            {
                label: "votings",
                hash: "votings"
            },
            {
                label: "affairs",
                hash: "affairs"
            },
            {
                label: "texts",
                hash: "texts"
            },
        ],
    },
    {
        label: "members",
        icon: "users",
        data_section: "bodies",
        data_sub_section: "persons",
        is_collapsible: false,
        page_key: "NS_BODIES_PEOPLE",
    },
    {
        label: "votings",
        icon: "vote",
        data_section: "bodies",
        data_sub_section: "votes",
        is_collapsible: false,
        page_key: "NS_BODIES_VOTINGS",
    },
    {
        label: "loyalty",
        icon: "heart-handshake",
        data_section: "bodies",
        data_sub_section: "loyalty",
        is_collapsible: false,
        page_key: "NS_BODIES_LOYALTY",
    },
    {
        label: "alignment",
        icon: "scatter-chart",
        data_section: "bodies",
        data_sub_section: "alignment",
        is_collapsible: false,
        page_key: "NS_BODIES_ALIGNMENT",
    },
    {
        label: "lobby",
        icon: "share-2",
        data_section: "bodies",
        data_sub_section: "lobby",
        is_collapsible: false,
        page_key: "NS_BODIES_LOBBY",
    },
    {
        label: "discussion",
        icon: "mic",
        data_section: "bodies",
        data_sub_section: "discussion",
        is_collapsible: false,
        page_key: "NS_BODIES_DISCUSSION",
    },
    {
        label: "affairs",
        icon: "file-text",
        data_section: "bodies",
        data_sub_section: "affairs",
        is_collapsible: false,
        page_key: "NS_BODIES_AFFAIRS",
    },
    {
        label: "docs",
        icon: "paperclip",
        data_section: "bodies",
        data_sub_section: "docs",
        is_collapsible: false,
        page_key: "NS_BODIES_DOCS",
    },
    {
        label: "texts",
        icon: "newspaper",
        data_section: "bodies",
        data_sub_section: "texts",
        is_collapsible: false,
        page_key: "NS_BODIES_TEXTS",
    },
]

// Affairs (parliamentary business items). Single overview route for now; the
// collapsible `overview` entry maps to /affairs/:id. Add flat feed rows here
// (e.g. votings on the affair) when those sub-routes land, mirroring `bodies`.
export const affairs: SidebarConfig[] = [
    {
        label: "overview",
        icon: "layout-dashboard",
        data_section: "affairs",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_AFFAIRS_OVERVIEW",
        items: [
            {
                label: "personal_data",
                hash: ""
            },
            {
                label: "votings",
                hash: "votings"
            },
            {
                label: "contributors",
                hash: "contributors"
            },
            {
                label: "events",
                hash: "events"
            },
            {
                label: "docs",
                hash: "docs"
            },
            {
                label: "texts",
                hash: "texts"
            },
        ],
    },
    {
        label: "votings",
        icon: "vote",
        data_section: "affairs",
        data_sub_section: "votes",
        is_collapsible: false,
        page_key: "NS_AFFAIRS_VOTINGS",
    },
    {
        label: "contributors",
        icon: "file-signature",
        data_section: "affairs",
        data_sub_section: "contributors",
        is_collapsible: false,
        page_key: "NS_AFFAIRS_CONTRIBUTORS",
    },
    {
        label: "speeches",
        icon: "mic",
        data_section: "affairs",
        data_sub_section: "speeches",
        is_collapsible: false,
        page_key: "NS_AFFAIRS_SPEECHES",
    },
    {
        label: "docs",
        icon: "paperclip",
        data_section: "affairs",
        data_sub_section: "docs",
        is_collapsible: false,
        page_key: "NS_AFFAIRS_DOCS",
    },
    {
        label: "events",
        icon: "calendar-range",
        data_section: "affairs",
        data_sub_section: "events",
        is_collapsible: false,
        page_key: "NS_AFFAIRS_EVENTS",
    },
    {
        label: "texts",
        icon: "newspaper",
        data_section: "affairs",
        data_sub_section: "texts",
        is_collapsible: false,
        page_key: "NS_AFFAIRS_TEXTS",
    },
]

// Votings (voting events). Leaf entity — a single overview route, no sub-feeds.
// The collapsible `overview` entry maps to /votings/:id; its one anchor is the
// voting detail section (hash "" → id="" on the overview page).
export const votings: SidebarConfig[] = [
    {
        label: "votings_overview",
        icon: "layout-dashboard",
        data_section: "votings",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_VOTINGS_OVERVIEW",
        items: [
            {
                label: "voting_details",
                hash: ""
            },
            {
                label: "voting_diagram",
                hash: "voting-diagram"
            },
            {
                label: "voting_tally",
                hash: "voting-tally"
            },
        ],
    },
]

// Texts (text blocks from the `texts` table). The section has a catalogue
// (/texts) and a leaf detail page (/texts/:id), mirroring votings. The catalogue
// index renders only the section header (its PAGE_CONFIG sidebar has
// labels_loc_object: null); this collapsible OVERVIEW entry renders on the detail
// page, where its hash-anchored section is shown. `data_section`/`data_sub_section`
// match the NS_TEXTS_OVERVIEW handle so the row highlights; labels resolve via
// `sidebar.labels`.
export const texts: SidebarConfig[] = [
    {
        label: "texts_overview",
        icon: "layout-dashboard",
        data_section: "texts",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_TEXTS_OVERVIEW",
        items: [
            {
                label: "text_details",
                hash: ""
            },
        ],
    },
]

// Docs (documents from the `docs` table). Catalogue (/docs) + leaf detail
// (/docs/:id), mirroring texts. The catalogue index renders only the section
// header (its PAGE_CONFIG sidebar has labels_loc_object: null); this collapsible
// OVERVIEW entry renders on the detail page, where its hash-anchored section
// (id="" on the overview) is shown. `data_section`/`data_sub_section` match the
// NS_DOCS_OVERVIEW handle so the row highlights; labels resolve via `sidebar.labels`.
export const docs: SidebarConfig[] = [
    {
        label: "docs_overview",
        icon: "layout-dashboard",
        data_section: "docs",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_DOCS_OVERVIEW",
        items: [
            {
                label: "doc_details",
                hash: ""
            },
        ],
    },
]

// Speeches (parliamentary interventions). Catalogue (/speeches) + leaf detail
// (/speeches/:id), mirroring texts. The collapsible OVERVIEW entry renders on the
// detail page.
export const speeches: SidebarConfig[] = [
    {
        label: "speeches_overview",
        icon: "layout-dashboard",
        data_section: "speeches",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_SPEECHES_OVERVIEW",
        items: [
            {
                label: "speech_details",
                hash: ""
            },
        ],
    },
]

// Interests (declared register-of-interests entries). Leaf entity — a catalogue
// (/interests) + a leaf detail page (/interests/:id), mirroring votings/texts.
// The catalogue index renders only the section header (its PAGE_CONFIG sidebar
// has labels_loc_object: null); this collapsible OVERVIEW entry renders on the
// detail page, where its hash-anchored section (id="" on the overview) is shown.
// `data_section`/`data_sub_section` match the NS_INTERESTS_OVERVIEW handle so the
// row highlights; labels resolve via `sidebar.labels`.
export const interests: SidebarConfig[] = [
    {
        label: "interests_overview",
        icon: "layout-dashboard",
        data_section: "interests",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_INTERESTS_OVERVIEW",
        items: [
            {
                label: "interest_details",
                hash: ""
            },
        ],
    },
]

// Organizations (register-of-interests entries grouped by normalized org name).
// Catalogue (/organizations) + a detail page (/organizations/:id) under a result
// layout. The catalogue index renders only the section header; this collapsible
// OVERVIEW entry renders on the detail page. data_section/data_sub_section match
// the NS_ORGANIZATIONS_OVERVIEW handle so the row highlights; labels resolve via
// `sidebar.labels`.
export const organizations: SidebarConfig[] = [
    {
        label: "organizations_overview",
        icon: "layout-dashboard",
        data_section: "organizations",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_ORGANIZATIONS_OVERVIEW",
        items: [
            {
                label: "org_details",
                hash: ""
            },
        ],
    },
]

// Meetings (sessions / sittings). Leaf entity — a catalogue (/meetings) + a leaf
// detail page (/meetings/:id) under a result layout, mirroring groups' overview.
// The catalogue index renders only the section header (its PAGE_CONFIG sidebar
// has labels_loc_object: null); this collapsible OVERVIEW entry renders on the
// detail page, where its hash-anchored section (id="" on the overview) is shown.
// `data_section`/`data_sub_section` match the NS_MEETINGS_OVERVIEW handle so the
// row highlights; labels resolve via `sidebar.labels`.
export const meetings: SidebarConfig[] = [
    {
        label: "meetings_overview",
        icon: "layout-dashboard",
        data_section: "meetings",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_MEETINGS_OVERVIEW",
        items: [
            { label: "meeting_details", hash: "" },
            { label: "agendas", hash: "agendas" },
            { label: "votings", hash: "votings" },
            { label: "speeches", hash: "speeches" },
            { label: "docs", hash: "docs" },
            { label: "events", hash: "events" },
            { label: "contributors", hash: "contributors" },
        ],
    },
    {
        label: "agendas",
        icon: "list-ordered",
        data_section: "meetings",
        data_sub_section: "agendas",
        is_collapsible: false,
        page_key: "NS_MEETINGS_AGENDAS",
    },
    {
        label: "votings",
        icon: "vote",
        data_section: "meetings",
        data_sub_section: "votes",
        is_collapsible: false,
        page_key: "NS_MEETINGS_VOTINGS",
    },
    {
        label: "speeches",
        icon: "mic",
        data_section: "meetings",
        data_sub_section: "speeches",
        is_collapsible: false,
        page_key: "NS_MEETINGS_SPEECHES",
    },
    {
        label: "docs",
        icon: "paperclip",
        data_section: "meetings",
        data_sub_section: "docs",
        is_collapsible: false,
        page_key: "NS_MEETINGS_DOCS",
    },
    {
        label: "events",
        icon: "calendar-range",
        data_section: "meetings",
        data_sub_section: "events",
        is_collapsible: false,
        page_key: "NS_MEETINGS_EVENTS",
    },
    {
        label: "contributors",
        icon: "file-signature",
        data_section: "meetings",
        data_sub_section: "contributors",
        is_collapsible: false,
        page_key: "NS_MEETINGS_CONTRIBUTORS",
    },
]

// Groups (parliamentary groups / factions / committees). Detail family like
// affairs: catalogue (/groups) + overview (/groups/:id) + two flat feeds
// (contributions, meetings). The collapsible OVERVIEW entry renders on the detail
// page; its hash anchors match the overview snippet section ids. `data_section` /
// `data_sub_section` match the site.config.ts handles so rows highlight; labels
// resolve via `sidebar.labels`.
export const groups: SidebarConfig[] = [
    {
        label: "groups_overview",
        icon: "layout-dashboard",
        data_section: "groups",
        data_sub_section: "overview",
        is_collapsible: true,
        page_key: "NS_GROUPS_OVERVIEW",
        items: [
            {
                label: "personal_data",
                hash: ""
            },
            {
                label: "contributions",
                hash: "contributions"
            },
            {
                label: "meetings",
                hash: "meetings"
            },
            {
                label: "memberships",
                hash: "memberships"
            },
            {
                label: "votings",
                hash: "votings"
            },
        ],
    },
    {
        label: "contributions",
        icon: "file-signature",
        data_section: "groups",
        data_sub_section: "contributions",
        is_collapsible: false,
        page_key: "NS_GROUPS_CONTRIBUTIONS",
    },
    {
        label: "meetings",
        icon: "calendar-days",
        data_section: "groups",
        data_sub_section: "meetings",
        is_collapsible: false,
        page_key: "NS_GROUPS_MEETINGS",
    },
    {
        label: "memberships",
        icon: "id-card",
        data_section: "groups",
        data_sub_section: "memberships",
        is_collapsible: false,
        page_key: "NS_GROUPS_MEMBERSHIPS",
    },
    {
        label: "votings",
        icon: "vote",
        data_section: "groups",
        data_sub_section: "votes",
        is_collapsible: false,
        page_key: "NS_GROUPS_VOTINGS",
    },
]

const nulls = {
    // votings: null,
    // groups: null,  // now a real section (see `groups` above)
    // interests: null,  // now a real section (see `interests` above)
    agendas: null,
    images: null,
    NONE: null
}


export default { persons, bodies, affairs, votings, texts, docs, speeches, groups, interests, organizations, meetings, ...nulls }

// location of index route 
export const sectionSeachLocationMap = {
    persons: "NS_PEOPLE_INDEX",
    bodies: "NS_BODIES_INDEX",
    affairs: "NS_AFFAIRS_INDEX",
    groups: "NS_GROUPS_INDEX",
    votings: "NS_VOTINGS_INDEX",
    texts: "NS_TEXTS_INDEX",
    speeches: "NS_SPEECHES_INDEX",
    interests: "NS_INTERESTS_INDEX",
    organizations: "NS_ORGANIZATIONS_INDEX",
    meetings: "NS_MEETINGS_INDEX",
    docs: "NS_DOCS_INDEX",

} as Record<DataSectionsNamespaces, PageNamespaces>


// PAGE_CONFIG icon_namespace

export const IconMap: Record<string, IconName> = {
    Home: "house",
    People: "user",
    Bodies: "landmark",
    Affairs: "file-text",
    Votings: "vote",
    Groups: "users-2",
    Meetings: "calendar-days",
    Interests: "briefcase",
    Organizations: "share-2",
    Speeches: "mic",
    Texts: "newspaper",
    Docs: "paperclip",
    Alignment: "scatter-chart",
    // Reuses the alignment chart mark — the sprite carries no dedicated
    // traffic/analytics symbol.
    TrafficStats: "scatter-chart",
    About: "info",
    Faq: "message-square-quote",
    // No leaf/sprout symbol in the sprite — "globe" is the closest existing icon.
    Sustainability: "globe",
    // No accessibility (person-in-circle) symbol in the sprite either.
    Accessibility: "heart-handshake",
    Imprint: "id-card",
}

export type DataSections = {
    namespace: PageNamespaces,
    icon: IconName,
    label: string
}


// label: locs.sidebar.section_switcher

// Site-level nav links (not data sections) — rendered in the sidebar footer,
// always visible regardless of the active section. `label` resolves via
// `loc_data_dashboard.sidebar.<label>`; `page_key` drives the localized href.
export const siteNav: { label: string; icon: IconName; page_key: PageNamespaces }[] = [
    { label: "about", icon: "info", page_key: "NS_ABOUT" },
    { label: "faq", icon: "message-square-quote", page_key: "NS_FAQ" },
]

export const dataSections: DataSections[] = [
    { namespace: "NS_PEOPLE_INDEX", icon: "user", label: "people" },
    { namespace: "NS_AFFAIRS_INDEX", icon: "file-text", label: "affairs" },
    { namespace: "NS_VOTINGS_INDEX", icon: "vote", label: "votings" },
    { namespace: "NS_SPEECHES_INDEX", icon: "mic", label: "speeches" },
    { namespace: "NS_BODIES_INDEX", icon: "landmark", label: "bodies" },
    { namespace: "NS_GROUPS_INDEX", icon: "users-2", label: "groups" },
    { namespace: "NS_MEETINGS_INDEX", icon: "calendar-days", label: "meetings" },
    { namespace: "NS_TEXTS_INDEX", icon: "newspaper", label: "texts" },
    { namespace: "NS_DOCS_INDEX", icon: "paperclip", label: "documents" },
    { namespace: "NS_INTERESTS_INDEX", icon: "briefcase", label: "interests" },
    { namespace: "NS_ORGANIZATIONS_INDEX", icon: "share-2", label: "organizations" },
]

// The data sections grouped into four quiet clusters — shared by the header's
// Explore panel and the sidebar's generic section nav. Group naming avoids the
// heading/item collisions ("Geschäfte" twice, "Dokumente" twice in de). Item
// `label` keys resolve via `section_switcher` (sidebar) / `nav.*` (header);
// `group` keys exist in both loc maps.
export const NAV_SECTION_GROUPS: {
    group: string
    items: { label: string; ns: PageNamespaces; icon: IconName }[]
}[] = [
        {
            group: "group_parliament",
            items: [
                { label: "people", ns: "NS_PEOPLE_INDEX", icon: "user" },
                { label: "bodies", ns: "NS_BODIES_INDEX", icon: "landmark" },
                { label: "groups", ns: "NS_GROUPS_INDEX", icon: "users-2" },
            ],
        },
        {
            group: "group_proceedings",
            items: [
                { label: "affairs", ns: "NS_AFFAIRS_INDEX", icon: "file-text" },
                { label: "votings", ns: "NS_VOTINGS_INDEX", icon: "vote" },
                { label: "meetings", ns: "NS_MEETINGS_INDEX", icon: "calendar-days" },
            ],
        },
        {
            group: "group_records",
            items: [
                { label: "speeches", ns: "NS_SPEECHES_INDEX", icon: "mic" },
                { label: "texts", ns: "NS_TEXTS_INDEX", icon: "newspaper" },
                { label: "documents", ns: "NS_DOCS_INDEX", icon: "paperclip" },
            ],
        },
        {
            group: "group_lobbying",
            items: [
                { label: "interests", ns: "NS_INTERESTS_INDEX", icon: "briefcase" },
                { label: "organizations", ns: "NS_ORGANIZATIONS_INDEX", icon: "share-2" },
            ],
        },
    ]