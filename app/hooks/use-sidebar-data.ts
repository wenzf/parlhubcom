import { useMemo } from "react"
import { useMatches } from "react-router";
import typia from "typia";
import { type StringRecord, type SidebarData, type SiteUIMatch } from "../../types/site";
import { extractDataFromConfig } from "~/lib/std/config_data";
import { PAGE_CONFIG } from "~/configs/site.config";


export function useSidebarData(): SidebarData {
    const matches = useMatches() as SiteUIMatch[];

    const sidebarData = useMemo(() => {
        const match = [...matches].reverse().find((h) => h.handle)
        const page_key = match?.handle?.page_key
        const page_config = page_key ? PAGE_CONFIG[page_key] : null

        // --- sidebar

        const sidebar_config = page_config?.sidebar
        const sidebar_section_title_config = sidebar_config?.section_title
        const sidebar_secion_subtitle_config = sidebar_config?.section_subtitle

        const sidebar_section_title = extractDataFromConfig(matches, sidebar_section_title_config)
        const sidebar_section_subtitle = extractDataFromConfig(matches, sidebar_secion_subtitle_config)


        // ---- header ---

        let header = {}

        if (sidebar_section_title) {
            header = { section_title: sidebar_section_title }
        }

        // `icon_namespace` is present on only some sidebar-config variants (others
        // carry `labels_loc_object` instead), so narrow the union with `in` before
        // reading it.
        if (sidebar_config && "icon_namespace" in sidebar_config && sidebar_config.icon_namespace) {
            header = { ...header, icon_namespace: sidebar_config.icon_namespace }
        }

        if (sidebar_section_subtitle) {
            header = { ...header, section_subtitle: sidebar_section_subtitle }
        }

        // --- location / section ---

        const data_section = page_config?.data_section ?? "NONE"
        const data_sub_section = page_config?.data_sub_section ?? "NONE"

        let location = {
            data_section,
            data_sub_section,
            page_key: page_key! // <-- DEV TODO
        }

        // --- labels object ---


        const labels_loc_object_config = sidebar_config?.labels_loc_object


        const labels_loc_object = extractDataFromConfig(matches, labels_loc_object_config)


        let labels

        if (typia.is<StringRecord>(labels_loc_object)) {
            labels = {
                labels_loc_object
            }
        } else {
            labels = null
        }


        return {
            header,
            location,
            labels
        }

    }, [matches])


    return sidebarData

}