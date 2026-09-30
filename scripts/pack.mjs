// Gzip every day file (static/data/tours/<id>/days/*/*.{bin,json}) and the backdrop (static/data/tours/<id>/region) to a
// .gz beside it for deployment.
// Static hosts compress JSON on the fly but not .bin, and uploading pre-compressed copies cuts
// the deployment by several times; the app prefers the .gz and decompresses it in the browser.
// The plain files stay (the build scripts read them) and are dropped from the deployed output
// by scripts/deploy.mjs. Incremental: only re-packs files newer than their .gz.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PATHS } from './lib/tour.mjs';

const DAYS = PATHS.days;
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
		if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
			fs.writeFileSync(out, zlib.gzipSync(fs.readFileSync(src), { level: 9 }));
			packed++;
		}
		raw += size;
		gz += fs.statSync(out).size;
	}
console.log(`Packed ${packed} files; days + backdrop ${(raw / 1e6).toFixed(0)} MB -> ${(gz / 1e6).toFixed(0)} MB gzipped`);
