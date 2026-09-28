// L0: the whole of Great Britain as a 1 km height grid in absolute British National Grid metres.
// Always-on backdrop for the tour overview and between days.
// Output: static/data/uk/terrain.bin (Int16 decimetres, row 0 = north) + terrain.json
import fs from 'node:fs';
import { TerrariumSampler, fromBng } from './lib/geo.mjs';

const SPACING = 1000;
// BNG extent of GB including Scilly and Shetland (metres)
const E0 = 0;
const E1 = 700_000;
const N0 = 0;
const N1 = 1_250_000;

const cols = (E1 - E0) / SPACING + 1;
const rows = (N1 - N0) / SPACING + 1;
console.log(`UK grid ${cols} x ${rows} @ ${SPACING} m`);

const dem = new TerrariumSampler('data/cache/terrarium', 8);
const corners = [fromBng(E0, N0), fromBng(E1, N0), fromBng(E0, N1), fromBng(E1, N1)];
await dem.prefetch([
	Math.min(...corners.map((c) => c[0])),
	Math.min(...corners.map((c) => c[1])),
	Math.max(...corners.map((c) => c[0])),
	Math.max(...corners.map((c) => c[1]))
]);

// The BNG box clips into Ireland, which wasn't part of the tour and leaves a hard edge: treat it
// as sea. Two boxes cover Northern Ireland (incl. Rathlin and the Ards peninsula) without touching
// Kintyre (-5.8, 55.3), Islay (55.6+) or the Rhins of Galloway (east of -5.2).
const isIreland = (lon, lat) => (lon < -5.95 && lat < 55.4) || (lon < -5.35 && lat < 54.95);

const grid = new Int16Array(cols * rows);
let maxH = -Infinity;
for (let r = 0; r < rows; r++)
	for (let c = 0; c < cols; c++) {
		const [lon, lat] = fromBng(E0 + c * SPACING, N1 - r * SPACING);
		const h = isIreland(lon, lat) ? -10 : dem.sample(lon, lat);
		grid[r * cols + c] = Math.round(Math.max(-3000, Math.min(3000, h)) * 10);
		if (h > maxH) maxH = h;
	}

fs.mkdirSync('static/data/uk', { recursive: true });
fs.writeFileSync('static/data/uk/terrain.bin', Buffer.from(grid.buffer));
// same shape as a day's terrain.json, with the origin at BNG 0,0
const meta = { originE: 0, originN: 0, x0: E0, n1: N1, cols, rows, spacing: SPACING, scale: 0.1, minH: 0, maxH };
fs.writeFileSync('static/data/uk/terrain.json', JSON.stringify(meta, null, 2));
console.log(`Wrote static/data/uk/terrain.bin (${(grid.byteLength / 1e6).toFixed(1)} MB), max ${maxH.toFixed(0)} m`);
