import { createCookie, createCookieSessionStorage } from "react-router";

// The signing key arrives as a runtime env var (SST Secret, injected into the
// task environment at deploy time), never from a tracked file. `npm run dev`
// injects nothing, hence the clearly-labelled throwaway; production must fail
// loud instead of signing with undefined.
const cookieSecret = process.env.COOKIE_SECRET
    ?? (process.env.NODE_ENV !== "production"
        ? "dev-only-throwaway-not-a-secret"
        : undefined);

if (!cookieSecret) {
    throw new Error("COOKIE_SECRET env var is not set: required in production");
}

const cookie = createCookie(
    "__settings", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secrets: [cookieSecret],
    secure: true,
    maxAge: 31536000 * 3 // 3 years
});


const { getSession, commitSession } = createCookieSessionStorage({ cookie })


export {
    getSession as getSettingsSession,
    commitSession as commitSettingsSession,
}
