// _shared/rows/VotingRow.tsx
//
// One voting row in the FEED style, shared by /affairs/:id/votings,
// /bodies/:id/votings and /groups/:id/votings. A title link, an optional
// external-record line, a meta line (date · type · body · parent affair) and the
// coloured yes/no/abst/absent tally + decision.
//
// Emits NO structured data — purely presentational. A voting is a division/tally,
// not schema.org Legislation (that's the parent AFFAIR), and schema.org has no
// vote type; the page's entity graph is emitted as head JSON-LD by the route
// meta().
//
// Presentational + href-driven — the caller resolves every link:
//   • `href`        internal link to the voting (null → plain title).
//   • `body`        optional body lookup → a landmark meta item (groups feed).
//   • `affairHref`  the parent affair link:
//                     – omit the prop entirely  → hide the affair meta
//                       (the affair's OWN votings feed, where it's implicit);
//                     – pass a string           → link;
//                     – pass null               → plain text (no affair route).
//
// NOTE: this unifies the three FEED rows only. The /votings CATALOGUE row
// (VotingsList) is a different presentation (ListItem + badges + compact tally)
// and stays local to that component.

import type { VotingClient, BodyClient } from "@/types/opd_db";
import { formatEpoch } from "~/lib/domain/person";

import {
    MetaItem,
    InternalLink,
    isoOf,
    hostLabel,
    bodyName as getBodyName,
    type TFunc,
} from "../../../opd_views/opd_micros";
import { Icon } from "../../../icons/opd_icons";
import { TallyLine } from "../votingHelpers";

export interface VotingRowProps {
    voting: VotingClient;
    t: TFunc;
    locale: string;
    /** Internal link to the voting; null renders the title as plain text. */
    href?: string | null;
    /** Body lookup (b.id = voting.body_id) — renders a landmark meta item. */
    body?: BodyClient | undefined;
    /** Parent-affair link. Omit to hide the affair meta; null = plain, string = link. */
    affairHref?: string | null;
    /** Chamber label (e.g. Nationalrat) — pass only where the feed spans chambers. */
    chamber?: string | null;
}

export function VotingRow({
    voting,
    t,
    locale,
    href,
    body,
    affairHref,
    chamber,
}: VotingRowProps) {
    const title =
        voting.title ?? voting.affair_title ?? t("voting_untitled");
    const date = formatEpoch(voting.date, locale);
    const url = voting.url_external ?? null;
    const domain = hostLabel(url);
    const type = voting.type ?? null;
    const decision = voting.decision ?? null;
    const affairTitle = voting.affair_title ?? null;
    const bodyName = getBodyName(body, body?.body_key);

    // affairHref === undefined → the affair's own feed: hide the affair meta.
    const showAffair = affairHref !== undefined && affairTitle != null;
    const affairLink =
        typeof affairHref === "string" && voting.affair_id != null ? affairHref : null;

    const hasTally =
        voting.results_yes != null ||
        voting.results_no != null ||
        voting.results_abstention != null ||
        voting.results_absent != null;

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium leading-snug">
                    {href ? (
                        <InternalLink to={href}>
                            <span>{title}</span>
                        </InternalLink>
                    ) : (
                        <span>{title}</span>
                    )}
                </div>

                {url ? (
                    <div className="text-xs">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            <Icon name="external-link" className="size-3 shrink-0" />
                            <span>
                                {t("external_link")}
                                {domain ? ` (${domain})` : ""}
                            </span>
                        </a>
                    </div>
                ) : null}

                {/* meta: date · type · chamber · body · parent affair */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {date ? (
                        <time dateTime={isoOf(voting.date)}>
                            {date}
                        </time>
                    ) : null}
                    {type ? <span>{type}</span> : null}
                    {chamber ? <span>{chamber}</span> : null}
                    {bodyName ? <MetaItem icon="landmark">{bodyName}</MetaItem> : null}
                    {showAffair ? (
                        <MetaItem icon="file-text">
                            {affairLink ? (
                                <InternalLink to={affairLink}>{affairTitle}</InternalLink>
                            ) : (
                                affairTitle
                            )}
                        </MetaItem>
                    ) : null}
                </div>

                {/* chamber result: tally + decision */}
                {hasTally || decision ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {hasTally ? (
                            <TallyLine
                                t={t}
                                yes={voting.results_yes}
                                no={voting.results_no}
                                abstention={voting.results_abstention}
                                absent={voting.results_absent}
                            />
                        ) : null}
                        {decision ? (
                            <span className="font-medium text-foreground">{decision}</span>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default VotingRow;