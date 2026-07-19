// _shared/feeds/FeedLoading.tsx
//
// Spinner card shown as the <Suspense> fallback while a DEFERRED catalogue query
// resolves — the big-table lists (speeches / texts / docs) stream their shell
// first and show this until the list is ready. Same spinner recipe as the
// /bodies/:id/lobby panel (role="status", AAA-contrast ring).

import { makeT } from "~/lib/lang";
import { Card, CardContent } from "@/components/ui/card";

/** `label` is a loc key resolved against `loc`; falls back to the key itself. */
export function FeedLoading({
    loc,
    label,
}: {
    loc: Record<string, string>;
    label: string;
}) {
    const text = makeT(loc)(label);
    return (
        <Card>
            <CardContent>
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
                    <span
                        role="status"
                        aria-label={text}
                        className="inline-block size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
                    />
                    {text}
                </div>
            </CardContent>
        </Card>
    );
}

export default FeedLoading;
