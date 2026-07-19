import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "~/components/ui/sidebar"

import { useSidebarData } from "~/hooks/use-sidebar-data"
import sidebarsConfig, { sectionSeachLocationMap, type SidebarConfig, NAV_SECTION_GROUPS, IconMap } from "~/configs/sidebars.config"
import { NavLink, useParams, useRouteLoaderData } from "react-router"
import { localizedPath } from "~/lib/lang"
import { ChevronRight } from "lucide-react"
import { useState, Fragment } from "react"
import { Icon } from "~/components/icons/opd_icons"

export function NavMain() {
    const { header, location, labels } = useSidebarData()
    const params = useParams()

    const [openColllapsible, setOpenCollapsible] = useState<
        typeof location.data_sub_section | "overview">(location.data_sub_section ?? "NONE")

    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')

    const data_section = location.data_section

    // @ts-expect-error follows
    const sectionSidebarConfig = sidebarsConfig?.[data_section] as SidebarConfig[]

    const section_switcher = layoutRouteLoaderData?.locs?.sidebar?.section_switcher

    if (!sectionSidebarConfig || !labels) return (
        <>
            <SidebarGroup>
                <SidebarMenu>
                    <Collapsible
                        open={false}
                        className="group/collapsible"
                        render={<SidebarMenuItem />}
                    >
                        <CollapsibleTrigger
                            nativeButton={false}
                            render={
                                <SidebarMenuButton
                                    tooltip={section_switcher?.home}
                                    render={
                                        <NavLink to={localizedPath(params.lang, "NS_LANG_LAYOUT")}
                                            viewTransition
                                        />} />}>
                            <Icon name="house" />
                            <span>{section_switcher?.home}</span>
                        </CollapsibleTrigger>
                    </Collapsible>
                </SidebarMenu>
            </SidebarGroup>
            {/* Same four clusters as the header's Explore panel (shared
                NAV_SECTION_GROUPS); group + item labels via section_switcher. */}
            {NAV_SECTION_GROUPS.map((g) => (
                <SidebarGroup key={g.group}>
                    <SidebarGroupLabel>
                        {section_switcher?.[g.group] ?? g.group}
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {g.items.map((it) => (
                            <Collapsible
                                key={it.ns}
                                open={false}
                                className="group/collapsible"
                                render={<SidebarMenuItem />}
                            >
                                <CollapsibleTrigger
                                    nativeButton={false}
                                    render={
                                        <SidebarMenuButton
                                            isActive={location.page_key === it.ns}
                                            tooltip={section_switcher?.[it.label]}
                                            render={
                                                <NavLink to={localizedPath(params.lang, it.ns)}
                                                    viewTransition
                                                />} />}>
                                    <Icon name={it.icon} />
                                    <span>{section_switcher?.[it.label]}</span>
                                </CollapsibleTrigger>
                            </Collapsible>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </>
    )

    const locs = labels?.labels_loc_object

    // Every data detail page presents the section's own sub-pages as an indented
    // sub-tree headed by the base-route icon (person / landmark / …) + the
    // record's name, with a fine vertical guide line. Head + line + indent
    // collapse away on the icon rail. The head icon comes from the page's
    // icon_namespace (NOT the "overview" item, which now carries its own mark).
    const baseIcon = header?.icon_namespace ? IconMap[header.icon_namespace] : undefined

    const sectionItems = sectionSidebarConfig.map((it) => (
        <Fragment key={it.page_key}>
            {it.is_collapsible ? (
                <Collapsible
                    open={openColllapsible === it.data_sub_section}
                    className="group/collapsible"
                    render={<SidebarMenuItem />}
                >
                    <CollapsibleTrigger
                        onClick={() => setOpenCollapsible(it?.data_sub_section !== openColllapsible ? it.data_sub_section! : "NONE")}
                        render={<SidebarMenuButton
                            isActive={it?.data_sub_section === openColllapsible}
                            tooltip={locs?.[it.label]} />}
                    >
                        <Icon name={it.icon} />
                        <span>{locs?.[it.label]}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                    </CollapsibleTrigger>
                    {it.items?.length ? (
                        <CollapsibleContent>
                            <SidebarMenuSub>
                                {it.items?.map((subItem) => (
                                    <SidebarMenuSubItem key={subItem.label}>
                                        <SidebarMenuSubButton render={
                                            <NavLink
                                                viewTransition
                                                to={`${localizedPath(params.lang,
                                                    it.page_key, params)}${subItem.hash
                                                        ? `#${subItem.hash}`
                                                        : ''}`} />
                                        }>
                                            <span>{locs?.[subItem.label]}</span>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                ))}
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    ) : null}
                </Collapsible>
            ) : (
                <Collapsible
                    open={false}
                    className="group/collapsible"
                    render={<SidebarMenuItem />}
                >
                    <CollapsibleTrigger
                        nativeButton={false}
                        render={
                            <SidebarMenuButton
                                isActive={it?.data_sub_section === openColllapsible}
                                onClick={() => setOpenCollapsible(it?.data_sub_section !== openColllapsible ? it.data_sub_section! : "NONE")}
                                tooltip={locs?.[it.label]}
                                render={
                                    <NavLink to={localizedPath(params.lang,
                                        it.page_key, params)}
                                        viewTransition
                                    />} />}>
                        <Icon name={it.icon} />
                        <span>{locs?.[it.label]}</span>
                    </CollapsibleTrigger>
                </Collapsible>
            )}
        </Fragment>
    ))

    return (
        <SidebarGroup>

            <SidebarMenu>

                <Collapsible
                    open={false}
                    className="group/collapsible"
                    render={<SidebarMenuItem />}
                >
                    <CollapsibleTrigger
                        nativeButton={false}
                        render={
                            <SidebarMenuButton
                                tooltip={locs?.home}
                                render={
                                    <NavLink to={localizedPath(params.lang, "NS_LANG_LAYOUT")}
                                        viewTransition
                                    />} />}>
                        <Icon name="house" />
                        <span>{locs?.home}</span>
                    </CollapsibleTrigger>
                </Collapsible>

                <Collapsible
                    open={false}
                    className="group/collapsible"
                    render={<SidebarMenuItem />}
                >
                    <CollapsibleTrigger
                        nativeButton={false}
                        render={
                            <SidebarMenuButton
                                tooltip={locs?.search}
                                render={
                                    <NavLink to={localizedPath(params.lang, sectionSeachLocationMap[data_section])}
                                        viewTransition
                                    />} />}>
                        <Icon name="search" />
                        <span>{locs?.search}</span>
                    </CollapsibleTrigger>
                </Collapsible>

            </SidebarMenu>

            {/* Entity head: the base-route icon + the record's name (e.g.
                "Brahim Aakti"), heading the indented sub-tree of the entity's
                own pages. The guide line descends from beneath the icon. */}
            <SidebarGroupLabel className="mt-1 gap-2 text-sidebar-foreground/80">
                {baseIcon ? <Icon name={baseIcon} /> : null}
                <span className="min-w-0 truncate">{header?.section_subtitle}</span>
            </SidebarGroupLabel>
            <SidebarMenu className="ml-4 w-[calc(100%-1rem)] border-l border-sidebar-border pl-1.5 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:border-l-0 group-data-[collapsible=icon]:pl-0">
                {sectionItems}
            </SidebarMenu>
        </SidebarGroup>
    )
}


