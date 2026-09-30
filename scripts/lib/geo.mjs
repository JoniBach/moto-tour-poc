// Shared geo helpers for the build scripts: the tour's projection, day context, Terrarium DEM
// sampling, GPX I/O.
import fs from 'node:fs';
import path from 'node:path';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { PATHS, TOUR } from './tour.mjs';

const R = 6371008.8;
const RAD = Math.PI / 180;

// The tour's flat world in metres: tour.config.json region.projection (British National Grid for
// the UK), else a transverse Mercator on region.centre. Keep in sync with src/lib/tourConfig.ts.
const { centre } = TOUR.region;
export const PROJECTION =
	TOUR.region.projection ??
	`+proj=tmerc +lat_0=${centre[1]} +lon_0=${centre[0]} +k=1 +x_0=500000 +y_0=500000 +ellps=WGS84 +units=m +no_defs`;
const grid = proj4('EPSG:4326', PROJECTION);
/** lon/lat -> projected metres [east, north] */
export const toGrid = (lon, lat) => grid.forward([lon, lat]);
/** projected metres -> [lon, lat] */
export const fromGrid = (e, n) => grid.inverse([e, n]);

/**
 * Every day shares one world: the tour's projected metres. Each day's data is stored relative
 * to its own origin (originE, originN) so numbers stay small; the app offsets days against each
 * other using those origins. Returns metres: x = east, n = north (relative to the origin).
 */
export function makeProjection(originE, originN) {
	return {
		originE,
		originN,
		forward: (lon, lat) => {
			const [e, n] = toGrid(lon, lat);
			return [e - originE, n - originN];
		},
		inverse: (x, n) => fromGrid(x + originE, n + originN)
	};
}

export function haversine(lon1, lat1, lon2, lat2) {
	const dLat = (lat2 - lat1) * RAD;
	const dLon = (lon2 - lon1) * RAD;
	const a =
		Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- Terrarium elevation tiles (AWS open data, no key) ----------
// https://registry.opendata.aws/terrain-tiles/  h = R*256 + G + B/256 - 32768
const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

export class TerrariumSampler {
	constructor(cacheDir, zoom = 12) {
		this.cacheDir = cacheDir;
		this.zoom = zoom;
		this.tiles = new Map();
	}

	static lonLatToPixel(lon, lat, z) {
		const n = 2 ** z * 256;
		const x = ((lon + 180) / 360) * n;
		const s = Math.sin(lat * RAD);
		const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
		return [x, y];
	}

	/** Download (or read from cache) every tile covering the bbox. */
	async prefetch([minLon, minLat, maxLon, maxLat]) {
		const z = this.zoom;
		const [x0, y0] = TerrariumSampler.lonLatToPixel(minLon, maxLat, z);
		const [x1, y1] = TerrariumSampler.lonLatToPixel(maxLon, minLat, z);
		const jobs = [];
		// a pixel of margin: bilinear sampling at the edge reads its neighbour, which can be in the next tile
		for (let ty = Math.floor((y0 - 1) / 256); ty <= Math.floor((y1 + 1) / 256); ty++)
			for (let tx = Math.floor((x0 - 1) / 256); tx <= Math.floor((x1 + 1) / 256); tx++) jobs.push([tx, ty]);
		console.log(`  terrarium z${z}: ${jobs.length} tiles`);
		await this.#loadAll(jobs);
	}

	/** Download only the tiles touched by these [lon, lat] points (and their bilinear neighbours). */
	async prefetchPoints(lonLats) {
		const keys = new Map();
		for (const [lon, lat] of lonLats) {
			const [x, y] = TerrariumSampler.lonLatToPixel(lon, lat, this.zoom);
			for (const dx of [-1, 1])
				for (const dy of [-1, 1]) {
					const tx = Math.floor((x + dx) / 256);
					const ty = Math.floor((y + dy) / 256);
					keys.set(`${tx}/${ty}`, [tx, ty]);
				}
		}
		const jobs = [...keys.values()].filter(([tx, ty]) => !this.tiles.has(`${tx}/${ty}`));
		if (jobs.length) console.log(`  terrarium z${this.zoom}: ${jobs.length} tiles along the route`);
		await this.#loadAll(jobs);
	}

	async #loadAll(jobs) {
		for (let i = 0; i < jobs.length; i += 8) {
			await Promise.all(jobs.slice(i, i + 8).map(([tx, ty]) => this.#load(tx, ty)));
		}
	}

	async #load(tx, ty) {
		const key = `${tx}/${ty}`;
		if (this.tiles.has(key)) return;
		const file = path.join(this.cacheDir, `${this.zoom}`, `${tx}`, `${ty}.png`);
		if (!fs.existsSync(file)) {
			const res = await fetch(TILE_URL(this.zoom, tx, ty));
			if (!res.ok) throw new Error(`tile ${key}: HTTP ${res.status}`);
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
		}
		const png = PNG.sync.read(fs.readFileSync(file));
		const h = new Float32Array(256 * 256);
		for (let i = 0; i < h.length; i++) {
			const o = i * 4;
			h[i] = png.data[o] * 256 + png.data[o + 1] + png.data[o + 2] / 256 - 32768;
		}
		this.tiles.set(key, h);
	}

	#pixel(px, py) {
		const tx = Math.floor(px / 256);
		const ty = Math.floor(py / 256);
		const t = this.tiles.get(`${tx}/${ty}`);
		if (!t) throw new Error(`tile ${tx}/${ty} not prefetched`);
		return t[(py - ty * 256) * 256 + (px - tx * 256)];
	}

	/** Like sample(), but returns `fallback` instead of throwing where tiles weren't prefetched. */
	sampleOr(lon, lat, fallback) {
		// bilinear lookups can straddle a tile edge, so let sample() decide what it needs
		try {
			return this.sample(lon, lat);
		} catch {
			return fallback;
		}
	}

	/** Bilinear elevation in metres (negative = bathymetry). */
	sample(lon, lat) {
		const [x, y] = TerrariumSampler.lonLatToPixel(lon, lat, this.zoom);
		const fx = x - 0.5;
		const fy = y - 0.5;
		const ix = Math.floor(fx);
		const iy = Math.floor(fy);
		const ax = fx - ix;
		const ay = fy - iy;
		const h00 = this.#pixel(ix, iy);
		const h10 = this.#pixel(ix + 1, iy);
		const h01 = this.#pixel(ix, iy + 1);
		const h11 = this.#pixel(ix + 1, iy + 1);
		return (h00 * (1 - ax) + h10 * ax) * (1 - ay) + (h01 * (1 - ax) + h11 * ax) * ay;
	}
}

// ---------- built terrain grid ----------

/** Loads static/data/terrain.* and returns { meta, heightAt(x, n) } with bilinear sampling. */
export function loadTerrainGrid(dir = 'static/data') {
	const meta = JSON.parse(fs.readFileSync(path.join(dir, 'terrain.json'), 'utf8'));
	const grid = new Int16Array(fs.readFileSync(path.join(dir, 'terrain.bin')).buffer.slice(0));
	const { cols, rows, spacing, x0, n1, scale } = meta;
	const heightAt = (x, n) => {
		const fc = Math.max(0, Math.min(cols - 1.001, (x - x0) / spacing));
		const fr = Math.max(0, Math.min(rows - 1.001, (n1 - n) / spacing));
		const c = Math.floor(fc);
		const r = Math.floor(fr);
		const ac = fc - c;
		const ar = fr - r;
		const h = (cc, rr) => grid[rr * cols + cc] * scale;
		return (h(c, r) * (1 - ac) + h(c + 1, r) * ac) * (1 - ar) + (h(c, r + 1) * (1 - ac) + h(c + 1, r + 1) * ac) * ar;
	};
	return { meta, heightAt };
}

// ---------- GPX ----------

/** Minimal GPX track parser: returns [{lat, lon, ele, time}] across all trkseg. */
export function parseGpx(xml) {
	const pts = [];
	const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
	let m;
	while ((m = re.exec(xml))) {
		const attr = m[1];
		const body = m[2];
		const lat = +/lat="([^"]+)"/.exec(attr)[1];
		const lon = +/lon="([^"]+)"/.exec(attr)[1];
		const ele = /<ele>([^<]+)<\/ele>/.exec(body);
		const time = /<time>([^<]+)<\/time>/.exec(body);
		pts.push({
			lat,
			lon,
			ele: ele ? +ele[1] : null,
			time: time ? Date.parse(time[1]) / 1000 : null
		});
	}
	return pts;
}

export function writeGpx(name, pts) {
	const body = pts
		.map(
			(p) =>
				`      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><ele>${p.ele.toFixed(1)}</ele><time>${new Date(p.time * 1000).toISOString()}</time></trkpt>`
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="moto-tour-poc sample generator" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name}</name>
    <trkseg>
${body}
    </trkseg>
  </trk>
</gpx>
`;
}

export function readAllGpx(files) {
	return files
		.flatMap((f) => parseGpx(fs.readFileSync(f, 'utf8')))
		.filter((p) => p.time != null)
		.sort((a, b) => a.time - b.time);
}

// ---------- day context ----------

export const GPX_DIR = PATHS.gpx;

/** All ride dates available in GPX_DIR ("2026-09-16", …), from the file-name prefix. */
export function listDays() {
	return [...new Set(fs.readdirSync(GPX_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}.*\.gpx$/i.test(f)).map((f) => f.slice(0, 10)))].sort();
}

/**
 * The day a build script is working on: DAY env var or first CLI arg. Gives its GPX files
 * (every file whose name starts with the date) and output folder static/data/days/<day>/.
 */
export function dayContext() {
	const day = process.env.DAY ?? process.argv[2];
	if (!day) throw new Error('Set DAY=YYYY-MM-DD (or pass it as the first argument)');
	const files = fs
		.readdirSync(GPX_DIR)
		.filter((f) => f.startsWith(day) && f.toLowerCase().endsWith('.gpx'))
		.sort()
		.map((f) => path.join(GPX_DIR, f));
	if (!files.length) throw new Error(`No GPX files for ${day} in ${GPX_DIR}`);
	const out = path.join(PATHS.days, day);
	fs.mkdirSync(out, { recursive: true });
	return { day, files, out, file: (name) => path.join(out, name) };
}

// ---------- privacy zones ----------

const PRIVACY_FILE = PATHS.privacy;
export const privacyZones = fs.existsSync(PRIVACY_FILE) ? JSON.parse(fs.readFileSync(PRIVACY_FILE, 'utf8')).zones : [];

/** True if a lon/lat falls inside any privacy zone (data/privacy.json). */
export const inPrivacyZone = (lon, lat) =>
	privacyZones.some((z) => haversine(lon, lat, z.lon, z.lat) < z.radius);

/**
 * Split a ride's fixes into the runs that lie outside every privacy zone. A ride that passes
 * through a zone becomes separate pieces, so nothing is drawn (or interpolated) across it.
 */
export function outsidePrivacy(fixes) {
	const runs = [[]];
	for (const p of fixes) {
		if (inPrivacyZone(p.lon, p.lat)) {
			if (runs.at(-1).length) runs.push([]);
		} else runs.at(-1).push(p);
	}
	return runs.filter((r) => r.length > 1);
}

/**
 * Where the rider really was at epoch-seconds t, from the *unfiltered* GPX (the built tracks have
 * privacy zones cut out, so they can't answer this). Before a day's first fix it's that fix (still
 * at the start), after the last it's the last. Returns null on days without rides.
 */
let rawByDate = null;
export function rawPositionAt(t) {
	if (!rawByDate) {
		rawByDate = new Map();
		for (const f of fs.readdirSync(GPX_DIR).filter((f) => /\.gpx$/i.test(f))) {
			const date = f.slice(0, 10);
			const fixes = parseGpx(fs.readFileSync(path.join(GPX_DIR, f), 'utf8')).filter((q) => q.time != null);
			rawByDate.set(date, [...(rawByDate.get(date) ?? []), ...fixes]);
		}
		for (const fixes of rawByDate.values()) fixes.sort((a, b) => a.time - b.time);
	}
	const fixes = rawByDate.get(tourDate(t));
	if (!fixes?.length) return null;
	let lo = 0;
	let hi = fixes.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (fixes[mid].time <= t) lo = mid;
		else hi = mid - 1;
	}
	return fixes[lo];
}

/** True if the rider was inside a privacy zone at epoch-seconds t (see rawPositionAt). */
export function inPrivacyZoneAt(t) {
	const p = rawPositionAt(t);
	return !!p && inPrivacyZone(p.lon, p.lat);
}

/** The calendar date in the tour's time zone ("2026-09-16") for epoch seconds. */
export const tourDate = (sec) => new Date(sec * 1000).toLocaleDateString('en-CA', { timeZone: TOUR.timeZone });

/** Parse "2026-09-16 11:30" (the tour's local time, daylight saving handled) or a full ISO string to epoch seconds. */
export function parseTourTime(s) {
	s = String(s).trim();
	if (/[zZ]|[+-]\d\d:?\d\d$/.test(s)) return Date.parse(s) / 1000;
	const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
	if (!m) return NaN;
	const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
	// the time zone's offset at that moment (e.g. London: BST +60, GMT 0)
	const local = new Date(new Date(asUtc).toLocaleString('en-US', { timeZone: TOUR.timeZone }));
	const utc = new Date(new Date(asUtc).toLocaleString('en-US', { timeZone: 'UTC' }));
	return (asUtc - (local - utc)) / 1000;
}

/** metres beyond a privacy zone where no place names are published (labels, "near …") */
export const PRIVACY_MARGIN = 8000;

/** The zones' own names (towns): must never appear in anything published. */
export const privacyZoneNames = () => privacyZones.map((z) => z.name).filter(Boolean);

/** True if a lon/lat is inside a privacy zone or within `margin` metres of one. */
export const nearPrivacyZone = (lon, lat, margin) =>
	privacyZones.some((z) => haversine(lon, lat, z.lon, z.lat) < z.radius + margin);
