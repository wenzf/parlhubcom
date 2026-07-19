import Header from "~/components/blocks/header";
import SkipLink from "~/components/blocks/skip-link";
import SiteIntro from "~/components/blocks/site-intro";
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { Outlet } from "react-router";
import IconSprite from "~/components/icons/opd_icons";
import { LogoSprite } from "~/components/icons/logo";
import type { Route } from "./+types/lang_layout";
import { langByParam, makeT, SITE_LANG_CODES } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import type { IntroCopyMap } from "~/components/blocks/site-intro";
import { PAGE_CONFIG } from "~/configs/site.config";


export const handle = PAGE_CONFIG.NS_LANG_LAYOUT.handle


export const loader = async ({ params }: Route.LoaderArgs) => {
    const { lang_code, is_fallback } = langByParam(params.lang)
    // A present-but-unsupported `:lang?` (only '', de, fr, it are valid prefixes)
    // is not a real page — 404 it. The root ErrorBoundary renders <NotFound />.
    if (is_fallback) throw new Response(null, { status: 404 })
    // The current language's chrome comes from loc_main. The site-intro toast
    // needs the `intro` block in *every* interface language at once — the
    // alternative-language offer is shown in the offered language (which may
    // differ from the current interface language), so we also load loc_main for
    // all SITE_LANG_CODES and hand the map of `.intro` sub-objects to <SiteIntro/>.
    // Only UI languages qualify: the offer switches the *interface* language, so a
    // content-only fallback like `rm` (no UI route) is deliberately excluded.
    const [locs, ...mainByLang] = await Promise.all([
        getStaticData(["loc_main"], lang_code),
        ...SITE_LANG_CODES.map((l) => getStaticData(["loc_main"], l)),
    ])
    const intro = Object.fromEntries(
        SITE_LANG_CODES.map((l, i) => [l, (mainByLang[i] as { intro: unknown }).intro]),
    ) as unknown as IntroCopyMap
    return Response.json({ locs, intro })
}


export default function LangLayout({ loaderData }: Route.ComponentProps) {
    const { intro, locs } = loaderData as unknown as {
        intro: IntroCopyMap
        locs: { nav?: Record<string, string> }
    }
    const tNav = makeT(locs?.nav)

    return (
        <TooltipProvider>
            {/* First focusable element in the body — must stay ahead of <Header/>. */}
            <SkipLink label={tNav("skip_to_content")} />
            <Header />
            <Outlet />
            <span>
                <IconSprite />
                <LogoSprite />
            </span>
            <Toaster />
            <SiteIntro intro={intro} />
        </TooltipProvider>

    )
}
