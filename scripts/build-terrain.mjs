// Builds one day's height grid (British National Grid metres, relative to the day's origin)
// covering the day's rides plus a margin. Spacing adapts to the day's size so every day stays
// around MAX_CELLS; the app streams full-resolution terrain around the bike separately.
// Output: static/data/days/<day>/terrain.bin (Int16, decimetres, row 0 = north) + terrain.json
import fs from 'node:fs';
import { TerrariumSampler, dayContext, inPrivacyZone, makeProjection, readAllGpx, toBng } from './lib/geo.mjs';

const MARGIN = 8000; // metres around the ride bbox
const MAX_CELLS = 3_200_000;

const ctx = dayContext();
// extent from fixes outside the privacy zones only (so the grid isn't centred on them)
const pts = readAllGpx(ctx.files).filter((p) => !inPrivacyZone(p.lon, p.lat));
if (!pts.length) throw new Error(`No GPX fixes for ${ctx.day}`);

const bng = pts.map((p) => toBng(p.lon, p.lat));
const minE = Math.min(...bng.map((b) => b[0])) - MARGIN;
const maxE = Math.max(...bng.map((b) => b[0])) + MARGIN;
const minN = Math.min(...bng.map((b) => b[1])) - MARGIN;
const maxN = Math.max(...bng.map((b) => b[1])) + MARGIN;

// 25 m for compact days, coarser (in 25 m steps) for the big ones
const spacing = Math.max(25, Math.ceil(Math.sqrt(((maxE - minE) * (maxN - minN)) / MAX_CELLS) / 25) * 25);
// origin: bbox centre on a whole kilometre, so day grids line up predictably
const originE = Math.round((minE + maxE) / 2000) * 1000;
const originN = Math.round((minN + maxN) / 2000) * 1000;
const proj = makeProjection(originE, originN);

const x0 = Math.floor((minE - originE) / spacing) * spacing;
const n1 = Math.ceil((maxN - originN) / spacing) * spacing; // north edge
const cols = Math.ceil((maxE - originE - x0) / spacing) + 1;
const rows = Math.ceil((n1 - (minN - originN)) / spacing) + 1;
console.log(
	`${ctx.day}: grid ${cols} x ${rows} @ ${spacing} m (${((cols * spacing) / 1000).toFixed(0)} x ${((rows * spacing) / 1000).toFixed(0)} km), origin ${originE}E ${originN}N`
);

// sample the DEM at roughly the grid resolution (Terrarium z12 ≈ 22 m/px at UK latitudes)
const zoom = spacing <= 30 ? 12 : spacing <= 90 ? 11 : 10;
const dem = new TerrariumSampler('data/cache/terrarium', zoom);
const corners = [
	proj.inverse(x0, n1),
	proj.inverse(x0 + (cols - 1) * spacing, n1),
	proj.inverse(x0, n1 - (rows - 1) * spacing),
	proj.inverse(x0 + (cols - 1) * spacing, n1 - (rows - 1) * spacing)
];
await dem.prefetch([
	Math.min(...corners.map((c) => c[0])),
	Math.min(...corners.map((c) => c[1])),
	Math.max(...corners.map((c) => c[0])),
	Math.max(...corners.map((c) => c[1]))
]);

const grid = new Int16Array(cols * rows);
let minH = Infinity;
let maxH = -Infinity;
for (let r = 0; r < rows; r++) {
	for (let c = 0; c < cols; c++) {
		const [lon, lat] = proj.inverse(x0 + c * spacing, n1 - r * spacing);
		const h = dem.sample(lon, lat);
		grid[r * cols + c] = Math.round(h * 10);
		if (h < minH) minH = h;
		if (h > maxH) maxH = h;
	}
}

fs.writeFileSync(ctx.file('terrain.bin'), Buffer.from(grid.buffer));
const meta = { originE, originN, x0, n1, cols, rows, spacing, scale: 0.1, minH, maxH };
fs.writeFileSync(ctx.file('terrain.json'), JSON.stringify(meta, null, 2));
console.log(`  wrote terrain.bin (${(grid.byteLength / 1e6).toFixed(1)} MB), h ${minH.toFixed(0)}..${maxH.toFixed(0)} m`);
