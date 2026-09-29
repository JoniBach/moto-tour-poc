// GeoJSON for the 2D map, from the tour's British National Grid data. Everything here is already
// privacy-filtered by the build (routes, photo and post positions); this only reprojects it.
import { fromBng } from '$lib/bng';
import { dayColor } from '$lib/colors';
import type { BlogPost, DaySummary, Parks, Photo, Track } from '$lib/data';

type Pos = [number, number];
const ll = (e: number, n: number): Pos => fromBng(e, n);
const flat = (pts: number[]): Pos[] => {
	const out: Pos[] = [];
	for (let k = 0; k < pts.length; k += 2) out.push(ll(pts[k], pts[k + 1]));
	return out;
};

/** Every day's simplified route, one feature per ride, coloured by day. */
export function routes(days: DaySummary[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
	return {
		type: 'FeatureCollection',
		features: days.flatMap((d) =>
			d.lines.map((line) => ({
				type: 'Feature' as const,
				properties: { day: d.day, index: d.index, color: dayColor(d.index, days.length), title: d.title },
				geometry: { type: 'LineString' as const, coordinates: flat(line) }
			}))
		)
	};
}

/** Where each day starts (the first point of its first ride). */
export const dayStart = (d: DaySummary): Pos | null => (d.lines[0]?.length ? ll(d.lines[0][0], d.lines[0][1]) : null);

export function bounds(ds: DaySummary[]): [Pos, Pos] {
	const minE = Math.min(...ds.map((d) => d.extent.minE));
	const maxE = Math.max(...ds.map((d) => d.extent.maxE));
	const minN = Math.min(...ds.map((d) => d.extent.minN));
	const maxN = Math.max(...ds.map((d) => d.extent.maxN));
	// BNG axes aren't lon/lat axes: take the corners' extremes
	const c = [ll(minE, minN), ll(minE, maxN), ll(maxE, minN), ll(maxE, maxN)];
	return [
		[Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1]))],
		[Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1]))]
	];
}

/**
 * A day's full track as lon/lat, thinned to at most ~4000 points (plenty on screen), with the
 * fix index of each kept point and which ride it belongs to (rides aren't joined across gaps).
 */
export function trackPoints(tr: Track, originE: number, originN: number) {
	const step = Math.max(1, Math.ceil(tr.count / 4000));
	const starts = new Set(tr.breaks);
	const pts: { i: number; ride: number; p: Pos }[] = [];
	let ride = 0;
	for (let i = 0; i < tr.count; i++) {
		if (i > 0 && starts.has(i)) ride++;
		// keep every step-th fix, and always each ride's first and last
		if (i % step === 0 || starts.has(i) || starts.has(i + 1) || i === tr.count - 1) pts.push({ i, ride, p: ll(tr.x[i] + originE, tr.n[i] + originN) });
	}
	return pts;
}

/** The rides as a MultiLineString, up to fix `upTo` (and then to `tip`, the bike between fixes). */
export function ridden(pts: ReturnType<typeof trackPoints>, upTo = Infinity, tip?: Pos): GeoJSON.Feature<GeoJSON.MultiLineString> {
	const lines: Pos[][] = [];
	let ride = -1;
	let last: { ride: number } | null = null;
	for (const pt of pts) {
		if (pt.i > upTo) break;
		if (pt.ride !== ride) {
			lines.push([]);
			ride = pt.ride;
		}
		lines[lines.length - 1].push(pt.p);
		last = pt;
	}
	if (tip && last && lines.length) lines[lines.length - 1].push(tip);
	return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines.filter((l) => l.length > 1) } };
}

export function parks(p: Parks): { shapes: GeoJSON.FeatureCollection; labels: GeoJSON.FeatureCollection } {
	return {
		shapes: {
			type: 'FeatureCollection',
			features: p.parks.map((park) => ({
				type: 'Feature',
				properties: { name: park.name, visited: park.visited },
				geometry: { type: 'MultiPolygon', coordinates: park.rings.map((r) => [flat(r)]) }
			}))
		},
		labels: {
			type: 'FeatureCollection',
			features: p.parks.map((park) => ({
				type: 'Feature',
				properties: { name: park.name, visited: park.visited },
				geometry: { type: 'Point', coordinates: ll(park.label.e, park.label.n) }
			}))
		}
	};
}

export function photos(list: Photo[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
	return {
		type: 'FeatureCollection',
		features: list
			.filter((p) => p.day)
			.map((p) => ({ type: 'Feature', properties: { id: p.id, day: p.day }, geometry: { type: 'Point', coordinates: ll(p.e, p.n) } }))
	};
}

export const postAt = (p: BlogPost): Pos => ll(p.e, p.n);
export const at = ll;
