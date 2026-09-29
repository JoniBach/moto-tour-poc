// Gzip every day file (static/data/days/*/*.{bin,json}) to a .gz beside it for deployment.
// Static hosts compress JSON on the fly but not .bin, and uploading pre-compressed copies cuts
// the deployment by several times; the app prefers the .gz and decompresses it in the browser.
// The plain files stay (the build scripts read them) and are dropped from the deployed output
// by scripts/deploy.mjs. Incremental: only re-packs files newer than their .gz.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DAYS = 'static/data/days';
let packed = 0;
let raw = 0;
let gz = 0;
for (const day of fs.readdirSync(DAYS))
	for (const f of fs.readdirSync(path.join(DAYS, day))) {
		if (!/\.(bin|json)$/.test(f)) continue;
		const src = path.join(DAYS, day, f);
		const out = `${src}.gz`;
		const size = fs.statSync(src).size;
		if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
			fs.writeFileSync(out, zlib.gzipSync(fs.readFileSync(src), { level: 9 }));
			packed++;
		}
		raw += size;
		gz += fs.statSync(out).size;
	}
console.log(`Packed ${packed} files; days ${(raw / 1e6).toFixed(0)} MB -> ${(gz / 1e6).toFixed(0)} MB gzipped`);
