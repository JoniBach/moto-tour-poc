// Pulls real road network, water and place names from OpenStreetMap (Overpass API) for the
// terrain area, drapes roads and rivers on the DEM, rasterises lakes into a water mask aligned
// with the height grid, and works out which road the ride is on at every fix.
// Output (per day): osm.json, water.bin
// Data © OpenStreetMap contributors, ODbL — the app must show attribution.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { TerrariumSampler, dayContext, loadTerrainGrid, makeProjection } from './lib/geo.mjs';

// public instances; tried in turn because any one of them is often busy (HTTP 429/504)
const OVERPASS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter'
];
const DENSIFY = 30; // metres between draped vertices
const NEAR_ROUTE = 1500; // metres: tracks, service roads and minor place names only this close to the ride
const MATCH_RADIUS = 30; // metres from a fix to count as "on" a road

// Tier index = draw style in the app (see Roads.svelte)
const TIERS = [
	['motorway', 'trunk', 'primary'],
	['secondary', 'tertiary'],
	['unclassified', 'residential', 'living_street'],
	['service'],
	['track']
];
const tierOf = (hw) => TIERS.findIndex((t) => t.includes(hw.replace(/_link$/, '')));

const ctx = dayContext();
const { meta, heightAt: gridHeightAt } = loadTerrainGrid(ctx.out);
const proj = makeProjection(meta.originE, meta.originN);
const { x0, n1, cols, rows, spacing } = meta;
const x1 = x0 + (cols - 1) * spacing;
const n0 = n1 - (rows - 1) * spacing;
// BNG grid -> lon/lat box: take the extremes of all four corners (grid north != true north)
const corners = [proj.inverse(x0, n0), proj.inverse(x1, n0), proj.inverse(x0, n1), proj.inverse(x1, n1)];
const west = Math.min(...corners.map((c) => c[0]));
const east = Math.max(...corners.map((c) => c[0]));
const south = Math.min(...corners.map((c) => c[1]));
const north = Math.max(...corners.map((c) => c[1]));
const bbox = `${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)}`;

// Full-res DEM where the route is (tiles fetched by build-track are on disk); day grid elsewhere
const dem = new TerrariumSampler('data/cache/terrarium', 12);
const track = JSON.parse(fs.readFileSync(ctx.file('track.json'), 'utf8'));
const routeLonLat = track.x.map((x, i) => proj.inverse(x, track.n[i]));
await dem.prefetchPoints(routeLonLat);
const heightAt = (x, n) => dem.sampleOr(...proj.inverse(x, n), gridHeightAt(x, n));

// The route as Overpass polylines (a point every ~800 m), in chunks: one query over a whole
// long day times out on every public instance, so each chunk is its own small cached query.
const aroundPts = [];
for (let i = 0, last = -Infinity; i < track.count; i++)
	if (track.dist[i] - last > 800 || i === track.count - 1) {
		aroundPts.push(`${routeLonLat[i][1].toFixed(5)},${routeLonLat[i][0].toFixed(5)}`);
		last = track.dist[i];
	}
const CHUNK = 40; // ~32 km of route per query
const chunks = [];
for (let k = 0; k < aroundPts.length - 1; k += CHUNK - 1) chunks.push(aroundPts.slice(k, k + CHUNK).join(','));
const MAJOR = TIERS.slice(0, 2).flat().join('|');
const MINOR = TIERS.slice(2).flat().join('|');
const WIDE = 8000; // metres: major roads, towns, peaks and water shown this far from the ride

const queries = chunks.flatMap((line) => [
	// near the ride: lanes, tracks, hamlets
	`[out:json][timeout:120];
(
  way[highway~"^(${MINOR})$"](around:${NEAR_ROUTE},${line});
  node[place~"^(hamlet|locality)$"][name](around:${NEAR_ROUTE},${line});
);
out geom;`,
	// the wider landscape: main roads, towns, fells, lakes and rivers
	`[out:json][timeout:120];
(
  way[highway~"^(${MAJOR})(_link)?$"](around:${WIDE},${line});
  node[place~"^(town|village)$"][name](around:${WIDE},${line});
  node[natural=peak][name](around:${WIDE},${line});
  way[natural=water](around:${WIDE},${line});
  relation[natural=water](around:${WIDE},${line});
  way[waterway=riverbank](around:${WIDE},${line});
  relation[waterway=riverbank](around:${WIDE},${line});
  way[waterway~"^(river|canal)$"](around:${WIDE},${line});
);
out geom;`
]);

// ---------- fetch (each query cached by its hash) ----------
async function overpass(query) {
	const cacheFile = `data/cache/osm-${crypto.createHash('md5').update(query).digest('hex').slice(0, 10)}.json`;
	if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
	for (const [attempt, url] of [...OVERPASS, ...OVERPASS].entries()) {
		try {
			const res = await fetch(url, {
				method: 'POST',
				// Overpass rejects requests without an identifying User-Agent
				headers: { 'User-Agent': 'moto-tour-poc/0.1 (personal project)', Accept: 'application/json' },
				body: new URLSearchParams({ data: query }),
				signal: AbortSignal.timeout(150_000)
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const json = await res.json();
			fs.mkdirSync('data/cache', { recursive: true });
			fs.writeFileSync(cacheFile, JSON.stringify(json));
			return json;
		} catch (e) {
			console.log(`  ${new URL(url).host} failed (${e.message})`);
			await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
		}
	}
	throw new Error('All Overpass instances failed; try again later');
}

// merge, de-duplicating features that sit in more than one chunk
const seen = new Map();
for (const [k, q] of queries.entries()) {
	process.stdout.write(`OSM: query ${k + 1}/${queries.length}`);
	for (const el of (await overpass(q)).elements) seen.set(`${el.type}/${el.id}`, el);
}
const osm = { elements: [...seen.values()] };
console.log(`OSM: ${osm.elements.length} features from ${queries.length} queries`);

const r1 = (v) => Math.round(v * 10) / 10;
const inside = (x, n) => x >= x0 && x <= x1 && n >= n0 && n <= n1;
// distance-to-route raster from build-track (cells, capped at 255)
const corridor = new Uint8Array(fs.readFileSync(ctx.file('corridor.bin')));
const routeDist = (x, n) =>
	corridor[Math.round((n1 - n) / spacing) * cols + Math.round((x - x0) / spacing)] * spacing;
const MINOR_TIERS = new Set([3, 4]); // service, track
const MINOR_PLACES = new Set(['locality', 'hamlet']);

/** OSM way geometry -> local metres, densified so it can follow the terrain, clipped to the grid. */
function densify(geometry) {
	const pts = [];
	let prev = null;
	for (const g of geometry) {
		const [x, n] = proj.forward(g.lon, g.lat);
		if (prev) {
			const d = Math.hypot(x - prev[0], n - prev[1]);
			for (let k = 1; k < Math.ceil(d / DENSIFY); k++) {
				const f = k / Math.ceil(d / DENSIFY);
				pts.push([prev[0] + (x - prev[0]) * f, prev[1] + (n - prev[1]) * f]);
			}
		}
		pts.push([x, n]);
		prev = [x, n];
	}
	return pts.filter(([x, n]) => inside(x, n));
}
// flat [x, n, h, x, n, h, …] draped on the DEM
const drape = (pts) => pts.flatMap(([x, n]) => [Math.round(x), Math.round(n), r1(Math.max(0, heightAt(x, n)))]);

// ---------- roads ----------
const roads = [];
for (const el of osm.elements) {
	if (el.type !== 'way' || !el.geometry || !el.tags?.highway) continue;
	const tier = tierOf(el.tags.highway);
	if (tier < 0) continue;
	const kept = densify(el.geometry);
	if (kept.length < 2) continue;
	if (MINOR_TIERS.has(tier) && !kept.some(([x, n]) => routeDist(x, n) < NEAR_ROUTE)) continue;
	const t = el.tags;
	roads.push({
		tier,
		highway: t.highway,
		name: t.name ?? null,
		ref: t.ref ?? null,
		maxspeed: t.maxspeed ?? null,
		singleTrack: t.passing_places === 'yes' || t.passing_places === 'true' || t.lanes === '1',
		pts: drape(kept)
	});
}

// ---------- water: lakes/reservoirs/riverbanks -> mask; rivers -> lines ----------
// Even-odd scanline fill over every ring segment of a feature. Works for multipolygon relations
// without stitching member ways into rings, as long as the members close up overall.
// Anti-aliased: SUB scanlines per cell and exact horizontal span overlap, so each cell stores
// the fraction of it that is water (smooth shorelines when the app interpolates it).
const SUB = 4;
const cover = new Float32Array(cols * rows);
const waterLabels = [];
function fillFeature(ringsLonLat) {
	const segs = [];
	for (const ring of ringsLonLat) {
		for (let k = 1; k < ring.length; k++) {
			const [xa, na] = proj.forward(ring[k - 1].lon, ring[k - 1].lat);
			const [xb, nb] = proj.forward(ring[k].lon, ring[k].lat);
			// grid space: c right, r down; samples sit on integer (c, r)
			segs.push([(xa - x0) / spacing, (n1 - na) / spacing, (xb - x0) / spacing, (n1 - nb) / spacing]);
		}
	}
	if (!segs.length) return null;
	let rMin = Infinity;
	let rMax = -Infinity;
	for (const sg of segs) {
		rMin = Math.min(rMin, sg[1], sg[3]);
		rMax = Math.max(rMax, sg[1], sg[3]);
	}
	let count = 0;
	let sc = 0;
	let sr = 0;
	// cell (c, r) covers [c - 0.5, c + 0.5] x [r - 0.5, r + 0.5]
	for (let r = Math.max(0, Math.round(rMin)); r <= Math.min(rows - 1, Math.round(rMax)); r++) {
		for (let k = 0; k < SUB; k++) {
			const y = r - 0.5 + (k + 0.5) / SUB;
			const xs = [];
			for (const [ca, ra, cb, rb] of segs)
				if ((ra <= y && y < rb) || (rb <= y && y < ra)) xs.push(ca + ((y - ra) * (cb - ca)) / (rb - ra));
			xs.sort((a, b) => a - b);
			for (let q = 0; q + 1 < xs.length; q += 2) {
				const a = xs[q];
				const b = xs[q + 1];
				for (let c = Math.max(0, Math.round(a)); c <= Math.min(cols - 1, Math.round(b)); c++) {
					const w = (Math.min(b, c + 0.5) - Math.max(a, c - 0.5)) / SUB;
					if (w <= 0) continue;
					cover[r * cols + c] += w;
					count += w;
					sc += c * w;
					sr += r * w;
				}
			}
		}
	}
	return count ? { count, c: sc / count, r: sr / count } : null;
}
const rivers = [];
for (const el of osm.elements) {
	const t = el.tags ?? {};
	const isArea = t.natural === 'water' || t.waterway === 'riverbank';
	if (isArea && el.type === 'way' && el.geometry) {
		const filled = fillFeature([el.geometry]);
		if (filled && t.name) waterLabels.push({ name: t.name, ...filled });
	} else if (isArea && el.type === 'relation') {
		const filled = fillFeature(el.members.filter((m) => m.type === 'way' && m.geometry).map((m) => m.geometry));
		if (filled && t.name) waterLabels.push({ name: t.name, ...filled });
	} else if (el.type === 'way' && /^(river|canal)$/.test(t.waterway ?? '') && el.geometry) {
		const kept = densify(el.geometry);
		if (kept.length >= 2) rivers.push({ name: t.name ?? null, pts: drape(kept) });
	}
}
const water = Uint8Array.from(cover, (v) => Math.round(Math.min(1, v) * 255)); // 0..255 coverage
fs.writeFileSync(ctx.file('water.bin'), Buffer.from(water.buffer));
const waterCells = cover.reduce((a, v) => a + Math.min(1, v), 0);
console.log(`Water: ${((waterCells * spacing * spacing) / 1e6).toFixed(1)} km² of lakes, ${rivers.length} river/canal ways`);

// ---------- places + peaks ----------
const places = [];
// named lakes over ~0.2 km² get a label at the centre of their filled cells
const MIN_LABEL_CELLS = 200_000 / (spacing * spacing);
for (const w of waterLabels.filter((w) => w.count >= MIN_LABEL_CELLS)) {
	const x = x0 + w.c * spacing;
	const n = n1 - w.r * spacing;
	places.push({ kind: 'water', name: w.name, ele: null, x: r1(x), n: r1(n), h: r1(Math.max(0, heightAt(x, n))) });
}
for (const el of osm.elements) {
	if (el.type !== 'node') continue;
	const [x, n] = proj.forward(el.lon, el.lat);
	if (!inside(x, n)) continue;
	const kind = el.tags.natural === 'peak' ? 'peak' : el.tags.place;
	if (MINOR_PLACES.has(kind) && routeDist(x, n) > NEAR_ROUTE) continue;
	places.push({
		kind,
		name: el.tags.name,
		ele: el.tags.ele ? Math.round(+el.tags.ele) : null,
		x: r1(x),
		n: r1(n),
		h: r1(Math.max(0, heightAt(x, n)))
	});
}

// ---------- which road is the ride on? ----------
// spatial hash of road segments, then nearest named/ref'd segment per fix (major roads win ties)
// (track loaded above)
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
		for (let dn = -1; dn <= 1; dn++) {
			for (const [ri, k] of buckets.get(`${Math.floor(px / CELL) + dx},${Math.floor(pn / CELL) + dn}`) ?? []) {
				const p = roads[ri].pts;
				const d = segDist(px, pn, p[k], p[k + 1], p[k + 3], p[k + 4]);
				if (d > MATCH_RADIUS) continue;
				const score = d + roads[ri].tier * 8 + (roads[ri].name || roads[ri].ref ? 0 : 15);
				if (score < bestScore) [bestScore, best] = [score, ri];
			}
		}
	roadAt[i] = best;
}
// smooth out single-fix flickers at junctions
for (let i = 1; i < track.count - 1; i++)
	if (roadAt[i - 1] === roadAt[i + 1] && roadAt[i] !== roadAt[i - 1]) roadAt[i] = roadAt[i - 1];
// run-length encode: [[fromFix, roadIndex], …]
const roadRuns = [];
roadAt.forEach((r, i) => {
	if (!roadRuns.length || roadRuns.at(-1)[1] !== r) roadRuns.push([i, r]);
});

fs.writeFileSync(ctx.file('osm.json'), JSON.stringify({ attribution: '© OpenStreetMap contributors', roads, rivers, places, roadRuns }));
const matched = roadAt.filter((r) => r >= 0).length;
console.log(
	`  osm.json: ${roads.length} roads, ${places.length} places/peaks, ride matched to roads on ${((matched / track.count) * 100).toFixed(0)}% of fixes`
);
const named = [...new Set(roadRuns.map(([, r]) => r).filter((r) => r >= 0).map((r) => [roads[r].ref, roads[r].name].filter(Boolean).join(' ') || roads[r].highway))];
console.log('  roads ridden:', named.join(' → '));
console.log(`  ${(fs.statSync(ctx.file('osm.json')).size / 1e6).toFixed(1)} MB`);
