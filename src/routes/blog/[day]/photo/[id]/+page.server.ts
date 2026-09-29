// A photo page, prerendered for every photo.
import { error } from '@sveltejs/kit';
import fs from 'node:fs';
import { photoPage } from '$lib/server/blog-data';

const PHOTOS = 'static/data/photos.json';

export const entries = () =>
	fs.existsSync(PHOTOS)
		? (JSON.parse(fs.readFileSync(PHOTOS, 'utf8')).photos as { day: string | null; id: string }[])
				.filter((p): p is { day: string; id: string } => !!p.day)
				.map(({ day, id }) => ({ day, id }))
		: [];

export const load = ({ params }) => photoPage(params.day, params.id) ?? error(404, "That photo isn't here");
