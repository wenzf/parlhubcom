// app/routes/sitemap/sitemap_shard.ts
//
// GET /sitemaps/:file — one paged child <urlset>, where :file is `<key>-<page>.xml`
// (e.g. "people-1.xml"). A single dynamic segment (not `:key/:page.xml`) sidesteps
// React Router's per-segment param rules and keeps the `.xml` extension literal.
// Registered at the site root (outside ':lang?'), loader-only.

import { buildEntitySitemap } from "~/server/sitemap/build.server";

const SHARD = /^([a-z0-9_]+)-(\d+)\.xml$/;

export async function loader({
    params,
}: {
    params: Record<string, string | undefined>;
}): Promise<Response> {
    const match = SHARD.exec(params.file ?? "");
    if (!match) throw new Response("Not found", { status: 404 });

    const xml = await buildEntitySitemap(match[1], Number(match[2]));
    if (xml == null) throw new Response("Not found", { status: 404 });

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
