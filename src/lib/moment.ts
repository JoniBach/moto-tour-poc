// Shareable moments. A day URL can carry the moment on screen and what's open:
//   /day/2026-09-16?t=10:40:12                      the ride at 10:40:12 (UK time)
//   /day/2026-09-16?t=10:40&post=2026-09-16-whinlatter   …with a blog post open
//   /day/2026-09-16?photo=20260916_104035           …with a photo open (t defaults to its time)
//   /?post=… or /?photo=…                           from the tour overview
// The layout keeps the URL in step (replaceState, no history spam); the pages read it on load.
import type { App } from './app.svelte';
import { bisect } from './data';
import type { Tour } from './tour.svelte';

const pad = (n: number) => String(n).padStart(2, '0');

/** Epoch seconds -> "HH:MM:SS" in UK time. */
export function ukClock(sec: number): string {
	const d = new Date(sec * 1000);
	const [h, m, s] = d
		.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour12: false })
		.split(':')
		.map(Number);
	return `${pad(h % 24)}:${pad(m)}:${pad(s)}`;
}

/** "2026-09-16" + "10:40" / "10:40:12" (UK time) -> epoch seconds, or NaN. */
export function ukToEpoch(day: string, clock: string): number {
	const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(clock);
	const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
	if (!m || !d) return NaN;
	const asUtc = Date.UTC(+d[1], +d[2] - 1, +d[3], +m[1], +m[2], +(m[3] ?? 0));
	// offset of Europe/London at that moment (BST +1 h, GMT 0)
	const london = new Date(new Date(asUtc).toLocaleString('en-US', { timeZone: 'Europe/London' }));
	const utc = new Date(new Date(asUtc).toLocaleString('en-US', { timeZone: 'UTC' }));
	return (asUtc - (london.getTime() - utc.getTime())) / 1000;
}

/** Riding time at a wall-clock moment of the day (clamped to the day). */
export function rtAtEpoch(tour: Tour, sec: number): number {
	const tr = tour.data.track;
	return tr.rt[bisect(tr.t, sec - tr.t0)];
}

/** Open whatever the URL asks for. Returns true if it set the ride's moment. */
export function applyMoment(app: App, tour: Tour | null, params: URLSearchParams): boolean {
	const post = params.get('post') ? app.posts.find((p) => p.slug === params.get('post')) : undefined;
	const photo = params.get('photo') ? app.photos.find((p) => p.id === params.get('photo')) : undefined;
	let seeked = false;
	if (tour) {
		const t = params.get('t');
		const sec = t ? ukToEpoch(tour.data.track.day, t) : (post?.t ?? photo?.t ?? NaN);
		if (Number.isFinite(sec)) {
			tour.seek(rtAtEpoch(tour, sec));
			tour.playing = false;
			seeked = true;
		}
	}
	if (post) app.reading = post;
	if (photo) {
		const group = tour?.photos.includes(photo) ? tour.photos : app.photos.filter((p) => p.day === photo.day);
		app.gallery = { photos: group, index: Math.max(0, group.indexOf(photo)) };
	}
	return seeked;
}

/** The URL for the current moment (or for a specific post / photo). */
export function momentUrl(
	app: App,
	extra: { post?: string; photo?: string; t?: number } = {}
): string {
	const tour = app.tour;
	const url = new URL(tour ? `/day/${tour.data.track.day}` : '/', location.origin);
	const t = extra.t ?? tour?.bike.time;
	if (tour && t != null) url.searchParams.set('t', ukClock(t));
	const post = extra.post ?? app.reading?.slug;
	const photo = extra.photo ?? (app.gallery ? app.gallery.photos[app.gallery.index]?.id : undefined);
	if (post) url.searchParams.set('post', post);
	if (photo) url.searchParams.set('photo', photo);
	return url.toString();
}

/** Copy a link to the clipboard; resolves true on success. */
export async function copyLink(href: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(href);
		return true;
	} catch {
		return false;
	}
}
