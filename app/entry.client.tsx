import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

// Mount the WebMCP polyfill before hydration, but as an awaited dynamic import
// so it lands in its own chunk instead of the entry bundle. Must be awaited:
// @mcp-b/react-webmcp's hooks register against `document.modelContext` during
// render, so the polyfill's side effect has to run before hydrateRoot. Wrapped
// in an async IIFE rather than top-level await — Vite's default build target
// (es2020) doesn't support TLA.
void (async () => {
    await import("./lib/webmcp/webmcp_polyfill.client");

    startTransition(() => {
        hydrateRoot(
            document,
            <StrictMode>
                <HydratedRouter />
            </StrictMode>,
        );
    });
})();
