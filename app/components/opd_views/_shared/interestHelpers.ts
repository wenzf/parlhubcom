// _shared/interestHelpers.ts
//
// Payment classification + presentation for declared interests, shared by
// InterestBase, InterestsList and PersonInterests. Extracted from the identical
// `Payment` type, `classifyPayment` classifier and `PAYMENT_CHIP` tone map that
// were copied across all three, plus the shared `paymentLabel` derivation.

import type { TFunc } from "../../opd_views/opd_micros";

export type Payment = "paid" | "unpaid" | "unknown";

/** Classify a declared interest's remuneration from the harmonized code first,
 *  then a multilingual free-text fallback (DE/FR/IT). Returns "unknown" when
 *  nothing recognizable is present. */
export function classifyPayment(
    harmonized: string | null | undefined,
    display: string | null | undefined,
): Payment {
    const h = (harmonized ?? "").toLowerCase().trim();
    if (h === "paid") return "paid";
    if (h === "unpaid" || h === "honorary") return "unpaid";
    if (h) return "unknown"; // harmonized present but unrecognized

    const d = (display ?? "").toLowerCase();
    if (!d.trim()) return "unknown";
    if (/nicht\s*bezahlt|unpaid|unbezahlt|unentgelt|ehrenamt|b[eé]n[eé]vol|gratuit|non[_\s-]?r[eé]mun/.test(d))
        return "unpaid";
    if (/bezahlt|paid|entgelt|verg[üu]t|r[eé]mun[eé]r|r[eé]tribu|retribu|pagat/.test(d))
        return "paid";
    return "unknown";
}

/** Chip/badge tone class per payment status (matches the app design tokens). */
export const PAYMENT_CHIP: Record<Payment, string> = {
    paid: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    unpaid: "border-border bg-muted text-muted-foreground",
    unknown: "border-border bg-muted text-muted-foreground",
};

/** The human label for a payment chip: the raw free-text value when present,
 *  else a localized Paid/Unpaid, else `unknownFallback` (null on the compact
 *  <InterestBase> header, the localized "—" elsewhere). Mirrors the original
 *  `interest.type_payment ?? (…)` derivation (`??`, so an empty string passes
 *  through unchanged). */
export function paymentLabel(
    rawTypePayment: string | null | undefined,
    payment: Payment,
    t: TFunc,
    unknownFallback: string | null = null,
): string | null {
    return (
        rawTypePayment ??
        (payment === "paid"
            ? t("interest_paid")
            : payment === "unpaid"
                ? t("interest_unpaid")
                : unknownFallback)
    );
}