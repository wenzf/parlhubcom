// wellknown_devtools.ts
//
// Chrome DevTools automatically probes
//   /.well-known/appspecific/com.chrome.devtools.json
// (its "automatic workspace folders" feature) whenever DevTools is open. In dev
// the vite-plugin-devtools-json plugin answers it; under the production server
// (react-router-serve) there is no handler, so the router throws
//   Error: No route matches URL "/.well-known/appspecific/com.chrome.devtools.json"
// and logs it on every DevTools connection.
//
// This resource route answers the probe with a plain 404 — we intentionally do
// NOT expose a workspace-folder mapping (a local filesystem path) in production —
// so DevTools gets a clean "no config" response and no server error is logged.
export function loader() {
    return new Response(null, { status: 404 });
}
