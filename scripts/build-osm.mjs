// Road network, water and place names for one day from OpenStreetMap vector tiles (OpenFreeMap,
// OpenMapTiles schema). Two bands along the ride:
//   near (z14 tiles within NEAR_ROUTE): every road class, hamlets, exact shorelines
//   wide (z12 tiles within WIDE):       main roads, towns, fells, lakes, rivers
// Roads and rivers are draped on the DEM, lakes rasterised into an anti-aliased water mask on the
// day grid, and every fix is matched to the road it was on.
// Output (per day): osm.json, water.bin
// Data © OpenMapTiles © OpenStreetMap contributors (ODbL) — the app shows attribution.
import fs from 'node:fs';
import { TerrariumSampler, dayContext, loadTerrainGrid, makeProjection, nearPrivacyZone, PRIVACY_MARGIN } from './lib/geo.mjs';
import { readTiles, tileOf, tilesAround } from './lib/vtiles.mjs';

// metres between draped vertices: fine on detailed days, no finer than the grid on coarse ones
const densifyFor = (spacing) => Math.max(30, spacing);
const NEAR_ROUTE = 2000; // metres: z14 detail band
const WIDE = 9000; // metres: z12 context band
const MATCH_RADIUS = 30; // metres from a fix to count as "on" a road

// OpenMapTiles transportation class -> draw tier (see Roads.svelte)
const TIER = { motorway: 0, trunk: 0, primary: 0, secondary: 1, tertiary: 1, minor: 2, service: 3, track: 4 };
const PLACE_KIND = { city: 'town', town: 'town', village: 'village', hamlet: 'hamlet', isolated_dwelling: 'locality', locality: 'locality' };

const ctx = dayContext();
const { meta, heightAt: gridHeightAt } = loadTerrainGrid(ctx.out);
const proj = makeProjection(meta.originE, meta.originN);
const { x0, n1, cols, rows, spacing } = meta;
const DENSIFY = densifyFor(spacing);
const x1 = x0 + (cols - 1) * spacing;
const n0 = n1 - (rows - 1) * spacing;

// Full-res DEM where the route is (tiles fetched by build-track are on disk); day grid elsewhere
const dem = new TerrariumSampler('data/cache/terrarium', 12);
const track = JSON.parse(fs.readFileSync(ctx.file('track.json'), 'utf8'));
const routeLonLat = track.x.map((x, i) => proj.inverse(x, track.n[i]));
await dem.prefetchPoints(routeLonLat);
const heightAt = (x, n) => dem.sampleOr(...proj.inverse(x, n), gridHeightAt(x, n));

// ---------- which tiles ----------
const routeSample = routeLonLat.filter((_, i) => i % 20 === 0 || i === track.count - 1);
const nearTiles = tilesAround(routeSample, 14, NEAR_ROUTE);
const nearKeys = new Set(nearTiles.map(([, x, y]) => `${x}/${y}`));
const wideTiles = tilesAround(routeSample, 12, WIDE);
/** true if a lon/lat falls in the near band, where z14 detail replaces the z12 version */
const inNear = (lon, lat) => nearKeys.has(tileOf(lon, lat, 14).join('/'));
console.log(`OSM tiles: ${nearTiles.length} near (z14) + ${wideTiles.length} wide (z12)`);

// ---------- geometry helpers ----------
const r1 = (v) => Math.round(v * 10) / 10;
const inside = (x, n) => x >= x0 && x <= x1 && n >= n0 && n <= n1;

/** [lon, lat] line -> local metres, densified so it can follow the terrain, clipped to the grid. */
function densify(coords) {
	const pts = [];
	let prev = null;
	for (const [lon, lat] of coords) {
		const [x, n] = proj.forward(lon, lat);
		if (prev) {
			const steps = Math.ceil(Math.hypot(x - prev[0], n - prev[1]) / DENSIFY);
			for (let k = 1; k < steps; k++) pts.push([prev[0] + ((x - prev[0]) * k) / steps, prev[1] + ((n - prev[1]) * k) / steps]);
		}
		pts.push([x, n]);
		prev = [x, n];
	}
	return pts.filter(([x, n]) => inside(x, n));
}
// flat [x, n, h, x, n, h, …] draped on the DEM
const drape = (pts) => pts.flatMap(([x, n]) => [Math.round(x), Math.round(n), Math.round(Math.max(0, heightAt(x, n)))]);
const lines = (geom) =>
	geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : [];
const polygons = (geom) =>
	geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
const midOf = (line) => line[Math.floor(line.length / 2)];

// ---------- water mask ----------
// Even-odd scanline fill with SUB scanlines per cell and exact horizontal span overlap, so each
// cell stores the fraction of it that is water (smooth shorelines when the app interpolates it).
// Tile-clipped polygons are closed within their tile, so each one fills independently.
const SUB = 4;
const cover = new Float32Array(cols * rows);
function fillRings(rings) {
	const segs = [];
	for (const ring of rings)
		for (let k = 1; k < ring.length; k++) {
			const [xa, na] = proj.forward(...ring[k - 1]);
			const [xb, nb] = proj.forward(...ring[k]);
			segs.push([(xa - x0) / spacing, (n1 - na) / spacing, (xb - x0) / spacing, (n1 - nb) / spacing]);
		}
	let rMin = Infinity;
	let rMax = -Infinity;
	for (const s of segs) (rMin = Math.min(rMin, s[1], s[3])), (rMax = Math.max(rMax, s[1], s[3]));
	for (let r = Math.max(0, Math.round(rMin)); r <= Math.min(rows - 1, Math.round(rMax)); r++)
		for (let k = 0; k < SUB; k++) {
			const y = r - 0.5 + (k + 0.5) / SUB;
			const xs = [];
			for (const [ca, ra, cb, rb] of segs)
				if ((ra <= y && y < rb) || (rb <= y && y < ra)) xs.push(ca + ((y - ra) * (cb - ca)) / (rb - ra));
			xs.sort((a, b) => a - b);
			for (let q = 0; q + 1 < xs.length; q += 2)
				for (let c = Math.max(0, Math.round(xs[q])); c <= Math.min(cols - 1, Math.round(xs[q + 1])); c++) {
					const w = (Math.min(xs[q + 1], c + 0.5) - Math.max(xs[q], c - 0.5)) / SUB;
					if (w > 0) cover[r * cols + c] += w;
				}
		}
}

// ---------- read both bands ----------
const roads = [];
const rivers = [];
const placeMap = new Map(); // dedupe labels that appear in several tiles / both bands
function addPlace(kind, name, lon, lat, ele = null) {
	if (!name) return;
	// no place names in or near a privacy zone: a label there would say where family live
	if (nearPrivacyZone(lon, lat, PRIVACY_MARGIN)) return;
	const [x, n] = proj.forward(lon, lat);
	if (!inside(x, n)) return;
	// water names repeat along rivers in every tile, so they dedupe over a wider area
	const cell = kind === 'water' ? 10_000 : 2000;
	const key = `${kind}:${name}:${Math.round(x / cell)}:${Math.round(n / cell)}`;
	if (!placeMap.has(key)) placeMap.set(key, { kind, name, ele, x: r1(x), n: r1(n), h: r1(Math.max(0, heightAt(x, n))) });
}
// Minor roads thin out with distance from the ride, or cities swamp the file (London alone was
// 36 MB): service roads and tracks right by the route, residential streets a little further.
const TIER_REACH = [Infinity, Infinity, 1200, 400, 400]; // metres, by tier
const corridor = new Uint8Array(fs.readFileSync(ctx.file('corridor.bin')));
const routeDist = (x, n) => {
	const c = Math.round((x - x0) / spacing);
	const r = Math.round((n1 - n) / spacing);
	return c < 0 || r < 0 || c >= cols || r >= rows ? Infinity : corridor[r * cols + c] * spacing;
};

function addRoad(p, coords, render) {
	const tier = TIER[p.class];
	if (tier === undefined) return;
	const kept = densify(coords);
	if (kept.length < 2) return;
	// name-only lines are kept regardless: the ride has to match against them
	if (render && !kept.some(([x, n]) => routeDist(x, n) <= TIER_REACH[tier])) return;
	roads.push({ tier, highway: p.class, name: p.name ?? null, ref: p.ref ?? null, render, pts: drape(kept) });
}

async function readBand(tiles, band) {
	const near = band === 'near';
	await readTiles(tiles, ['transportation', 'transportation_name', 'water', 'waterway', 'place', 'mountain_peak', 'water_name'], (layer, f) => {
		const p = f.properties;
		const g = f.geometry;
		if (layer === 'transportation' || layer === 'transportation_name') {
			// wide band: main roads only, and not where the near band has the detailed version
			if (!near && (TIER[p.class] ?? 9) > 1) return;
			for (const line of lines(g)) {
				if (!near && inNear(...midOf(line))) continue;
				// transportation draws the network; transportation_name carries names/refs for matching
				addRoad(p, line, layer === 'transportation');
			}
		} else if (layer === 'water') {
			if (p.class === 'swimming_pool') return;
			for (const poly of polygons(g)) fillRings(poly);
		} else if (layer === 'waterway') {
			if (p.class !== 'river' && p.class !== 'canal') return;
			for (const line of lines(g)) {
				if (!near && inNear(...midOf(line))) continue;
				const kept = densify(line);
				if (kept.length >= 2) rivers.push({ name: p.name ?? null, pts: drape(kept) });
			}
		} else if (layer === 'place' && g.type === 'Point') {
			const kind = PLACE_KIND[p.class];
			// small places only near the ride; towns and villages from both bands
			if (kind && (near || kind === 'town' || kind === 'village')) addPlace(kind, p.name, ...g.coordinates);
		} else if (layer === 'mountain_peak' && g.type === 'Point') {
			addPlace('peak', p.name, ...g.coordinates, p.ele ?? null);
		} else if (layer === 'water_name' && g.type === 'Point') {
			addPlace('water', p.name, ...g.coordinates);
		}
	});
}
await readBand(nearTiles, 'near');
await readBand(wideTiles, 'wide');

const water = Uint8Array.from(cover, (v) => Math.round(Math.min(1, v) * 255)); // 0..255 coverage
fs.writeFileSync(ctx.file('water.bin'), Buffer.from(water.buffer));
const waterKm2 = (cover.reduce((a, v) => a + Math.min(1, v), 0) * spacing * spacing) / 1e6;
const places = [...placeMap.values()];

// ---------- which road is the ride on? ----------
// spatial hash of road segments, then the nearest segment per fix: named roads (from the
// transportation_name layer) win over unnamed ones, major roads over minor
const CELL = 100;
const buckets = new Map();
roads.forEach((road, ri) => {
	const p = road.pts;
	for (let k = 3; k < p.length; k += 3) {
		const key = `${Math.floor(p[k] / CELL)},${Math.floor(p[k + 1] / CELL)}`;
		if (!buckets.has(key)) buckets.set(key, []);
		buckets.get(key).push([ri, k - 3]);
	}
});
function segDist(px, pn, ax, an, bx, bn) {
	const dx = bx - ax;
	const dn = bn - an;
	const len2 = dx * dx + dn * dn || 1;
	const f = Math.max(0, Math.min(1, ((px - ax) * dx + (pn - an) * dn) / len2));
	return Math.hypot(px - (ax + dx * f), pn - (an + dn * f));
}
const roadAt = new Int32Array(track.count).fill(-1);
for (let i = 0; i < track.count; i++) {
	const px = track.x[i];
	const pn = track.n[i];
	let best = -1;
	let bestScore = Infinity;
	for (let dx = -1; dx <= 1; dx++)
		for (let dn = -1; dn <= 1; dn++)
			for (const [ri, k] of buckets.get(`${Math.floor(px / CELL) + dx},${Math.floor(pn / CELL) + dn}`) ?? []) {
				const p = roads[ri].pts;
				const d = segDist(px, pn, p[k], p[k + 1], p[k + 3], p[k + 4]);
				if (d > MATCH_RADIUS) continue;
				const score = d + roads[ri].tier * 8 + (roads[ri].name || roads[ri].ref ? 0 : 15);
				if (score < bestScore) [bestScore, best] = [score, ri];
			}
	roadAt[i] = best;
}
// smooth out single-fix flickers at junctions
for (let i = 1; i < track.count - 1; i++)
	if (roadAt[i - 1] === roadAt[i + 1] && roadAt[i] !== roadAt[i - 1]) roadAt[i] = roadAt[i - 1];
// Name-only lines exist for matching; ship just the ones the ride actually used (they're most of
// the file otherwise) and re-index the matches to the trimmed list.
const used = new Set(roadAt);
const keep = roads.map((r, i) => r.render || used.has(i));
const newIndex = new Int32Array(roads.length).fill(-1);
const shipped = [];
roads.forEach((r, i) => {
	if (keep[i]) (newIndex[i] = shipped.length), shipped.push(r);
});
// run-length encode: [[fromFix, roadIndex], …]
const roadRuns = [];
roadAt.forEach((r, i) => {
	const ri = r >= 0 ? newIndex[r] : -1;
	if (!roadRuns.length || roadRuns.at(-1)[1] !== ri) roadRuns.push([i, ri]);
});

fs.writeFileSync(
	ctx.file('osm.json'),
	JSON.stringify({ attribution: '© OpenMapTiles © OpenStreetMap contributors', roads: shipped, rivers, places, roadRuns })
);
const matched = roadAt.filter((r) => r >= 0).length;
console.log(
	`  osm.json: ${roads.filter((r) => r.render).length} road pieces, ${places.length} places/peaks, ${waterKm2.toFixed(1)} km² water, ${rivers.length} river pieces; ride matched on ${((matched / track.count) * 100).toFixed(0)}% of fixes, ${(fs.statSync(ctx.file('osm.json')).size / 1e6).toFixed(1)} MB`
);
const named = [
	...new Set(
		roadRuns
			.map(([, r]) => r)
			.filter((r) => r >= 0)
			.map((r) => [roads[r].ref, roads[r].name].filter(Boolean).join(' ') || roads[r].highway)
	)
];
console.log('  roads ridden:', named.join(' → '));
