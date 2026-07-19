// webmcp.d.ts
//
// WebMCP declarative-API attributes. Lighthouse's "agentic browsing" audits — and
// native-WebMCP browsers — read `toolname` / `tooldescription` straight off a
// <form> to expose it as an agent tool. This is the DECLARATIVE counterpart to the
// imperative useWebMCP() tools registered in DimensionMcpTools / HomeSearchMcpTool:
// unlike those, the attributes are server-rendered, so they're present the moment
// Lighthouse snapshots the DOM (the imperative registry only fills in after
// hydration). React 19 renders these lowercase custom attributes verbatim; this
// augmentation just lets them typecheck on <form> and react-router's <Form>
// (whose props extend FormHTMLAttributes).

import "react";

declare module "react" {
    interface FormHTMLAttributes<T> {
        /** WebMCP declarative tool name, e.g. "home_search" / "votes_filter". */
        toolname?: string;
        /** WebMCP declarative tool description shown to agents. */
        tooldescription?: string;
    }
}
