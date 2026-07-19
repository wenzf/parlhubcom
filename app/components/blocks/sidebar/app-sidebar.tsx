"use client"

import * as React from "react"
import { NavLink, useLocation, useParams, useRouteLoaderData } from "react-router"
import { Separator } from "~/components/ui/separator"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from "~/components/ui/sidebar"

import { SectionSwitcher } from "./section-switcher"
import { NavMain } from "./nav-main"
import { siteNav } from "~/configs/sidebars.config"
import { localizedPath } from "~/lib/lang"
import { Icon } from "~/components/icons/opd_icons"
import { LogoMark, LogoWordmark } from "~/components/icons/logo"


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const params = useParams()
    const { pathname } = useLocation()
    const { isMobile, setOpenMobile } = useSidebar()
    // On mobile the sidebar is an overlay drawer: close it once a nav link has
    // navigated to a new page. Covers every link source (sections, main nav,
    // footer) in one place. No-op on desktop and on initial mount.
    React.useEffect(() => {
        if (isMobile) setOpenMobile(false)
    }, [pathname, isMobile, setOpenMobile])
    // Site-nav labels live in loc_data_dashboard (loaded by the dashboard layout).
    const layoutData = useRouteLoaderData("routes/layouts/data_dashboard_layout") as
        { locs?: { sidebar?: Record<string, string> } } | undefined
    const sidebarLoc = layoutData?.locs?.sidebar

    return (
        <Sidebar collapsible="icon" {...props} className="top-[var(--header-height)]">
            <SidebarHeader>
                <SectionSwitcher />
                <Separator
                    orientation="horizontal"
                    className="mr-2 data-[orientation=vertical]:h-4"
                />
            </SidebarHeader>
            <SidebarContent>
                <NavMain />
            </SidebarContent>
            <SidebarFooter>
                {/* Site-level links (About). Always visible, independent of the
                    active data section. */}
                <SidebarMenu>
                    {siteNav.map((it) => (
                        <SidebarMenuItem key={it.page_key}>
                            <SidebarMenuButton
                                tooltip={sidebarLoc?.[it.label] ?? it.label}
                                render={
                                    <NavLink
                                        to={localizedPath(params.lang, it.page_key)}
                                        viewTransition
                                    />
                                }
                            >
                                <Icon name={it.icon} />
                                <span>{sidebarLoc?.[it.label] ?? it.label}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
                <Separator
                    orientation="horizontal"
                    className="mr-2 data-[orientation=vertical]:h-4"
                />
                {/* Full wordmark when expanded, mark only when collapsed to the
                    icon rail. Sprite-backed components drawing in currentColor. */}
                <LogoWordmark
                    title="parlhub"
                    className="h-6 px-1 group-data-[collapsible=icon]:hidden"
                />
                <LogoMark
                    title="parlhub"
                    className="mx-auto hidden size-7 group-data-[collapsible=icon]:block"
                />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
