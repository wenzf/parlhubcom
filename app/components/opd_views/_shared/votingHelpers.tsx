// _shared/votingHelpers.tsx
//
// Presentational helpers shared by the voting feeds. Extracted from the
// byte-identical `Tally` copies in AffairVotings / BodyVotings / GroupVotings /
// PersonVotes and consumed by the shared _shared/rows/VotingRow.
//
// NOTE: per-voter outcome classification (classifyVote / Outcome / OUTCOME_CHIP)
// currently lives in PersonVotes only (single use), so it is intentionally left
// there. If a second consumer appears (e.g. a per-voter VotingRow), move it here.

/** One coloured count in a result line: "N label", e.g. "12 Yes". `n` nullish
 *  renders as 0. `className` carries the outcome tone (emerald/rose/amber/…). */
export function Tally({
    label,
    n,
    className,
}: {
    label: string;
    n: number | null | undefined;
    className?: string;
}) {
    return (
        <span className={className}>
            {n ?? 0} <span className="text-muted-foreground">{label}</span>
        </span>
    );
}

/** Outcome tones for the text tally line — emerald / rose / amber / muted.
 *  (Distinct from the filled OUTCOME_CHIP badge tones in PersonVotes, which use
 *  border+bg and lighter dark shades appropriate to a filled chip.) */
export const TALLY_TONE = {
    yes: "text-emerald-700 dark:text-emerald-400",
    no: "text-rose-700 dark:text-rose-400",
    abstention: "text-amber-700 dark:text-amber-400",
    absent: "text-muted-foreground",
} as const;

/** The chamber result line — "Result: N Yes · N No · N Abst. · N Absent" — with
 *  the shared outcome tones. Shared by _shared/rows/VotingRow and PersonVotes. */
export function TallyLine({
    t,
    yes,
    no,
    abstention,
    absent,
}: {
    t: (key: string) => string;
    yes: number | null | undefined;
    no: number | null | undefined;
    abstention: number | null | undefined;
    absent: number | null | undefined;
}) {
    return (
        <span className="text-muted-foreground">
            <span className="text-foreground">{t("result")}:</span>{" "}
            <Tally label={t("tally_yes")} n={yes} className={TALLY_TONE.yes} />
            {" · "}
            <Tally label={t("tally_no")} n={no} className={TALLY_TONE.no} />
            {" · "}
            <Tally
                label={t("tally_abstention")}
                n={abstention}
                className={TALLY_TONE.abstention}
            />
            {" · "}
            <Tally
                label={t("tally_absent")}
                n={absent}
                className={TALLY_TONE.absent}
            />
        </span>
    );
}
