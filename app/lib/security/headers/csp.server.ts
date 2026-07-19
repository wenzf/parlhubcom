import {
    getCSP, NONE, STRICT_DYNAMIC, SELF, UNSAFE_INLINE,
} from 'csp-header';
import headers_remove from './headers_remove.json';

/*
 * headers_remove.json via
 * https://github.com/OWASP/www-project-secure-headers/blob/master/ci/headers_remove.json
 */


export const securityHeaders = (nonce: string): Headers => {
    const owaspHeaders = new Headers();

    owaspHeaders.set('Content-Security-Policy', contentSecurityPolicy(nonce));
    owaspHeaders.set('Cross-Origin-Embedder-Policy', 'same-origin');
    owaspHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
    owaspHeaders.set('Cross-Origin-Resource-Policy', 'same-origin');
    owaspHeaders.set('Origin-Agent-Cluster', '?1');
    owaspHeaders.set('Permissions-Policy',
        'accelerometer=(), camera=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
    owaspHeaders.set('X-Content-Type-Options', 'nosniff');
    owaspHeaders.set('X-DNS-Prefetch-Control', 'off');
    owaspHeaders.set('X-Download-Options', 'noopen');
    owaspHeaders.set('X-Frame-Options', 'SAMEORIGIN');
    owaspHeaders.set('X-Permitted-Cross-Domain-Policies', 'none');
    owaspHeaders.set('X-XSS-Protection', '0');
    owaspHeaders.set('Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload');
    owaspHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    return owaspHeaders;
};

export const addSecurityHeaders = (headers: Headers, nonce: string): Headers => {
    const owaspHeaders = securityHeaders(nonce);

    owaspHeaders.forEach((value, key) => {
        headers.set(key, value);
    });

    return headers;
};

export const sanitizeHeaders = (headers: Headers): Headers => {
    headers_remove.headers.forEach((header) => {
        headers.delete(header);
    });

    return headers;
};

export const contentSecurityPolicy = (nonce: string): string => {
    // Strict script-src in BOTH dev and prod — no 'unsafe-eval'. Verified nothing
    // evaluates strings at runtime: typia validators are build-time codegen, zod
    // runs jitless (forced via the inline <head> bootstrap in root.tsx, which loads
    // before any module — @mcp-b builds zod schemas at import), and Vite's dev
    // HMR applies updates via import(), not eval. arktype (which JIT-probed with
    // new Function) was removed. Confirmed CSP-clean in a real browser, dev + prod.
    return getCSP({
        directives: {
            // Backstop: everything not listed below is denied.
            'default-src': [NONE],
            'script-src': [
                STRICT_DYNAMIC,
                `'nonce-${nonce}'`,
            ],
            // 'unsafe-inline' (NOT a nonce — a nonce would make the browser
            // ignore 'unsafe-inline') is required: React style={{…}} attributes,
            // the inlined @font-face <style>, and JS-injected <style> elements
            // (Vite dev CSS, UI-lib runtime styles) can't all carry a nonce.
            // Styles can't execute script, so inline styles are not an XSS sink.
            'style-src': [SELF, UNSAFE_INLINE],
            // Person profile images come from arbitrary upstream source_url /
            // wikidata hosts; chart export draws SVG→canvas via blob/data URLs.
            'img-src': [SELF, 'data:', 'blob:', 'https:'],
            // DimensionControls sources facet options client-side from the API;
            // exports fetch from self.
            'connect-src': [SELF, 'https://api.openparldata.ch'],
            'font-src': [SELF],
            'form-action': [SELF],
            'manifest-src': [SELF],
            'worker-src': [NONE],
            'frame-src': [NONE],
            'media-src': [NONE],
            'object-src': [NONE],
            'base-uri': [NONE],
            'frame-ancestors': [NONE],
            'upgrade-insecure-requests': true,
        }
    });
};