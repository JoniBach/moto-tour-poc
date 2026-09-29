// A blog post page, prerendered for every post.
import { error } from '@sveltejs/kit';
import fs from 'node:fs';
import { postPage } from '$lib/server/blog-data';

const BLOG = 'static/data/blog.json';

export const entries = () =>
	fs.existsSync(BLOG)
		? (JSON.parse(fs.readFileSync(BLOG, 'utf8')).posts as { day: string; slug: string }[]).map(({ day, slug }) => ({ day, slug }))
		: [];

export const load = ({ params }) => postPage(params.slug) ?? error(404, "That story isn't here");
