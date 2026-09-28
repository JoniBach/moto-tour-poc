// Builds a regular height grid (local metres) covering every GPX in data/raw plus a margin.
// Output: static/data/terrain.bin (Int16, decimetres, row 0 = north) + terrain.json (grid meta).
import fs from 'node:fs';
import { TerrariumSampler, makeProjection, readAllGpx } from './lib/geo.mjs';

const SPACING = 25; // metres per cell
const MARGIN = 8000; // metres around the ride bbox

const pts = readAllGpx('data/raw');
if (!pts.length) throw new Error('No GPX fixes found in data/raw');

const lons = pts.map((p) => p.lon);
const lats = pts.map((p) => p.lat);
const minLon = Math.min(...lons);
const maxLon = Math.max(...lons);
const minLat = Math.min(...lats);
const maxLat = Math.max(...lats);
const proj = makeProjection((minLon + maxLon) / 2, (minLat + maxLat) / 2);

const [ex0, en0] = proj.forward(minLon, minLat);
const [ex1, en1] = proj.forward(maxLon, maxLat);
const x0 = Math.floor((ex0 - MARGIN) / SPACING) * SPACING;
const n1 = Math.ceil((en1 + MARGIN) / SPACING) * SPACING; // north edge
const cols = Math.ceil((ex1 + MARGIN - x0) / SPACING) + 1;
const rows = Math.ceil((n1 - (en0 - MARGIN)) / SPACING) + 1;
console.log(`Grid ${cols} x ${rows} @ ${SPACING} m (${((cols * SPACING) / 1000).toFixed(1)} x ${((rows * SPACING) / 1000).toFixed(1)} km)`);

const dem = new TerrariumSampler('data/cache/terrarium', 12);
const [bl0, bb0] = proj.inverse(x0, n1 - (rows - 1) * SPACING);
const [bl1, bb1] = proj.inverse(x0 + (cols - 1) * SPACING, n1);
await dem.prefetch([bl0, bb0, bl1, bb1]);

const grid = new Int16Array(cols * rows);
let minH = Infinity;
let maxH = -Infinity;
for (let r = 0; r < rows; r++) {
	for (let c = 0; c < cols; c++) {
		const [lon, lat] = proj.inverse(x0 + c * SPACING, n1 - r * SPACING);
		const h = dem.sample(lon, lat);
		grid[r * cols + c] = Math.round(h * 10);
		if (h < minH) minH = h;
		if (h > maxH) maxH = h;
	}
}

fs.mkdirSync('static/data', { recursive: true });
fs.writeFileSync('static/data/terrain.bin', Buffer.from(grid.buffer));
const meta = { lon0: proj.lon0, lat0: proj.lat0, x0, n1, cols, rows, spacing: SPACING, scale: 0.1, minH, maxH };
fs.writeFileSync('static/data/terrain.json', JSON.stringify(meta, null, 2));
console.log(`Wrote static/data/terrain.bin (${(grid.byteLength / 1e6).toFixed(1)} MB), h ${minH.toFixed(0)}..${maxH.toFixed(0)} m`);
