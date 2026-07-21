// PersonVotes.tsx
//
// Voting-record list for a political actor. Two variants:
//   • "page"    — the /people/:id/votes dimension route: paginated, with a
//                 CC BY 4.0 data credit. Rendered BELOW <PersonBase />.
//   • "snippet" — embedded on the overview route: shows the rows the loader
//                 passed (no pager) plus a link to the full feed.
// Like <PersonFull />, it owns only its own panel and never re-emits identity
// properties, so nothing is declared twice on the page.
//
// Each item is a `VoteWithVoting`: a vote row with its joined `voting` struct
// embedded. The person's own vote (vote_display) is the headline, color-coded by
// outcome and aligned in a fixed left column so the record scans vertically; the
// linked voting title, date, per-row body label, chamber tally and decision sit
// beside it. Each row is also enriched from the response-scoped lookups with its
// parent affair (linked), the group that held the vote, and the meeting it
// happened in — passed as the `affairs` / `groups` / `meetings` props.
//
// Structured data: this list emits none — it is purely presentational. The
// page's Person/ProfilePage graph is emitted as head JSON-LD by the route
// meta() (metas/person.ts → jsonld/person.ts); per-row VoteActions were dropped
// as low search-value (nested sub-lists aren't emitted as graph nodes — see the
// structured-data note in docs/conventions.md).
//
// Conventions:
//   • Reverse-chronological by voting date (newest first), id desc as tiebreak —
//     matches the query's ORDER BY id DESC and the usual reading of a voting log.
//   • Dates are epoch-millis numbers → formatEpoch (explicit tz, no SSR drift).
//   • Rows can span bodies (national + cantonal), so every row shows its own
//     body label via bodyLabel(row.body_key, …).
//   • Pagination ("page") is driven by a URL search param so it is SSR-friendly
//     and linkable; total_count is the unpaginated count, items is the slice.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type {
    PersonClient,
    IdentityClient,
    BodyClient,
    AffairClient,
    GroupClient,
    MeetingClient,
} from "@/types/opd_db";
import type {
    PaginatedList,
    VoteWithVoting,
} from "@/types/opd_paginated_client";
import {
    buildBodyLookup,
    bodyLabel,
    formatEpoch,
} from "~/lib/domain/person";
import {
    votesDescriptor,
    withBodyOptions,
} from "~/lib/dimensions/descriptors";

import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, feedPath, InternalLink, isoOf, Chip, hostLabel } from "../opd_micros";
import { votingHref, affairHref, groupHref, meetingHref } from "~/lib/urls/hrefs";
import { Icon } from "../../icons/opd_icons";
import { TallyLine } from "../_shared/votingHelpers";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface PersonVotesProps {
    /** The person record. `persons.id` is the canonical (primary) id and drives
     *  the feed link. */
    persons: PersonClient;
    /** The page slice + unpaginated count: `dat.votes`. */
    votes: PaginatedList<VoteWithVoting>;
    identities?: IdentityClient[];
    bodies?: BodyClient[];
    /** Response-scoped lookups for row enrichment: the affairs / groups /
     *  meetings behind the votes on this page (from the *_agg arrays). */
    affairs?: AffairClient[];
    groups?: GroupClient[];
    meetings?: MeetingClient[];
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    /**
     * "page"    — full dimension route: pagination + data credit (default).
     * "snippet" — embedded on the overview: no pager, just the rows the loader
     *             passed plus a link to the full /people/:id/votes feed.
     */
    variant?: "page" | "snippet";
    /** Page size ($7) and page start ($8), echoed from the loader. ("page" only.) */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. ("page" only.) */
    pageParam?: string;
    className?: string;
}

/* ----------------------------- outcome mapping ---------------------------- */

type Outcome = "yes" | "no" | "abstain" | "absent" | "unknown";

/**
 * Classify a vote for color coding. Uses the raw `vote` (stable, unlocalized)
 * with the localized display as a secondary hint. Order matters: the abstain /
 * absent stems are tested before yes / no so "abstention" never reads as "no".
 */
function classifyVote(
    raw: string | null | undefined,
    display: string | null | undefined,
): Outcome {
    const s = `${raw ?? ""} ${display ?? ""}`.toLowerCase();
    if (/abst|enthal/.test(s)) return "abstain";
    if (/absent|abwesend|entschuld|excus|not[_\s-]?part/.test(s)) return "absent";
    if (/\b(yes|ja|oui|s[ìi])\b/.test(s)) return "yes";
    if (/\b(no|nein|non)\b/.test(s)) return "no";
    return "unknown";
}

const OUTCOME_CHIP: Record<Outcome, string> = {
    yes: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    no: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
    abstain:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    absent:
        "border-border bg-muted text-muted-foreground",
    unknown:
        "border-border bg-muted text-muted-foreground",
};

/* -------------------------------- component ------------------------------- */

export function PersonVotes({
    persons,
    votes,
    identities: _identities = [],
    bodies = [],
    affairs = [],
    groups = [],
    meetings = [],
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: PersonVotesProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);

    // id → record lookups so each vote can resolve its parent business, the
    // group that held it, and the meeting it happened in.
    const affairById = React.useMemo(
        () => new Map(affairs.map((a) => [a.id, a])),
        [affairs],
    );
    const groupById = React.useMemo(
        () => new Map(groups.map((g) => [g.id, g])),
        [groups],
    );
    const meetingById = React.useMemo(
        () => new Map(meetings.map((m) => [m.id, m])),
        [meetings],
    );

    const personId = persons.id;

    // Descriptor with the body facet filled from the bodies actually present.
    const descriptor = React.useMemo(
        () => withBodyOptions(votesDescriptor, bodies),
        [bodies],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            feedHref={feedPath(personId, "votes")}
            icon="vote"
            titleKey="section_votes"
            titleFallback="Voting record"
            emptyKey="no_votes"
            emptyFallback="No recorded votes."
            noResultsFallback="No votes match your search."
            viewAllKey="view_all_votes"
            viewAllFallback="View full voting record"
            list={votes}
            renderRow={(v) => (
                <VoteRow
                    key={v.id}
                    vote={v}
                    t={t}
                    locale={locale}
                    bodyLabelText={bodyLabel(v.body_key, bodyLookup)}
                    affair={
                        v.voting?.affair_id != null
                            ? affairById.get(v.voting.affair_id) ?? null
                            : null
                    }
                    group={
                        v.voting?.group_id != null
                            ? groupById.get(v.voting.group_id) ?? null
                            : null
                    }
                    meeting={
                        v.voting?.meeting_id != null
                            ? meetingById.get(v.voting.meeting_id) ?? null
                            : null
                    }
                />
            )}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            ordered
            className={className}
        />
    );
}

/* --------------------------------- a row ---------------------------------- */

function VoteRow({
    vote,
    t,
    locale,
    bodyLabelText,
    affair,
    group,
    meeting,
}: {
    vote: VoteWithVoting;
    t: (key: string) => string;
    locale: string;
    bodyLabelText: string | null;
    affair: AffairClient | null;
    group: GroupClient | null;
    meeting: MeetingClient | null;
}) {
    const params = useParams();
    const voting = vote.voting;
    const hasVoting = voting != null && voting.id != null;

    const outcome = classifyVote(vote.vote, vote.vote_display);
    const castLabel = vote.vote_display ?? vote.vote ?? t("vote_unknown");

    const title = voting?.title ?? voting?.affair_title ?? null;
    const date = formatEpoch(voting?.date, locale);
    const url = voting?.url_external ?? null;
    const externalHost = hostLabel(url);
    const type = voting?.type ?? null;
    const decision = voting?.decision ?? null;

    // Enrichment from the response-scoped lookups. Affair / group / meeting link
    // INTERNALLY to their own pages (see InternalLink); the voting title above
    // keeps its external official-record link.
    const affairLabel =
        affair?.title ?? affair?.title_long ?? voting?.affair_title ?? null;
    const meetingDate = formatEpoch(meeting?.begin_date, locale);
    const hasContext = !!(affairLabel || group || meeting);

    const hasTally =
        hasVoting &&
        (voting?.results_yes != null ||
            voting?.results_no != null ||
            voting?.results_abstention != null ||
            voting?.results_absent != null);

    return (
        <li className="grid grid-cols-1 gap-y-1.5 py-3 sm:grid-cols-[7rem_1fr] sm:gap-x-4 sm:gap-y-0">
            {/* outcome — aligned, color-coded, scannable down the column */}
            <div className="justify-self-start sm:justify-self-stretch sm:pt-0.5">
                <Chip tone={OUTCOME_CHIP[outcome]}>
                    {castLabel}
                </Chip>
            </div>

            {/* the vote's subject + context */}
            <div className="min-w-0 space-y-1">
                {/* The voting itself carries no entity type (a division isn't
            Legislation); the VoteAction's `object` is the parent affair below. */}
                <div className="text-sm font-medium leading-snug">
                    {hasVoting ? (
                        <InternalLink to={votingHref(params.lang, voting!.id)}>
                            <span>{title ?? t("voting_untitled")}</span>
                        </InternalLink>
                    ) : (
                        <span>{title ?? t("voting_untitled")}</span>
                    )}
                </div>

                {url ? (
                    <div className="text-xs">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            <Icon name="external-link" className="size-3" />
                            {t("external_link")}
                            {externalHost ? ` (${externalHost})` : ""}
                        </a>
                    </div>
                ) : null}

                {/* meta: date · body · type */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {date ? (
                        <time dateTime={isoOf(voting?.date)}>
                            {date}
                        </time>
                    ) : null}
                    {bodyLabelText ? (
                        <MetaItem icon="landmark">{bodyLabelText}</MetaItem>
                    ) : null}
                    {type ? <span>{type}</span> : null}
                </div>

                {/* context: parent affair · group · meeting — internal links */}
                {hasContext ? (
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {affair ? (
                            <MetaItem icon="file-text">
                                <span>
                                    <InternalLink to={affairHref(params.lang, affair.id)}>
                                        <span>{affairLabel}</span>
                                    </InternalLink>
                                    {affair.type_name ? (
                                        <span className="text-muted-foreground/80">
                                            {" "}
                                            ({affair.type_name})
                                        </span>
                                    ) : null}
                                </span>
                            </MetaItem>
                        ) : affairLabel ? (
                            <MetaItem icon="file-text">
                                <span>{affairLabel}</span>
                            </MetaItem>
                        ) : null}
                        {group ? (
                            <MetaItem icon="users">
                                <InternalLink to={groupHref(params.lang, group.id)}>
                                    {group.name ?? group.abbreviation}
                                </InternalLink>
                            </MetaItem>
                        ) : null}
                        {meeting ? (
                            <MetaItem icon="calendar-days">
                                <InternalLink to={meetingHref(params.lang, meeting.id)}>
                                    {meeting.name ?? meeting.type_external ?? t("meeting")}
                                </InternalLink>
                                {meetingDate ? (
                                    <span className="text-muted-foreground/80"> · {meetingDate}</span>
                                ) : null}
                            </MetaItem>
                        ) : null}
                    </div>
                ) : null}

                {/* chamber result: tally + decision */}
                {hasTally || decision ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {hasTally ? (
                            <TallyLine
                                t={t}
                                yes={voting?.results_yes}
                                no={voting?.results_no}
                                abstention={voting?.results_abstention}
                                absent={voting?.results_absent}
                            />
                        ) : null}
                        {decision ? (
                            <Badge variant="outline" className="font-normal text-muted-foreground">
                                {decision}
                            </Badge>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default PersonVotes;