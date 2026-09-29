// The day's chronology for the events drawer: rides starting and finishing, long breaks,
// photo moments and authored pins (notes, POIs, fuel, food…), each on the riding-time axis so
// the drawer can jump the tour to it.
import { PIN_META, type Photo, type Pin, type Track } from './data';

export type TourEvent =
	| { kind: 'start' | 'finish'; rt: number; t: number; ride: number; rides: number }
	| { kind: 'break'; rt: number; t: number; minutes: number }
	| { kind: 'photos'; rt: number; t: number; photos: Photo[] }
	| { kind: 'pin'; rt: number; t: number; pin: Pin };

export const BREAK_MIN = 30; // minutes: shorter stops aren't worth an entry
const MOMENT = 5 * 60; // seconds: photos this close together are one moment

export function dayEvents(tr: Track, pins: Pin[], photos: Photo[]): TourEvent[] {
	const ev: TourEvent[] = [];
	const at = (i: number) => ({ rt: tr.rt[i], t: tr.t0 + tr.t[i] });

	// each ride's start and finish (a day can hold several rides)
	const starts = [0, ...(tr.breaks ?? [])];
	starts.forEach((s, k) => {
		const end = (starts[k + 1] ?? tr.count) - 1;
		ev.push({ kind: 'start', ...at(s), ride: k + 1, rides: starts.length });
		ev.push({ kind: 'finish', ...at(end), ride: k + 1, rides: starts.length });
	});

	for (const s of tr.stops)
		if (s.duration >= BREAK_MIN * 60) ev.push({ kind: 'break', ...at(s.start), minutes: Math.round(s.duration / 60) });

	// photo moments
	let moment: Photo[] = [];
	const flush = () => {
		if (moment.length) ev.push({ kind: 'photos', rt: moment[0].rt ?? 0, t: moment[0].t, photos: moment });
		moment = [];
	};
	for (const p of [...photos].sort((a, b) => a.t - b.t)) {
		if (moment.length && p.t - moment.at(-1)!.t > MOMENT) flush();
		moment.push(p);
	}
	flush();

	for (const pin of pins) ev.push({ kind: 'pin', rt: pin.rt, t: tr.t0 + tr.t[pin.i], pin });

	// chronological; at equal times keep a sensible order (start before anything, finish after)
	const rank = { start: 0, pin: 1, break: 2, photos: 3, finish: 4 };
	return ev.sort((a, b) => a.t - b.t || rank[a.kind] - rank[b.kind]);
}

export function eventLabel(e: TourEvent): { icon: string; title: string; color: string } {
	switch (e.kind) {
		case 'start':
			return { icon: '▶', title: e.rides > 1 ? `Set off · ride ${e.ride} of ${e.rides}` : 'Set off', color: '#7cf7ff' };
		case 'finish':
			return { icon: '■', title: e.rides > 1 ? `Finished ride ${e.ride}` : 'Arrived', color: '#7cf7ff' };
		case 'break':
			return { icon: '⏸', title: `Break · ${e.minutes >= 60 ? `${Math.floor(e.minutes / 60)} h ${e.minutes % 60} min` : `${e.minutes} min`}`, color: '#b8c7d0' };
		case 'photos':
			return { icon: '📷', title: e.photos.length > 1 ? `${e.photos.length} photos` : 'Photo', color: '#ffd166' };
		case 'pin': {
			const m = PIN_META[e.pin.type];
			return { icon: m.icon, title: e.pin.title, color: m.color };
		}
	}
}
