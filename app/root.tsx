import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useParams,
    useRouteLoaderData,
} from "react-router";


import interLatinWoff2 from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import interFontface from "./css/fonts/inter.css?inline";
import "./app.css";
import type { Route } from "./routes/+types/home";

import clsx from "clsx";
import NotFound, { ErrorView } from "./components/blocks/not-found";
import { RouteProgress } from "./components/blocks/RouteProgress";
import { langByParam } from "./lib/lang";
import { JsonLd, siteJsonLd } from "./lib/seo/jsonld";
import { NonceContext, settingsSessionContext } from "./server/contexts";
import { settingsMiddleware } from "./server/middleware/mw_settings";
import { useContext } from "react";



export const middleware = [
    settingsMiddleware
]


export async function loader({ context }: Route.LoaderArgs) {
    let settings = context.get(settingsSessionContext)

    return Response.json({
        settings
    })
}


export function Layout({ children }: { children: React.ReactNode }) {
    let rootLoaderData = useRouteLoaderData("root")
    let { lang } = useParams()
    let { lang_html, charset } = langByParam(lang)
    const cspNonce = useContext(NonceContext) as string;
    let settings = rootLoaderData?.settings
    const theme = settings?.theme
    const ui_grayscale = settings?.ui_grayscale
    const ui_high_contrast = settings?.ui_high_contrast
    const font_size = settings?.font_size
    return (
        <html
            lang={lang_html}
            className={clsx(theme ?? 'system', {
                "grayscale": ui_grayscale,
                'contrast': ui_high_contrast
            })}
            style={{ fontSize: `${font_size ?? 100}%` }}
        >
            <head>
                {/*
                  Force Zod into jitless mode BEFORE any module script runs. Zod v4
                  JIT-compiles parsers with `new Function` (and probes eval via
                  `new Function("")`), which the strict CSP (no 'unsafe-eval')
                  blocks — surfacing as a console violation. Third-party chunks
                  (@mcp-b/webmcp-ts-sdk) build Zod schemas at MODULE INIT, before any
                  bundled entry code runs, so setting this from an entry module is
                  too late. This nonce'd classic inline script executes during head
                  parse, ahead of the deferred module scripts, so Zod reads
                  `jitless: true` from its global config on load. See zod #4461/#5414.
                */}
                <script
                    nonce={cspNonce}
                    dangerouslySetInnerHTML={{
                        __html:
                            "globalThis.__zod_globalConfig=Object.assign(globalThis.__zod_globalConfig||{},{jitless:true});",
                    }}
                />
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
                <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
                <link rel="icon" href="/favicon.ico" sizes="48x48" />
                <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
                <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#171717" />
                {/*
                  Inter Variable: preload the latin subset and inline the @font-face
                  declarations ahead of app.css so the woff2 fetch starts during head
                  parse — prevents FOUC / late font swap. See app/css/fonts/inter.css.
                */}
                <link rel="preload" href={interLatinWoff2} as="font" type="font/woff2" crossOrigin="anonymous" />
                <style type="text/css" nonce={cspNonce} dangerouslySetInnerHTML={{ __html: interFontface }} />
                <Meta />
                <Links nonce={cspNonce} />
                {/* Site-wide structured data: the parlhub Organization (the @id
                    every Dataset node's `publisher` references) + the WebSite.
                    JSON-LD is a data block — CSP script-src doesn't apply. */}
                <JsonLd data={siteJsonLd()} />
                <meta name="msvalidate.01" content="6DCCF2846BD9A91B5A8764CF0F5C1E76" />
            </head>
            <body>
                <RouteProgress />
                {children}
                <ScrollRestoration nonce={cspNonce} />
                <Scripts nonce={cspNonce} />
            </body>
        </html>
    );
}

export default function App() {
    return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    // 404s — an unsupported `:lang?` (lang_layout loader throws) or an unmatched
    // route (React Router's built-in) — render the localized NotFound page.
    if (isRouteErrorResponse(error) && error.status === 404) {
        return <NotFound />;
    }

    // Everything else → the styled twin of the 404 page (see not-found.tsx).
    let status: number | undefined;
    let details: string | undefined;
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        status = error.status;
        details = error.statusText || undefined;
    } else if (import.meta.env.DEV && error && error instanceof Error) {
        details = error.message;
        stack = error.stack;
    }

    return <ErrorView status={status} details={details} stack={stack} />;
}
