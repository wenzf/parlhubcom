// webmcp_polyfill.client.ts
//
// Mount the WebMCP polyfill exactly ONCE, on the client only. `@mcp-b/global`
// installs `document.modelContext`, which @mcp-b/react-webmcp's hooks register
// against. The native API is a Chrome DevTrial, so the polyfill is what makes the
// tools work in every other browser.
//
// Why a separate .client file: importing `@mcp-b/global` at module top runs its
// side effect against `document`, which does not exist during SSR. React Router's
// `.client.ts` suffix guarantees this module is bundled/evaluated only in the
// browser, so the import is safe here and must NOT be done inside SSR-reachable
// components.
//
// Usage — import for its side effect from the client entry, before hydration:
//
//   // app/entry.client.tsx
//   import "./webmcp_polyfill.client";
//   import { startTransition, StrictMode } from "react";
//   import { hydrateRoot } from "react-dom/client";
//   import { HydratedRouter } from "react-router/dom";
//
//   startTransition(() => {
//     hydrateRoot(
//       document,
//       <StrictMode>
//         <HydratedRouter />
//       </StrictMode>,
//     );
//   });

import "@mcp-b/global";