// OpenStreetMap vector tiles from OpenFreeMap (OpenMapTiles schema, free CDN, no key).
// Replaces live Overpass queries: small static tiles fetched in parallel and cached on disk.
// https://openfreemap.org  ·  data © OpenMapTiles © OpenStreetMap contributors
import fs from 'node:fs';
import path from 'node:path';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const TILEJSON = 'https://tiles.openfreemap.org/planet';
const CACHE = 'data/cache/omt';
const CONCURRENCY = 16;
const RAD = Math.PI / 180;

export const tileOf = (lon, lat, z) => {
	const s = Math.sin(lat * RAD);
	return [
		Math.floor(((lon + 180) / 360) * 2 ** z),
		Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z)
	];
};

/** Every tile at zoom z within `radius` metres of any of the [lon, lat] points. */
export function tilesAround(lonLats, z, radius) {
	const keys = new Map();
	for (const [lon, lat] of lonLats) {
		const dLat = radius / 111_320;
		const dLon = radius / (111_320 * Math.cos(lat * RAD));
		const [x0, y0] = tileOf(lon - dLon, lat + dLat, z);
		const [x1, y1] = tileOf(lon + dLon, lat - dLat, z);
		for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.set(`${z}/${x}/${y}`, [z, x, y]);
	}
	return [...keys.values()];
}

let template = null;
/** The current planet tile URL template (versioned), from OpenFreeMap's TileJSON. */
async function tileUrl() {
	if (!template) {
		const tj = await (await fetch(TILEJSON)).json();
		template = tj.tiles[0];
	}
	return template;
}

async function fetchTile(z, x, y) {
	const url = (await tileUrl()).replace('{z}', z).replace('{x}', x).replace('{y}', y);
	// cache per data version so a newer planet build never mixes with an older one
	const version = url.split('/').at(-4);
	const file = path.join(CACHE, version, `${z}`, `${x}`, `${y}.pbf`);
	if (fs.existsSync(file)) return fs.readFileSync(file);
	for (let attempt = 0; ; attempt++) {
		try {
			const res = await fetch(url);
			if (res.status === 404 || res.status === 204) return Buffer.alloc(0); // empty tile (open sea)
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buf = Buffer.from(await res.arrayBuffer());
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, buf);
			return buf;
		} catch (e) {
			if (attempt >= 3) throw new Error(`tile ${z}/${x}/${y}: ${e.message}`);
			await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
		}
	}
}

/**
 * Fetch and decode tiles, calling visit(layerName, geojsonFeature, [z, x, y]) for every feature
 * in the requested layers. Geometry comes back in lon/lat.
 */
export async function readTiles(tiles, layers, visit) {
	let next = 0;
	let done = 0;
	const worker = async () => {
		while (next < tiles.length) {
			const [z, x, y] = tiles[next++];
			const buf = await fetchTile(z, x, y);
			if (buf.length) {
				const vt = new VectorTile(new PbfReader(new Uint8Array(buf)));
				for (const name of layers) {
					const layer = vt.layers[name];
					if (!layer) continue;
					for (let i = 0; i < layer.length; i++) visit(name, layer.feature(i).toGeoJSON(x, y, z), [z, x, y]);
				}
			}
			if (++done % 50 === 0 || done === tiles.length) process.stdout.write(`  tiles ${done}/${tiles.length}\r`);
		}
	};
	await Promise.all(Array.from({ length: CONCURRENCY }, worker));
	process.stdout.write('\n');
}
