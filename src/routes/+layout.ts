// A client-side app: no server rendering. Every page is prerendered as a static shell, so the
// deployment is plain static files (no serverless functions).
export const ssr = false;
export const prerender = true;
