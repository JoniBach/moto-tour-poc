// National parks of Great Britain (OpenMapTiles `park` layer, z9 tiles) for the tour overview:
//  - each park is rasterised at 200 m within its own box, then traced (d3-contour) into a clean
//    outline: the tile-clipped polygons would otherwise show seams along tile edges
//  - a 1 km mask aligned with the UK grid (park index + 1 per cell) for tinting the UK points
//  - which parks the tour passed through, from tour.json's route lines
// Output: static/data/uk/parks.json, static/data/uk/parks.bin
// Run after build-uk and build-tour.
import fs from 'node:fs';
import { contours } from 'd3';
import { fromBng, toBng } from './lib/geo.mjs';
import { readTiles, tileOf } from './lib/vtiles.mjs';

const RES = 200; // metres per cell of each park's raster
const SIMPLIFY = 350; // metres between kept outline points

// OSM name -> display name (English names as used on the tour)
const PARKS = {
	'Bannau Brycheiniog National Park': 'Brecon Beacons',
	'Cairngorms National Park': 'Cairngorms',
	'Dartmoor National Park': 'Dartmoor',
	'Exmoor National Park': 'Exmoor',
	'Lake District National Park': 'Lake District',
	'Loch Lomond and The Trossachs National Park': 'Loch Lomond & The Trossachs',
	'New Forest National Park': 'New Forest',
	'North York Moors National Park': 'North York Moors',
	'Northumberland National Park': 'Northumberland',
	'Parc Cenedlaethol Eryri': 'Snowdonia',
	'Peak District National Park': 'Peak District',
	'Pembrokeshire Coast National Park': 'Pembrokeshire Coast',
	'South Downs National Park': 'South Downs',
	'The Broads': 'The Broads',
	'Yorkshire Dales National Park': 'Yorkshire Dales'
};

// ---------- collect polygon pieces per park (BNG metres) ----------
const Z = 9;
const [tx0, ty0] = tileOf(-8.2, 60.9, Z);
const [tx1, ty1] = tileOf(1.8, 49.8, Z);
const tiles = [];
for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) tiles.push([Z, x, y]);
console.log(`Parks: reading ${tiles.length} z${Z} tiles`);

const pieces = new Map(); // name -> [[ring, ring…], …] in BNG
await readTiles(tiles, ['park'], (_, f) => {
	const name = PARKS[f.properties.name];
	if (!name) return;
	const g = f.geometry;
	const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
	for (const poly of polys) {
		if (!pieces.has(name)) pieces.set(name, []);
		pieces.get(name).push(poly.map((ring) => ring.map(([lon, lat]) => toBng(lon, lat))));
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

const tour = JSON.parse(fs.readFileSync('static/data/tour.json', 'utf8'));
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

// ---------- 1 km mask on the UK grid ----------
const uk = JSON.parse(fs.readFileSync('static/data/uk/terrain.json', 'utf8'));
const mask = new Uint8Array(uk.cols * uk.rows);
parks.forEach((p, idx) => {
	const { grid, cols, rows, e0, n1 } = p._raster;
	for (let r = 0; r < uk.rows; r++) {
		const n = uk.n1 - r * uk.spacing;
		const pr = Math.round((n1 - n) / RES);
		if (pr < 0 || pr >= rows) continue;
		for (let c = 0; c < uk.cols; c++) {
			const pc = Math.round((uk.x0 + c * uk.spacing - e0) / RES);
			if (pc >= 0 && pc < cols && grid[pr * cols + pc]) mask[r * uk.cols + c] = idx + 1;
		}
	}
});

fs.writeFileSync('static/data/uk/parks.bin', Buffer.from(mask.buffer));
fs.writeFileSync(
	'static/data/uk/parks.json',
	JSON.stringify({ parks: parks.map(({ _raster, ...p }) => p) })
);
console.log(
	`Wrote static/data/uk/parks.json (${(fs.statSync('static/data/uk/parks.json').size / 1024).toFixed(0)} KB): ${parks.length} parks, ${parks.filter((p) => p.visited).length} on the route`
);
