/**
 * opd_db.ts
 *
 * TypeScript row types + DuckDB column-type maps for the OPD dataset tables.
 *
 * Per-table structure
 * -----------------------------------------------------------------------
 * XxxBase       — non-localized fields (shared between DB and client)
 * XxxLocalized  — all _de/_fr/_it/_rm/_en field groups (DB only)
 * Xxx           — XxxBase & XxxLocalized — full DB row
 * XxxClient     — XxxBase + resolved single-language fields (dates as epoch ms)
 *
 * Tables with no localized fields (agendas, person_images) export only
 * Xxx — no client type needed (a client variant is added where dates differ).
 *
 * Naming rule for client fields
 * -----------------------------------------------------------------------
 * - `xxx_de/fr/it` group → client field `xxx`
 * - Strip the language suffix to get the client field name: `type_harmonized_de/fr/it`
 *   → client field `type_harmonized`, regardless of whether a base field
 *   with the same name already exists.
 *
 * DuckDB types
 * -----------------------------------------------------------------------
 * - INTEGER          → number / number | null
 * - VARCHAR / DATE   → string / string | null
 * - BOOLEAN          → boolean | null
 * - DOUBLE           → string | null in the DB row (source ndjson has ISO
 *   timestamp strings); the query converts them to epoch millis (DOUBLE) so
 *   getRowObjects() returns plain JS numbers on the *Client shapes.
 * - tsvector columns are excluded (Postgres internal, not in ndjson)
 */

// =============================================================================
// DuckDB column type union
// =============================================================================

export type DuckDBSqlType =
    | "BOOLEAN"
    | "TINYINT"
    | "SMALLINT"
    | "INTEGER"
    | "BIGINT"
    | "HUGEINT"
    | "DOUBLE"
    | "DECIMAL"
    | "VARCHAR"
    | "DATE"
    | "TIME"
    | "TIMESTAMP"
    | "TIMESTAMP_MS"
    | "TIMESTAMPTZ"
    | "BLOB"
    | "UUID"
    | "JSON";

// =============================================================================
// Shared column map entries
// =============================================================================

export const recordMetadataColumns = {
    created_at: "DOUBLE",
    updated_at: "DOUBLE",
    updated_external_at: "DOUBLE",
} as const satisfies Record<string, DuckDBSqlType>;

// =============================================================================
// access_badges        (table_view: access_badges)
// =============================================================================

interface AccessBadgeBase {
    id: number;
    body_key?: string | null;
    person_external_id?: string | null;
    person_id?: number | null;
    external_id?: string | null;
    person_fullname?: string | null;
    beneficiary_person_id?: number | null;
    beneficiary_person_fullname?: string | null;
    beneficiary_group?: string | null;
    type_harmonized?: string | null;
    valid_from?: string | null;
    valid_to?: string | null;
    version?: number | null;
    latest?: boolean | null;
    body_id?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface AccessBadgeLocalized {
    type_de?: string | null;
    type_fr?: string | null;
    type_it?: string | null;
}

export interface AccessBadge extends AccessBadgeBase, AccessBadgeLocalized { }
export interface AccessBadgeClient extends Omit<AccessBadgeBase, "valid_from" | "valid_to" | "created_at" | "updated_at" | "updated_external_at"> {
    valid_from?: number | null;
    valid_to?: number | null;
    type?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const accessBadgeColumns = {
    id: "INTEGER",
    body_key: "VARCHAR",
    person_external_id: "VARCHAR",
    person_id: "INTEGER",
    external_id: "VARCHAR",
    person_fullname: "VARCHAR",
    beneficiary_person_id: "INTEGER",
    beneficiary_person_fullname: "VARCHAR",
    beneficiary_group: "VARCHAR",
    type_de: "VARCHAR",
    type_fr: "VARCHAR",
    type_it: "VARCHAR",
    type_harmonized: "VARCHAR",
    valid_from: "DOUBLE",
    valid_to: "DOUBLE",
    version: "INTEGER",
    latest: "BOOLEAN",
    body_id: "INTEGER",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const ACCESS_BADGES_TABLE_NAME = "access_badges";

// =============================================================================
// affairs              (table_view: affairs)
// =============================================================================

interface AffairBase {
    id: number;
    body_id?: number | null;
    body_key: string;
    number?: string | null;
    external_id?: string | null;
    external_alternative_id?: string | null;
    type_harmonized_id?: number | null;
    type_harmonized_wikidata_id?: string | null;
    // type_harmonized is the key/code — labels are in Localized
    type_harmonized?: string | null;
    state_name_harmonized_id?: number | null;
    active?: boolean | null;
    type_external_id?: string | null;
    state_external_id?: string | null;
    begin_date?: string | null;
    end_date?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface AffairLocalized {
    type_harmonized_de?: string | null;
    type_harmonized_fr?: string | null;
    type_harmonized_it?: string | null;
    type_harmonized_rm?: string | null;
    type_harmonized_en?: string | null;
    state_name_harmonized_de?: string | null;
    state_name_harmonized_fr?: string | null;
    state_name_harmonized_it?: string | null;
    state_name_harmonized_rm?: string | null;
    title_de?: string | null;
    title_fr?: string | null;
    title_it?: string | null;
    title_rm?: string | null;
    title_long_de?: string | null;
    title_long_fr?: string | null;
    title_long_it?: string | null;
    title_long_rm?: string | null;
    type_name_de?: string | null;
    type_name_fr?: string | null;
    type_name_it?: string | null;
    type_name_rm?: string | null;
    state_name_de?: string | null;
    state_name_fr?: string | null;
    state_name_it?: string | null;
    state_name_rm?: string | null;
    url_external_de?: string | null;
    url_external_fr?: string | null;
    url_external_it?: string | null;
    url_external_rm?: string | null;
}

export interface Affair extends AffairBase, AffairLocalized { }
export interface AffairClient extends Omit<AffairBase, "begin_date" | "end_date" | "created_at" | "updated_at" | "updated_external_at" | "type_harmonized"> {
    begin_date?: number | null;
    end_date?: number | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
    type_harmonized?: string | null;
    state_name_harmonized?: string | null;
    title?: string | null;
    title_long?: string | null;
    type_name?: string | null;
    state_name?: string | null;
    url_external?: string | null;
}

export const affairColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    number: "VARCHAR",
    external_id: "VARCHAR",
    external_alternative_id: "VARCHAR",
    type_harmonized_id: "INTEGER",
    type_harmonized_wikidata_id: "VARCHAR",
    type_harmonized_de: "VARCHAR",
    type_harmonized_fr: "VARCHAR",
    type_harmonized_it: "VARCHAR",
    type_harmonized_rm: "VARCHAR",
    type_harmonized_en: "VARCHAR",
    state_name_harmonized_id: "INTEGER",
    state_name_harmonized_de: "VARCHAR",
    state_name_harmonized_fr: "VARCHAR",
    state_name_harmonized_it: "VARCHAR",
    state_name_harmonized_rm: "VARCHAR",
    active: "BOOLEAN",
    title_de: "VARCHAR",
    title_fr: "VARCHAR",
    title_it: "VARCHAR",
    title_rm: "VARCHAR",
    title_long_de: "VARCHAR",
    title_long_fr: "VARCHAR",
    title_long_it: "VARCHAR",
    title_long_rm: "VARCHAR",
    type_name_de: "VARCHAR",
    type_name_fr: "VARCHAR",
    type_name_it: "VARCHAR",
    type_name_rm: "VARCHAR",
    type_external_id: "VARCHAR",
    state_name_de: "VARCHAR",
    state_name_fr: "VARCHAR",
    state_name_it: "VARCHAR",
    state_name_rm: "VARCHAR",
    state_external_id: "VARCHAR",
    begin_date: "DOUBLE",
    end_date: "DOUBLE",
    url_external_de: "VARCHAR",
    url_external_fr: "VARCHAR",
    url_external_it: "VARCHAR",
    url_external_rm: "VARCHAR",
    type_harmonized: "VARCHAR",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const AFFAIRS_TABLE_NAME = "affairs";

// =============================================================================
// agendas              (table_view: agendas)
// No localized fields — single type.
// =============================================================================

export interface Agenda {
    id: number;
    body_id?: number | null;
    body_key: string;
    meeting_id?: number | null;
    item_date?: string | null;
    item_external_id?: string | null;
    item_title?: string | null;
    item_number_display?: string | null;
    item_category?: string | null;
    item_url?: string | null;
    item_affair_number?: string | null;
    item_affair_id?: number | null;
    item_language?: string | null;
    item_description?: string | null;
    item_number?: number | null;
    item_result?: string | null;
    item_status?: string | null;
    created_at?: string | null;
}

/** Query-output variant: item_date / created_at arrive as epoch-millis numbers. */
export interface AgendaClient extends Omit<Agenda, "item_date" | "created_at"> {
    item_date?: number | null;
    created_at?: number | null;
}

export const agendaColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    meeting_id: "INTEGER",
    item_date: "DOUBLE",
    item_external_id: "VARCHAR",
    item_title: "VARCHAR",
    item_number_display: "VARCHAR",
    item_category: "VARCHAR",
    item_url: "VARCHAR",
    item_affair_number: "VARCHAR",
    item_affair_id: "INTEGER",
    item_language: "VARCHAR",
    item_description: "VARCHAR",
    item_number: "INTEGER",
    item_result: "VARCHAR",
    item_status: "VARCHAR",
    created_at: "DOUBLE",
} as const satisfies Record<string, DuckDBSqlType>;

export const AGENDAS_TABLE_NAME = "agendas";

// =============================================================================
// bodies               (table_view: bodies)
// =============================================================================

interface BodyBase {
    id: number;
    body_key: string;
    // general name fields (no language suffix) — localized variants in Localized
    name?: string | null;
    legislative_name?: string | null;
    executive_name?: string | null;
    wikidata_id?: string | null;
    lang?: string | null;
    indexed?: boolean | null;
    type?: string | null;
    canton_key?: string | null;
    canton_id_bfs?: number | null;
    canton_table_id?: string | null;
    country_key?: string | null;
    position?: number | null;
    legislative_wikidata_id?: string | null;
    legislative_seats?: number | null;
    executive_wikidata_id?: string | null;
    executive_seats?: number | null;
    consultations_url?: string | null;
    flag_image_url?: string | null;
    flag_image_oparl_url?: string | null;
    has_parliament?: boolean | null;
    population?: number | null;
    languages?: string | null;
    elections_and_votings_url?: string | null;
}

interface BodyLocalized {
    name_de?: string | null;
    name_fr?: string | null;
    name_it?: string | null;
    name_en?: string | null;
    legislative_name_de?: string | null;
    legislative_name_fr?: string | null;
    legislative_name_it?: string | null;
    legislative_name_en?: string | null;
    executive_name_de?: string | null;
    executive_name_fr?: string | null;
    executive_name_it?: string | null;
    executive_name_en?: string | null;
    type_name_de?: string | null;
    type_name_fr?: string | null;
    type_name_it?: string | null;
    type_name_rm?: string | null;
    type_name_en?: string | null;
}

export interface Body extends BodyBase, BodyLocalized { }
// BodyClient = BodyBase & { name, legislative_name, executive_name, type_name } (.and)
export interface BodyClient extends BodyBase {
    name?: string | null;
    legislative_name?: string | null;
    executive_name?: string | null;
    type_name?: string | null;
}

export const bodyColumns = {
    id: "INTEGER",
    body_key: "VARCHAR",
    legislative_name_de: "VARCHAR",
    legislative_name_fr: "VARCHAR",
    legislative_name_it: "VARCHAR",
    legislative_name_en: "VARCHAR",
    name_de: "VARCHAR",
    name_fr: "VARCHAR",
    name_it: "VARCHAR",
    name_en: "VARCHAR",
    type_name_de: "VARCHAR",
    type_name_fr: "VARCHAR",
    type_name_it: "VARCHAR",
    type_name_rm: "VARCHAR",
    type_name_en: "VARCHAR",
    executive_name_de: "VARCHAR",
    executive_name_fr: "VARCHAR",
    executive_name_it: "VARCHAR",
    executive_name_en: "VARCHAR",
    wikidata_id: "VARCHAR",
    name: "VARCHAR",
    lang: "VARCHAR",
    indexed: "BOOLEAN",
    type: "VARCHAR",
    canton_key: "VARCHAR",
    canton_id_bfs: "INTEGER",
    canton_table_id: "VARCHAR",
    country_key: "VARCHAR",
    position: "INTEGER",
    legislative_name: "VARCHAR",
    legislative_wikidata_id: "VARCHAR",
    legislative_seats: "INTEGER",
    executive_name: "VARCHAR",
    executive_wikidata_id: "VARCHAR",
    executive_seats: "INTEGER",
    consultations_url: "VARCHAR",
    flag_image_url: "VARCHAR",
    flag_image_oparl_url: "VARCHAR",
    has_parliament: "BOOLEAN",
    population: "INTEGER",
    languages: "VARCHAR",
    elections_and_votings_url: "VARCHAR"
} as const satisfies Record<string, DuckDBSqlType>;

export const BODIES_TABLE_NAME = "bodies";

// =============================================================================
// contributors         (table_view: contributors)
// =============================================================================

interface ContributorBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    affair_id?: number | null;
    news_id?: number | null;
    person_id?: number | null;
    group_id?: number | null;
    meeting_id?: number | null;
    session_id?: number | null;
    type?: string | null;
    role_external_id?: string | null;
    // role_harmonized is the key — labels in Localized
    role_harmonized?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    fullname?: string | null;
    party_wikidata_id?: string | null;
    position?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface ContributorLocalized {
    role_de?: string | null;
    role_fr?: string | null;
    role_it?: string | null;
    role_rm?: string | null;
    role_harmonized_de?: string | null;
    role_harmonized_fr?: string | null;
    role_harmonized_it?: string | null;
    role_harmonized_rm?: string | null;
    role_harmonized_en?: string | null;
    party_de?: string | null;
    party_fr?: string | null;
    party_it?: string | null;
    party_rm?: string | null;
    party_harmonized_de?: string | null;
    party_harmonized_fr?: string | null;
    party_harmonized_it?: string | null;
}

export interface Contributor extends ContributorBase, ContributorLocalized { }
export interface ContributorClient extends Omit<ContributorBase, "role_harmonized" | "created_at" | "updated_at" | "updated_external_at"> {
    role?: string | null;
    role_harmonized?: string | null;
    party?: string | null;
    party_harmonized?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const contributorColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    affair_id: "INTEGER",
    news_id: "INTEGER",
    person_id: "INTEGER",
    group_id: "INTEGER",
    meeting_id: "INTEGER",
    session_id: "INTEGER",
    type: "VARCHAR",
    role_de: "VARCHAR",
    role_fr: "VARCHAR",
    role_it: "VARCHAR",
    role_rm: "VARCHAR",
    role_external_id: "VARCHAR",
    role_harmonized: "VARCHAR",
    role_harmonized_de: "VARCHAR",
    role_harmonized_fr: "VARCHAR",
    role_harmonized_it: "VARCHAR",
    role_harmonized_rm: "VARCHAR",
    role_harmonized_en: "VARCHAR",
    firstname: "VARCHAR",
    lastname: "VARCHAR",
    fullname: "VARCHAR",
    party_de: "VARCHAR",
    party_fr: "VARCHAR",
    party_it: "VARCHAR",
    party_rm: "VARCHAR",
    party_harmonized_de: "VARCHAR",
    party_harmonized_fr: "VARCHAR",
    party_harmonized_it: "VARCHAR",
    party_wikidata_id: "VARCHAR",
    position: "INTEGER",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const CONTRIBUTORS_TABLE_NAME = "contributors";

// =============================================================================
// docs                 (table_view: docs)
// =============================================================================

interface DocBase {
    id: number;
    body_id?: number | null;
    body_key: string;
    parent_type?: string | null;
    hash?: string | null;
    external_id?: string | null;
    external_alternative_id?: string | null;
    name?: string | null;
    url?: string | null;
    url_oparl?: string | null;
    date?: string | null;
    size?: number | null;
    category_harmonized?: string | null;
    format?: string | null;
    language?: string | null;
    updated_external_at?: string | null;
    updated_at?: string | null;
    text?: string | null;
    tika_metadata?: string | null;
    affair_id?: number | null;
    meeting_id?: number | null;
    agenda_id?: number | null;
    news_id?: number | null;
}

interface DocLocalized {
    category_de?: string | null;
    category_fr?: string | null;
    category_it?: string | null;
}

export interface Doc extends DocBase, DocLocalized { }
// DocClient = DocBase & { category } (.and)
export interface DocClient extends DocBase {
    category?: string | null;
}

export const docColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    parent_type: "VARCHAR",
    hash: "VARCHAR",
    external_id: "VARCHAR",
    external_alternative_id: "VARCHAR",
    name: "VARCHAR",
    url: "VARCHAR",
    url_oparl: "VARCHAR",
    date: "DATE",
    size: "INTEGER",
    category_de: "VARCHAR",
    category_fr: "VARCHAR",
    category_it: "VARCHAR",
    category_harmonized: "VARCHAR",
    format: "VARCHAR",
    language: "VARCHAR",
    updated_external_at: "DOUBLE",
    updated_at: "DOUBLE",
    text: "VARCHAR",
    tika_metadata: "VARCHAR",
    affair_id: "INTEGER",
    meeting_id: "INTEGER",
    agenda_id: "INTEGER",
    news_id: "INTEGER",
} as const satisfies Record<string, DuckDBSqlType>;

export const DOCS_TABLE_NAME = "docs";

// =============================================================================
// events               (table_view: events)
// =============================================================================

interface EventBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    date?: string | null;
    position?: number | null;
    title_external_id?: string | null;
    // title_harmonized is the raw key — labels in Localized
    title_harmonized?: string | null;
    actor_external_id?: string | null;
    actor_type?: string | null;
    affair_id?: number | null;
    meeting_parent_type?: string | null;
    meeting_id?: number | null;
    meeting_parent_external_id?: string | null;
    details_url?: string | null;
    details_text?: string | null;
    last?: boolean | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface EventLocalized {
    title_de?: string | null;
    title_fr?: string | null;
    title_it?: string | null;
    title_rm?: string | null;
    title_harmonized_de?: string | null;
    title_harmonized_fr?: string | null;
    title_harmonized_it?: string | null;
    title_harmonized_rm?: string | null;
    title_harmonized_en?: string | null;
    actor_de?: string | null;
    actor_fr?: string | null;
    actor_it?: string | null;
}

export interface Event extends EventBase, EventLocalized { }
export interface EventClient extends Omit<EventBase, "title_harmonized" | "created_at" | "updated_at" | "updated_external_at"> {
    title?: string | null;
    title_harmonized?: string | null;
    actor?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const eventColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    date: "DATE",
    position: "INTEGER",
    title_de: "VARCHAR",
    title_fr: "VARCHAR",
    title_it: "VARCHAR",
    title_rm: "VARCHAR",
    title_external_id: "VARCHAR",
    title_harmonized: "VARCHAR",
    title_harmonized_de: "VARCHAR",
    title_harmonized_fr: "VARCHAR",
    title_harmonized_it: "VARCHAR",
    title_harmonized_rm: "VARCHAR",
    title_harmonized_en: "VARCHAR",
    actor_de: "VARCHAR",
    actor_fr: "VARCHAR",
    actor_it: "VARCHAR",
    actor_external_id: "VARCHAR",
    actor_type: "VARCHAR",
    affair_id: "INTEGER",
    meeting_parent_type: "VARCHAR",
    meeting_id: "INTEGER",
    meeting_parent_external_id: "VARCHAR",
    details_url: "VARCHAR",
    details_text: "VARCHAR",
    last: "BOOLEAN",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const EVENTS_TABLE_NAME = "events";

// =============================================================================
// external_links       (table_view: external_links)
// =============================================================================

interface ExternalLinkBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    person_id?: number | null;
    affair_id?: number | null;
    // type_harmonized_en is English-only, no full localized set
    type_harmonized_en?: string | null;
    created_external_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface ExternalLinkLocalized {
    url_de?: string | null;
    url_fr?: string | null;
    url_it?: string | null;
    name_de?: string | null;
    name_fr?: string | null;
    name_it?: string | null;
    type_external_de?: string | null;
    type_external_fr?: string | null;
    type_external_it?: string | null;
}

export interface ExternalLink extends ExternalLinkBase, ExternalLinkLocalized { }
export interface ExternalLinkClient extends Omit<ExternalLinkBase, "created_at" | "updated_at" | "updated_external_at"> {
    url?: string | null;
    name?: string | null;
    type_external?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const externalLinkColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    person_id: "INTEGER",
    affair_id: "INTEGER",
    url_de: "VARCHAR",
    url_fr: "VARCHAR",
    url_it: "VARCHAR",
    name_de: "VARCHAR",
    name_fr: "VARCHAR",
    name_it: "VARCHAR",
    type_external_de: "VARCHAR",
    type_external_fr: "VARCHAR",
    type_external_it: "VARCHAR",
    type_harmonized_en: "VARCHAR",
    created_external_at: "DOUBLE",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const EXTERNAL_LINKS_TABLE_NAME = "external_links";

// =============================================================================
// groups               (table_view: groups)
// =============================================================================

interface GroupBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    external_alternative_id?: string | null;
    type_harmonized_id?: number | null;
    // type_harmonized is the key — labels in Localized
    type_harmonized?: string | null;
    type_harmonized_position?: number | null;
    type_harmonized_wikidata_id?: string | null;
    active?: boolean | null;
    type_external_id?: string | null;
    begin_date?: string | null;
    end_date?: string | null;
    wikidata_id?: string | null;
    parent_group_external_id?: string | null;
    child_group_external_id?: string | null;
    parent_council_external_id?: string | null;
    contact?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface GroupLocalized {
    url_external_de?: string | null;
    url_external_fr?: string | null;
    url_external_it?: string | null;
    url_external_rm?: string | null;
    type_harmonized_de?: string | null;
    type_harmonized_fr?: string | null;
    type_harmonized_it?: string | null;
    type_harmonized_rm?: string | null;
    type_harmonized_en?: string | null;
    name_de?: string | null;
    name_fr?: string | null;
    name_it?: string | null;
    name_rm?: string | null;
    abbreviation_de?: string | null;
    abbreviation_fr?: string | null;
    abbreviation_it?: string | null;
    abbreviation_rm?: string | null;
    description_de?: string | null;
    description_fr?: string | null;
    description_it?: string | null;
    description_rm?: string | null;
    type_external_de?: string | null;
    type_external_fr?: string | null;
    type_external_it?: string | null;
    type_external_rm?: string | null;
}

export interface Group extends GroupBase, GroupLocalized { }
export interface GroupClient extends Omit<GroupBase, "type_harmonized" | "begin_date" | "end_date" | "created_at" | "updated_at" | "updated_external_at"> {
    begin_date?: number | null;
    end_date?: number | null;
    url_external?: string | null;
    type_harmonized?: string | null;
    name?: string | null;
    abbreviation?: string | null;
    description?: string | null;
    // client-only: the language tag ('de'|'fr'|'it'|'rm') the `description` value
    // was resolved from (loc_lang() in group_by_id.sql). NULL when there is no
    // description. Rendered as the description block's lang attribute.
    description_lang?: string | null;
    type_external?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const groupColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    external_alternative_id: "VARCHAR",
    url_external_de: "VARCHAR",
    url_external_fr: "VARCHAR",
    url_external_it: "VARCHAR",
    url_external_rm: "VARCHAR",
    type_harmonized_id: "INTEGER",
    type_harmonized_de: "VARCHAR",
    type_harmonized_fr: "VARCHAR",
    type_harmonized_it: "VARCHAR",
    type_harmonized_rm: "VARCHAR",
    type_harmonized: "VARCHAR",
    type_harmonized_en: "VARCHAR",
    type_harmonized_position: "INTEGER",
    type_harmonized_wikidata_id: "VARCHAR",
    type_external_de: "VARCHAR",
    active: "BOOLEAN",
    name_de: "VARCHAR",
    name_fr: "VARCHAR",
    name_it: "VARCHAR",
    name_rm: "VARCHAR",
    abbreviation_de: "VARCHAR",
    abbreviation_fr: "VARCHAR",
    abbreviation_it: "VARCHAR",
    abbreviation_rm: "VARCHAR",
    description_de: "VARCHAR",
    description_fr: "VARCHAR",
    description_it: "VARCHAR",
    description_rm: "VARCHAR",
    type_external_fr: "VARCHAR",
    type_external_it: "VARCHAR",
    type_external_rm: "VARCHAR",
    type_external_id: "VARCHAR",
    begin_date: "DOUBLE",
    end_date: "DOUBLE",
    wikidata_id: "VARCHAR",
    parent_group_external_id: "VARCHAR",
    child_group_external_id: "VARCHAR",
    parent_council_external_id: "VARCHAR",
    contact: "VARCHAR",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const GROUPS_TABLE_NAME = "groups";

// =============================================================================
// identities           (endpoint: identities, table_view: person_identities)
// =============================================================================

interface IdentityBase {
    id: number;
    identity_primary_id?: number | null;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    fullname?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    party_harmonized_wikidata_id?: string | null;
    image_url_external?: string | null;
    email?: string | null;
    phone?: string | null;
    birthday?: string | null;
    birthday_format?: string | null;
    deathday?: string | null;
    street?: string | null;
    postal_code?: string | null;
    city?: string | null;
    title?: string | null;
    website_personal?: string | null;
    gender?: string | null;
    active?: boolean | null;
    language?: string | null;
    wikidata_id?: string | null;
    is_primary?: boolean | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface IdentityLocalized {
    party_de?: string | null;
    party_fr?: string | null;
    party_it?: string | null;
    party_harmonized_de?: string | null;
    party_harmonized_fr?: string | null;
    party_harmonized_it?: string | null;
    party_harmonized_en?: string | null;
    occupation_de?: string | null;
    occupation_fr?: string | null;
    occupation_it?: string | null;
    marital_status_de?: string | null;
    marital_status_fr?: string | null;
    marital_status_it?: string | null;
    electoral_district_de?: string | null;
    electoral_district_fr?: string | null;
    electoral_district_it?: string | null;
    parliamentary_group_name_de?: string | null;
    parliamentary_group_name_fr?: string | null;
    parliamentary_group_name_it?: string | null;
    parliamentary_group_name_rm?: string | null;
    website_parliament_url_de?: string | null;
    website_parliament_url_fr?: string | null;
    website_parliament_url_it?: string | null;
}

export interface Identity extends IdentityBase, IdentityLocalized { }
export interface IdentityClient extends Omit<IdentityBase, "deathday" | "created_at" | "updated_at" | "updated_external_at"> {
    deathday?: number | null;
    party?: string | null;
    party_harmonized?: string | null;
    occupation?: string | null;
    marital_status?: string | null;
    electoral_district?: string | null;
    parliamentary_group_name?: string | null;
    website_parliament_url?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const identityColumns = {
    id: "INTEGER",
    identity_primary_id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    fullname: "VARCHAR",
    firstname: "VARCHAR",
    lastname: "VARCHAR",
    party_de: "VARCHAR",
    party_fr: "VARCHAR",
    party_it: "VARCHAR",
    party_harmonized_de: "VARCHAR",
    party_harmonized_fr: "VARCHAR",
    party_harmonized_it: "VARCHAR",
    party_harmonized_en: "VARCHAR",
    party_harmonized_wikidata_id: "VARCHAR",
    image_url_external: "VARCHAR",
    email: "VARCHAR",
    phone: "VARCHAR",
    birthday: "VARCHAR",
    birthday_format: "VARCHAR",
    deathday: "DOUBLE",
    street: "VARCHAR",
    postal_code: "VARCHAR",
    city: "VARCHAR",
    occupation_de: "VARCHAR",
    occupation_fr: "VARCHAR",
    occupation_it: "VARCHAR",
    title: "VARCHAR",
    marital_status_de: "VARCHAR",
    marital_status_fr: "VARCHAR",
    marital_status_it: "VARCHAR",
    electoral_district_de: "VARCHAR",
    electoral_district_fr: "VARCHAR",
    electoral_district_it: "VARCHAR",
    website_personal: "VARCHAR",
    gender: "VARCHAR",
    parliamentary_group_name_de: "VARCHAR",
    parliamentary_group_name_fr: "VARCHAR",
    parliamentary_group_name_it: "VARCHAR",
    parliamentary_group_name_rm: "VARCHAR",
    active: "BOOLEAN",
    language: "VARCHAR",
    wikidata_id: "VARCHAR",
    website_parliament_url_de: "VARCHAR",
    website_parliament_url_fr: "VARCHAR",
    website_parliament_url_it: "VARCHAR",
    is_primary: "BOOLEAN",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const IDENTITIES_TABLE_NAME = "person_identities";

// =============================================================================
// interests            (table_view: interests)
// =============================================================================

interface InterestBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    person_id?: number | null;
    external_id?: string | null;
    begin_date?: string | null;
    declaration_doc_title?: string | null;
    declaration_doc_url?: string | null;
    end_date?: string | null;
    ex_officio?: boolean | null;
    name_id?: number | null;
    place?: string | null;
    role_external_id?: string | null;
    type_external_id?: string | null;
    type_payment_harmonized?: string | null;
    url?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface InterestLocalized {
    type_de?: string | null;
    type_fr?: string | null;
    type_it?: string | null;
    name_de?: string | null;
    name_fr?: string | null;
    name_it?: string | null;
    name_short_de?: string | null;
    name_short_fr?: string | null;
    name_short_it?: string | null;
    group_de?: string | null;
    group_fr?: string | null;
    group_it?: string | null;
    name_abbreviation_de?: string | null;
    name_abbreviation_fr?: string | null;
    name_abbreviation_it?: string | null;
    role_name_de?: string | null;
    role_name_fr?: string | null;
    role_name_it?: string | null;
    type_payment_de?: string | null;
    type_payment_fr?: string | null;
    type_payment_it?: string | null;
}

export interface Interest extends InterestBase, InterestLocalized { }
export interface InterestClient extends Omit<InterestBase, "begin_date" | "end_date" | "created_at" | "updated_at" | "updated_external_at"> {
    begin_date?: number | null;
    end_date?: number | null;
    type?: string | null;
    name?: string | null;
    name_short?: string | null;
    group?: string | null;
    name_abbreviation?: string | null;
    role_name?: string | null;
    type_payment?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const interestColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    person_id: "INTEGER",
    external_id: "VARCHAR",
    type_de: "VARCHAR",
    type_fr: "VARCHAR",
    type_it: "VARCHAR",
    name_de: "VARCHAR",
    name_fr: "VARCHAR",
    name_it: "VARCHAR",
    name_short_de: "VARCHAR",
    name_short_fr: "VARCHAR",
    name_short_it: "VARCHAR",
    begin_date: "DOUBLE",
    declaration_doc_title: "VARCHAR",
    declaration_doc_url: "VARCHAR",
    end_date: "DOUBLE",
    ex_officio: "BOOLEAN",
    group_de: "VARCHAR",
    group_fr: "VARCHAR",
    group_it: "VARCHAR",
    name_abbreviation_de: "VARCHAR",
    name_abbreviation_fr: "VARCHAR",
    name_abbreviation_it: "VARCHAR",
    name_id: "INTEGER",
    place: "VARCHAR",
    role_external_id: "VARCHAR",
    role_name_de: "VARCHAR",
    role_name_fr: "VARCHAR",
    role_name_it: "VARCHAR",
    type_external_id: "VARCHAR",
    type_payment_de: "VARCHAR",
    type_payment_fr: "VARCHAR",
    type_payment_harmonized: "VARCHAR",
    type_payment_it: "VARCHAR",
    url: "VARCHAR",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const INTERESTS_TABLE_NAME = "interests";

// =============================================================================
// meetings             (table_view: meetings)
// =============================================================================

interface MeetingBase {
    id: number;
    body_id?: number | null;
    body_key: string;
    external_id?: string | null;
    type?: string | null;
    group_id?: number | null;
    parent_type?: string | null;
    parent_external_id?: string | null;
    parent_oparl_id?: number | null;
    state?: string | null;
    abbreviation?: string | null;
    number?: string | null;
    begin_date?: string | null;
    end_date?: string | null;
    location?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface MeetingLocalized {
    name_de?: string | null;
    name_fr?: string | null;
    name_it?: string | null;
    name_rm?: string | null;
    description_de?: string | null;
    description_fr?: string | null;
    description_it?: string | null;
    type_external_de?: string | null;
    type_external_fr?: string | null;
    type_external_it?: string | null;
    url_external_de?: string | null;
    url_external_fr?: string | null;
    url_external_it?: string | null;
    url_external_rm?: string | null;
}

export interface Meeting extends MeetingBase, MeetingLocalized { }
export interface MeetingClient extends Omit<MeetingBase, "begin_date" | "end_date" | "created_at" | "updated_at"> {
    begin_date?: number | null;
    end_date?: number | null;
    name?: string | null;
    description?: string | null;
    type_external?: string | null;
    url_external?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: string | null; // column is VARCHAR (see meetingColumns anomaly)
}

export const meetingColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    type: "VARCHAR",
    group_id: "INTEGER",
    parent_type: "VARCHAR",
    parent_external_id: "VARCHAR",
    parent_oparl_id: "INTEGER",
    state: "VARCHAR",
    name_de: "VARCHAR",
    name_fr: "VARCHAR",
    name_it: "VARCHAR",
    name_rm: "VARCHAR",
    abbreviation: "VARCHAR",
    number: "VARCHAR",
    begin_date: "DOUBLE",
    end_date: "DOUBLE",
    location: "VARCHAR",
    created_at: "DOUBLE",
    updated_at: "DOUBLE",
    updated_external_at: "VARCHAR",  // schema anomaly — see note above
    description_de: "VARCHAR",
    description_fr: "VARCHAR",
    description_it: "VARCHAR",
    type_external_de: "VARCHAR",
    type_external_fr: "VARCHAR",
    type_external_it: "VARCHAR",
    url_external_de: "VARCHAR",
    url_external_fr: "VARCHAR",
    url_external_it: "VARCHAR",
    url_external_rm: "VARCHAR",
} as const satisfies Record<string, DuckDBSqlType>;

export const MEETINGS_TABLE_NAME = "meetings";

// =============================================================================
// memberships          (table_view: memberships)
// =============================================================================

interface MembershipBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    person_id?: number | null;
    person_fullname?: string | null;
    group_id?: number | null;
    external_id?: string | null;
    begin_date?: string | null;
    end_date?: string | null;
    active?: boolean | null;
    // type_harmonized is the key — labels in Localized
    type_harmonized?: string | null;
    type_harmonized_oparl_id?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface MembershipLocalized {
    type_harmonized_de?: string | null;
    type_harmonized_fr?: string | null;
    type_harmonized_it?: string | null;
    type_harmonized_rm?: string | null;
    type_harmonized_en?: string | null;
    group_name_de?: string | null;
    group_name_fr?: string | null;
    group_name_it?: string | null;
    role_name_de?: string | null;
    role_name_fr?: string | null;
    role_name_it?: string | null;
    type_external_de?: string | null;
    type_external_fr?: string | null;
    type_external_it?: string | null;
}

export interface Membership extends MembershipBase, MembershipLocalized { }
export interface MembershipClient extends Omit<MembershipBase, "type_harmonized" | "begin_date" | "end_date" | "created_at" | "updated_at" | "updated_external_at"> {
    begin_date?: number | null;
    end_date?: number | null;
    // In the CLIENT shape `type_harmonized` carries the LOCALIZED label (resolved
    // via loc() in the SQL), matching GroupClient. The bare harmonized CODE — the
    // stable value the memberships `type` facet filters on ($10) — is kept
    // separately as `type_harmonized_code`.
    type_harmonized?: string | null;
    type_harmonized_code?: string | null;
    group_name?: string | null;
    role_name?: string | null;
    type_external?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const membershipColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    person_id: "INTEGER",
    person_fullname: "VARCHAR",
    group_id: "INTEGER",
    external_id: "VARCHAR",
    begin_date: "DOUBLE",
    end_date: "DOUBLE",
    active: "BOOLEAN",
    type_harmonized: "VARCHAR",
    type_harmonized_oparl_id: "INTEGER",
    type_harmonized_de: "VARCHAR",
    type_harmonized_fr: "VARCHAR",
    type_harmonized_it: "VARCHAR",
    type_harmonized_rm: "VARCHAR",
    type_harmonized_en: "VARCHAR",
    group_name_de: "VARCHAR",
    group_name_fr: "VARCHAR",
    group_name_it: "VARCHAR",
    role_name_de: "VARCHAR",
    role_name_fr: "VARCHAR",
    role_name_it: "VARCHAR",
    type_external_de: "VARCHAR",
    type_external_fr: "VARCHAR",
    type_external_it: "VARCHAR",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const MEMBERSHIPS_TABLE_NAME = "memberships";

// =============================================================================
// news                 (table_view: news)
// =============================================================================

interface NewsBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    affair_id?: number | null;
    affair_external_id?: string | null;
    affair_number?: string | null;
    type_harmonized?: string | null;
    content_format?: string | null;
    date?: string | null;
    location?: string | null;
    image_url?: string | null;
    additional_data?: string | null;
    contact?: string | null;
    version?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface NewsLocalized {
    type_de?: string | null;
    type_fr?: string | null;
    type_it?: string | null;
    type_rm?: string | null;
    type_en?: string | null;
    title_de?: string | null;
    title_fr?: string | null;
    title_it?: string | null;
    title_rm?: string | null;
    title_en?: string | null;
    lead_de?: string | null;
    lead_fr?: string | null;
    lead_it?: string | null;
    lead_rm?: string | null;
    lead_en?: string | null;
    content_de?: string | null;
    content_fr?: string | null;
    content_it?: string | null;
    content_rm?: string | null;
    content_en?: string | null;
    url_external_de?: string | null;
    url_external_fr?: string | null;
    url_external_it?: string | null;
    url_external_rm?: string | null;
    url_external_en?: string | null;
}

export interface News extends NewsBase, NewsLocalized { }
export interface NewsClient extends Omit<NewsBase, "created_at" | "updated_at" | "updated_external_at"> {
    type?: string | null;
    title?: string | null;
    lead?: string | null;
    content?: string | null;
    url_external?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const newsColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    affair_id: "INTEGER",
    affair_external_id: "VARCHAR",
    affair_number: "VARCHAR",
    type_de: "VARCHAR",
    type_fr: "VARCHAR",
    type_it: "VARCHAR",
    type_rm: "VARCHAR",
    type_en: "VARCHAR",
    type_harmonized: "VARCHAR",
    title_de: "VARCHAR",
    title_fr: "VARCHAR",
    title_it: "VARCHAR",
    title_rm: "VARCHAR",
    title_en: "VARCHAR",
    lead_de: "VARCHAR",
    lead_fr: "VARCHAR",
    lead_it: "VARCHAR",
    lead_rm: "VARCHAR",
    lead_en: "VARCHAR",
    content_de: "VARCHAR",
    content_fr: "VARCHAR",
    content_it: "VARCHAR",
    content_rm: "VARCHAR",
    content_en: "VARCHAR",
    content_format: "VARCHAR",
    date: "DOUBLE",
    location: "VARCHAR",
    url_external_de: "VARCHAR",
    url_external_fr: "VARCHAR",
    url_external_it: "VARCHAR",
    url_external_rm: "VARCHAR",
    url_external_en: "VARCHAR",
    image_url: "VARCHAR",
    additional_data: "VARCHAR",
    contact: "VARCHAR",
    version: "INTEGER",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const NEWS_TABLE_NAME = "news";

// =============================================================================
// person_images        (table_view: person_images)
// No localized fields — single type.
// =============================================================================

export interface PersonImage {
    id: number;
    person_id: number;
    source_url?: string | null;
    oparl_url?: string | null;
    profile_url?: string | null;
    thumb_url?: string | null;
    version?: number | null;
    latest?: boolean | null;
    valid_from?: string | null;
    valid_to?: string | null;
}

export interface PersonImageClient extends Omit<PersonImage, "valid_from" | "valid_to"> {
    valid_from?: number | null;
    valid_to?: number | null;
}

export const personImageColumns = {
    id: "INTEGER",
    person_id: "INTEGER",
    source_url: "VARCHAR",
    oparl_url: "VARCHAR",
    profile_url: "VARCHAR",
    thumb_url: "VARCHAR",
    version: "INTEGER",
    latest: "BOOLEAN",
    valid_from: "DOUBLE",
    valid_to: "DOUBLE",
} as const satisfies Record<string, DuckDBSqlType>;

export const PERSON_IMAGES_TABLE_NAME = "person_images";

// =============================================================================
// persons              (table_view: persons)
// =============================================================================

interface PersonBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    external_alternative_id?: string | null;
    firstname?: string | null;
    lastname: string;
    fullname?: string | null;
    birthday?: string | null;
    birthday_format?: string | null;
    deathday?: string | null;
    gender?: string | null;
    party_external_id?: string | null;
    party_harmonized_wikidata_id?: string | null;
    parliamentary_group_external_id?: string | null;
    image_url_external?: string | null;
    image_url_oparl?: string | null;
    email?: string | null;
    phone?: string | null;
    street?: string | null;
    postal_code?: string | null;
    city?: string | null;
    title?: string | null;
    website_personal?: string | null;
    parliament_sector?: string | null;
    parliament_seat?: number | null;
    active?: boolean | null;
    language?: string | null;
    function_latest_external_id?: string | null;
    wikidata_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface PersonLocalized {
    parliamentary_group_name_de?: string | null;
    parliamentary_group_name_fr?: string | null;
    parliamentary_group_name_it?: string | null;
    parliamentary_group_name_rm?: string | null;
    party_de?: string | null;
    party_fr?: string | null;
    party_it?: string | null;
    party_harmonized_de?: string | null;
    party_harmonized_fr?: string | null;
    party_harmonized_it?: string | null;
    party_harmonized_en?: string | null;
    website_parliament_url_de?: string | null;
    website_parliament_url_fr?: string | null;
    website_parliament_url_it?: string | null;
    occupation_de?: string | null;
    occupation_fr?: string | null;
    occupation_it?: string | null;
    marital_status_de?: string | null;
    marital_status_fr?: string | null;
    marital_status_it?: string | null;
    electoral_district_de?: string | null;
    electoral_district_fr?: string | null;
    electoral_district_it?: string | null;
    function_latest_de?: string | null;
    function_latest_fr?: string | null;
    function_latest_it?: string | null;
    function_latest_rm?: string | null;
}

export interface Person extends PersonBase, PersonLocalized { }
export interface PersonClient extends Omit<PersonBase, "deathday" | "created_at" | "updated_at" | "updated_external_at"> {
    deathday?: number | null;
    parliamentary_group_name?: string | null;
    party?: string | null;
    party_harmonized?: string | null;
    website_parliament_url?: string | null;
    occupation?: string | null;
    marital_status?: string | null;
    electoral_district?: string | null;
    function_latest?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const personColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    firstname: "VARCHAR",
    lastname: "VARCHAR",
    fullname: "VARCHAR",
    birthday: "VARCHAR",
    birthday_format: "VARCHAR",
    deathday: "DOUBLE",
    gender: "VARCHAR",
    party_external_id: "VARCHAR",
    parliamentary_group_name_de: "VARCHAR",
    parliamentary_group_name_fr: "VARCHAR",
    parliamentary_group_name_it: "VARCHAR",
    parliamentary_group_name_rm: "VARCHAR",
    parliamentary_group_external_id: "VARCHAR",
    party_de: "VARCHAR",
    party_fr: "VARCHAR",
    party_it: "VARCHAR",
    image_url_external: "VARCHAR",
    image_url_oparl: "VARCHAR",
    party_harmonized_de: "VARCHAR",
    party_harmonized_fr: "VARCHAR",
    party_harmonized_it: "VARCHAR",
    party_harmonized_en: "VARCHAR",
    party_harmonized_wikidata_id: "VARCHAR",
    external_alternative_id: "VARCHAR",
    website_parliament_url_de: "VARCHAR",
    website_parliament_url_fr: "VARCHAR",
    website_parliament_url_it: "VARCHAR",
    email: "VARCHAR",
    phone: "VARCHAR",
    street: "VARCHAR",
    postal_code: "VARCHAR",
    city: "VARCHAR",
    occupation_de: "VARCHAR",
    occupation_fr: "VARCHAR",
    occupation_it: "VARCHAR",
    title: "VARCHAR",
    marital_status_de: "VARCHAR",
    marital_status_fr: "VARCHAR",
    marital_status_it: "VARCHAR",
    electoral_district_de: "VARCHAR",
    electoral_district_fr: "VARCHAR",
    electoral_district_it: "VARCHAR",
    website_personal: "VARCHAR",
    parliament_sector: "VARCHAR",
    parliament_seat: "INTEGER",
    active: "BOOLEAN",
    language: "VARCHAR",
    function_latest_de: "VARCHAR",
    function_latest_fr: "VARCHAR",
    function_latest_it: "VARCHAR",
    function_latest_rm: "VARCHAR",
    function_latest_external_id: "VARCHAR",
    wikidata_id: "VARCHAR",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const PERSONS_TABLE_NAME = "persons";

// =============================================================================
// speeches             (table_view: speeches)
// =============================================================================

interface SpeechBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    person_id?: number | null;
    // person_role is a legacy single-language field — localized variants in Localized
    person_role?: string | null;
    date_start?: string | null;
    date_end?: string | null;
    type_external_id?: string | null;
    affair_id?: number | null;
    meeting_id?: number | null;
    agenda_external_id?: string | null;
    agenda_id?: number | null;
    url?: string | null;
    audio_url?: string | null;
    video_url?: string | null;
    meeting_external_id?: string | null;
    meeting_type?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface SpeechLocalized {
    person_role_de?: string | null;
    person_role_fr?: string | null;
    person_role_it?: string | null;
    text_content_de?: string | null;
    text_content_fr?: string | null;
    text_content_it?: string | null;
    type_external_de?: string | null;
    type_external_fr?: string | null;
    type_external_it?: string | null;
}

export interface Speech extends SpeechBase, SpeechLocalized { }
export interface SpeechClient extends Omit<SpeechBase, "date_start" | "date_end" | "person_role" | "created_at" | "updated_at" | "updated_external_at"> {
    date_start?: number | null;
    date_end?: number | null;
    person_role?: string | null;
    text_content?: string | null;
    type_external?: string | null;
    // client-only: the language tag ('de'|'fr'|'it') the `text_content` value was
    // resolved from (loc_lang() in the speeches SQL). NULL when there is no text.
    speech_lang?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const speechColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    person_id: "INTEGER",
    person_role: "VARCHAR",
    person_role_de: "VARCHAR",
    person_role_fr: "VARCHAR",
    person_role_it: "VARCHAR",
    date_start: "DOUBLE",
    date_end: "DOUBLE",
    text_content_de: "VARCHAR",
    text_content_fr: "VARCHAR",
    text_content_it: "VARCHAR",
    type_external_id: "VARCHAR",
    type_external_de: "VARCHAR",
    type_external_fr: "VARCHAR",
    type_external_it: "VARCHAR",
    affair_id: "INTEGER",
    meeting_id: "INTEGER",
    agenda_external_id: "VARCHAR",
    agenda_id: "INTEGER",
    url: "VARCHAR",
    audio_url: "VARCHAR",
    video_url: "VARCHAR",
    meeting_external_id: "VARCHAR",
    meeting_type: "VARCHAR",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const SPEECHES_TABLE_NAME = "speeches";

// =============================================================================
// texts                (table_view: texts)
// =============================================================================

interface TextBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    affair_id?: number | null;
    // type_en is English-only with no full de/fr/it/rm counterpart group
    type_en?: string | null;
    text_format?: string | null;
    text_date?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface TextLocalized {
    type_de?: string | null;
    type_fr?: string | null;
    type_it?: string | null;
    type_rm?: string | null;
    text_de?: string | null;
    text_fr?: string | null;
    text_it?: string | null;
    text_rm?: string | null;
}

export interface Text extends TextBase, TextLocalized { }
export interface TextClient extends Omit<TextBase, "created_at" | "updated_at" | "updated_external_at"> {
    type?: string | null;
    text?: string | null;
    // client-only: localized title of the linked affair (texts.affair_id),
    // resolved in the by-id/feed SQL for the internal /affairs/:id link.
    affair_title?: string | null;
    // client-only: the language tag ('de'|'fr'|'it'|'rm') the `text` value was
    // resolved from (loc_lang() in texts_list.sql). NULL when there is no body.
    text_lang?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const textColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    affair_id: "INTEGER",
    type_de: "VARCHAR",
    type_fr: "VARCHAR",
    type_it: "VARCHAR",
    type_rm: "VARCHAR",
    text_de: "VARCHAR",
    text_fr: "VARCHAR",
    text_it: "VARCHAR",
    text_rm: "VARCHAR",
    type_en: "VARCHAR",
    text_format: "VARCHAR",
    text_date: "DATE",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const TEXTS_TABLE_NAME = "texts";

// =============================================================================
// votes                (table_view: votes)
// =============================================================================

interface VoteBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    voting_id?: number | null;
    voting_external_id?: string | null;
    person_id?: number | null;
    vote?: string | null;
    person_fullname?: string | null;
    created_at?: string | null;
}

interface VoteLocalized {
    vote_display_de?: string | null;
    vote_display_fr?: string | null;
    vote_display_it?: string | null;
    person_party_de?: string | null;
    person_party_fr?: string | null;
    person_party_it?: string | null;
    person_party_rm?: string | null;
    person_parliamentary_group_name_de?: string | null;
    person_parliamentary_group_name_fr?: string | null;
    person_parliamentary_group_name_it?: string | null;
    person_parliamentary_group_name_rm?: string | null;
}

export interface Vote extends VoteBase, VoteLocalized { }
export interface VoteClient extends Omit<VoteBase, "created_at"> {
    vote_display?: string | null;
    person_party?: string | null;
    person_parliamentary_group_name?: string | null;
    created_at?: number | null;
}

export const voteColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    voting_id: "INTEGER",
    voting_external_id: "VARCHAR",
    person_id: "INTEGER",
    vote: "VARCHAR",
    vote_display_de: "VARCHAR",
    vote_display_fr: "VARCHAR",
    vote_display_it: "VARCHAR",
    person_party_de: "VARCHAR",
    person_party_fr: "VARCHAR",
    person_party_it: "VARCHAR",
    person_party_rm: "VARCHAR",
    person_parliamentary_group_name_de: "VARCHAR",
    person_parliamentary_group_name_fr: "VARCHAR",
    person_parliamentary_group_name_it: "VARCHAR",
    person_parliamentary_group_name_rm: "VARCHAR",
    person_fullname: "VARCHAR",
    created_at: "DOUBLE",
} as const satisfies Record<string, DuckDBSqlType>;

export const VOTES_TABLE_NAME = "votes";

// =============================================================================
// votings              (table_view: votings)
// =============================================================================

interface VotingBase {
    id: number;
    body_id?: number | null;
    body_key?: string | null;
    external_id?: string | null;
    date?: string | null;
    external_alternative_id?: string | null;
    affair_id?: number | null;
    results_yes?: number | null;
    results_no?: number | null;
    results_abstention?: number | null;
    results_absent?: number | null;
    results_string?: string | null;
    decision?: string | null;
    meeting_id?: number | null;
    group_id?: number | null;
    group_external_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    updated_external_at?: string | null;
}

interface VotingLocalized {
    title_de?: string | null;
    title_fr?: string | null;
    title_it?: string | null;
    url_external_de?: string | null;
    url_external_fr?: string | null;
    url_external_it?: string | null;
    type_de?: string | null;
    type_fr?: string | null;
    type_it?: string | null;
    meaning_of_yes_de?: string | null;
    meaning_of_yes_fr?: string | null;
    meaning_of_yes_it?: string | null;
    meaning_of_no_de?: string | null;
    meaning_of_no_fr?: string | null;
    meaning_of_no_it?: string | null;
    affair_title_de?: string | null;
    affair_title_fr?: string | null;
    affair_title_it?: string | null;
}

export interface Voting extends VotingBase, VotingLocalized { }
export interface VotingClient extends Omit<VotingBase, "date" | "created_at" | "updated_at" | "updated_external_at"> {
    date?: number | null;
    title?: string | null;
    url_external?: string | null;
    type?: string | null;
    meaning_of_yes?: string | null;
    meaning_of_no?: string | null;
    affair_title?: string | null;
    // Denormalized group (g.id = votings.group_id), localized, for the
    // body/group line next to the parliament name.
    group_name?: string | null;
    group_abbreviation?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    updated_external_at?: number | null;
}

export const votingColumns = {
    id: "INTEGER",
    body_id: "INTEGER",
    body_key: "VARCHAR",
    external_id: "VARCHAR",
    date: "DOUBLE",
    external_alternative_id: "VARCHAR",
    affair_id: "INTEGER",
    title_de: "VARCHAR",
    title_fr: "VARCHAR",
    title_it: "VARCHAR",
    url_external_de: "VARCHAR",
    url_external_fr: "VARCHAR",
    url_external_it: "VARCHAR",
    type_de: "VARCHAR",
    type_fr: "VARCHAR",
    type_it: "VARCHAR",
    meaning_of_yes_de: "VARCHAR",
    meaning_of_yes_fr: "VARCHAR",
    meaning_of_yes_it: "VARCHAR",
    meaning_of_no_de: "VARCHAR",
    meaning_of_no_fr: "VARCHAR",
    meaning_of_no_it: "VARCHAR",
    results_yes: "INTEGER",
    results_no: "INTEGER",
    results_abstention: "INTEGER",
    results_absent: "INTEGER",
    results_string: "VARCHAR",
    affair_title_de: "VARCHAR",
    affair_title_fr: "VARCHAR",
    affair_title_it: "VARCHAR",
    decision: "VARCHAR",
    meeting_id: "INTEGER",
    group_id: "INTEGER",
    group_external_id: "VARCHAR",
    ...recordMetadataColumns,
} as const satisfies Record<string, DuckDBSqlType>;

export const VOTINGS_TABLE_NAME = "votings";

// =============================================================================
// Registry
// =============================================================================

export const TABLE_COLUMNS = {
    access_badges: accessBadgeColumns,
    affairs: affairColumns,
    agendas: agendaColumns,
    bodies: bodyColumns,
    contributors: contributorColumns,
    docs: docColumns,
    events: eventColumns,
    external_links: externalLinkColumns,
    groups: groupColumns,
    person_identities: identityColumns,
    interests: interestColumns,
    meetings: meetingColumns,
    memberships: membershipColumns,
    news: newsColumns,
    person_images: personImageColumns,
    persons: personColumns,
    speeches: speechColumns,
    texts: textColumns,
    votes: voteColumns,
    votings: votingColumns,
} as const;


export const stopwordColumns = { lang: "VARCHAR", word: "VARCHAR" } as const;
export function assertStopword(x: unknown) {
    const r = x as { lang?: unknown; word?: unknown };
    if (typeof r.lang !== "string" || typeof r.word !== "string")
        throw new Error("stopword: lang/word must be strings");
    return r;
}

// =============================================================================
// import_meta  (remote-import bookkeeping — one row per synced entity)
// -----------------------------------------------------------------------------
// Written by the remote importer's loadImportMeta/recordEntityMeta
// (ingest/remoteimport.ts). The CREATE TABLE there is the source of truth; this
// mirror exists so the app can read the table type-safely. Not part of
// TABLE_COLUMNS (that registry is for OPD dataset tables, not bookkeeping).
//
// The count columns are BIGINT, which @duckdb/node-api's getRowObjects() returns
// as JS `bigint`; ImportMeta types them as such. ImportMetaClient narrows the
// counts to `number` for UI use (a query can `CAST(... AS INTEGER)` or the caller
// can `Number(...)`) — all values here fit safely in a JS number.
// =============================================================================

export const IMPORT_META_TABLE_NAME = "import_meta";

export const importMetaColumns = {
    entity: "VARCHAR",
    row_count: "BIGINT",
    skipped_count: "BIGINT",
    source_size: "BIGINT",
    source_row_count: "BIGINT",
    source_created: "VARCHAR",
    source_generated_at: "VARCHAR",
    synced_at: "VARCHAR",
} as const satisfies Record<string, DuckDBSqlType>;

/** DB row shape of import_meta as returned by getRowObjects(). */
export interface ImportMeta {
    /** Table/entity name (primary key). */
    entity: string;
    /** Rows actually stored in the entity's table = "amount of entries". */
    row_count: bigint;
    /** Rows dropped during import (bad JSON / schema mismatch). */
    skipped_count: bigint;
    /** Compressed byte total reported by index.json (change-detection key). */
    source_size: bigint;
    /** Row total reported by index.json. */
    source_row_count: bigint;
    /** Export "created" timestamp — when the source data was last created (ISO). */
    source_created: string;
    /** index.json `generated_at` captured at sync time (ISO). */
    source_generated_at: string;
    /** When we last wrote this entity into DuckDB = "last updated" (ISO). */
    synced_at: string;
}

/** Client shape: BIGINT counts narrowed to `number` for convenient UI use. */
export interface ImportMetaClient extends Omit<
    ImportMeta,
    "row_count" | "skipped_count" | "source_size" | "source_row_count"
> {
    row_count: number;
    skipped_count: number;
    source_size: number;
    source_row_count: number;
}

// =============================================================================
// Ingest-time row validators (plain JS — no eval, no build transform)
// -----------------------------------------------------------------------------
// The importer (ingest/*, run under tsx) validates each RAW ndjson row before
// appending it to DuckDB. typia's validators require its Vite/ts-patch build
// transform, which tsx does not run; arktype is removed. So these validators are
// derived directly from the per-table `*Columns` maps — which already encode the
// authoritative shape — reconstructing the old arktype DB-row semantics:
//   • every declared column may be absent or null, and if present must match its
//     column's JS kind; undeclared keys are ignored (arktype's default);
//   • the `required` keys must be present, non-null, and of the right kind.
// DOUBLE columns hold ISO timestamp STRINGS at ingest time (appendRow converts
// them to epoch millis), so DOUBLE maps to a string check here.
// =============================================================================

type RowValueKind = "integer" | "number" | "string" | "boolean";

const sqlTypeToKind = (t: DuckDBSqlType): RowValueKind => {
    switch (t) {
        case "INTEGER":
        case "BIGINT":
        case "HUGEINT":
        case "SMALLINT":
        case "TINYINT":
            return "integer";
        case "DECIMAL":
            return "number";
        case "BOOLEAN":
            return "boolean";
        // DOUBLE holds a raw ISO timestamp string at ingest time; every other
        // remaining type (VARCHAR/DATE/TIME/TIMESTAMP*/UUID/JSON/BLOB) is a string.
        default:
            return "string";
    }
};

const matchesKind = (value: unknown, kind: RowValueKind): boolean => {
    switch (kind) {
        case "integer":
            return typeof value === "number" && Number.isInteger(value);
        case "number":
            return typeof value === "number";
        case "string":
            return typeof value === "string";
        case "boolean":
            return typeof value === "boolean";
    }
};

const makeRowAssert = (
    columns: Record<string, DuckDBSqlType>,
    required: readonly string[],
) => {
    const kinds = Object.entries(columns).map(
        ([key, sqlType]) => [key, sqlTypeToKind(sqlType)] as const,
    );
    const requiredKeys = new Set(required);
    return (input: unknown): unknown => {
        if (typeof input !== "object" || input === null) {
            throw new Error("row must be a non-null object");
        }
        const row = input as Record<string, unknown>;
        for (const [key, kind] of kinds) {
            const value = row[key];
            const missing = value === null || value === undefined || !(key in row);
            if (requiredKeys.has(key)) {
                if (missing || !matchesKind(value, kind)) {
                    throw new Error(`field "${key}" must be a non-null ${kind}`);
                }
            } else if (!missing && !matchesKind(value, kind)) {
                throw new Error(`field "${key}" must be ${kind} | null`);
            }
        }
        return input;
    };
};

export const assertAccessBadge = makeRowAssert(accessBadgeColumns, ["id"]);
export const assertAffair = makeRowAssert(affairColumns, ["id", "body_key"]);
export const assertAgenda = makeRowAssert(agendaColumns, ["id", "body_key"]);
export const assertBody = makeRowAssert(bodyColumns, ["id", "body_key"]);
export const assertContributor = makeRowAssert(contributorColumns, ["id"]);
export const assertDoc = makeRowAssert(docColumns, ["id", "body_key"]);
export const assertEvent = makeRowAssert(eventColumns, ["id"]);
export const assertExternalLink = makeRowAssert(externalLinkColumns, ["id"]);
export const assertGroup = makeRowAssert(groupColumns, ["id"]);
export const assertIdentity = makeRowAssert(identityColumns, ["id"]);
export const assertInterest = makeRowAssert(interestColumns, ["id"]);
export const assertMeeting = makeRowAssert(meetingColumns, ["id", "body_key"]);
export const assertMembership = makeRowAssert(membershipColumns, ["id"]);
export const assertNews = makeRowAssert(newsColumns, ["id"]);
export const assertPerson = makeRowAssert(personColumns, ["id", "lastname"]);
export const assertPersonImage = makeRowAssert(personImageColumns, ["id", "person_id"]);
export const assertSpeech = makeRowAssert(speechColumns, ["id"]);
export const assertText = makeRowAssert(textColumns, ["id"]);
export const assertVote = makeRowAssert(voteColumns, ["id"]);
export const assertVoting = makeRowAssert(votingColumns, ["id"]);
