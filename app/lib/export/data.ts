// data_export.ts
//
// The pure, dependency-free serializers behind <DataExport>. Kept out of the
// base bundle: <DataExport> lazily `import()`s this module on the first export
// click (mirroring ChartExport's code-split). No React, no DOM beyond the tiny
// `download()` helper — everything here turns tabular data into a Blob.
//
// Formats:
//   • JSON  — array-of-objects per table (label-keyed), pretty-printed.
//   • CSV   — RFC-4180 (CRLF rows, quote-escaped); one table only.
//   • XLSX  — a minimal, hand-written OOXML workbook zipped STORE-only (no
//             compression, no library, no eval → CSP-clean, real .xlsx). One
//             worksheet per table, values typed as number vs inline string.
//
// Why hand-rolled xlsx: the project forbids `unsafe-eval` and avoids new runtime
// deps (see [[csp-strict-no-unsafe-eval]]). A stored (method 0) ZIP needs only a
// CRC-32 and byte concatenation, so a valid xlsx is ~a page of plain JS.

export interface ExportColumn {
    key: string;
    label: string;
}

export interface ExportTable {
    /** Worksheet name / CSV has none / JSON top-level key. */
    name: string;
    columns: ExportColumn[];
    rows: Record<string, unknown>[];
}

export type ExportFormat = "json" | "csv" | "xlsx";

/* --------------------------------- meta ----------------------------------- */

/** The API-style header wrapped around a JSON export: where the data came from,
 *  which URL produced it, when, and how it paginates. CSV/XLSX carry no meta
 *  (flat tabular formats), so this only shapes `toJSON`. */
export interface ExportMeta {
    source: { provider: string; data_origin: string; site_url: string };
    /** The dataset/dimension segment (e.g. "votes"), or null on a profile export. */
    dataset: string | null;
    /** Absolute URL of the export endpoint (bulk), or null for an in-browser slice. */
    export_url: string | null;
    /** Absolute URL of the page the export was taken from. */
    page_url: string | null;
    /** ISO-8601 instant the data was retrieved. */
    retrieved_at: string;
    /** Content-language priority the localized fields were resolved in. */
    languages: string[] | null;
    pagination: {
        page: number | null;
        page_size: number | null;
        total_pages: number | null;
        total_entries: number | null;
        entries_on_page: number;
        next: string | null;
        previous: string | null;
    };
}

/** Assemble an ExportMeta, defaulting every unknown pagination slot to null. The
 *  one builder shared by the server bulk route and the in-browser export, so both
 *  emit the SAME envelope shape (unknown fields are null, never absent). */
export function buildExportMeta(opts: {
    origin: string | null;
    dataset: string | null;
    exportUrl: string | null;
    pageUrl: string | null;
    retrievedAt: string;
    languages?: string[] | null;
    pagination: { entries_on_page: number } & Partial<Omit<ExportMeta["pagination"], "entries_on_page">>;
}): ExportMeta {
    const p = opts.pagination;
    return {
        source: {
            provider: "parlhub",
            data_origin: "OpenParlData.ch",
            site_url: opts.origin ?? "https://parlhub.com",
        },
        dataset: opts.dataset,
        export_url: opts.exportUrl,
        page_url: opts.pageUrl,
        retrieved_at: opts.retrievedAt,
        languages: opts.languages ?? null,
        pagination: {
            page: p.page ?? null,
            page_size: p.page_size ?? null,
            total_pages: p.total_pages ?? null,
            total_entries: p.total_entries ?? null,
            entries_on_page: p.entries_on_page,
            next: p.next ?? null,
            previous: p.previous ?? null,
        },
    };
}

/* --------------------------------- cells ---------------------------------- */

/** Normalize a raw cell into the primitive we serialize. `null`/`undefined` →
 *  empty string; everything non-numeric is stringified. */
function cellValue(v: unknown): string | number {
    if (v == null) return "";
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "boolean") return v ? "true" : "false";
    // Raw list rows can carry nested objects / arrays (joined lookups) — keep them
    // legible as compact JSON rather than "[object Object]".
    if (typeof v === "object") {
        try {
            return JSON.stringify(v);
        } catch {
            return String(v);
        }
    }
    return String(v);
}

/** Union of row keys, in first-seen order — the columns for a raw list export
 *  where no explicit column set is given. */
export function inferColumns(rows: Record<string, unknown>[]): ExportColumn[] {
    const seen = new Set<string>();
    const cols: ExportColumn[] = [];
    for (const row of rows) {
        for (const k of Object.keys(row)) {
            if (!seen.has(k)) {
                seen.add(k);
                cols.push({ key: k, label: k });
            }
        }
    }
    return cols;
}

/** A plain object (a joined struct lookup), not an array / Date / null. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/** Expand nested plain objects into dot-path keys — a joined struct like a vote's
 *  embedded `voting` becomes real columns (`voting.title`, `voting.date`, …)
 *  instead of one JSON-blob cell. Arrays and primitives are left as-is (arrays
 *  still serialize to compact JSON via `cellValue`). */
export function flattenRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const walk = (obj: Record<string, unknown>, prefix: string, out: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) {
            const key = prefix ? `${prefix}.${k}` : k;
            if (isPlainObject(v)) walk(v, key, out);
            else out[key] = v;
        }
    };
    return rows.map((row) => {
        const out: Record<string, unknown> = {};
        walk(row, "", out);
        return out;
    });
}

/** Build a table from RAW list rows (no explicit columns): flatten nested struct
 *  lookups to dot-path columns, then infer the column set. The single shape for
 *  exporting a feed's visible rows — shared by the in-browser and bulk paths. */
export function rawTable(name: string, rows: Record<string, unknown>[]): ExportTable {
    const flat = flattenRows(rows);
    return { name, columns: inferColumns(flat), rows: flat };
}

/* --------------------------------- JSON ----------------------------------- */

export function toJSON(tables: ExportTable[], meta?: ExportMeta): string {
    // Single table → a bare array; multi-table → an object keyed by sheet name.
    const build = (t: ExportTable) =>
        t.rows.map((row) => {
            const o: Record<string, string | number> = {};
            for (const c of t.columns) o[c.label] = cellValue(row[c.key]);
            return o;
        });
    const data =
        tables.length === 1
            ? build(tables[0])
            : Object.fromEntries(tables.map((t) => [t.name, build(t)]));
    // API-style envelope when meta is supplied: a `meta` header, then `data`.
    const payload = meta ? { meta, data } : data;
    return JSON.stringify(payload, null, 2);
}

/* ---------------------------------- CSV ----------------------------------- */

/** RFC-4180: wrap in quotes and double any embedded quote when the field
 *  contains a quote, comma, or newline. */
function csvField(v: string | number): string {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(table: ExportTable): string {
    const head = table.columns.map((c) => csvField(c.label)).join(",");
    const body = table.rows.map((row) =>
        table.columns.map((c) => csvField(cellValue(row[c.key]))).join(","),
    );
    // Leading BOM so Excel opens UTF-8 (umlauts in Swiss names) correctly.
    return "﻿" + [head, ...body].join("\r\n");
}

/* --------------------------------- XLSX ----------------------------------- */

const enc = new TextEncoder();
const xmlEsc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
        c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&apos;",
    );

/** 0-based column index → spreadsheet letter (0→A, 26→AA). */
function colLetter(i: number): string {
    let s = "";
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
        s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    }
    return s;
}

function sheetXml(table: ExportTable): string {
    const rowXml = (cells: (string | number)[], r: number) => {
        const cs = cells
            .map((v, ci) => {
                const ref = `${colLetter(ci)}${r}`;
                if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
                return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(String(v))}</t></is></c>`;
            })
            .join("");
        return `<row r="${r}">${cs}</row>`;
    };
    const header = table.columns.map((c) => c.label);
    const rows = [
        rowXml(header, 1),
        ...table.rows.map((row, i) =>
            rowXml(table.columns.map((c) => cellValue(row[c.key])), i + 2),
        ),
    ].join("");
    return (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<sheetData>${rows}</sheetData></worksheet>`
    );
}

/** Excel forbids \ / ? * [ ] : in sheet names and caps them at 31 chars. */
function safeSheetName(name: string, i: number): string {
    const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31);
    return cleaned || `Sheet${i + 1}`;
}

export function toXLSX(tables: ExportTable[]): Uint8Array {
    const sheets = tables.map((t, i) => ({
        name: safeSheetName(t.name, i),
        path: `xl/worksheets/sheet${i + 1}.xml`,
        xml: sheetXml(t),
    }));

    const contentTypes =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        sheets
            .map(
                (s, i) =>
                    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
            )
            .join("") +
        `</Types>`;

    const rootRels =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`;

    const workbook =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
        sheets
            .map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
            .join("") +
        `</sheets></workbook>`;

    const workbookRels =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets
            .map(
                (s, i) =>
                    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
            )
            .join("") +
        `</Relationships>`;

    const files: { path: string; data: Uint8Array }[] = [
        { path: "[Content_Types].xml", data: enc.encode(contentTypes) },
        { path: "_rels/.rels", data: enc.encode(rootRels) },
        { path: "xl/workbook.xml", data: enc.encode(workbook) },
        { path: "xl/_rels/workbook.xml.rels", data: enc.encode(workbookRels) },
        ...sheets.map((s) => ({ path: s.path, data: enc.encode(s.xml) })),
    ];

    return zipStore(files);
}

/* ------------------------------ store-only ZIP ---------------------------- */

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/** Build a valid ZIP with every entry stored uncompressed (method 0). Enough for
 *  a real .xlsx — Excel doesn't require the parts to be deflated. */
function zipStore(files: { path: string; data: Uint8Array }[]): Uint8Array {
    const chunks: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;

    const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
    const u32 = (n: number) =>
        new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
    const concat = (...parts: Uint8Array[]) => {
        const len = parts.reduce((a, p) => a + p.length, 0);
        const out = new Uint8Array(len);
        let o = 0;
        for (const p of parts) {
            out.set(p, o);
            o += p.length;
        }
        return out;
    };

    for (const f of files) {
        const name = enc.encode(f.path);
        const crc = crc32(f.data);
        const size = f.data.length;

        const local = concat(
            u32(0x04034b50), // local file header sig
            u16(20), // version needed
            u16(0), // flags
            u16(0), // method 0 = stored
            u16(0), // mod time
            u16(0), // mod date
            u32(crc),
            u32(size), // compressed size
            u32(size), // uncompressed size
            u16(name.length),
            u16(0), // extra len
            name,
            f.data,
        );
        chunks.push(local);

        central.push(
            concat(
                u32(0x02014b50), // central dir header sig
                u16(20), // version made by
                u16(20), // version needed
                u16(0),
                u16(0),
                u16(0),
                u16(0),
                u32(crc),
                u32(size),
                u32(size),
                u16(name.length),
                u16(0), // extra
                u16(0), // comment
                u16(0), // disk #
                u16(0), // internal attrs
                u32(0), // external attrs
                u32(offset), // local header offset
                name,
            ),
        );
        offset += local.length;
    }

    const centralBytes = concat(...central);
    const end = concat(
        u32(0x06054b50), // end of central dir sig
        u16(0),
        u16(0),
        u16(files.length),
        u16(files.length),
        u32(centralBytes.length),
        u32(offset),
        u16(0), // comment len
    );

    return concat(...chunks, centralBytes, end);
}

/* ------------------------------- download --------------------------------- */

const MIME: Record<ExportFormat, string> = {
    json: "application/json",
    csv: "text/csv;charset=utf-8",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Turn a serialized payload into a downloaded file. */
export function download(
    filename: string,
    format: ExportFormat,
    payload: string | Uint8Array,
): void {
    const blob = new Blob([payload as BlobPart], { type: MIME[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick so the click's navigation has grabbed the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Serialize `tables` to a payload + content-type, with no DOM (usable in a
 *  loader / resource route as well as the browser). CSV takes the first table. */
export function serializeTables(
    format: ExportFormat,
    tables: ExportTable[],
    meta?: ExportMeta,
): { payload: string | Uint8Array; mime: string } {
    const payload =
        format === "json" ? toJSON(tables, meta) : format === "csv" ? toCSV(tables[0]) : toXLSX(tables);
    return { payload, mime: MIME[format] };
}

/** One-call export: serialize `tables` in `format` and trigger the download.
 *  `meta` wraps the JSON output in the API-style `{ meta, data }` envelope. */
export function exportTables(
    filename: string,
    format: ExportFormat,
    tables: ExportTable[],
    meta?: ExportMeta,
): void {
    if (format === "json") return download(filename, "json", toJSON(tables, meta));
    if (format === "csv") return download(filename, "csv", toCSV(tables[0]));
    return download(filename, "xlsx", toXLSX(tables));
}
