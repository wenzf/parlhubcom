# Domain — political data

- The site presents Swiss and Liechtenstein political / parliamentary data.
- Data source: https://openparldata.ch/ (collects data from Switzerland and Liechtenstein).
- Logo: hemicycle mark + wordmark, `public/icons/logo*.svg` (OG card `icons/og-image.png`).

## What parlhub is (the short version)

parlhub is a portal for the Swiss and Liechtenstein parliaments — it takes the open data from
OpenParlData.ch and turns it into something you can actually explore. You can
dig into **people** (MPs), **groups** (parties/fractions), **bodies** (councils
& committees), **affairs** (legislative business), **votings**, **speeches**,
**docs/texts**, **meetings**, **organizations** and **interests** (lobbying ties).

The fun part is it doesn't just list rows — it computes stuff on top: voting
**alignment**, party **loyalty**, **lobby** connections, **topics**,
**vocabulary** (word-frequency maps of a person's speeches, at
`/people/:id/vocabulary`), and co-voting neighbours. So you can ask "who votes
like whom?" not just "how did X vote?". It's multilingual (en/de/fr/it/es/pt/rm), server-rendered
(React Router + DuckDB), and wrapped in the calm monochrome AAA look described
in the style guide.
