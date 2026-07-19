"use client"

import { NavLink, useParams, useRouteLoaderData } from "react-router"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "~/components/ui/sidebar"
import { useSidebarData } from "~/hooks/use-sidebar-data"
import { ChevronsUpDownIcon, House } from "lucide-react"
import { localizedPath } from "~/lib/lang"
import { Icon, type IconName } from "~/components/icons/opd_icons"
import { IconMap, dataSections } from '~/configs/sidebars.config'


export function SectionSwitcher() {
    const params = useParams()
    const langLayoutLoaderData = useRouteLoaderData("routes/layouts/data_dashboard_layout")
    const { isMobile } = useSidebar()
    const { header } = useSidebarData()
    const loc_sidebar = langLayoutLoaderData?.locs?.sidebar
    const section_switcher = loc_sidebar?.section_switcher

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <SidebarMenuButton
                                size="lg"
                                // Collapsed rail: size=lg drops its padding (p-0!), which
                                // would pin the icon to the left edge — center it so it
                                // lines up with the p-2-centered nav icons below.
                                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
                            />
                        }>

                        {/* Collapsed icon rail: the section icon alone stands in
                            for the switcher; the text + chevron hide. */}
                        {header?.icon_namespace && (
                            <Icon
                                name={IconMap[header.icon_namespace] as IconName}
                                className="hidden size-4 shrink-0 group-data-[collapsible=icon]:block"
                            />
                        )}
                        <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                            {header?.section_title && <span className="truncate font-medium">{header?.section_title}</span>}
                            {header?.section_subtitle && <span className="truncate text-xs">{header?.section_subtitle}</span>}

                        </span>
                        <ChevronsUpDownIcon className="ml-auto group-data-[collapsible=icon]:hidden" aria-hidden />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        className="w-fit"
                        align="start"
                        side={isMobile ? "bottom" : "right"}
                        sideOffset={4}
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuItem render={
                                <NavLink to={localizedPath(params.lang, "NS_LANG_LAYOUT")} viewTransition>
                                    <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                                        <House className="size-4" aria-hidden />
                                    </div>
                                    <div className="font-medium text-muted-foreground">
                                        {section_switcher?.home}
                                    </div>
                                </NavLink>
                            }>

                            </DropdownMenuItem>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                                {loc_sidebar?.sidebar?.section_switcher?.label_section}
                            </DropdownMenuLabel>
                            {dataSections.map((sec, index) => (
                                <DropdownMenuItem key={index} render={
                                    <NavLink
                                        key={index}
                                        to={localizedPath(params.lang, sec.namespace)}
                                        viewTransition
                                    >
                                        <div className="flex size-6 items-center justify-center rounded-md border">
                                            <Icon name={sec.icon} />
                                        </div>
                                        {section_switcher[sec.label]}
                                    </NavLink>}>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>

                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
