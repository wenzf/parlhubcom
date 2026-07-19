// /app/lib/std/config_data.ts

import typia from "typia";
import { type DataFromConfig, type SiteUIMatch } from "@/types/site";
import { getProperty } from 'dot-prop'

export const extractDataFromConfig = (
    matches: SiteUIMatch[],
    dataFromConfig?: DataFromConfig | null
) => {
    if (typia.is<DataFromConfig>(dataFromConfig)) {

        const isDotProp = dataFromConfig.data_key_type === "dotprop"
        if (isDotProp) {
            const data_origin = dataFromConfig.data_origin
            const loaderData = matches.find((it) => it?.handle?.page_key === data_origin)?.loaderData
            const data_key = dataFromConfig.data_key

            if (loaderData && data_key) {
                const primary = getProperty(loaderData, data_key)
                if (primary != null) return primary
                // Primary path is null/undefined → try the optional fallback path
                // (e.g. body.name when body.legislative_name is absent). The
                // fallback may resolve against a different match's loaderData
                // (data_key_fallback_origin) — e.g. a localized placeholder in a
                // layout's `locs` when the entity's own field is empty.
                const fallbackKey = dataFromConfig.data_key_fallback
                if (fallbackKey) {
                    const fallbackOrigin = dataFromConfig.data_key_fallback_origin ?? data_origin
                    const fallbackData = fallbackOrigin === data_origin
                        ? loaderData
                        : matches.find((it) => it?.handle?.page_key === fallbackOrigin)?.loaderData
                    return (fallbackData ? getProperty(fallbackData, fallbackKey) : null) ?? null
                }
                return primary
            }
        }
    }
    return null
}


