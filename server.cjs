#!/usr/bin/env node
// Entry point for `npm run start`. All this does is set NODE_ENV and hand off
// to ./server.js — but it has to be a separate CommonJS file to do it.
//
// React's CJS entry picks its development-vs-production build at import time,
// off process.env.NODE_ENV. ESM static imports are hoisted and evaluated before
// any statement in the module body, so `process.env.NODE_ENV = ...` written
// inside server.js runs too late: @react-router/express has already pulled in
// react's development build by then. The symptom is not a clean error — SSR
// dies with `TypeError: dispatcher.getOwner is not a function` (react dev
// paired with react-dom production) and every page returns 500, while /health
// keeps answering 200 because it never touches React.
//
// Setting NODE_ENV here, before the dynamic import below pulls in that graph,
// is the same trick (and the same reason) as @react-router/serve's own bin.cjs.
process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

void import("./server.js").catch((error) => {
    console.error(error);
    process.exit(1);
});
