import crypto from 'node:crypto';
import { PassThrough } from "node:stream";

import type { EntryContext, RouterContextProvider } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import { addSecurityHeaders, sanitizeHeaders } from './lib/security/headers/csp.server';
import { NonceContext } from './server/contexts';

// Deferred catalogue loaders (speeches / texts / docs) stream their shell first
// and resolve the big-table query under a <Suspense> spinner. The abort timer
// (streamTimeout + 1000, see below) must outlive the SLOWEST such query or the
// stream is torn down mid-flight and single-fetch surfaces "Server Timeout".
// The speeches list alone runs ~5s uncached, so 5_000 raced it — 30_000 leaves
// headroom for cold / filtered (home-page `?q=…`) queries.
export const streamTimeout = 30_000;

export default function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
    loadContext: RouterContextProvider,
    // If you have middleware enabled:
    // loadContext: RouterContextProvider
) {
    // https://httpwg.org/specs/rfc9110.html#HEAD
    if (request.method.toUpperCase() === "HEAD") {
        return new Response(null, {
            status: responseStatusCode,
            headers: responseHeaders,
        });
    }

    const cspNonce = crypto.randomBytes(16).toString('hex');
    return new Promise((resolve, reject) => {
        let shellRendered = false;
        let userAgent = request.headers.get("user-agent");

        // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
        // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
        let readyOption: keyof RenderToPipeableStreamOptions =
            (userAgent && isbot(userAgent)) || routerContext.isSpaMode
                ? "onAllReady"
                : "onShellReady";

        // Abort the rendering stream after the `streamTimeout` so it has time to
        // flush down the rejected boundaries
        let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
            () => abort(),
            streamTimeout + 1000,
        );

        const { pipe, abort } = renderToPipeableStream(
            <NonceContext.Provider value={cspNonce}>
                <ServerRouter context={routerContext} url={request.url} nonce={cspNonce} />
            </NonceContext.Provider>,
            {
                nonce: cspNonce,
                [readyOption]() {
                    shellRendered = true;
                    const body = new PassThrough({
                        final(callback) {
                            // Clear the timeout to prevent retaining the closure and memory leak
                            clearTimeout(timeoutId);
                            timeoutId = undefined;
                            callback();
                        },
                    });
                    const stream = createReadableStreamFromReadable(body);

                    responseHeaders.set("Content-Type", "text/html");

                    addSecurityHeaders(responseHeaders, cspNonce);
                    sanitizeHeaders(responseHeaders)

                    pipe(body);

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: responseStatusCode,
                        }),
                    );
                },
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    responseStatusCode = 500;
                    // Log streaming rendering errors from inside the shell.  Don't log
                    // errors encountered during initial shell rendering since they'll
                    // reject and get logged in handleDocumentRequest.
                    if (shellRendered) {
                        console.error(error);
                    }
                },
            },
        );
    });
}
