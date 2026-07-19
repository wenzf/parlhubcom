import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { SiteLangs } from "../../../types/site"

const cache = new Map<string, { data: Record<string, unknown>; at: number }>()

// Dev: short TTL so edits to /public/locales show up on reload.
// Prod: the files are baked into the deploy (build/client/locales) and only
// change with a redeploy, so cache entries never need to expire.
const TTL = process.env.NODE_ENV === "development" ? 1000 : Infinity

// react-router build copies /public into build/client, so in production the
// locale files sit next to the served assets on the local disk — no HTTP
// round trip to our own public URL (which would also deadlock the very first
// container boot, when the health check runs before the site is reachable).
const LOCALES_DIR =
    process.env.NODE_ENV === "development"
        ? "public/locales"
        : "build/client/locales"

/**
 *
 * @description read localized text fragments from `locales/<lang>/<loc>.json`
 * @param locs namespaces of language files
 * @param lang
 * @returns parsed JSON ltf
 */
export const getStaticData = async (
    locs: string[],
    lang: SiteLangs["lang_code"]
): Promise<Record<string, string | Record<string, string>>> => {
    if (!locs.length) return {}

    const oneCall = async (file: string) => {
        const key = join(LOCALES_DIR, lang, `${file}.json`)
        const hit = cache.get(key)
        if (hit && Date.now() - hit.at < TTL) return hit.data

        const data = JSON.parse(await readFile(key, "utf8"))
        cache.set(key, { data, at: Date.now() })
        return data
    }

    let jobs: unknown[] = []
    for (let i = 0; i < locs.length; i += 1) {
        jobs = [...jobs, oneCall(locs[i])]
    }

    const res = await Promise.all(jobs)
    const outp: Record<string, string> = Object.assign({}, ...res)

    return outp
}
