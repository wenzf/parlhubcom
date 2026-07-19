// app/components/opd_views/_shared/MethodologyLink.tsx
//
// A small, quiet link that sits next to a computed chart and points at the exact
// section of /project/methodology that explains how that chart's numbers are
// derived. `anchor` is the method's id on the methodology page (e.g. "alignment",
// "loyalty", "vocabulary").
//
// The label ("Methodology") is read from the lang layout's already-loaded
// loc_main.nav, so this component is self-contained and adds no new loc surface;
// the path is resolved through localizedPath (never hardcoded), so it carries the
// active language prefix.

import { Link, useParams, useRouteLoaderData } from "react-router";
import { localizedPath } from "~/lib/lang";
import { cn } from "~/lib/std/cn";
import { Icon } from "~/components/icons/opd_icons";

export function MethodologyLink({ anchor, className }: { anchor: string; className?: string }) {
    const { lang } = useParams();
    const langLayoutData = useRouteLoaderData("routes/layouts/lang_layout") as
        | { locs?: { nav?: Record<string, string> } }
        | undefined;
    const label = langLayoutData?.locs?.nav?.methodology ?? "Methodology";
    const href = `${localizedPath(lang, "NS_PROJECT_METHODOLOGY")}#${anchor}`;

    return (
        <Link
            to={href}
            viewTransition
            className={cn(
                "inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                className,
            )}
        >
            <Icon name="braces" className="size-3.5 shrink-0" />
            {label}
        </Link>
    );
}
