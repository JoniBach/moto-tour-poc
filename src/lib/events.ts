// The day's chronology for the events drawer: rides starting and finishing, long breaks,
// photo moments and authored pins (notes, POIs, fuel, food…), each on the riding-time axis so
// the drawer can jump the tour to it.
import { PIN_META, type BlogPost, type Photo, type Pin, type Track } from './data';
import { dayEventsCore } from './events-core.js';
import { A } from './activity';

export { BREAK_MIN } from './events-core.js';

export type TourEvent =
	| { kind: 'start' | 'finish'; rt: number; t: number; ride: number; rides: number }
	| { kind: 'break'; rt: number; t: number; minutes: number }
	| { kind: 'photos'; rt: number; t: number; photos: Photo[] }
	| { kind: 'pin'; rt: number; t: number; pin: Pin }
	| { kind: 'post'; rt: number; t: number; post: BlogPost };

/** The day's events (shared logic in events-core.js, also used to build the blog feed). */
export function dayEvents(tr: Track, pins: Pin[], photos: Photo[], posts: BlogPost[] = []): TourEvent[] {
	return dayEventsCore(tr, pins, photos, posts);
}

export function eventLabel(e: TourEvent): { icon: string; title: string; color: string } {
	switch (e.kind) {
		case 'start':
			return { icon: '▶', title: e.rides > 1 ? `Set off · ${A.leg} ${e.ride} of ${e.rides}` : 'Set off', color: '#7cf7ff' };
		case 'finish':
			return { icon: '■', title: e.rides > 1 ? `Finished ${A.leg} ${e.ride}` : 'Arrived', color: '#7cf7ff' };
		case 'break':
			return { icon: '⏸', title: `Break · ${e.minutes >= 60 ? `${Math.floor(e.minutes / 60)} h ${e.minutes % 60} min` : `${e.minutes} min`}`, color: '#b8c7d0' };
		case 'photos':
			return { icon: '📷', title: e.photos.length > 1 ? `${e.photos.length} photos` : 'Photo', color: '#ffd166' };
		case 'post':
			return { icon: '✎', title: e.post.title, color: '#ffd166' };
		case 'pin': {
			const m = PIN_META[e.pin.type];
			return { icon: m.icon, title: e.pin.title, color: m.color };
		}
	}
}
