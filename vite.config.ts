import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import devtoolsJson from 'vite-plugin-devtools-json';
import UnpluginTypia from "@ryoppippi/unplugin-typia/vite";

export default defineConfig({
    plugins: [
        // cache: reuse typia transforms across builds/dev (node_modules/.cache);
        // log: false silences the per-build "Cache disabled/enabled" banner.
        UnpluginTypia({ cache: true, log: false }),
        tailwindcss(),
        reactRouter(),
        devtoolsJson()
    ],
    resolve: {
        tsconfigPaths: true,
    },
    server: {
        port: 5555,
        // Fail fast if 5555 is taken instead of silently hopping to 5556/5557.
        // A second `npm run dev` errors ("port in use") rather than spawning a
        // duplicate server — makes orphaned/stacked dev processes impossible to
        // create by accident (reuse the running one, or kill it first).
        strictPort: true,
        watch: {
            ignored: ["**/node_modules/@duckdb/**"],
        },
    },
    optimizeDeps: {
        exclude: [
            "@duckdb/node-api",
            "@duckdb/node-bindings",

        ],
    },
    ssr: {
        external: [
            '@duckdb/node-api',
            '@duckdb/node-bindings',
                        // "@duckdb/node-bindings-linux-x64",
        ],
    },
});
