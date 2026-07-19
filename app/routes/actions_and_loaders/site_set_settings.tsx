import { data, redirect } from "react-router";
import { parseJSON } from '~/lib/std/json'
import { commitSettingsSession, getSettingsSession } from "~/server/sessions/settings.server";
import { FONT_SIZE_MAX, FONT_SIZE_MIN, SETTINGS_DEFAULT } from '~/configs/site.config'
import { CONTENT_LANGS } from '~/configs/content_langs.config'
import type { Settings } from '../../../types/site'

const THEMES: readonly unknown[] = ["dark", "light", "system"]

// The __settings cookie is written from a client-supplied JSON payload, so
// nothing may land in it unchecked: only keys of SETTINGS_DEFAULT survive, and
// each value must already have its expected type (invalid entries are dropped,
// never coerced from strings). Bounding the keys also caps the cookie size, so
// a hostile oversized payload cannot push it past the ~4KB browser limit.
function sanitizeSettings(input: unknown): Partial<Settings> {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {}
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
        if (!(key in SETTINGS_DEFAULT)) continue
        switch (key as keyof Settings) {
            case "theme":
                if (THEMES.includes(value)) out[key] = value
                break
            case "font_size":
                // Clamp to the range the header stepper offers.
                if (typeof value === "number" && Number.isFinite(value)) {
                    out[key] = Math.round(Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, value)))
                }
                break
            case "content_lang":
                // null = "auto", otherwise one of the data-content languages.
                if (value === null || (CONTENT_LANGS as readonly string[]).includes(value as string)) {
                    out[key] = value
                }
                break
            default:
                // The remaining settings are the boolean flags.
                if (typeof value === "boolean") out[key] = value
        }
    }
    return out as Partial<Settings>
}

export async function action({ request }: any) {

    try {
        const formData = await request.formData();
        const cookieHeader = request.headers.get('Cookie')
        const session = await getSettingsSession(cookieHeader)
        const payload = sanitizeSettings(parseJSON(formData.get('payload')))

        // Rebuild from defaults, then the sanitized stored values, then the
        // sanitized payload: a junk key or value from an older or forged
        // cookie is healed on the next write instead of carried forward.
        const newSettings: Settings = {
            ...SETTINGS_DEFAULT,
            ...sanitizeSettings(session.data),
            ...payload,
        }

        for (const key of Object.keys(session.data)) {
            if (!(key in SETTINGS_DEFAULT)) session.unset(key)
        }
        Object.entries(newSettings).forEach(([key, value]) => {
            session.set(key, value)
        })

        // Explicitly not a redirect: every caller is a fetcher that
        // revalidates on completion, so applying the cookie takes a plain 200.
        // No Location header is ever emitted (the old redirect_to form field
        // is ignored), which closes the open-redirect surface outright.
        return data(null, {
            headers: { "Set-Cookie": await commitSettingsSession(session) },
        });

    } catch {
        return null
    }
}

export const loader = () => redirect('/', { status: 404 })
