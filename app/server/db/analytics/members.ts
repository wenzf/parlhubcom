"server-only";
// analytics_members.ts             → ~/server/db/analytics_members.ts
//
// Shared member-row shaping for the body analytics runners. body_loyalty.ts and
// body_alignment.ts both project the same identity columns for a chamber member
// (person + party + parliamentary group) and coerce the JSON-typed values the
// same way; each then extends the row with its own metric fields. This is the
// common core, factored out so the two stay in lockstep.
//
// (body_lobby.ts's LobbyPerson has a DIFFERENT shape — no parliamentary_group,
// plus interest/degree metrics — so it keeps its own mapping.)

/** The party/identity columns every chamber-member row shares. */
export interface MemberBase {
    person_id: number;
    fullname: string | null;
    party: string | null;
    party_key: string | null; // party_harmonized_wikidata_id — stable colour key
    parliamentary_group: string | null;
}

/** Coerce the shared member identity columns from one raw SQL row. Metric fields
 *  (n_ballots, dissent_rate, x/y, …) are added by each caller on top. */
export function mapMemberBase(m: any): MemberBase {
    return {
        person_id: Number(m.person_id),
        fullname: m.fullname ?? null,
        party: m.party ?? null,
        party_key: m.party_key ?? null,
        parliamentary_group: m.parliamentary_group ?? null,
    };
}
