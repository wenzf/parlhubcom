"use client"

import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { Separator } from "~/components/ui/separator"
import { Outlet } from "react-router"
import BreadcrumbsByHandle from "../breadcrumbs"
import { MAIN_ID } from "../skip-link"



export default function Sidebar() {

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="pt-[var(--header-height)]">
                <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                    <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
                        {/* Sidebar toggle lives here — outside the sidebar — so it stays
                            visible when the sidebar collapses to the off-canvas sheet on
                            mobile (where an in-sidebar trigger would be hidden). */}
                        <SidebarTrigger className="-ml-1 shrink-0" />
                        <Separator
                            orientation="vertical"
                            // The base Separator sets `data-vertical:self-stretch`; with a
                            // fixed h-4 that resolves to top-alignment, so the divider sits
                            // above the switch/breadcrumb centre line. Force-center it (the
                            // `!` beats the attribute-selector stretch regardless of CSS order).
                            className="shrink-0 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center!"
                        />
                        <BreadcrumbsByHandle />
                    </div>
                </header>

                <main id={MAIN_ID} tabIndex={-1} className="flex flex-1 flex-col gap-4 p-4 pt-0 outline-none">
                    <Outlet />
                </main>

            </SidebarInset>
        </SidebarProvider>
    )
}