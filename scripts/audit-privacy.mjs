// Audit: scan everything the site serves for personal positions inside the privacy zones.
//   node scripts/audit-privacy.mjs   (exit code 1 if anything leaks)
// Checks every day's track, corridor raster, pins and ride-matched roads (plain and packed .gz
// copies), the tour overview lines, and photo positions + files; then the words: no zone's name
// in any title, pin, feed entry, story or place label, and no place label near a zone.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fromBng, inPrivacyZone, nearPrivacyZone, PRIVACY_MARGIN, privacyZoneNames } from './lib/geo.mjs';

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

if (fs.existsSync('static/data/blog.json'))
	for (const p of JSON.parse(fs.readFileSync('static/data/blog.json', 'utf8')).posts) check(`post ${p.slug}`, p.e, p.n);

const photos = JSON.parse(fs.readFileSync('static/data/photos.json', 'utf8')).photos;
for (const p of photos) check(`photo ${p.id}`, p.e, p.n);
const listed = new Set(photos.map((p) => p.id));
for (const size of ['thumb', 'medium', 'large'])
	for (const f of fs.readdirSync(`static/photos/${size}`))
		if (!listed.has(path.basename(f, '.webp'))) {
			leaks++;
			console.log(`LEAK unlisted photo file static/photos/${size}/${f}`);
		}

// ---- words: the zones' names, and place labels near them ----
// A title like "Risca → …" says where family live as plainly as a route would. Checked in every
// text people read: day titles, the feed (titles, "near …" places, pins), stories, pins and place
// labels. Road names are left out: "Bristol Road" in another town says nothing about Bristol.
const names = privacyZoneNames();
// exact: map labels, where "Bristol Channel" or "Stockland Bristol" are other places (anything
// near a zone is caught by position below); otherwise the name anywhere as a word
const named = (what, text, exact = false) => {
	for (const name of names)
		if (text && (exact ? text.toLowerCase() === name.toLowerCase() : new RegExp(`\\b${name}\\b`, 'i').test(text))) {
			leaks++;
			console.log(`LEAK ${what} names "${name}": ${String(text).slice(0, 80)}`);
		}
};
let labels = 0;
for (const d of tour.days) named(`tour title ${d.day}`, d.title);
if (fs.existsSync('static/data/feed.json'))
	for (const d of JSON.parse(fs.readFileSync('static/data/feed.json', 'utf8')).days) {
		named(`feed title ${d.day}`, d.title);
		for (const e of d.events) named(`feed ${d.day}`, [e.place, e.pin?.title, e.pin?.body].filter(Boolean).join(' · '));
	}
if (fs.existsSync('static/data/blog.json'))
	for (const p of JSON.parse(fs.readFileSync('static/data/blog.json', 'utf8')).posts) named(`post ${p.slug}`, `${p.title} ${p.excerpt} ${p.html}`);
for (const day of fs.readdirSync(DAYS)) {
	const f = (name) => path.join(DAYS, day, name);
	const meta = JSON.parse(read(f('terrain.json')));
	named(`${day} track title`, JSON.parse(read(f('track.json'))).title);
	for (const p of JSON.parse(read(f('pins.json')))) named(`${day} pin`, `${p.title} ${p.body}`);
	if (fs.existsSync(f('osm.json')))
		for (const p of JSON.parse(read(f('osm.json'))).places) {
			labels++;
			named(`${day} place label`, p.name, true);
			const [lon, lat] = fromBng(p.x + meta.originE, p.n + meta.originN);
			if (nearPrivacyZone(lon, lat, PRIVACY_MARGIN)) {
				if (leaks++ < 20) console.log(`LEAK ${day} place label "${p.name}" within ${PRIVACY_MARGIN / 1000} km of a privacy zone`);
			}
		}
}

console.log(`${checked.toLocaleString()} positions checked, ${leaks} inside privacy zones`);
console.log(`${labels.toLocaleString()} place labels and every title, pin, feed entry and story checked for zone names`);
process.exit(leaks ? 1 : 0);
