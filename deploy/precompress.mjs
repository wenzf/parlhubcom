// deploy/precompress.mjs — build-time asset precompression.
//
// Runs as npm `postbuild` (so it rides inside `npm run build`, incl. the
// Dockerfile build-env stage — no Dockerfile change needed). It writes `.br`
// and `.gz` siblings next to every hashed asset in build/client/assets, which
// `express-static-gzip` then serves directly at runtime (see server.js).
//
// Why here and not at request time: those assets are immutable (1y cache), so
// compressing them once at max ratio beats the on-the-fly `compression()`
// middleware, which runs Brotli at quality 4 on every cache-cold request on a
// single origin process (no CDN). Measured ~13% smaller than q4, and it takes
// all asset-compression CPU off the request path.
//
// Dependency-free (node:zlib only) and eval-free — keeps the deploy image lean
// and matches the repo's hand-rolled, CSP-safe conventions.

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

const ROOT = "build/client/assets";

// Only text-like assets benefit; skip already-compressed siblings and anything
// below serve-static's practical floor (matches compression()'s 1KB threshold —
// tiny files often grow when compressed and the per-request win is nil).
const COMPRESSIBLE = /\.(js|mjs|css|svg|json|map|txt|ico|xml|wasm)$/;
const MIN_BYTES = 1024;

/** Yield every regular file under `dir`, recursively. */
function* walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        const st = statSync(path);
        if (st.isDirectory()) yield* walk(path);
        else if (st.isFile()) yield { path, size: st.size };
    }
}

if (!existsSync(ROOT)) {
    console.log(`[precompress] ${ROOT} not found — nothing to do (run after build).`);
    process.exit(0);
}

let files = 0;
let raw = 0;
let br = 0;
let gz = 0;

for (const { path, size } of walk(ROOT)) {
    if (path.endsWith(".br") || path.endsWith(".gz")) continue;
    if (!COMPRESSIBLE.test(path) || size < MIN_BYTES) continue;

    const buf = readFileSync(path);
    const brBuf = brotliCompressSync(buf, {
        params: {
            [constants.BROTLI_PARAM_QUALITY]: 11,
            [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
        },
    });
    const gzBuf = gzipSync(buf, { level: 9 });

    writeFileSync(path + ".br", brBuf);
    writeFileSync(path + ".gz", gzBuf);

    files++;
    raw += buf.length;
    br += brBuf.length;
    gz += gzBuf.length;
}

const kb = (n) => (n / 1024).toFixed(1) + "KB";
console.log(
    `[precompress] ${files} assets: ${kb(raw)} → br ${kb(br)} / gz ${kb(gz)} ` +
        `(brotli ${raw ? ((100 * br) / raw).toFixed(1) : "0"}% of raw)`,
);
