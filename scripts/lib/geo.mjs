// Shared geo helpers for the build scripts: local projection, Terrarium DEM sampling, GPX I/O.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const R = 6371008.8;
const RAD = Math.PI / 180;

/**
 * Local equirectangular projection around an origin. Good to well under 0.1% over a
 * region this size. Prod should switch to British National Grid (EPSG:27700) so
 * OS Terrain 50 lines up natively.
 * Returns metres: x = east, n = north.
 */
export function makeProjection(lon0, lat0) {
	const kx = R * Math.cos(lat0 * RAD) * RAD;
	const ky = R * RAD;
	return {
		lon0,
		lat0,
		forward: (lon, lat) => [(lon - lon0) * kx, (lat - lat0) * ky],
		inverse: (x, n) => [lon0 + x / kx, lat0 + n / ky]
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
		for (let ty = Math.floor(y0 / 256); ty <= Math.floor(y1 / 256); ty++)
			for (let tx = Math.floor(x0 / 256); tx <= Math.floor(x1 / 256); tx++) jobs.push([tx, ty]);
		console.log(`  terrarium z${z}: ${jobs.length} tiles`);
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

export function readAllGpx(dir) {
	return fs
		.readdirSync(dir)
		.filter((f) => f.toLowerCase().endsWith('.gpx'))
		.sort()
		.flatMap((f) => parseGpx(fs.readFileSync(path.join(dir, f), 'utf8')))
		.filter((p) => p.time != null)
		.sort((a, b) => a.time - b.time);
}
