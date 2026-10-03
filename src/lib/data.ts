import { DATA, photoSrc, TOUR } from './tourConfig';
// Client-side data model: loads the pre-built artefacts from static/data and answers
// "where is the bike at riding-time rt?" and "how high is the ground at (x, n)?".

export interface TerrainMeta {
	originE: number; // British National Grid origin of this grid's local metres
	originN: number;
	x0: number; // west edge, local metres
	n1: number; // north edge, local metres
	cols: number;
	rows: number;
	spacing: number;
	scale: number;
	minH: number;
	maxH: number;
}

export interface Track {
	day: string;
	title: string;
	breaks: number[]; // fix indices where a new ride starts (not joined to the previous fix)
	count: number;
	t0: number; // epoch seconds of first fix
	t: number[]; // seconds since t0 (wall clock)
	rt: number[]; // riding time (stops collapsed) — the scrubber axis
	x: number[];
	n: number[];
	ele: number[]; // GPS altitude as recorded
	ground: number[]; // DEM height under the fix
	dist: number[];
	speed: number[]; // m/s
	heading: number[]; // rad, 0 = north, clockwise
	lean: number[]; // rad, + = right
	stops: { start: number; end: number; duration: number }[];
}

export type PinType = 'photo' | 'blog' | 'poi' | 'fuel' | 'food' | 'pub' | 'route';

export interface Pin {
	id: number;
	type: PinType;
	title: string;
	body: string;
	i: number;
	rt: number;
	x: number;
	n: number;
	h: number;
	placedBy: 'gps' | 'time';
	/** a named stretch (pins.json "end"): to fix j, at riding time rtEnd */
	j?: number;
	rtEnd?: number;
}

export class Terrain {
	meta: TerrainMeta;
	heights: Float32Array; // metres, row 0 = north
	corridor: Uint8Array; // distance to route in cells, capped 255
	water: Uint8Array | null; // 0..255 = fraction of the cell that is inland water (OSM lakes); null if not built

	constructor(meta: TerrainMeta, heights: Float32Array, corridor: Uint8Array, water: Uint8Array | null) {
		this.meta = meta;
		this.heights = heights;
		this.corridor = corridor;
		this.water = water;
	}

	/** 0..1 water coverage at local metres, bilinear: smooth shorelines even on coarse day grids. */
	waterAtXY(x: number, n: number): number {
		const { x0, n1, spacing, cols, rows } = this.meta;
		const fc = Math.max(0, Math.min(cols - 1.001, (x - x0) / spacing));
		const fr = Math.max(0, Math.min(rows - 1.001, (n1 - n) / spacing));
		const c = Math.floor(fc);
		const r = Math.floor(fr);
		const a = fc - c;
		const b = fr - r;
		return (
			(this.waterAt(c, r) * (1 - a) + this.waterAt(c + 1, r) * a) * (1 - b) +
			(this.waterAt(c, r + 1) * (1 - a) + this.waterAt(c + 1, r + 1) * a) * b
		);
	}

	/** 0..1 water coverage at grid cell (c, r): OSM lake coverage, or 1 for sea (height at/below 0). */
	waterAt(c: number, r: number): number {
		const { cols, rows } = this.meta;
		if (c < 0 || r < 0 || c >= cols || r >= rows) return 0;
		const i = r * cols + c;
		return this.heights[i] <= 0.5 ? 1 : (this.water?.[i] ?? 0) / 255;
	}

	/** Bilinear ground height at local metres (x east, n north). */
	heightAt(x: number, n: number): number {
		if (!this.heights.length) return 0; // a light day (2D map): no terrain loaded
		const { x0, n1, spacing, cols, rows } = this.meta;
		const fc = Math.max(0, Math.min(cols - 1.001, (x - x0) / spacing));
		const fr = Math.max(0, Math.min(rows - 1.001, (n1 - n) / spacing));
		const c = Math.floor(fc);
		const r = Math.floor(fr);
		const ac = fc - c;
		const ar = fr - r;
		const h = this.heights;
		const i = r * cols + c;
		return (h[i] * (1 - ac) + h[i + 1] * ac) * (1 - ar) + (h[i + cols] * (1 - ac) + h[i + cols + 1] * ac) * ar;
	}
}

export interface Road {
	tier: number; // 0 major … 4 track (see scripts/build-osm.mjs)
	highway: string;
	name: string | null;
	ref: string | null;
	/** speed limit / single track: only in the old Overpass data, absent from vector tiles */
	maxspeed?: string | null;
	singleTrack?: boolean;
	/** false = a name-only line kept for road matching; not drawn */
	render?: boolean;
	pts: number[]; // flat [x, n, h, …] draped on the DEM
}

export interface Place {
	kind: 'town' | 'village' | 'hamlet' | 'locality' | 'peak' | 'water';
	name: string;
	ele: number | null;
	x: number;
	n: number;
	h: number;
}

export interface Osm {
	attribution: string;
	roads: Road[];
	rivers: { name: string | null; pts: number[] }[];
	places: Place[];
	roadRuns: [fromFix: number, road: number][]; // which road the ride is on, run-length encoded
}

export interface WeatherSample {
	rt: number;
	t: number;
	temp: number | null; // °C, corrected to the ground height
	feels: number | null;
	precip: number | null; // mm in that hour
	cloud: number; // %
	wind: number | null; // mph
	gust: number | null;
	windDir: number; // degrees the wind blows FROM
	code: number; // WMO weather code
	isDay: number;
}

export interface Weather {
	attribution: string;
	source: string;
	sunrise: number | null;
	sunset: number | null;
	summary: { minTemp: number; maxTemp: number; wettestHourMm: number; maxGust: number };
	samples: WeatherSample[];
}

export interface TourData {
	terrain: Terrain;
	track: Track;
	pins: Pin[];
	osm: Osm | null;
	weather: Weather | null;
	/** loaded for the 2D map only: no terrain heights, rasters or OSM */
	light?: boolean;
}

// ---------- tour index + region backdrop ----------

export interface DaySummary {
	index: number;
	day: string; // "2026-09-16"
	title: string;
	originE: number;
	originN: number;
	extent: { minE: number; maxE: number; minN: number; maxN: number }; // absolute projected metres
	km: number;
	rides: number;
	start: number;
	end: number;
	weather: Weather['summary'] | null;
	lines: number[][]; // simplified route, [E, N, E, N, …] per ride, absolute projected metres
}

export interface TourIndex {
	days: DaySummary[];
}

/** A failed request as a sentence people can read (not a JSON parse error). */
const unavailable = (what: string) => new Error(`Couldn't load ${what}. Check the connection and try again.`);

/**
 * Remove single-cell spikes and pits from a height grid, in place: a cell more than `limit`
 * metres above (or below) all 8 of its neighbours becomes their median. Elevation sources have
 * the odd bad sample (hundreds of metres out on one cell), which the 3D views draw as sudden
 * cones; real summits and valleys have neighbours that follow them, so they're left alone.
 */
export function despike(h: Float32Array, cols: number, rows: number, limit: number) {
	const src = h.slice();
	const n = new Float32Array(8);
	let fixed = 0;
	for (let r = 1; r < rows - 1; r++)
		for (let c = 1; c < cols - 1; c++) {
			const i = r * cols + c;
			let k = 0;
			for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) n[k++] = src[i + dr * cols + dc];
			let hi = -Infinity;
			let lo = Infinity;
			for (const v of n) {
				if (v > hi) hi = v;
				if (v < lo) lo = v;
			}
			const v = src[i];
			if (v - hi > limit || lo - v > limit) {
				n.sort();
				h[i] = (n[3] + n[4]) / 2;
				fixed++;
			}
		}
	return fixed;
}

export async function loadTourIndex(): Promise<TourIndex> {
	const r = await fetch(`${DATA}/tour.json`).catch(() => null);
	if (!r?.ok) throw unavailable('the tour');
	return r.json();
}

/** L0: the region around the whole tour (build-region). Same shape as a day grid, with origin at 0,0. */
export async function loadRegion(): Promise<Terrain> {
	// packed like the day files (scripts/pack.mjs): the .bin isn't compressed by the host
	const [meta, buf] = await Promise.all([packedJson<TerrainMeta>(`${DATA}/region/terrain.json`), fetchPacked(`${DATA}/region/terrain.bin`)]);
	if (!meta || !buf) throw unavailable('the map of the region');
	return new Terrain(meta, heightsFrom(buf, meta.cols, meta.scale), new Uint8Array(0), null);
}

// ---------- national parks ----------

export interface Park {
	name: string; // display name, e.g. "Lake District"
	days: string[]; // tour days whose route passes through it
	visited: boolean;
	label: { e: number; n: number }; // absolute projected
	areaKm2: number;
	rings: number[][]; // outlines, [E, N, E, N, …] absolute projected, closed
}

export interface Parks {
	parks: Park[];
	/** 1 km mask aligned with the region backdrop grid: park index + 1, 0 outside */
	mask: Uint8Array;
}

export async function loadParks(): Promise<Parks | null> {
	try {
		const [json, buf] = await Promise.all([packedJson<{ parks: Park[] }>(`${DATA}/parks.json`), fetchPacked(`${DATA}/parks.bin`)]);
		if (!json || !buf) return null;
		return { parks: json.parks, mask: new Uint8Array(buf) };
	} catch {
		return null; // optional layer: the tour works without build-parks
	}
}

// ---------- photos ----------

export interface Photo {
	id: string; // file stem; images at /photos/{thumb,large}/<id>.webp
	t: number; // epoch seconds taken
	w: number; // gallery image size
	h: number;
	day: string | null;
	e: number; // absolute projected where it was taken (or placed)
	n: number;
	i?: number; // track fix it was placed at (time placement)
	rt?: number; // riding time of that fix
	placedBy: 'gps' | 'time' | 'time-offride';
}

export const photoUrl = (p: Photo, size: 'thumb' | 'large') => photoSrc(size, p.id);

export async function loadPhotos(): Promise<Photo[]> {
	try {
		const r = await fetch(`${DATA}/photos.json`);
		return r.ok ? ((await r.json()).photos as Photo[]) : [];
	} catch {
		return []; // optional: the tour works without build-photos
	}
}

// ---------- places (scripts/build-places.mjs): the story editor's gazetteer ----------

export async function loadPlaces(): Promise<import('./editor/places').Place[]> {
	try {
		return (await packedJson<{ places: import('./editor/places').Place[] }>(`${DATA}/places.json`))?.places ?? [];
	} catch {
		return []; // optional: the editor just doesn't suggest places
	}
}

// ---------- music (scripts/build-music.mjs) ----------

export interface Song {
	name: string;
	artist: string;
	id?: string; // Spotify track ID, when it was found there
	art?: string; // small album cover (Spotify's image CDN)
}

export interface Music {
	tracks: Song[];
	/** [start, end, track index], epoch seconds, in time order */
	plays: [number, number, number][];
}

export async function loadMusic(): Promise<Music | null> {
	try {
		return await packedJson<Music>(`${DATA}/music.json`);
	} catch {
		return null; // optional: the tour works without build-music
	}
}

/** The track playing at clock time t (epoch seconds); a short gap between tracks keeps the last one up. */
export function playingAt(music: Music, t: number, gap = 60): { song: Song; start: number } | null {
	const { plays } = music;
	let lo = 0;
	let hi = plays.length - 1;
	if (hi < 0 || plays[0][0] > t) return null;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (plays[mid][0] <= t) lo = mid;
		else hi = mid - 1;
	}
	const [start, end, k] = plays[lo];
	return t <= end + gap ? { song: music.tracks[k], start } : null;
}

// ---------- blog posts ----------

export interface BlogPost {
	slug: string;
	title: string;
	t: number; // epoch seconds of the moment it's about
	day: string;
	i: number; // track fix at that moment
	rt: number;
	e: number; // absolute projected where the bike was
	n: number;
	cover: string | null; // photo id
	excerpt: string;
	minutes: number; // reading time
	html: string; // rendered at build time from the author's own Markdown
	/** before / after the trip (pinned to its first day's start / last day's end) */
	when?: 'before' | 'after';
	/** a before / after story's own date (epoch seconds), if it has one */
	date?: number;
}

export async function loadBlog(): Promise<BlogPost[]> {
	try {
		const r = await fetch(`${DATA}/blog.json`);
		return r.ok ? ((await r.json()).posts as BlogPost[]) : [];
	} catch {
		return []; // optional: the tour works without build-blog
	}
}

// ---------- blog feed (scripts/build-feed.mjs) ----------

export type FeedEvent = { t: number; place: string | null } & (
	| { kind: 'start' | 'finish'; ride: number; rides: number }
	| { kind: 'break'; minutes: number }
	| { kind: 'photos'; photos: string[] }
	| { kind: 'pin'; pin: { type: PinType; title: string; body: string; from?: string; to?: string } }
	| { kind: 'post'; post: string }
);

export interface FeedDay {
	day: string;
	index: number;
	title: string;
	start: number;
	end: number;
	km: number;
	rides: number;
	weather: Weather['summary'] | null;
	parks: string[];
	photos: number;
	events: FeedEvent[];
}

export interface Feed {
	days: FeedDay[];
}

export async function loadFeed(): Promise<Feed> {
	const r = await fetch(`${DATA}/feed.json`);
	if (!r.ok) throw new Error('Blog feed missing: run npm run data:feed');
	return r.json();
}

/** L1: one day's bundle. */
export const loadDay = (day: string, light = false) => loadTour(`${DATA}/days/${day}`, light);

/**
 * Fetch a day file, preferring the gzipped copy made for deployment (<name>.gz, see
 * scripts/pack.mjs): static hosts don't compress .bin files, and packing shrinks a day several
 * times over. Falls back to the plain file (local dev). Resolves null if neither exists.
 */
async function fetchPacked(url: string): Promise<ArrayBuffer | null> {
	const gz = await fetch(`${url}.gz`).catch(() => null);
	if (gz?.ok) {
		const buf = await gz.arrayBuffer();
		const bytes = new Uint8Array(buf, 0, 2);
		// gzip magic: decompress here; otherwise the host already decoded it (Content-Encoding)
		if (bytes[0] === 0x1f && bytes[1] === 0x8b)
			return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
		return buf;
	}
	const plain = await fetch(url).catch(() => null);
	return plain?.ok ? plain.arrayBuffer() : null;
}
/**
 * A height grid's samples, in its own units, from either form: plain Int16, or packed by
 * scripts/pack.mjs ('MTDELTA1', a step, a count, then the change from the cell to the left as
 * low and high byte planes).
 */
export function heightsFrom(buf: ArrayBuffer, cols: number, scale: number): Float32Array {
	const b = new Uint8Array(buf);
	const MAGIC = 'MTDELTA1';
	let packed = b.length > 13;
	for (let k = 0; packed && k < MAGIC.length; k++) packed = b[k] === MAGIC.charCodeAt(k);
	if (!packed) return Float32Array.from(new Int16Array(buf), (v) => v * scale);
	const step = b[8];
	const n = new DataView(buf).getUint32(9, true);
	const lo = 13;
	const hi = 13 + n;
	const out = new Float32Array(n);
	const k = step * scale;
	let v = 0;
	for (let i = 0; i < n; i++) {
		let d = b[lo + i] | (b[hi + i] << 8);
		if (d & 0x8000) d -= 0x10000;
		v = i % cols ? v + d : d;
		out[i] = v * k;
	}
	return out;
}

const packedJson = async <T>(url: string): Promise<T | null> => {
	const buf = await fetchPacked(url);
	return buf ? (JSON.parse(new TextDecoder().decode(buf)) as T) : null;
};

/**
 * One day's data. `light` (the 2D map) skips what only the 3D views draw: the terrain, water and
 * corridor rasters, most of a day's download; the terrain then has its metadata but no heights.
 */
export async function loadTour(base: string, light = false): Promise<TourData> {
	const none = Promise.resolve(null);
	const [meta, heightsBuf, corridorBuf, track, pins, osm, waterBuf, weather] = await Promise.all([
		packedJson<TerrainMeta>(`${base}/terrain.json`),
		light ? none : fetchPacked(`${base}/terrain.bin`),
		light ? none : fetchPacked(`${base}/corridor.bin`),
		packedJson<Track>(`${base}/track.json`),
		packedJson<Pin[]>(`${base}/pins.json`),
		// roads, water and weather are optional: the tour works without them
		packedJson<Osm>(`${base}/osm.json`), // small packed; the scrubber names the road from it
		light ? none : fetchPacked(`${base}/water.bin`),
		packedJson<Weather>(`${base}/weather.json`)
	]);
	if (!meta || !track) throw new Error(`Couldn't load this day. Check the connection and try again.`);
	if (light) return { terrain: new Terrain(meta, new Float32Array(0), new Uint8Array(0), null), track, pins: pins ?? [], osm, weather, light: true };
	if (!heightsBuf || !corridorBuf) throw new Error(`Couldn't load this day's landscape. Check the connection and try again.`);
	const heights = heightsFrom(heightsBuf, meta.cols, meta.scale);
	// bad single samples: a threshold that grows with the cell size, so steep real ground stays
	despike(heights, meta.cols, meta.rows, 50 + meta.spacing * 0.3);
	const water = waterBuf && waterBuf.byteLength === heights.length ? new Uint8Array(waterBuf) : null;
	return { terrain: new Terrain(meta, heights, new Uint8Array(corridorBuf), water), track, pins: pins ?? [], osm, weather };
}

export interface BikeState {
	i: number; // index of fix at/before rt
	f: number; // fraction towards i+1
	x: number;
	n: number;
	h: number;
	speed: number;
	heading: number;
	lean: number;
	dist: number;
	time: number; // epoch seconds
	ele: number;
}

/** Largest index with arr[i] <= v. */
export function bisect(arr: number[], v: number): number {
	let lo = 0;
	let hi = arr.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (arr[mid] <= v) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const lerpAngle = (a: number, b: number, f: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * f;

export function sampleTrack(tr: Track, rt: number): BikeState {
	const i = Math.min(bisect(tr.rt, rt), tr.count - 2);
	const span = tr.rt[i + 1] - tr.rt[i];
	const f = span > 0 ? Math.max(0, Math.min(1, (rt - tr.rt[i]) / span)) : 0;
	return {
		i,
		f,
		x: lerp(tr.x[i], tr.x[i + 1], f),
		n: lerp(tr.n[i], tr.n[i + 1], f),
		h: lerp(tr.ground[i], tr.ground[i + 1], f),
		speed: lerp(tr.speed[i], tr.speed[i + 1], f),
		heading: lerpAngle(tr.heading[i], tr.heading[i + 1], f),
		lean: lerp(tr.lean[i], tr.lean[i + 1], f),
		dist: lerp(tr.dist[i], tr.dist[i + 1], f),
		time: tr.t0 + lerp(tr.t[i], tr.t[i + 1], f),
		ele: lerp(tr.ele[i], tr.ele[i + 1], f)
	};
}

/** The OSM road under fix i, if any. */
export function roadAtFix(osm: Osm | null, i: number): Road | null {
	if (!osm) return null;
	let lo = 0;
	let hi = osm.roadRuns.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (osm.roadRuns[mid][0] <= i) lo = mid;
		else hi = mid - 1;
	}
	const r = osm.roadRuns[lo]?.[1] ?? -1;
	return r >= 0 ? osm.roads[r] : null;
}

/** Weather at riding-time rt: nearest earlier sample, with temperature/wind blended to the next. */
export function weatherAt(w: Weather | null, rt: number): WeatherSample | null {
	if (!w?.samples.length) return null;
	const s = w.samples;
	let k = 0;
	while (k < s.length - 1 && s[k + 1].rt <= rt) k++;
	const a = s[k];
	const b = s[Math.min(k + 1, s.length - 1)];
	const f = b.rt > a.rt ? Math.max(0, Math.min(1, (rt - a.rt) / (b.rt - a.rt))) : 0;
	const lerp = (x: number | null, y: number | null) => (x == null || y == null ? x : x + (y - x) * f);
	return { ...a, temp: lerp(a.temp, b.temp), feels: lerp(a.feels, b.feels), wind: lerp(a.wind, b.wind) };
}

/** WMO weather code -> icon + label (https://open-meteo.com/en/docs, "WMO Weather interpretation codes"). */
export function weatherLabel(code: number, isDay = 1): { icon: string; label: string } {
	if (code === 0) return { icon: isDay ? '☀️' : '🌙', label: 'Clear' };
	if (code <= 2) return { icon: isDay ? '🌤️' : '☁️', label: code === 1 ? 'Mainly clear' : 'Partly cloudy' };
	if (code === 3) return { icon: '☁️', label: 'Overcast' };
	if (code <= 48) return { icon: '🌫️', label: 'Fog' };
	if (code <= 57) return { icon: '🌦️', label: 'Drizzle' };
	if (code <= 67) return { icon: '🌧️', label: 'Rain' };
	if (code <= 77) return { icon: '🌨️', label: 'Snow' };
	if (code <= 82) return { icon: '🌧️', label: 'Showers' };
	if (code <= 86) return { icon: '🌨️', label: 'Snow showers' };
	return { icon: '⛈️', label: 'Thunderstorm' };
}

export const PIN_META: Record<PinType, { icon: string; label: string; color: string }> = {
	photo: { icon: '◉', label: 'Photo', color: '#7cf7ff' },
	blog: { icon: '✎', label: 'Story', color: '#ffd166' },
	poi: { icon: '▲', label: 'Point of interest', color: '#b8f28c' },
	fuel: { icon: '⛽', label: 'Fuel', color: '#ff6b6b' },
	food: { icon: '🍴', label: 'Food', color: '#ffa94d' },
	pub: { icon: '🍺', label: 'Pub', color: '#e599f7' },
	route: { icon: '⤳', label: 'Route', color: '#f2b134' }
};

export const mph = (ms: number) => ms * 2.23694;

export function clock(epochSeconds: number): string {
	return new Date(epochSeconds * 1000).toLocaleTimeString(TOUR.locale, {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: TOUR.timeZone
	});
}
