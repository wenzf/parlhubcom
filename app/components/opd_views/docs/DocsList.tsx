// DocsList.tsx                 → ~/components/opd_views/docs/DocsList.tsx
//
// The docs DIRECTORY (top-level /docs): a paginated, server-filtered list of
// documents (from the `docs` table) with search / filter / sort. Driven by
// `docsDescriptor` + the URL. LIST family (top-level): the loader uses
// runListPaginatedFiltered and `docs` here is already the filtered, sorted page
// slice (total_count is the filtered total). Mirrors TextsList / VotingsList.
//
// Search matches the doc name + localized category (server-side). Facet options:
// institution (`body`, sourced, grouped by position), `category` (page slice,
// value = category_harmonized) and `format` (page slice).
//
// Each row is the SHARED <DocRow> whose name links to the doc's own /docs/:id
// page; the same row shape is reused by every scope-docs feed. Catalogue chrome
// (controls / MCP tools / pager / footer) lives in FeedShell.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type { DocClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { docsDescriptor, withCodeOptions } from "~/lib/dimensions/descriptors";
import { localizedPath } from "~/lib/lang";

import { makeT } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { DocRow } from "../_shared/rows/DocRow";

export interface DocsListProps {
  /** The filtered page slice + filtered total: `data.docs`. */
  docs: PaginatedList<DocClient>;
  /** Response-scoped body lookup (`data.bodies.items`): the bodies referenced by
   *  this page's docs (b.id = docs.body_id). Present for parity with other
   *  catalogues; the shared DocRow does not render the institution, so this is
   *  currently unused for display but kept for future row enrichment. */
  bodies?: BodyClient[] | undefined;
  /** Localized label map (pages.person.labels from the loc JSON). */
  loc?: Record<string, string> | undefined;
  locale?: string;
  /** Page size ($6) and page start ($7), echoed from the loader. */
  limit?: number;
  offset?: number;
  /** URL search param the pager writes the offset to. */
  pageParam?: string;
  /** Enable data export (catalogue use only) — forwarded to FeedShell. Omit for scoped reuses. */
  exportConfig?: {
    segment: string;
    datasetKey: string;
    filenameBase: string;
    subject?: string;
  };
  className?: string;
}

export function DocsList({
  docs,
  bodies: _bodies,
  loc = {},
  locale = "de-CH",
  limit = 20,
  offset = 0,
  pageParam = "offset",
  exportConfig,
  className,
}: DocsListProps) {
  const t = React.useMemo(() => makeT(loc), [loc]);
  const { lang } = useParams();

  // Inject `category` options (code = category_harmonized, label = localized
  // category) and `format` options (code = label = format) from the page slice.
  // The `body` facet is sourced client-side (see `sourced` on FeedShell).
  const descriptor = React.useMemo(
    () =>
      withCodeOptions(
        withCodeOptions(
          docsDescriptor,
          "category",
          (docs.items ?? []) as unknown as Record<string, unknown>[],
          "category_harmonized",
          (r) => (r.category as string) ?? String(r.category_harmonized ?? ""),
        ),
        "format",
        (docs.items ?? []) as unknown as Record<string, unknown>[],
        "format",
        (r) => String(r.format ?? ""),
      ),
    [docs.items],
  );

  return (
    <FeedShell
      descriptor={descriptor}
      icon="paperclip"
      titleKey="docs_title"
      titleFallback="Documents"
      emptyKey="no_docs"
      emptyFallback="No documents."
      noResultsFallback="No documents match your search."
      mcpNamespace="catalog"
      mcpSubject="all"
      sourced
      list={docs}
      renderRow={(doc) => (
        <DocRow
          key={doc.id}
          doc={doc}
          t={t}
          locale={locale}
          docHref={localizedPath(lang, "NS_DOCS_OVERVIEW", {
            id: String(doc.id),
          })}
        />
      )}
      loc={loc}
      locale={locale}
      variant="page"
      limit={limit}
      offset={offset}
      pageParam={pageParam}
      exportConfig={exportConfig}
      className={className}
    />
  );
}

export default DocsList;
