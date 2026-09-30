// Gzip every day file (static/data/tours/<id>/days/*/*.{bin,json}) and the backdrop (static/data/tours/<id>/region) to a
// .gz beside it for deployment.
// Static hosts compress JSON on the fly but not .bin, and uploading pre-compressed copies cuts
// the deployment by several times; the app prefers the .gz and decompresses it in the browser.
// The plain files stay (the build scripts read them) and are dropped from the deployed output
// by scripts/deploy.mjs. Incremental: only re-packs files newer than their .gz.
// Height grids (terrain.bin) are packed smaller still: rounded to half a metre (the elevation
// source isn't finer than that), stored as the change from the cell to the left, split into
// low and high byte planes, then gzipped: about a third of the size of gzipping them as they are.
// src/lib/data.ts (heightsFrom) reads either form.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PATHS } from './lib/tour.mjs';

const DAYS = PATHS.days;
/** half-metre steps, in the grid's own units (decimetres) */
const STEP = 5;
const MAGIC = Buffer.from('MTDELTA1');

/** Int16 heights (row-major, `cols` wide) -> MAGIC · uint8 step · uint32 count · low bytes · high bytes */
function packHeights(buf, cols) {
	const h = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
	const n = h.length;
	const out = Buffer.alloc(MAGIC.length + 5 + n * 2);
	MAGIC.copy(out, 0);
	out.writeUInt8(STEP, MAGIC.length);
	out.writeUInt32LE(n, MAGIC.length + 1);
	const base = MAGIC.length + 5;
	let prev = 0;
	for (let i = 0; i < n; i++) {
		const v = Math.round(h[i] / STEP);
		const d = (i % cols ? v - prev : v) & 0xffff;
		prev = v;
		out[base + i] = d & 0xff;
		out[base + n + i] = d >> 8;
	}
	return out;
}
let packed = 0;
let raw = 0;
let gz = 0;
// every day's files, the tour's own (parks mask, …) and the region backdrop
const dirs = [...fs.readdirSync(DAYS).map((day) => path.join(DAYS, day)), PATHS.out, PATHS.region];
for (const dir of dirs)
	for (const f of fs.readdirSync(dir)) {
		if (!/\.(bin|json)$/.test(f)) continue;
		const src = path.join(dir, f);
		const out = `${src}.gz`;
		const size = fs.statSync(src).size;
		const stale = !fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs;
		// height grids: re-pack if stale or still in the plain form
		const heights = f === 'terrain.bin';
		const plainGz = heights && !stale && !zlib.gunzipSync(fs.readFileSync(out)).subarray(0, MAGIC.length).equals(MAGIC);
		if (stale || plainGz) {
			let data = fs.readFileSync(src);
			if (heights) data = packHeights(data, JSON.parse(fs.readFileSync(path.join(dir, 'terrain.json'), 'utf8')).cols);
			fs.writeFileSync(out, zlib.gzipSync(data, { level: 9 }));
			packed++;
		}
		raw += size;
		gz += fs.statSync(out).size;
	}
console.log(`Packed ${packed} files; days + backdrop ${(raw / 1e6).toFixed(0)} MB -> ${(gz / 1e6).toFixed(0)} MB gzipped`);
