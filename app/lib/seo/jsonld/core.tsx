// /app/lib/seo/jsonld/core.tsx
//
// The <JsonLd> render primitive: a SSR-only schema.org data block. Still used by
// the root layout to emit the site-wide graph (siteJsonLd, moved to site.ts).
// The engine (buildGraph / jsonLdTag / safeJsonLd) lives in graph.ts; the
// site-wide nodes in site.ts.
//
// CSP: `<script type="application/ld+json">` is a data block, never executed, so
// the strict script-src does not apply — no nonce needed.

import { safeJsonLd } from "./graph";

/** Render a schema.org JSON-LD data block. SSR-only output, zero client JS. */
export function JsonLd({ data }: { data: object }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
        />
    );
}
