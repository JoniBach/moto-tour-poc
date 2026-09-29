// Where everything sits on the globe's base, shared by the plinth (which engraves the labels)
// and the switches. All in scene units for a globe of on-screen radius V; y = 0 is the
// landscape's floor (the plinth's top). Angles are from the front (+z, where the globe first
// faces you) towards +x (the viewer's right), in degrees.
import type { MapStyle } from '$lib/imagery';
import type { Tour } from '$lib/tour.svelte';

export function plinthLayout(V: number) {
	const OUT = V * 1.13;
	return {
		OUT,
		/** the top block: compass ring on top, the day's name around its side */
		band: { top: 0, bottom: -0.08 * V },
		/** the ledge around the base: controls on its top */
		ledge: { top: -0.08 * V, bottom: -0.112 * V, outer: OUT * 1.3 },
		/** controls stand on this circle; labels are engraved further out */
		switchR: OUT * 1.1,
		labelR: OUT * 1.205,
		groupR: OUT * 1.265
	};
}

export type Layout = ReturnType<typeof plinthLayout>;

/** the four surface keys (one of them pressed) */
export const SURFACE_KEYS: { id: MapStyle; label: string; name: string; at: number }[] = [
	{ id: 'hologram', label: 'PLAIN', name: 'Plain', at: -88 },
	{ id: 'satellite', label: 'SAT', name: 'Satellite', at: -77 },
	{ id: 'sentinel', label: 'S-2', name: 'Sentinel-2', at: -66 },
	{ id: 'topo', label: 'TOPO', name: 'Topo', at: -55 }
];

/** the lever switches */
export const SWITCHES: { key: keyof Tour['layers']; label: string; name: string; at: number }[] = [
	{ key: 'contours', label: 'LINES', name: 'Elevation lines', at: -36 },
	{ key: 'route', label: 'ROUTE', name: 'Route', at: -24 },
	{ key: 'weather', label: 'WEATHER', name: 'Weather', at: -12 },
	{ key: 'labels', label: 'NAMES', name: 'Place names', at: 0 },
	{ key: 'pins', label: 'PLACES', name: 'Places', at: 12 },
	{ key: 'photos', label: 'PHOTOS', name: 'Photos', at: 24 },
	{ key: 'blog', label: 'STORIES', name: 'Stories', at: 36 }
];

/** group titles engraved along the ledge's outer edge (size and relief carry their values;
 * the switches' own labels say enough) */
export const GROUPS = [{ label: 'SURFACE', at: -71.5 }];

/** − / + buttons for the two stepped settings */
export const STEPPERS: { key: 'size' | 'relief'; name: string; minus: number; plus: number; at: number }[] = [
	{ key: 'size', name: 'Size', minus: 53, plus: 63, at: 58 },
	{ key: 'relief', name: 'Relief', minus: 76, plus: 86, at: 81 }
];

/** metres from the bike to the rim */
export const SIZES = [800, 1000, 1400, 1800, 2400, 3200, 4400, 6000];
/** vertical exaggeration */
export const RELIEFS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];

/** The next value along a list of steps (dir -1 / +1), from wherever `v` is now. */
export function step(list: number[], v: number, dir: number): number {
	if (dir > 0) return list.find((x) => x > v + 1e-6) ?? list[list.length - 1];
	return [...list].reverse().find((x) => x < v - 1e-6) ?? list[0];
}

export const km = (m: number) => `${(m / 1000).toFixed(1)} km`;

/** A position on a circle of radius r at `deg` from the front, at height y. */
export function around(r: number, deg: number, y: number): [number, number, number] {
	const a = (deg * Math.PI) / 180;
	return [Math.sin(a) * r, y, Math.cos(a) * r];
}
