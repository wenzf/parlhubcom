// components/data_map/graph.ts
//
// The static graph behind /project/data-map. Pure data: nodes (the 11 data
// catalogues), the four clusters they group into, curated coordinates for the
// diagram, and the edge list — the real interconnections between the entities,
// read off the FK graph (ingest/datasets.ts) and the dimension descriptors
// (people→votes→votings, affairs↔votings↔bodies, memberships→groups,
// interests→people/organizations, speeches→affairs/meetings, …).
//
// Icons + index-route namespaces are the SAME ones the sidebar uses (mirrors
// `dataSections` / `NAV_SECTION_GROUPS` in sidebars.config.ts), so a node's
// symbol on the map matches its symbol in the nav.

import type { IconName } from "~/components/icons/opd_icons";
import type { PageNamespaces } from "@/types/site";

/** Diagram coordinate space. The desktop canvas is drawn 1:1 in these units and
 *  scrolls horizontally on narrow viewports (no squishing). Node x/y below are
 *  CENTRES in this space. */
export const VIEWBOX = { w: 1040, h: 720 } as const;

export type ClusterKey = "parliament" | "proceedings" | "records" | "lobbying";

/** The stable node id — also the loc key under `data_map.nodes.<key>`. */
export type NodeKey =
    | "people"
    | "bodies"
    | "groups"
    | "affairs"
    | "votings"
    | "meetings"
    | "speeches"
    | "texts"
    | "documents"
    | "interests"
    | "organizations";

export interface AtlasNode {
    key: NodeKey;
    /** Index (catalogue / search) route the node links to. */
    ns: PageNamespaces;
    icon: IconName;
    cluster: ClusterKey;
    /** Centre in VIEWBOX units. */
    x: number;
    y: number;
}

/** One faint rounded zone drawn behind each cluster's column, with a label
 *  centred at (labelX, labelY). */
export interface Cluster {
    key: ClusterKey;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Edge {
    a: NodeKey;
    b: NodeKey;
    /** A long cross-map tie routed as an arc so it reads as intentional wiring
     *  rather than a line clipped by the cards it passes under. */
    curve?: "bottom";
    /** De-emphasised stroke for long / secondary ties. */
    faint?: boolean;
}

// Four columns, one per cluster (curated hand-laid layout). Column centres:
//   parliament 150 · proceedings 400 · records 650 · lobbying 895
export const CLUSTERS: Cluster[] = [
    { key: "parliament", x: 50, y: 60, w: 200, h: 620 },
    { key: "proceedings", x: 300, y: 60, w: 200, h: 620 },
    { key: "records", x: 550, y: 60, w: 200, h: 620 },
    { key: "lobbying", x: 800, y: 160, w: 190, h: 420 },
];

export const NODES: AtlasNode[] = [
    // Parliament — the actors.
    { key: "bodies", ns: "NS_BODIES_INDEX", icon: "landmark", cluster: "parliament", x: 150, y: 170 },
    { key: "people", ns: "NS_PEOPLE_INDEX", icon: "user", cluster: "parliament", x: 150, y: 370 },
    { key: "groups", ns: "NS_GROUPS_INDEX", icon: "users-2", cluster: "parliament", x: 150, y: 570 },
    // Proceedings — the business.
    { key: "votings", ns: "NS_VOTINGS_INDEX", icon: "vote", cluster: "proceedings", x: 400, y: 170 },
    { key: "affairs", ns: "NS_AFFAIRS_INDEX", icon: "file-text", cluster: "proceedings", x: 400, y: 370 },
    { key: "meetings", ns: "NS_MEETINGS_INDEX", icon: "calendar-days", cluster: "proceedings", x: 400, y: 570 },
    // Records — what proceedings leave behind.
    { key: "speeches", ns: "NS_SPEECHES_INDEX", icon: "mic", cluster: "records", x: 650, y: 170 },
    { key: "texts", ns: "NS_TEXTS_INDEX", icon: "newspaper", cluster: "records", x: 650, y: 370 },
    { key: "documents", ns: "NS_DOCS_INDEX", icon: "paperclip", cluster: "records", x: 650, y: 570 },
    // Lobbying — the ties to outside interests.
    { key: "interests", ns: "NS_INTERESTS_INDEX", icon: "briefcase", cluster: "lobbying", x: 895, y: 280 },
    { key: "organizations", ns: "NS_ORGANIZATIONS_INDEX", icon: "share-2", cluster: "lobbying", x: 895, y: 470 },
];

export const NODE_BY_KEY: Record<NodeKey, AtlasNode> = Object.fromEntries(
    NODES.map((n) => [n.key, n]),
) as Record<NodeKey, AtlasNode>;

// The interconnections. Every edge maps to a real relationship the site already
// exposes as a dimension / join.
export const EDGES: Edge[] = [
    // people ↔ parliament structure (memberships)
    { a: "people", b: "bodies" },
    { a: "people", b: "groups" },
    // people ↔ proceedings (votes, contributions)
    { a: "people", b: "votings" },
    { a: "people", b: "affairs" },
    // bodies ↔ proceedings (a body's votings / affairs)
    { a: "bodies", b: "votings" },
    { a: "bodies", b: "affairs" },
    // groups ↔ proceedings (group votings / meetings)
    { a: "groups", b: "votings", faint: true },
    { a: "groups", b: "meetings" },
    // within proceedings
    { a: "affairs", b: "votings" },
    { a: "affairs", b: "meetings" },
    // proceedings ↔ records
    { a: "affairs", b: "texts" },
    { a: "affairs", b: "speeches" },
    { a: "affairs", b: "documents" },
    { a: "meetings", b: "speeches", faint: true },
    { a: "meetings", b: "documents" },
    // lobbying
    { a: "people", b: "interests", curve: "bottom" },
    { a: "interests", b: "organizations" },
];

/** Cluster render order = column order left→right. */
export const CLUSTER_ORDER: ClusterKey[] = [
    "parliament",
    "proceedings",
    "records",
    "lobbying",
];

/** Nodes belonging to a cluster, in draw order. */
export function nodesInCluster(cluster: ClusterKey): AtlasNode[] {
    return NODES.filter((n) => n.cluster === cluster);
}
