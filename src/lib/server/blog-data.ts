// Build-time data for the blog pages. Runs only on the server (at prerender), reading the
// generated JSON from static/data, so each page ships just the slice it shows — never the whole
// photo list or the 3D app.
import fs from 'node:fs';
import type { BlogPost, Feed, FeedDay, FeedEvent, Photo, TourIndex } from '$lib/data';
import { sketch, type Sketch } from '$lib/sketch';
import { on } from '$lib/flags';
import { DATA_DIR, emailPhotoSrc, ORIGIN, photoSrc } from '$lib/tourConfig';
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
const tourIndex = () => read<TourIndex>('tour.json', { days: [] });

/** A photo as a share card's image (a full address): the JPEG copy if the story has one
 *  (scripts/build-email-images.mjs), else the gallery WebP. */
export function shareImage(id: string | null | undefined): string | null {
	if (!id) return null;
	const jpg = emailPhotoSrc(id);
	return ORIGIN + (fs.existsSync(`static${jpg.slice(jpg.indexOf('/photos/'))}`) ? jpg : photoSrc('large', id));
}

/** A day's route sketch (tour.json's simplified lines), with a moment marked if given. */
export function sketchOf(day: string, dot?: { e: number; n: number }, max = 160): Sketch {
	const d = tourIndex().days.find((x) => x.day === day);
	return sketch(d?.lines ?? [], { dot, max });
}

/** The journey rail: every day, in order, with a small sketch. */
export function railDays() {
	return feed().days.map((d) => ({ day: d.day, index: d.index, title: d.title, start: d.start, sketch: sketchOf(d.day, undefined, 40) }));
}
export type RailDay = ReturnType<typeof railDays>[number];

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
export type BlogDay = Omit<FeedDay, 'events'> & { events: BlogEvent[]; sketch: Sketch; cover: { id: string; w: number; h: number } | null };
export type DayRef = Pick<FeedDay, 'day' | 'index' | 'title'>;

const ref = (d: FeedDay): DayRef => ({ day: d.day, index: d.index, title: d.title });

function resolve(d: FeedDay, maxPhotos: number): BlogDay {
	const byId = new Map(photos().map((p) => [p.id, p]));
	const bySlug = new Map(posts().map((p) => [p.slug, p]));
	// the day's banner: a photo from the middle of the day, usually out on the road
	const own = photos().filter((p) => p.day === d.day);
	const mid = own[Math.floor(own.length / 2)];
	return {
		...d,
		sketch: sketchOf(d.day),
		cover: mid ? { id: mid.id, w: mid.w, h: mid.h } : null,
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
	const resolved = days.map((d) => resolve(d, 6));
	return {
		days: resolved,
		share: shareImage(posts().find((p) => p.cover)?.cover ?? resolved.find((d) => d.cover)?.cover?.id),
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
	const shown = resolve(days[k], 12);
	return {
		day: shown,
		share: shareImage(shown.cover?.id),
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
	const days = feed().days;
	const nav = (p?: BlogPost) => {
		if (!p) return null;
		const pd = days.find((x) => x.day === p.day);
		const c = p.cover ? photos().find((x) => x.id === p.cover) : undefined;
		return { slug: p.slug, day: p.day, index: pd?.index ?? 0, title: p.title, excerpt: p.excerpt, cover: c ? { id: c.id, w: c.w, h: c.h } : null };
	};
	return {
		post,
		cover: cover ? { id: cover.id, w: cover.w, h: cover.h } : null,
		share: shareImage(cover?.id),
		day: ref(d),
		dayCount: days.length,
		where: sketchOf(d.day, { e: post.e, n: post.n }),
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

/** Every blog page, for the sitemap: its path under the tour, and when it last changed if known. */
export function blogPaths(): { path: string; changed?: number }[] {
	if (!on('blog')) return [];
	const days = feed().days;
	return [
		{ path: '/blog' },
		...days.map((d) => ({ path: `/blog/${d.day}` })),
		...posts().map((p) => ({ path: `/blog/${p.day}/${p.slug}`, changed: p.published })),
		...photos().map((p) => ({ path: `/blog/${p.day}/photo/${p.id}` }))
	];
}

/** The newest stories by when they went out, as cards (the "you're subscribed" page). */
export function latestPosts(n: number) {
	const days = feed().days;
	return [...posts()]
		.sort((a, b) => b.published - a.published)
		.slice(0, n)
		.map((p) => ({ slug: p.slug, day: p.day, index: days.find((d) => d.day === p.day)?.index ?? 0, title: p.title, excerpt: p.excerpt }));
}
