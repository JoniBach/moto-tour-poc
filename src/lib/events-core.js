// The day's chronology, shared by the app (events drawer, src/lib/events.ts) and the pipeline
// (scripts/build-feed.mjs → the blog), so both always list exactly the same events.
// Plain JS (JSDoc-typed) so Node can import it without a TypeScript step.

export const BREAK_MIN = 30; // minutes: shorter stops aren't worth an entry
export const MOMENT = 5 * 60; // seconds: photos this close together are one moment

/**
 * @template {{ t: number, rt?: number }} P photo
 * @template {{ rt: number, i: number }} N pin
 * @template {{ rt: number, t: number }} B blog post
 * @param {{ t0: number, t: number[], rt: number[], count: number, breaks?: number[], stops: { start: number, duration: number }[] }} tr
 * @param {N[]} pins
 * @param {P[]} photos
 * @param {B[]} [posts]
 */
export function dayEventsCore(tr, pins, photos, posts = []) {
	/** @type {Array<
	 *   | { kind: 'start' | 'finish', rt: number, t: number, i: number, ride: number, rides: number }
	 *   | { kind: 'break', rt: number, t: number, i: number, minutes: number }
	 *   | { kind: 'photos', rt: number, t: number, photos: P[] }
	 *   | { kind: 'pin', rt: number, t: number, pin: N }
	 *   | { kind: 'post', rt: number, t: number, post: B }
	 * >} */
	const ev = [];
	const at = (/** @type {number} */ i) => ({ rt: tr.rt[i], t: tr.t0 + tr.t[i], i });

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
	/** @type {P[]} */
	let moment = [];
	const flush = () => {
		if (moment.length) ev.push({ kind: 'photos', rt: moment[0].rt ?? 0, t: moment[0].t, photos: moment });
		moment = [];
	};
	for (const p of [...photos].sort((a, b) => a.t - b.t)) {
		if (moment.length && p.t - moment[moment.length - 1].t > MOMENT) flush();
		moment.push(p);
	}
	flush();

	for (const pin of pins) ev.push({ kind: 'pin', rt: pin.rt, t: tr.t0 + tr.t[pin.i], pin });
	for (const post of posts) ev.push({ kind: 'post', rt: post.rt, t: post.t, post });

	// chronological; at equal times keep a sensible order (start before anything, finish after)
	const rank = { start: 0, post: 1, pin: 2, break: 3, photos: 4, finish: 5 };
	return ev.sort((a, b) => a.t - b.t || rank[a.kind] - rank[b.kind]);
}
