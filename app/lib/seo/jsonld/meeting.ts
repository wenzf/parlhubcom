// /app/lib/seo/jsonld/meeting.ts
//
// Event graph node for a /meetings/:id page — head JSON-LD replacing the
// microdata <MeetingBase /> and the meetings layout emitted. Wired into
// `meetingMeta`/`meetingDimensionMeta` (metas/meeting.ts).

import type { MetaLang } from "~/lib/seo/metas/core";
import type { MeetingClient } from "@/types/opd_db";
import { isoOf } from "~/components/opd_views/opd_micros";
import { meetingNodeId, meetingPageUrl, bodyNodeId } from "./ids";

type MeetingNodeData = { meeting?: MeetingClient | null } | null | undefined;

/**
 * Event node for a meeting page (`@id` = `…/meetings/:id#identity`). Returns
 * `[]` when the record has no name.
 */
export function meetingNode(
    data: MeetingNodeData,
    _lang: MetaLang,
    _path: string | undefined,
): object[] {
    const m = data?.meeting;
    if (!m || m.id == null) return [];
    const name = m.name ?? m.abbreviation ?? null;
    if (!name) return [];

    const node: Record<string, unknown> = {
        "@type": "Event",
        "@id": meetingNodeId(m.id),
        name,
        url: meetingPageUrl(m.id),
    };
    const start = isoOf(m.begin_date);
    if (start) node.startDate = start;
    const end = isoOf(m.end_date);
    if (end) node.endDate = end;
    if (m.location) node.location = { "@type": "Place", name: m.location };
    if (m.body_id != null) node.organizer = { "@id": bodyNodeId(m.body_id) };

    return [node];
}
