// routes/layouts/experiments_layout.tsx
//
// Layout for the standalone /experiments/* pages (index + the Wordfish write-up).
// Same chrome as project_layout: the brand wordmark top-left (linking home) and a
// breadcrumb row, no data sidebar. LogoSprite is mounted by the lang layout (this
// sits inside it), so the <use> reference resolves.

import { NavLink, Outlet, useParams, useRouteLoaderData } from "react-router";
import { LogoWordmark } from "~/components/icons/logo";
import { localizedPath, makeT } from "~/lib/lang";
import BreadcrumbsByHandle from "~/components/blocks/breadcrumbs";
import { MAIN_ID } from "~/components/blocks/skip-link";

export default function ExperimentsLayout() {
    const { lang } = useParams();
    const langLayoutData = useRouteLoaderData("routes/layouts/lang_layout") as
        | { locs?: { nav?: Record<string, string> } }
        | undefined;
    const tNav = makeT(langLayoutData?.locs?.nav);

    return (
        <>
            <div className="px-2 py-1" data-print-hide>
                <NavLink
                    to={localizedPath(lang, "NS_LANG_LAYOUT")}
                    viewTransition
                    aria-label={tNav("home")}
                    className="inline-flex h-11 items-center rounded-md px-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <LogoWordmark className="h-6" />
                </NavLink>
            </div>
            <header className="flex h-12 shrink-0 items-center px-4" data-print-hide>
                <BreadcrumbsByHandle />
            </header>
            {/* The section's single <main> landmark — both leaves render a plain
                <article> root, so the wrapper lives here (see project_layout). */}
            <main id={MAIN_ID} tabIndex={-1} className="outline-none">
                <Outlet />
            </main>
        </>
    );
}
