// Helpers for the plain blog (routes under /blog): links into the 3D experience at an exact
// moment, tour-time formatting, and readable sentences for each event.
import { PIN_META, type FeedEvent } from './data';
import { base } from '$app/paths';
import { tourClock } from './time';
import { TOUR } from '$lib/tourConfig';
import { A } from './activity';

/** The 3D view at this moment (and with this post / photo open). */
export function mapLink(day: string, t: number, open: { post?: string; photo?: string; stretch?: { from: string; to: string; name?: string } } = {}): string {
	const q = new URLSearchParams({ t: open.stretch?.from ?? tourClock(t) });
	if (open.stretch) {
		q.set('to', open.stretch.to);
		if (open.stretch.name) q.set('name', open.stretch.name);
	}
	if (open.post) q.set('post', open.post);
	if (open.photo) q.set('photo', open.photo);
	return `${base}/day/${day}?${q}`;
}

const tz = { timeZone: TOUR.timeZone } as const;
export const longDate = (s: number) =>
	new Date(s * 1000).toLocaleDateString(TOUR.locale, { ...tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const shortDate = (s: number) =>
	new Date(s * 1000).toLocaleDateString(TOUR.locale, { ...tz, weekday: 'short', day: 'numeric', month: 'short' });
export const time = (s: number) => new Date(s * 1000).toLocaleTimeString(TOUR.locale, { ...tz, hour: '2-digit', minute: '2-digit' });
/** machine-readable timestamp for <time datetime> */
export const iso = (s: number) => new Date(s * 1000).toISOString();

// written out in full: easier to read than "1 h 5 min" (and no abbreviations to explain)
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const duration = (m: number) =>
	m >= 60 ? [plural(Math.floor(m / 60), 'hour'), m % 60 ? plural(m % 60, 'minute') : ''].filter(Boolean).join(' ') : plural(m, 'minute');
export const near = (place: string | null, prep = 'near') => (place ? ` ${prep} ${place}` : '');

/** A short plain-language line for an event (posts and photos get richer rendering). */
export function eventSentence(e: FeedEvent): { icon: string; label: string; text: string } {
	switch (e.kind) {
		case 'start':
			return {
				icon: '▶',
				label: 'Set off',
				text: e.rides > 1 ? `Set off on ${A.leg} ${e.ride} of ${e.rides}${near(e.place, 'from')}` : `Set off${near(e.place, 'from')}`
			};
		case 'finish':
			return {
				icon: '■',
				label: 'Arrived',
				text: e.rides > 1 && e.ride < e.rides ? `Finished ${A.leg} ${e.ride}${near(e.place, 'at')}` : `Arrived${near(e.place, 'at')}`
			};
		case 'break':
			return { icon: '⏸', label: 'Break', text: `Stopped for ${duration(e.minutes)}${near(e.place)}` };
		case 'photos':
			return { icon: '📷', label: 'Photos', text: `${e.photos.length === 1 ? 'A photo' : `${e.photos.length} photos`}${near(e.place)}` };
		case 'pin': {
			const m = PIN_META[e.pin.type];
			return { icon: m.icon, label: m.label, text: e.pin.title };
		}
		case 'post':
			return { icon: '✎', label: 'Story', text: '' };
	}
}
