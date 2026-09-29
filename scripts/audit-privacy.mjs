// Audit: scan everything the site serves for personal positions inside the privacy zones.
//   node scripts/audit-privacy.mjs   (exit code 1 if anything leaks)
// Checks every day's track, corridor raster, pins and ride-matched roads (plain and packed .gz
// copies), the tour overview lines, and photo positions + files. Map data (roads, place names)
// inside a zone is public and not personal, so it's not checked.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fromBng, inPrivacyZone } from './lib/geo.mjs';

let leaks = 0;
let checked = 0;
const check = (what, e, n) => {
	checked++;
	const [lon, lat] = fromBng(e, n);
	if (inPrivacyZone(lon, lat)) {
		if (leaks++ < 10) console.log(`LEAK ${what} at ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
	}
};
const read = (file) => {
	const buf = fs.readFileSync(file);
	return file.endsWith('.gz') ? zlib.gunzipSync(buf) : buf;
};

const DAYS = 'static/data/days';
for (const day of fs.readdirSync(DAYS)) {
	for (const variant of ['', '.gz']) {
		const f = (name) => path.join(DAYS, day, name + variant);
		if (!fs.existsSync(f('track.json'))) continue;
		const meta = JSON.parse(read(f('terrain.json')));
		const tr = JSON.parse(read(f('track.json')));
		for (let i = 0; i < tr.count; i++) check(`${day} track${variant}`, tr.x[i] + meta.originE, tr.n[i] + meta.originN);
		for (const p of JSON.parse(read(f('pins.json')))) check(`${day} pin${variant}`, p.x + meta.originE, p.n + meta.originN);
		// corridor raster: cells on the route (distance 0)
		const cor = read(f('corridor.bin'));
		for (let r = 0; r < meta.rows; r++)
			for (let c = 0; c < meta.cols; c++)
				if (cor[r * meta.cols + c] === 0) check(`${day} corridor${variant}`, meta.originE + meta.x0 + c * meta.spacing, meta.originN + meta.n1 - r * meta.spacing);
	}
}
const tour = JSON.parse(fs.readFileSync('static/data/tour.json', 'utf8'));
for (const d of tour.days) for (const line of d.lines) for (let k = 0; k < line.length; k += 2) check(`tour line ${d.day}`, line[k], line[k + 1]);

const photos = JSON.parse(fs.readFileSync('static/data/photos.json', 'utf8')).photos;
for (const p of photos) check(`photo ${p.id}`, p.e, p.n);
const listed = new Set(photos.map((p) => p.id));
for (const size of ['thumb', 'large'])
	for (const f of fs.readdirSync(`static/photos/${size}`))
		if (!listed.has(path.basename(f, '.webp'))) {
			leaks++;
			console.log(`LEAK unlisted photo file static/photos/${size}/${f}`);
		}

console.log(`${checked.toLocaleString()} positions checked, ${leaks} inside privacy zones`);
process.exit(leaks ? 1 : 0);
