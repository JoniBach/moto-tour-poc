// The blog is rendered to HTML at build time (the 3D app is client-only): content, headings and
// links arrive in the first response, readable before — or without — any JavaScript.
export const ssr = true;
export const prerender = true;
