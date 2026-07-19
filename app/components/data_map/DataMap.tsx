// components/data_map/DataMap.tsx
//
// The /project/data-map diagram. Server-rendered, zero-JS core: an SVG wiring
// layer (cluster zones + edges, purely decorative) with real <Link> cards laid
// over it. Every card is a keyboard-operable link to that entity's catalogue,
// with the AAA focus ring, 44px hit area and hover underline. Below `md` the
// diagram is replaced by a grouped card list (same links, linear order).

import { NavLink, type Params } from "react-router";
import { Icon, type IconName } from "~/components/icons/opd_icons";
import { localizedPath } from "~/lib/lang";
import {
    VIEWBOX,
    NODES,
    EDGES,
    CLUSTERS,
    CLUSTER_ORDER,
    NODE_BY_KEY,
    nodesInCluster,
    type AtlasNode,
    type NodeKey,
    type ClusterKey,
} from "./graph";

/** Loc shape the route passes in (locs.data_map from loc_data_map.json). */
export interface DataMapContent {
    title: string;
    lead: string;
    diagram_label: string;
    clusters: Record<ClusterKey, string>;
    nodes: Record<NodeKey, { label: string; desc: string }>;
    source: {
        heading: string;
        body: string;
        links_label: string;
        openparldata_label: string;
        openparldata_href: string;
        schemas_label: string;
        schemas_href: string;
        raw_label: string;
        raw_href: string;
    };
}

export function DataMap({
    lang,
    content,
}: {
    lang: Params["lang"];
    content: DataMapContent;
}) {
    return (
        <>
            {/* ── Diagram (md and up). Fixed canvas; scrolls horizontally rather than
          squishing on narrower desktops (styleguide §5 wide-content rule). ── */}
            <div className="hidden overflow-x-auto md:block">
                <div
                    className="relative mx-auto"
                    style={{ width: VIEWBOX.w, height: VIEWBOX.h }}
                    role="group"
                    aria-label={content.diagram_label}
                >
                    <svg
                        className="absolute inset-0 h-full w-full text-foreground"
                        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
                        aria-hidden="true"
                        focusable="false"
                    >
                        {/* cluster zones */}
                        {CLUSTERS.map((c) => (
                            <rect
                                key={c.key}
                                x={c.x}
                                y={c.y}
                                width={c.w}
                                height={c.h}
                                rx={20}
                                className="fill-muted/40 stroke-border"
                                strokeWidth={1}
                            />
                        ))}
                        {/* edges — the interconnections */}
                        <g stroke="currentColor" fill="none" strokeLinecap="round">
                            {EDGES.map((e, i) => {
                                const a = NODE_BY_KEY[e.a];
                                const b = NODE_BY_KEY[e.b];
                                const op = e.faint ? 0.12 : 0.26;
                                if (e.curve === "bottom") {
                                    const cy = VIEWBOX.h - 20;
                                    return (
                                        <path
                                            key={i}
                                            d={`M${a.x},${a.y} C ${a.x + 150},${cy} ${b.x - 195},${cy} ${b.x},${b.y}`}
                                            strokeOpacity={op}
                                            strokeWidth={1.5}
                                        />
                                    );
                                }
                                return (
                                    <line
                                        key={i}
                                        x1={a.x}
                                        y1={a.y}
                                        x2={b.x}
                                        y2={b.y}
                                        strokeOpacity={op}
                                        strokeWidth={1.5}
                                    />
                                );
                            })}
                        </g>
                    </svg>

                    {/* cluster labels */}
                    {CLUSTERS.map((c) => (
                        <span
                            key={c.key}
                            className="pointer-events-none absolute -translate-x-1/2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                            style={{ left: c.x + c.w / 2, top: c.y + 28 }}
                        >
                            {content.clusters[c.key]}
                        </span>
                    ))}

                    {/* nodes */}
                    {NODES.map((n) => (
                        <div
                            key={n.key}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: n.x, top: n.y }}
                        >
                            <NodeCard lang={lang} node={n} content={content} />
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Grouped-list fallback (below md). Same links, linear reading order. ── */}
            <div className="flex flex-col gap-8 md:hidden">
                {CLUSTER_ORDER.map((cluster) => (
                    <section key={cluster} className="flex flex-col gap-3">
                        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {content.clusters[cluster]}
                        </h2>
                        <div className="flex flex-col gap-3">
                            {nodesInCluster(cluster).map((n) => (
                                <NodeCard key={n.key} lang={lang} node={n} content={content} block />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}

function NodeCard({
    lang,
    node,
    content,
    block,
}: {
    lang: Params["lang"];
    node: AtlasNode;
    content: DataMapContent;
    /** Full-width card for the list fallback (vs the fixed-width diagram card). */
    block?: boolean;
}) {
    const n = content.nodes[node.key];
    return (
        <NavLink
            to={localizedPath(lang, node.ns)}
            viewTransition
            className={[
                "group flex flex-col gap-1 rounded-lg border border-input bg-card p-3 text-left shadow-sm ring-1 ring-foreground/10 transition-colors",
                "hover:bg-accent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                block ? "w-full" : "w-40",
            ].join(" ")}
        >
            <span className="flex items-center gap-2">
                <Icon name={node.icon as IconName} className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground group-hover:underline">
                    {n.label}
                </span>
            </span>
            <span className="text-xs leading-snug text-muted-foreground">{n.desc}</span>
        </NavLink>
    );
}
