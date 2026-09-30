// L0: the backdrop terrain for the whole tour, a height grid in absolute projected metres. Always
// on for the tour overview and between days. The area, spacing and sea masks come from
// tour.config.json region.backdrop; by default it's the rides' extent plus 100 km, at whatever
// spacing keeps it under a million points.
// Output: static/data/tours/<id>/region/terrain.bin (Int16 decimetres, row 0 = north) + terrain.json
import fs from 'node:fs';
import path from 'node:path';
import { GPX_DIR, TerrariumSampler, fromGrid, readAllGpx, toGrid } from './lib/geo.mjs';
import { PATHS, TOUR } from './lib/tour.mjs';

const cfg = TOUR.region.backdrop ?? {};
const MARGIN = 100_000;
const MAX_POINTS = 1_000_000;

let extent = cfg.extent;
if (!extent) {
	// only a box around the rides leaves here, never a position
	const fixes = readAllGpx(fs.readdirSync(GPX_DIR).filter((f) => /\.gpx$/i.test(f)).map((f) => path.join(GPX_DIR, f)));
	if (!fixes.length) throw new Error(`No rides in ${GPX_DIR} to size the backdrop from (or set region.backdrop.extent)`);
	let [e0, n0, e1, n1] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const p of fixes) {
		const [e, n] = toGrid(p.lon, p.lat);
		(e0 = Math.min(e0, e)), (n0 = Math.min(n0, n)), (e1 = Math.max(e1, e)), (n1 = Math.max(n1, n));
	}
	extent = [e0 - MARGIN, n0 - MARGIN, e1 + MARGIN, n1 + MARGIN];
}
const SPACING = cfg.spacing ?? Math.max(250, Math.ceil(Math.sqrt(((extent[2] - extent[0]) * (extent[3] - extent[1])) / MAX_POINTS) / 250) * 250);
const [E0, N0, E1, N1] = [
	Math.floor(extent[0] / SPACING) * SPACING,
	Math.floor(extent[1] / SPACING) * SPACING,
	Math.ceil(extent[2] / SPACING) * SPACING,
	Math.ceil(extent[3] / SPACING) * SPACING
];

const cols = (E1 - E0) / SPACING + 1;
const rows = (N1 - N0) / SPACING + 1;
console.log(`${TOUR.region.name} grid ${cols} x ${rows} @ ${SPACING} m`);

const corners = [fromGrid(E0, N0), fromGrid(E1, N0), fromGrid(E0, N1), fromGrid(E1, N1)];
const bbox = [
	Math.min(...corners.map((c) => c[0])),
	Math.min(...corners.map((c) => c[1])),
	Math.max(...corners.map((c) => c[0])),
	Math.max(...corners.map((c) => c[1]))
];
// tiles a few times finer than the grid: Terrarium pixels are ~156 km * cos(lat) / 2^zoom
const midLat = (bbox[1] + bbox[3]) / 2;
const zoom = Math.max(5, Math.min(11, Math.round(Math.log2((156_543 * Math.cos((midLat * Math.PI) / 180)) / (SPACING / 3)))));
const dem = new TerrariumSampler('data/cache/terrarium', zoom);
await dem.prefetch(bbox);

// land that wasn't part of the tour (e.g. Ireland and the Continent around GB) as sea, so the
// backdrop ends at a coast rather than a hard edge
const sea = cfg.sea ?? [];
const isSea = (lon, lat) => sea.some(([a, b, c, d]) => lon > a && lat > b && lon < c && lat < d);

const grid = new Int16Array(cols * rows);
let maxH = -Infinity;
for (let r = 0; r < rows; r++)
	for (let c = 0; c < cols; c++) {
		const [lon, lat] = fromGrid(E0 + c * SPACING, N1 - r * SPACING);
		const h = isSea(lon, lat) ? -10 : dem.sample(lon, lat);
		grid[r * cols + c] = Math.round(Math.max(-3000, Math.min(3000, h)) * 10);
		if (h > maxH) maxH = h;
	}

fs.mkdirSync(PATHS.region, { recursive: true });
fs.writeFileSync(path.join(PATHS.region, 'terrain.bin'), Buffer.from(grid.buffer));
// same shape as a day's terrain.json, with the origin at 0,0
const meta = { originE: 0, originN: 0, x0: E0, n1: N1, cols, rows, spacing: SPACING, scale: 0.1, minH: 0, maxH };
fs.writeFileSync(path.join(PATHS.region, 'terrain.json'), JSON.stringify(meta, null, 2));
console.log(`Wrote ${PATHS.region}/terrain.bin (${(grid.byteLength / 1e6).toFixed(1)} MB, z${zoom} tiles), max ${maxH.toFixed(0)} m`);
