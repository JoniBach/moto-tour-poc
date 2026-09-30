// A photo page, prerendered for every photo.
import { error } from '@sveltejs/kit';
import fs from 'node:fs';
import { on } from '$lib/flags';
import { photoPage } from '$lib/server/blog-data';
import { DATA_DIR } from '$lib/tourConfig';

const PHOTOS = `${DATA_DIR}/photos.json`;

// switched off: not built (a request would just 404)
export const prerender = on('blog') && on('photos');

export const entries = () =>
	on('blog') && on('photos') && fs.existsSync(PHOTOS)
		? (JSON.parse(fs.readFileSync(PHOTOS, 'utf8')).photos as { day: string | null; id: string }[])
				.filter((p): p is { day: string; id: string } => !!p.day)
				.map(({ day, id }) => ({ day, id }))
		: [];

export const load = ({ params }) => photoPage(params.day, params.id) ?? error(404, "That photo isn't here");
