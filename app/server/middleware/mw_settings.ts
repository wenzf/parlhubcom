"server-only"

import type { MiddlewareFunction } from "react-router";
import typia from "typia";
import type { Settings } from '../../../types/site'
import { getSettingsSession } from '~/server/sessions/settings.server'
import { settingsSessionContext } from "../contexts";
import { SETTINGS_DEFAULT } from "~/configs/site.config";

export const settingsMiddleware: MiddlewareFunction = async ({ request, context }, next) => {
    const cookieHeader = request.headers.get("Cookie");
    const settingsSession = await getSettingsSession(cookieHeader);

    // Merge stored values over the defaults so a cookie written before a new
    // setting existed (e.g. content_lang) still validates — missing keys fall
    // back to their default instead of failing typia and dropping ALL settings.
    const settings = {
        ...SETTINGS_DEFAULT,
        ...settingsSession.data,
    }

    if (typia.is<Settings>(settings)) {
        context.set(settingsSessionContext, settings)

    }

    return next();
};