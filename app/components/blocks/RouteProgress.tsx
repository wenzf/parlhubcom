// blocks/RouteProgress.tsx
//
// Cross-route navigation progress bar. Complements the two existing pending
// affordances — the NavLink `a.pending` dim and the same-route PendingOverlay —
// by covering the case they don't: a plain page → page navigation, where the
// whole tree is being replaced and nothing on screen signals the wait. Renders a
// thin top bar ONLY while a navigation to a DIFFERENT pathname is in flight;
// same-pathname search / pager / facet changes stay with PendingOverlay
// (useSameRoutePending), so the two never show at once. Styling + reduced-motion
// handling live in app/css/page-transition.css (.route-progress).

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigation } from "react-router";

// Instant client-cached navigations resolve in well under a frame; delaying the
// bar keeps it from flashing for those. ~120ms mirrors the a.pending delay.
const SHOW_DELAY_MS = 180;

export function RouteProgress() {
    const navigation = useNavigation();
    const { pathname } = useLocation();

    // Leaving the current page: a loader for a DIFFERENT path is running.
    const leaving =
        navigation.state === "loading" &&
        navigation.location?.pathname !== pathname;

    const [visible, setVisible] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (leaving) {
            timer.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
        } else {
            clearTimeout(timer.current);
            setVisible(false);
        }
        return () => clearTimeout(timer.current);
    }, [leaving]);

    return (
        <div
            aria-hidden="true"
            data-active={visible || undefined}
            className="route-progress"
        />
    );
}

export default RouteProgress;
