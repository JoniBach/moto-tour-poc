// One day's blog page, prerendered for every built day.
import { error } from '@sveltejs/kit';
import fs from 'node:fs';
import { dayPage } from '$lib/server/blog-data';

const FEED = 'static/data/feed.json';

export const entries = () =>
	fs.existsSync(FEED) ? (JSON.parse(fs.readFileSync(FEED, 'utf8')).days as { day: string }[]).map(({ day }) => ({ day })) : [];

export const load = ({ params }) => dayPage(params.day) ?? error(404, "That day isn't in the tour");
