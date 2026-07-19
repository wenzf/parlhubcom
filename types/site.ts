import type { UIMatch } from 'react-router'


// --- helpers

/** An object whose every value is a string (arktype `{ "[string]": "string" }`). */
export type StringRecord = Record<string, string>;

/** A record that carries an unknown `data` payload. */
export interface RecordWithDataObject {
    data: unknown;
}


// ---


export interface SiteLangs {
    lang_code: 'en' | 'de' | 'fr' | 'it' | 'rm' | 'es' | 'pt';
    lang_html: string;
    lang_param: string;
    default: boolean;
    label: string;
    charset: 'latin' | 'chinese-simplified';
}

export interface Settings {
    theme: 'dark' | 'light' | 'system';
    font_size: number;
    show_cookie_consent_message: boolean;
    ui_high_contrast: boolean;
    ui_grayscale: boolean;
    msg_lang_hint: boolean;
    /** Preferred *content* (data) language, independent of the interface language.
     *  It sets the primary slot of the loc() priority; the remaining supported
     *  languages follow in canonical order (see `resolveContentLangs`). `null` =
     *  "auto" — follow the page/interface language. One of SiteLangs['lang_code']. */
    content_lang: SiteLangs['lang_code'] | null;
}

export const PAGE_NAMESPACES = [
    "NS_LANG_LAYOUT",
    "NS_PEOPLE_RESULT_LAYOUT",
    "NS_BODIES_RESULT_LAYOUT",
    "NS_DATA_DASHBOARD_LAYOUT",
    // PAGES
    "NS_START",
    "NS_ABOUT",
    "NS_FAQ",
    // /project/* section (standalone, no data sidebar)
    "NS_PROJECT_INDEX",
    "NS_SUSTAINABILITY",
    "NS_ACCESSIBILITY",
    "NS_TRAFFIC_STATS",
    "NS_PROJECT_DATA_MAP",
    "NS_PROJECT_DATA_GUIDE",
    "NS_PROJECT_METHODOLOGY",
    "NS_IMPRINT",
    "NS_PEOPLE_INDEX",
    "NS_BODIES_INDEX",
    "NS_BODIES_OVERVIEW",
    "NS_BODIES_PEOPLE",
    "NS_BODIES_VOTINGS",
    "NS_BODIES_AFFAIRS",
    "NS_BODIES_DOCS",
    "NS_BODIES_TEXTS",
    "NS_BODIES_LOYALTY",
    "NS_BODIES_ALIGNMENT",
    "NS_BODIES_LOBBY",
    "NS_BODIES_DISCUSSION",
    "NS_AFFAIRS_INDEX",
    "NS_AFFAIRS_OVERVIEW",
    "NS_AFFAIRS_VOTINGS",
    "NS_AFFAIRS_CONTRIBUTORS",
    "NS_AFFAIRS_SPEECHES",
    "NS_AFFAIRS_DOCS",
    "NS_AFFAIRS_TEXTS",
    "NS_AFFAIRS_EVENTS",
    "NS_VOTINGS_INDEX",
    "NS_VOTINGS_OVERVIEW",
    "NS_TEXTS_INDEX",
    "NS_TEXTS_OVERVIEW",
    "NS_DOCS_INDEX",
    "NS_DOCS_OVERVIEW",
    "NS_SPEECHES_INDEX",
    "NS_SPEECHES_OVERVIEW",
    // meetings (catalogue + leaf overview)
    "NS_MEETINGS_INDEX",
    "NS_MEETINGS_OVERVIEW",
    // meetings sub-feeds (/meetings/:id/<feed>)
    "NS_MEETINGS_AGENDAS",
    "NS_MEETINGS_VOTINGS",
    "NS_MEETINGS_SPEECHES",
    "NS_MEETINGS_DOCS",
    "NS_MEETINGS_EVENTS",
    "NS_MEETINGS_CONTRIBUTORS",
    // interests (catalogue + leaf overview)
    "NS_INTERESTS_INDEX",
    "NS_INTERESTS_OVERVIEW",
    // groups (catalogue + overview + two feeds)
    "NS_GROUPS_INDEX",
    "NS_GROUPS_OVERVIEW",
    "NS_GROUPS_CONTRIBUTIONS",
    "NS_GROUPS_MEETINGS",
    "NS_GROUPS_MEMBERSHIPS",
    "NS_GROUPS_VOTINGS",
    "NS_PEOPLE_ACCESS_BADGES",
    "NS_PEOPLE_CONTRIBUTORS",
    "NS_PEOPLE_INTERESTS",
    "NS_PEOPLE_MEMBERSHIPS",
    "NS_PEOPLE_OVERVIEW",
    "NS_PEOPLE_SPEECHES",
    "NS_PEOPLE_VOTES",
    "NS_PEOPLE_IMAGES",
    "NS_PEOPLE_VOCABULARY",
    "NS_PEOPLE_ALIGNMENT",
    // organizations (catalogue + detail + layout)
    "NS_ORGANIZATIONS_INDEX",
    "NS_ORGANIZATIONS_OVERVIEW",
    "NS_ORGANIZATIONS_RESULT_LAYOUT",
    // experiments (index + wordfish showcase) — standalone info pages
    "NS_EXPERIMENTS_INDEX",
    "NS_EXPERIMENTS_WORDFISH",
] as const

export type PageNamespaces = (typeof PAGE_NAMESPACES)[number]

export const DATA_SECTIONS_NAMESPACES = [
    "persons", "bodies", "votes", "groups", "affairs", "agendas", "NONE",
    "interests", "images", "access_badges", "speeches", "contributions",
    "memberships", "docs", "contributors", "events", "texts", "votings",
    "meetings", "vocabulary", "loyalty", "alignment", "lobby", "discussion", "organizations"
] as const

export type DataSectionsNamespaces = (typeof DATA_SECTIONS_NAMESPACES)[number]

export interface DataFromConfig {
    data_origin?: PageNamespaces;
    data_key_type?: 'dotprop';
    data_key?: string;
    /** Optional dotprop path tried when `data_key` resolves to null/undefined.
     *  Lets a config express a "primary ?? fallback" display value (e.g. a body's
     *  legislative_name ?? name — most municipalities have no legislative_name). */
    data_key_fallback?: string;
    /** Match whose loaderData the fallback resolves against (defaults to
     *  `data_origin`). Lets an entity crumb fall back to a *localized* placeholder
     *  from a layout's `locs` when its own data field is empty (e.g. a speech with
     *  no type → the `NS_DATA_DASHBOARD_LAYOUT` "Speech" label). */
    data_key_fallback_origin?: PageNamespaces;
}


export interface PageHandle {
    page_key?: PageNamespaces;
    is_primary_data_match?: boolean;
    breadcrumbs?: {
        label: DataFromConfig;
        path: PageNamespaces;
    }[];
}


export interface PageEntry {
    handle?: PageHandle;
    path_fragment?: string;
    absolute_path?: string;
    data_section?: DataSectionsNamespaces;
    data_sub_section?: DataSectionsNamespaces | 'overview';
    sidebar?: {
        section_title?: DataFromConfig | null;
        section_subtitle?: DataFromConfig | null;
        labels_loc_object?: DataFromConfig | null;
        icon_namespace?: string;
    } | null;
}


export type PageConfig = Record<PageNamespaces, PageEntry>


export interface SiteUIMatch extends UIMatch {
    handle: PageHandle
}


export interface SidebarData {
    header?: {
        section_title?: string;
        section_subtitle?: string;
        icon_namespace?: string;
    } | null;
    location: {
        data_sub_section: DataSectionsNamespaces | 'overview';
        data_section: DataSectionsNamespaces;
        page_key: PageNamespaces;
    };
    labels: {
        labels_loc_object: StringRecord;
    } | null;
}
