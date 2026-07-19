// app/routes/sitemap/llms_txt.ts
//
// GET /llms.txt — the llms.txt convention (https://llmstxt.org): a single
// Markdown file at the domain root that gives an LLM / AI agent a curated,
// low-noise map of the site, so it doesn't have to crawl and parse HTML chrome
// to learn what's here. Complements sitemap.xml (exhaustive, for search
// crawlers) and robots.txt (access rules) — this one is selective + annotated.
//
// Registered at the site root (OUTSIDE the ':lang?' prefix, like robots.txt and
// carbon.txt): the convention places exactly one file at the domain root. It is
// therefore English-only (the default, prefix-less locale) — a root file, not a
// localized page, so it does NOT touch /public/locales and needs no mirror.
//
// Every URL is derived from PAGE_CONFIG via `absoluteLocalizedUrl`, the same
// helper the sitemap, canonical <meta> and app <Link>s use — so the links here
// can never drift from the real routes (the "never hardcode a path" rule). Only
// the prose descriptions are inline; adding a page means adding one row below.

import type { PageNamespaces } from "@/types/site";
import { SITE_LANGS } from "~/configs/site.config";
import { absoluteLocalizedUrl, SITE_ORIGIN } from "~/lib/seo/sitemap/urls";

/** The canonical (prefix-less) locale — llms.txt is a single root file. */
const DEFAULT_LANG = SITE_LANGS.find((l) => l.default) ?? SITE_LANGS[0];

type Row = readonly [ns: PageNamespaces, desc: string];

/** `- [Title](url): description` for a PAGE_CONFIG namespace, in the default locale.
 *  The link text is the last path segment's Title — but we spell it out per row
 *  below so the label reads naturally rather than mirroring the URL slug. */
function link(label: string, ns: PageNamespaces, desc: string): string {
    return `- [${label}](${absoluteLocalizedUrl(DEFAULT_LANG.lang_param, ns)}): ${desc}`;
}

const CATALOGUES: ReadonlyArray<readonly [string, ...Row]> = [
    ["People", "NS_PEOPLE_INDEX", "Members of parliament. Each profile links to their votes, how closely they align with other members, lobby/interest ties, memberships, speeches, and a word-frequency vocabulary map."],
    ["Parliaments & bodies", "NS_BODIES_INDEX", "Councils, chambers and committees. Per body: members, votings, affairs, documents, texts, party-loyalty and alignment analyses, and speech-based discussion scaling."],
    ["Groups", "NS_GROUPS_INDEX", "Parties and parliamentary fractions — members, contributions, meetings and votings."],
    ["Affairs", "NS_AFFAIRS_INDEX", "Legislative business — its votings, contributors, speeches, documents, events and full texts."],
    ["Votings", "NS_VOTINGS_INDEX", "Individual votes and their results."],
    ["Speeches", "NS_SPEECHES_INDEX", "Parliamentary speech transcripts (full-text searchable)."],
    ["Texts", "NS_TEXTS_INDEX", "Full texts of parliamentary business (searchable)."],
    ["Documents", "NS_DOCS_INDEX", "Documents attached to affairs and meetings (searchable)."],
    ["Meetings", "NS_MEETINGS_INDEX", "Parliamentary sessions — agendas, votings, speeches, documents, events and contributors."],
    ["Interests", "NS_INTERESTS_INDEX", "Declared interests and lobbying ties of members."],
    ["Organizations", "NS_ORGANIZATIONS_INDEX", "Organizations connected to members and their declared interests."],
];

const PROJECT: ReadonlyArray<readonly [string, ...Row]> = [
    ["Start here", "NS_START", "Guided entry point — curated links to the federal chambers, all 26 cantons, and a search over the ~460 communal parliaments."],
    ["Project overview", "NS_PROJECT_INDEX", "The project section landing page."],
    ["About", "NS_ABOUT", "What parlhub is, who maintains it, and where the data comes from."],
    ["FAQ", "NS_FAQ", "Frequently asked questions."],
    ["Data guide", "NS_PROJECT_DATA_GUIDE", "Plain-language field guide to every data type, each with a link to its catalogue and one concrete example."],
    ["Data map", "NS_PROJECT_DATA_MAP", "Diagram of the data model — the entities and how they interconnect."],
    ["Methodology", "NS_PROJECT_METHODOLOGY", "How each computed metric (voting alignment, party loyalty, lobby network, vocabulary, Wordfish) is calculated, with the exact formula and a link to the source code."],
    ["Accessibility", "NS_ACCESSIBILITY", "Accessibility statement — the site targets WCAG 2.2 level AAA."],
    ["Sustainability", "NS_SUSTAINABILITY", "How parlhub is hosted, and what it deliberately does not measure."],
    ["Traffic statistics", "NS_TRAFFIC_STATS", "Public, privacy-preserving request statistics — no cookies, no IP addresses, no third-party trackers."],
    ["Imprint", "NS_IMPRINT", "Legal notice / publisher information (Impressum) — who runs parlhub, contact, and the code and data licenses."],
];

const EXPERIMENTS: ReadonlyArray<readonly [string, ...Row]> = [
    ["Experiments", "NS_EXPERIMENTS_INDEX", "Experimental and methodological showcases."],
    ["Wordfish", "NS_EXPERIMENTS_WORDFISH", "The Wordfish political-text scaling write-up, and the parliaments whose speech data is rich enough to chart."],
];

const section = (rows: ReadonlyArray<readonly [string, ...Row]>): string =>
    rows.map(([label, ns, desc]) => link(label, ns, desc)).join("\n");

const BODY = `# parlhub

> A portal for the Swiss and Liechtenstein parliaments. parlhub turns the open data from OpenParlData.ch into an explorable, multilingual, server-rendered site — people (MPs), groups (parties & fractions), bodies (councils & committees), affairs (legislative business), votings, speeches, documents, meetings, organizations and lobbying interests — and computes voting alignment, party loyalty, lobby networks, speech vocabulary and Wordfish text-scaling on top of it.

parlhub is a non-commercial, open-source project. All source data comes from OpenParlData.ch, which collects it from Switzerland and Liechtenstein. The interface is available in several languages; the default (unprefixed) language is English, with the others under a language prefix (e.g. \`/de/people\` for German). Most catalogue pages offer bulk data export (CSV/JSON) via \`/{section}/export/…\` routes.

## Data catalogues
${section(CATALOGUES)}

## Project & documentation
${section(PROJECT)}

## Experiments
${section(EXPERIMENTS)}

## Data license
All data — including bulk exports — is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): use, share and build on it, including commercially, with attribution. Credit [OpenParlData.ch](https://openparldata.ch/) as the source of the parliamentary data; credit parlhub for the computed metrics (alignment, loyalty, lobby networks, vocabulary, Wordfish). The application source code is separately licensed Apache-2.0. Details: ${absoluteLocalizedUrl(DEFAULT_LANG.lang_param, "NS_IMPRINT")}

## Optional
- [Home](${SITE_ORIGIN}/): Site entry point with search across all data.
- [Sitemap](${SITE_ORIGIN}/sitemap.xml): Exhaustive machine-readable index of every URL, across all languages.
- [Source code](https://github.com/wenzf/parlhubcom): The full application source.
`;

export function loader(): Response {
    return new Response(BODY, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
