import { Fragment } from 'react'

import { NavLink } from "react-router";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

import { useBreadcrumbsByHandle } from '~/hooks/use-breadcrumbs-by-handle';
import { excerpt } from '~/lib/std/strings';


export default function BreadcrumbsByHandle() {
    const breadcrumbs = useBreadcrumbsByHandle()
    if (!breadcrumbs) return null

    return (
        // Scroll the trail horizontally when it's wider than the (narrow) header
        // instead of wrapping onto a second line. min-w-0 lets it shrink inside
        // the flex header so it can scroll rather than push the page wider.
        // p-1.5/-m-1.5: overflow-x-auto clips on BOTH axes, which would cut a
        // crumb link's focus ring — top/bottom on every crumb, and the left edge
        // of the first (home) crumb at scroll-start. The padding gives the ring
        // room inside the clip box; the equal negative margin keeps the nav's
        // laid-out box unchanged in the header.
        <Breadcrumb className="-m-1.5 min-w-0 max-w-full overflow-x-auto p-1.5">
            <BreadcrumbList className="flex-nowrap whitespace-nowrap">
                {breadcrumbs.map((it, ind) => (
                    <Fragment key={ind}>
                        <BreadcrumbItem>
                            {it.is_last ? (
                                <BreadcrumbPage>{excerpt(it.label, 21)}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink render={
                                    <NavLink to={it.path} viewTransition>
                                        <span>{excerpt(it.label, 21)}</span>
                                    </NavLink>
                                } />
                            )}
                        </BreadcrumbItem>
                        {!it.is_last && <BreadcrumbSeparator />}
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )

}
