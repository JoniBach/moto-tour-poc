// The protected areas around the tour (OpenMapTiles `park` layer, z9 tiles) for the overview:
//  - each park is rasterised at 200 m within its own box, then traced (d3-contour) into a clean
//    outline: the tile-clipped polygons would otherwise show seams along tile edges
//  - a mask aligned with the region backdrop grid (park index + 1 per cell) for tinting its points
//  - which parks the tour passed through, from tour.json's route lines
// Which parks: tour.config.json protectedAreas.names (map name -> display name; only those), else
// every park of protectedAreas.classes (default national_park) of at least minKm2 (default 10),
// named as the map names it, less a trailing " National Park" style suffix.
// Output: static/data/tours/<id>/parks.json + parks.bin
// Run after build-region and build-tour.
import fs from 'node:fs';
import path from 'node:path';
import { contours } from 'd3';
import { fromGrid, toGrid } from './lib/geo.mjs';
import { readTiles, tileOf } from './lib/vtiles.mjs';
import { PATHS, TOUR } from './lib/tour.mjs';

const RES = 200; // metres per cell of each park's raster
const SIMPLIFY = 350; // metres between kept outline points

const { names, classes = ['national_park'], minKm2 = 10, one } = TOUR.protectedAreas;
const suffix = new RegExp(`\\s+${one}$`, 'i');
const displayName = (props) => {
	if (names) return names[props.name];
	if (!classes.includes(props.class)) return undefined;
	const name = props['name:en'] ?? props.name_en ?? props.name;
	return name ? name.replace(suffix, '') : undefined;
};

// the backdrop's area, in lon/lat
const region = JSON.parse(fs.readFileSync(path.join(PATHS.region, 'terrain.json'), 'utf8'));
const e1 = region.x0 + (region.cols - 1) * region.spacing;
const n0 = region.n1 - (region.rows - 1) * region.spacing;
const corners = [fromGrid(region.x0, n0), fromGrid(e1, n0), fromGrid(region.x0, region.n1), fromGrid(e1, region.n1)];
const west = Math.min(...corners.map((c) => c[0]));
const east = Math.max(...corners.map((c) => c[0]));
const south = Math.min(...corners.map((c) => c[1]));
const north = Math.max(...corners.map((c) => c[1]));

// ---------- collect polygon pieces per park (projected metres) ----------
const Z = 9;
const [tx0, ty0] = tileOf(west, north, Z);
const [tx1, ty1] = tileOf(east, south, Z);
const tiles = [];
for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) tiles.push([Z, x, y]);
console.log(`Parks: reading ${tiles.length} z${Z} tiles`);

const pieces = new Map(); // name -> [[ring, ring…], …] in projected metres
await readTiles(tiles, ['park'], (_, f) => {
	const name = displayName(f.properties);
	if (!name) return;
	const g = f.geometry;
	const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
	for (const poly of polys) {
		if (!pieces.has(name)) pieces.set(name, []);
		pieces.get(name).push(poly.map((ring) => ring.map(([lon, lat]) => toGrid(lon, lat))));
	}
});

// ---------- rasterise each park, trace its outline ----------
function fillPolys(polys, grid, cols, rows, e0, n1) {
	// even-odd scanline per polygon (tile-clipped pieces are each closed)
	for (const poly of polys) {
		const segs = [];
		for (const ring of poly)
			for (let k = 1; k < ring.length; k++)
				segs.push([(ring[k - 1][0] - e0) / RES, (n1 - ring[k - 1][1]) / RES, (ring[k][0] - e0) / RES, (n1 - ring[k][1]) / RES]);
		let rMin = Infinity;
		let rMax = -Infinity;
		for (const s of segs) (rMin = Math.min(rMin, s[1], s[3])), (rMax = Math.max(rMax, s[1], s[3]));
		for (let r = Math.max(0, Math.ceil(rMin)); r <= Math.min(rows - 1, Math.floor(rMax)); r++) {
			const xs = [];
			for (const [ca, ra, cb, rb] of segs)
				if ((ra <= r && r < rb) || (rb <= r && r < ra)) xs.push(ca + ((r - ra) * (cb - ca)) / (rb - ra));
			xs.sort((a, b) => a - b);
			for (let q = 0; q + 1 < xs.length; q += 2)
				for (let c = Math.max(0, Math.ceil(xs[q])); c <= Math.min(cols - 1, Math.floor(xs[q + 1])); c++) grid[r * cols + c] = 1;
		}
	}
}

const tour = JSON.parse(fs.readFileSync(PATHS.tourJson, 'utf8'));
const parks = [];
for (const [name, polys] of [...pieces].sort()) {
	let [e0, s0, e1, n1] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const poly of polys)
		for (const [e, n] of poly[0]) (e0 = Math.min(e0, e)), (e1 = Math.max(e1, e)), (s0 = Math.min(s0, n)), (n1 = Math.max(n1, n));
	e0 = Math.floor(e0 / RES) * RES - RES;
	n1 = Math.ceil(n1 / RES) * RES + RES;
	const cols = Math.ceil((e1 - e0) / RES) + 2;
	const rows = Math.ceil((n1 - s0) / RES) + 2;
	const grid = new Float64Array(cols * rows);
	fillPolys(polys, grid, cols, rows, e0, n1);

	// outline: contour at 0.5; d3 coords are cell-centred at +0.5
	const [iso] = contours().size([cols, rows]).thresholds([0.5])(Array.from(grid));
	const rings = [];
	for (const poly of iso.coordinates)
		for (const ring of poly) {
			const out = [];
			let last = null;
			for (const [c, r] of ring) {
				const e = Math.round(e0 + (c - 0.5) * RES);
				const n = Math.round(n1 - (r - 0.5) * RES);
				if (last && Math.hypot(e - last[0], n - last[1]) < SIMPLIFY) continue;
				out.push(e, n);
				last = [e, n];
			}
			if (out.length >= 8) out.push(out[0], out[1]); // close
			if (out.length >= 10) rings.push(out);
		}

	// label at the filled cell nearest the park's centre of mass
	let [sc, sr, count] = [0, 0, 0];
	for (let i = 0; i < grid.length; i++) if (grid[i]) (sc += i % cols), (sr += Math.floor(i / cols)), count++;
	let [bc, br, bd] = [0, 0, Infinity];
	for (let i = 0; i < grid.length; i++)
		if (grid[i]) {
			const d = (i % cols - sc / count) ** 2 + (Math.floor(i / cols) - sr / count) ** 2;
			if (d < bd) [bc, br, bd] = [i % cols, Math.floor(i / cols), d];
		}

	// visited: any tour route point inside the park
	const inside = (e, n) => {
		const c = Math.round((e - e0) / RES);
		const r = Math.round((n1 - n) / RES);
		return c >= 0 && r >= 0 && c < cols && r < rows && grid[r * cols + c] > 0;
	};
	const days = tour.days
		.filter((d) => d.lines.some((line) => line.some((_, k) => k % 2 === 0 && inside(line[k], line[k + 1]))))
		.map((d) => d.day);
	// by class there are many small reserves: keep the ones worth a label, and any the tour went through
	if (!names && !days.length && (count * RES * RES) / 1e6 < minKm2) continue;

	parks.push({
		name,
		days,
		visited: days.length > 0,
		label: { e: e0 + bc * RES, n: n1 - br * RES },
		areaKm2: Math.round((count * RES * RES) / 1e6),
		rings,
		_raster: { grid, cols, rows, e0, n1 }
	});
	console.log(`  ${name.padEnd(30)} ${String(Math.round((count * RES * RES) / 1e6)).padStart(5)} km²  ${rings.length} ring(s)  ${days.length ? 'days ' + days.map((d) => d.slice(8)).join(',') : '—'}`);
}

// ---------- mask on the backdrop grid ----------
const bg = region;
const mask = new Uint8Array(bg.cols * bg.rows);
parks.forEach((p, idx) => {
	const { grid, cols, rows, e0, n1 } = p._raster;
	for (let r = 0; r < bg.rows; r++) {
		const n = bg.n1 - r * bg.spacing;
		const pr = Math.round((n1 - n) / RES);
		if (pr < 0 || pr >= rows) continue;
		for (let c = 0; c < bg.cols; c++) {
			const pc = Math.round((bg.x0 + c * bg.spacing - e0) / RES);
			if (pc >= 0 && pc < cols && grid[pr * cols + pc]) mask[r * bg.cols + c] = idx + 1;
		}
	}
});

fs.writeFileSync(PATHS.parksBin, Buffer.from(mask.buffer));
fs.writeFileSync(
	PATHS.parksJson,
	JSON.stringify({ parks: parks.map(({ _raster, ...p }) => p) })
);
console.log(
	`Wrote ${PATHS.parksJson} (${(fs.statSync(PATHS.parksJson).size / 1024).toFixed(0)} KB): ${parks.length} parks, ${parks.filter((p) => p.visited).length} on the route`
);
