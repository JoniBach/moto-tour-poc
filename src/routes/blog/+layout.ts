// The blog is rendered to HTML at build time (the 3D app is client-only): content, headings and
// links arrive in the first response, readable before — or without — any JavaScript.
// Switched off in this release (src/lib/flags.ts): nothing is prerendered and every /blog URL 404s.
import { error } from '@sveltejs/kit';
import { on } from '$lib/flags';

export const ssr = true;
export const prerender = on('blog');

export const load = ({ data }) => {
	if (!on('blog')) error(404, 'Not found');
	return data;
};
