// _shared/feeds/PendingOverlay.tsx
//
// Same-route pending indicator. While a criteria/pager navigation back to the
// CURRENT pathname is in flight, React Router holds the previous tree (also
// while a deferred <Await> suspends on the new promise), so the stale content
// stays on screen — dim it and float a spinner pill on top. Usage:
//
//   const pending = useSameRoutePending();
//   <div className="relative" aria-busy={pending || undefined}>
//     {content}
//     {pending ? <PendingOverlay loc={loc} label="controls_loading" /> : null}
//   </div>
//
// The pill sits on its own card surface (bg-card + ring) so its contrast stays
// AAA regardless of what it covers, and sticks at ⅓ viewport so it's visible
// on long scrolled lists.

import { useLocation, useNavigation } from "react-router";
import { makeT } from "~/lib/lang";

/** True while a navigation targeting the current pathname is in flight —
 *  i.e. a search/facet/sort/pager change on this view, not a leave. */
export function useSameRoutePending(): boolean {
    const navigation = useNavigation();
    const { pathname } = useLocation();
    return (
        navigation.state !== "idle" && navigation.location?.pathname === pathname
    );
}

/** `label` is a loc key resolved against `loc`; falls back to the key itself.
 *  Render inside a `relative` parent (see usage above). */
export function PendingOverlay({
    loc,
    label,
}: {
    loc: Record<string, string>;
    label: string;
}) {
    const text = makeT(loc)(label);
    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center bg-background/60">
            <div
                role="status"
                className="sticky top-1/3 mt-10 flex items-center gap-3 rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground shadow-md ring-1 ring-foreground/10"
            >
                <span
                    aria-hidden="true"
                    className="inline-block size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
                />
                {text}
            </div>
        </div>
    );
}

export default PendingOverlay;
