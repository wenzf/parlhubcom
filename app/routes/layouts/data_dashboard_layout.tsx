import Sidebar from "~/components/blocks/sidebar";
import type { Route } from "./+types/data_dashboard_layout";
import { langByParam } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";

import { PAGE_CONFIG } from "~/configs/site.config";

import '../../css/opd-richtext.css'


export const handle = PAGE_CONFIG.NS_DATA_DASHBOARD_LAYOUT.handle


export const loader = async ({ params }: Route.LoaderArgs) => {
    const { lang_code } = langByParam(params.lang)
    const locs = await getStaticData(["loc_data_dashboard"], lang_code)
    return Response.json({ locs })
}


export default function DataDashboardLayout() {

    return (
        <>
            <Sidebar />
        </>
    )
} 