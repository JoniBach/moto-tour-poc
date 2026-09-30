// Build-time data for the blog pages. Runs only on the server (at prerender), reading the
// generated JSON from static/data, so each page ships just the slice it shows — never the whole
// photo list or the 3D app.
import fs from 'node:fs';
import type { BlogPost, Feed, FeedDay, FeedEvent, Photo } from '$lib/data';
import { on } from '$lib/flags';
import { DATA_DIR } from '$lib/tourConfig';
import { distRound } from '../units';

const cache = new Map<string, unknown>();
function read<T>(file: string, fallback: T): T {
	if (!cache.has(file)) {
		const path = `${DATA_DIR}/${file}`;
		cache.set(file, fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : fallback);
	}
	return cache.get(file) as T;
}
const rawFeed = () => read<Feed>('feed.json', { days: [] });
const posts = () => (on('stories') ? read<{ posts: BlogPost[] }>('blog.json', { posts: [] }).posts : []);
const photos = () => (on('photos') ? read<{ photos: Photo[] }>('photos.json', { photos: [] }).photos : []);

/** The feed as released (src/lib/flags.ts): without the photos, stories or weather that are switched off. */
const keep = (e: FeedEvent) => (e.kind === 'photos' ? on('photos') : e.kind === 'post' ? on('stories') : true);
let released: Feed | null = null;
const feed = (): Feed =>
	(released ??= {
		days: rawFeed().days.map((d) => ({
			...d,
			photos: on('photos') ? d.photos : 0,
			weather: on('weather') ? d.weather : null,
			events: d.events.filter(keep)
		}))
	});

/** What a post looks like in a feed card (no body HTML). */
export type PostCard = Pick<BlogPost, 'slug' | 'title' | 'excerpt' | 'minutes' | 'cover'>;
/** A feed event with its post resolved and photo sizes attached (for width/height, no layout shift). */
export type BlogEvent = FeedEvent & { card?: PostCard; sizes?: Record<string, [number, number]> };
export type BlogDay = Omit<FeedDay, 'events'> & { events: BlogEvent[] };
export type DayRef = Pick<FeedDay, 'day' | 'index' | 'title'>;

const ref = (d: FeedDay): DayRef => ({ day: d.day, index: d.index, title: d.title });

function resolve(d: FeedDay, maxPhotos: number): BlogDay {
	const byId = new Map(photos().map((p) => [p.id, p]));
	const bySlug = new Map(posts().map((p) => [p.slug, p]));
	return {
		...d,
		events: d.events.map((e): BlogEvent => {
			if (e.kind === 'post') {
				const p = bySlug.get(e.post);
				const card = p && { slug: p.slug, title: p.title, excerpt: p.excerpt, minutes: p.minutes, cover: p.cover };
				const cover = p?.cover ? byId.get(p.cover) : undefined;
				return { ...e, card, sizes: cover ? { [cover.id]: [cover.w, cover.h] } : undefined };
			}
			if (e.kind === 'photos') {
				const sizes: Record<string, [number, number]> = {};
				for (const id of e.photos.slice(0, maxPhotos)) {
					const p = byId.get(id);
					if (p) sizes[id] = [p.w, p.h];
				}
				return { ...e, sizes };
			}
			return e;
		})
	};
}

export function indexPage() {
	const days = feed().days;
	return {
		days: days.map((d) => resolve(d, 6)),
		totals: {
			days: days.length,
			distance: distRound(days.reduce((a, d) => a + d.km, 0)),
			parks: new Set(days.flatMap((d) => d.parks)).size,
			photos: days.reduce((a, d) => a + d.photos, 0),
			stories: posts().length
		}
	};
}

export function dayPage(day: string) {
	const days = feed().days;
	const k = days.findIndex((d) => d.day === day);
	if (k < 0) return null;
	return {
		day: resolve(days[k], 12),
		dayCount: days.length,
		prev: k > 0 ? ref(days[k - 1]) : null,
		next: k < days.length - 1 ? ref(days[k + 1]) : null
	};
}

export function postPage(slug: string) {
	const all = posts();
	const k = all.findIndex((p) => p.slug === slug);
	if (k < 0) return null;
	const post = all[k];
	const d = feed().days.find((x) => x.day === post.day);
	if (!d) return null;
	const cover = post.cover ? photos().find((p) => p.id === post.cover) : undefined;
	const place = d.events.find((e) => e.kind === 'post' && e.post === slug)?.place ?? null;
	const nav = (p?: BlogPost) => (p ? { slug: p.slug, day: p.day, title: p.title } : null);
	return {
		post,
		cover: cover ? { id: cover.id, w: cover.w, h: cover.h } : null,
		day: ref(d),
		place,
		prev: nav(all[k - 1]),
		next: nav(all[k + 1])
	};
}

export function photoPage(day: string, id: string) {
	const list = photos().filter((p) => p.day === day);
	const k = list.findIndex((p) => p.id === id);
	const d = feed().days.find((x) => x.day === day);
	if (k < 0 || !d) return null;
	const p = list[k];
	const place = d.events.find((e) => e.kind === 'photos' && e.photos.includes(id))?.place ?? null;
	return {
		photo: { id: p.id, w: p.w, h: p.h, t: p.t },
		position: k + 1,
		count: list.length,
		prev: list[k - 1]?.id ?? null,
		next: list[k + 1]?.id ?? null,
		day: ref(d),
		place
	};
}
