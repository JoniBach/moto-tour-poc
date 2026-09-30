// The map's lines for the globe (roads, rivers, national park edges), in one shape both the
// landscape (GlobeLines) and the surroundings beyond the rim (GlobeHalo) can draw: day-local x/n
// pairs plus how each should look. Colours are sRGB 0..1 (the globe's shaders write them as-is).
import { PIN_META, type BlogPost, type Osm, type Parks, type Photo, type Pin } from '$lib/data';

export interface GlobeLine {
	/** day-local metres: x, n, x, n, … */
	xy: Float32Array;
	/** half-width on the land, as a share of the globe's radius */
	half: number;
	color: [number, number, number];
	alpha: number;
	/** how it shows beyond the rim */
	haloColor: [number, number, number];
	haloAlpha: number;
	dash: boolean;
}

// roads by tier: 0 major … 4 track
const ROAD_HALF = [0.0034, 0.0028, 0.0022, 0.0016, 0.0011];
const ROAD_ALPHA = [0.95, 0.9, 0.8, 0.6, 0.4];
const ROAD_HALO = [0.6, 0.5, 0.38, 0.25, 0.14];

/** x,n,h triples (the pipeline's draped lines) → x,n pairs */
const pairs = (pts: number[]) => {
	const out = new Float32Array((pts.length / 3) * 2);
	for (let k = 0, j = 0; k < pts.length; k += 3, j += 2) {
		out[j] = pts[k];
		out[j + 1] = pts[k + 1];
	}
	return out;
};

export function globeLines(
	osm: Osm | null,
	parks: Parks | null,
	originE: number,
	originN: number,
	show: { roads: boolean; rivers: boolean; parks: boolean }
): GlobeLine[] {
	const lines: GlobeLine[] = [];
	if (show.parks && parks)
		for (const park of parks.parks)
			for (const ring of park.rings) {
				const xy = new Float32Array(ring.length);
				for (let k = 0; k < ring.length; k += 2) {
					xy[k] = ring[k] - originE;
					xy[k + 1] = ring[k + 1] - originN;
				}
				lines.push({ xy, half: 0.0013, color: [0.17, 0.55, 0.27], alpha: 0.75, haloColor: [0.17, 0.55, 0.27], haloAlpha: 0.35, dash: true });
			}
	if (show.rivers && osm)
		for (const r of osm.rivers)
			lines.push({ xy: pairs(r.pts), half: 0.0017, color: [0.42, 0.66, 0.86], alpha: 0.9, haloColor: [0.42, 0.62, 0.8], haloAlpha: 0.35, dash: false });
	if (show.roads && osm)
		for (const road of osm.roads) {
			if (road.render === false) continue;
			const t = Math.min(4, Math.max(0, road.tier));
			lines.push({
				xy: pairs(road.pts),
				half: ROAD_HALF[t],
				color: [1, 0.99, 0.96],
				alpha: ROAD_ALPHA[t],
				haloColor: [0.47, 0.49, 0.52],
				haloAlpha: ROAD_HALO[t],
				dash: false
			});
		}
	return lines;
}

/** Which national park (if any) an absolute BNG point is in: even-odd test over the outlines. */
export function parkAt(parks: Parks | null, e: number, n: number): string | null {
	for (const park of parks?.parks ?? []) {
		let inside = false;
		for (const ring of park.rings)
			for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
				const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
				if (yi > n !== yj > n && e < ((xj - xi) * (n - yi)) / (yj - yi) + xi) inside = !inside;
			}
		if (inside) return park.name;
	}
	return null;
}

/** A pin beyond the rim: just where it is (day-local metres) and its colour (sRGB 0..1). */
export interface HaloMark {
	x: number;
	n: number;
	color: [number, number, number];
}

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];

/** The day's places, photos and stories as marks for the surroundings (each follows its switch). */
export function haloMarks(
	pins: Pin[],
	photos: Photo[],
	posts: BlogPost[],
	originE: number,
	originN: number,
	show: { pins: boolean; photos: boolean; stories: boolean }
): HaloMark[] {
	const out: HaloMark[] = [];
	if (show.pins) for (const p of pins) out.push({ x: p.x, n: p.n, color: hex(PIN_META[p.type].color) });
	if (show.photos) for (const p of photos) out.push({ x: p.e - originE, n: p.n - originN, color: [0.9, 0.47, 0.0] });
	if (show.stories) for (const p of posts) out.push({ x: p.e - originE, n: p.n - originN, color: [0.95, 0.72, 0.2] });
	return out;
}
