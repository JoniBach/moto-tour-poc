// A stretch of a day's ride, between two clock times: what the tour shares as a link
// (/day/2026-09-16?t=11:10&to=11:45), named stretches in pins.json ("time" + "end"), and stories'
// map snapshots and links ("map:2026-09-16T11:10-11:45", "tour:2026-09-16T11:10-11:45"). Its facts
// are distance, climb, highest point and roads; no ride time (with the distance it would give the
// speed, and the tour shows no speeds). The GPX has no times either, for the same reason.
import { bisect, roadAtFix, type Osm, type Track } from './data';
import { ukToEpoch } from './moment';
import { fromGrid } from './projection';
import { distance, distUnit } from './units';

export interface Stretch {
	day: string;
	/** the tour's local times, hh:mm */
	from: string;
	to: string;
}

/** fix indices of a stretch on its day's track (from <= to; null if it doesn't fall on the ride) */
export function stretchFixes(tr: Track, s: Stretch): { i: number; j: number } | null {
	const a = ukToEpoch(s.day, s.from) - tr.t0;
	const b = ukToEpoch(s.day, s.to) - tr.t0;
	if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
	const end = tr.t[tr.count - 1];
	if (Math.max(a, b) < 0 || Math.min(a, b) > end) return null;
	const at = (v: number) => (v <= 0 ? 0 : Math.min(bisect(tr.t, v), tr.count - 1));
	const [i, j] = [at(Math.min(a, b)), at(Math.max(a, b))];
	return j > i ? { i, j } : null;
}

export interface StretchFacts {
	/** metres */
	distance: number;
	/** metres climbed (small ups and downs smoothed out) */
	climb: number;
	/** metres above the sea */
	highest: number;
	/** the roads it follows, in order, the longest few */
	roads: string[];
}

export function stretchFacts(tr: Track, osm: Osm | null, i: number, j: number): StretchFacts {
	// climb from the ground under the route (smoother than GPS altitude), with a 3 m deadband
	let climb = 0;
	let base = tr.ground[i];
	let highest = tr.ground[i];
	for (let k = i + 1; k <= j; k++) {
		const h = tr.ground[k];
		if (h > highest) highest = h;
		if (h - base > 3) {
			climb += h - base;
			base = h;
		} else if (base - h > 3) base = h;
	}
	// roads: metres on each (one road by its number, whichever stretches of it are named), kept in the
	// order first met; the ones that carried at least a tenth of it, by their fullest label
	const metres = new Map<string, number>();
	const label = new Map<string, string>();
	for (let k = i + 1; k <= j; k++) {
		const r = roadAtFix(osm, k);
		const key = r?.ref || r?.name;
		if (!r || !key) continue;
		metres.set(key, (metres.get(key) ?? 0) + (tr.dist[k] - tr.dist[k - 1]));
		const full = [r.ref, r.name].filter(Boolean).join(' ');
		if (full.length > (label.get(key)?.length ?? 0)) label.set(key, full);
	}
	const total = tr.dist[j] - tr.dist[i];
	const roads = [...metres].filter(([, m]) => m >= total / 10).slice(0, 4).map(([k]) => label.get(k)!);
	return { distance: total, climb: Math.round(climb), highest: Math.round(highest), roads };
}

/** "12.4 mi · 410 m climb · highest 356 m" */
export function factsLine(f: StretchFacts): string {
	const d = distance(f.distance / 1000);
	return `${d < 10 ? d.toFixed(1) : Math.round(d)} ${distUnit} · ${f.climb} m climb · highest ${f.highest} m`;
}

/** The stretch as a GPX track to ride: positions and heights, no times. */
export function stretchGpx(tr: Track, originE: number, originN: number, i: number, j: number, name: string): string {
	const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
	const pts: string[] = [];
	let last = -Infinity;
	for (let k = i; k <= j; k++) {
		// a point every 10 m or so is plenty for a satnav, and keeps the file small
		if (k !== j && tr.dist[k] - last < 10) continue;
		last = tr.dist[k];
		const [lon, lat] = fromGrid(tr.x[k] + originE, tr.n[k] + originN);
		pts.push(`<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${tr.ground[k].toFixed(1)}</ele></trkpt>`);
	}
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<gpx version="1.1" creator="GT Retrospective" xmlns="http://www.topografix.com/GPX/1/1">',
		`<metadata><name>${esc(name)}</name></metadata>`,
		`<trk><name>${esc(name)}</name><trkseg>`,
		...pts,
		'</trkseg></trk>',
		'</gpx>'
	].join('\n');
}

/** "the-honister-pass-experience.gpx" */
export const gpxName = (title: string) =>
	`${title
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'stretch'}.gpx`;

/** Hand the visitor a file to save. */
export function download(name: string, text: string, type = 'application/gpx+xml') {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const a = Object.assign(document.createElement('a'), { href: url, download: name });
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
