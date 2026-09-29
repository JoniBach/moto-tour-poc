// A blog post page, prerendered for every post.
import { error } from '@sveltejs/kit';
import fs from 'node:fs';
import { on } from '$lib/flags';
import { postPage } from '$lib/server/blog-data';

const BLOG = 'static/data/blog.json';

// switched off: not built (a request would just 404)
export const prerender = on('blog') && on('stories');

export const entries = () =>
	on('blog') && on('stories') && fs.existsSync(BLOG)
		? (JSON.parse(fs.readFileSync(BLOG, 'utf8')).posts as { day: string; slug: string }[]).map(({ day, slug }) => ({ day, slug }))
		: [];

export const load = ({ params }) => postPage(params.slug) ?? error(404, "That story isn't here");
