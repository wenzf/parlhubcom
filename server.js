// server.js — production HTTP server.
//
// This is a line-for-line port of `react-router-serve`
// (node_modules/@react-router/serve/dist/cli.js), minus its RSC branch, plus
// the two things below. It exists ONLY because that CLI ends in
// `app.listen(port, onListen)` and never touches the returned server object,
// so there is no way to set `keepAliveTimeout` from the outside.
//
// Why keepAliveTimeout matters here (this is a real production bug, not a
// precaution): Node closes an idle keep-alive connection after 5s, while our
// ALB pools upstream connections for 60s (idle_timeout.timeout_seconds). When
// the ALB dispatches a request onto a connection Node has concurrently decided
// to close, the request meets a FIN/RST and the ALB answers **502**. It is
// sporadic, it never appears in the app log (the request does not reach this
// process), and it surfaces as `TargetConnectionErrorCount` on the ALB. It also
// fails ALB health checks, which makes ECS kill an otherwise-healthy task — and
// because a replacement re-downloads the ~35GB DuckDB before it can listen,
// one blip costs minutes of downtime.
//
// The fix is to make the server's idle timeout LONGER than the ALB's, so the
// ALB is always the side that closes. Keep KEEP_ALIVE_TIMEOUT_MS above the
// ALB's idle_timeout (60s, set in sst.config.ts) if either is ever changed.

// Entry point is server.cjs, NOT this file — it sets NODE_ENV before the
// imports below are evaluated, which React's CJS entry depends on. Running
// `node server.js` directly with NODE_ENV unset serves 500s on every page.

import path from "node:path";
import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import expressStaticGzip from "express-static-gzip";
import morgan from "morgan";

const PORT = Number(process.env.PORT) || 5555;

/** Must exceed the ALB's idle_timeout (60s) so the ALB always closes first. */
const KEEP_ALIVE_TIMEOUT_MS = 65_000;
/** Node requires this to exceed keepAliveTimeout, or it can close mid-headers. */
const HEADERS_TIMEOUT_MS = 66_000;

const build = await import("./build/server/index.js");

const app = express();
app.disable("x-powered-by");
app.use(compression());

// Static wiring identical to react-router-serve: hashed assets are immutable,
// everything else in build/client (which is where the build copies /public) is
// served plainly.
const publicPath = build.publicPath.startsWith("/")
    ? build.publicPath
    : `/${build.publicPath}`;
// Hashed assets are immutable, so they're precompressed to `.br`/`.gz` at build
// time (deploy/precompress.mjs, npm `postbuild`). express-static-gzip serves the
// best variant the client accepts — Brotli q11 from disk instead of the q4
// on-the-fly path below — and falls back to the raw file when no sibling exists
// (sub-1KB assets) or the client sent no Accept-Encoding, in which case the
// compression() middleware above still gzips it. Serving a `.br`/`.gz` sets
// Content-Encoding, which compression() detects and skips (no double-encoding).
app.use(
    path.posix.join(publicPath, "assets"),
    expressStaticGzip(path.join(build.assetsBuildDirectory, "assets"), {
        enableBrotli: true,
        orderPreference: ["br"],
        index: false,
        serveStatic: {
            immutable: true,
            maxAge: "1y",
        },
    }),
);
app.use(publicPath, express.static(build.assetsBuildDirectory));
app.use(express.static("public", { maxAge: "1h" }));

// morgan's "tiny" preset, plus the user-agent. Without it a request logs as
// `GET /fr/docs/78133 200 - - 46.227 ms` and there is no way to tell a reader
// from a crawler — ALB access logs are off, so this is the only record of who
// is asking. Deliberately NOT logging the client IP (x-forwarded-for): a bot
// names itself in the user-agent, whereas IPs are personal data and this is a
// public site with EU/CH visitors.
app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms ":user-agent"'),
);

// Liveness probe for the ALB target group (loadBalancer.health in sst.config.ts).
// Deliberately handled here rather than as a react-router route: it must not be
// able to touch DuckDB, the locale loaders, or anything else that could stall
// under load. The ALB kills the task on 2 consecutive failures, and a
// replacement costs ~4min of downtime, so this path answers from memory or not
// at all. Kept AFTER morgan on purpose — the per-check log line is what proves
// the process was still serving when ECS declared it unhealthy.
app.get("/health", (_req, res) => {
    res.status(200).type("text/plain").send("ok");
});

app.all("/{*splat}", createRequestHandler({ build, mode: process.env.NODE_ENV }));

const server = app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
});

server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
server.headersTimeout = HEADERS_TIMEOUT_MS;

// ECS sends SIGTERM and waits before SIGKILL; close the listener so in-flight
// requests drain instead of being cut.
for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => server.close(console.error));
}
