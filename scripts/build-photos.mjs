// Photos: resize for the web and place them on the tour.
//  - reads originals from data/photos-src/jpg (git-ignored)
//  - writes WebP thumbnails (320 px) and gallery images (1600 px) to static/photos/, rotated
//    upright and with ALL metadata stripped (no GPS or camera details in published files)
//  - places each photo: EXIF GPS if present, otherwise by its timestamp against that day's
//    track (Google Photos/Drive exports usually strip location). Photos taken before or after
//    the day's riding snap to its start or end (where you set off from / stayed).
// Output: static/photos/{thumb,large}/<id>.webp, static/data/photos.json
// Incremental: images already resized are skipped, so re-runs are quick.
import fs from 'node:fs';
import path from 'node:path';
import exifr from 'exifr';
import sharp from 'sharp';
import { inPrivacyZone, inPrivacyZoneAt, makeProjection, toBng } from './lib/geo.mjs';

const SRC = 'data/photos-src/jpg';
const OUT = 'static/photos';
const SIZES = { thumb: { px: 320, quality: 70 }, large: { px: 1600, quality: 80 } };
const CONCURRENCY = 4;

for (const s of Object.keys(SIZES)) fs.mkdirSync(path.join(OUT, s), { recursive: true });

// ---------- tracks, for time placement ----------
const DAYS = 'static/data/days';
const days = new Map();
for (const day of fs.readdirSync(DAYS)) {
	const dir = path.join(DAYS, day);
	if (!fs.existsSync(path.join(dir, 'track.json'))) continue;
	const meta = JSON.parse(fs.readFileSync(path.join(dir, 'terrain.json'), 'utf8'));
	const track = JSON.parse(fs.readFileSync(path.join(dir, 'track.json'), 'utf8'));
	days.set(day, { meta, track, proj: makeProjection(meta.originE, meta.originN) });
}
const lastLE = (arr, v) => {
	let lo = 0;
	let hi = arr.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (arr[mid] <= v) lo = mid;
		else hi = mid - 1;
	}
	return lo;
};
// the calendar day in UK time (a photo at 00:30 BST belongs to that date, not the UTC one)
const ukDate = (sec) => new Date(sec * 1000).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

// Privacy: photos taken inside a zone (judged from the unfiltered GPX at that moment, so photos
// at home before setting off or after arriving count) are dropped.
const takenInPrivacyZone = (t, gps) => (gps ? inPrivacyZone(gps.longitude, gps.latitude) : inPrivacyZoneAt(t));

function place(t, gps) {
	const day = days.get(ukDate(t));
	if (gps) {
		const [e, n] = toBng(gps.longitude, gps.latitude);
		return { day: day?.track.day ?? null, e: Math.round(e), n: Math.round(n), placedBy: 'gps' };
	}
	if (!day) return null;
	const { track: tr, meta } = day;
	const rel = t - tr.t0;
	const end = tr.t[tr.count - 1];
	const i = rel <= 0 ? 0 : rel >= end ? tr.count - 1 : lastLE(tr.t, rel);
	return {
		day: tr.day,
		i,
		rt: tr.rt[i],
		e: Math.round(tr.x[i] + meta.originE),
		n: Math.round(tr.n[i] + meta.originN),
		placedBy: rel < 0 || rel > end ? 'time-offride' : 'time'
	};
}

// ---------- process ----------
const files = fs.readdirSync(SRC).filter((f) => /\.jpe?g$/i.test(f)).sort();
const photos = [];
let private_ = 0;
let resized = 0;
let next = 0;
async function worker() {
	while (next < files.length) {
		const file = files[next++];
		const src = path.join(SRC, file);
		const id = path.basename(file, path.extname(file));
		const exif = await exifr.parse(src, { gps: true, pick: ['DateTimeOriginal', 'latitude', 'longitude'] }).catch(() => null);
		const t = exif?.DateTimeOriginal ? exif.DateTimeOriginal.getTime() / 1000 : null;
		const gps = Number.isFinite(exif?.latitude) ? exif : null;
		// privacy check before any resizing
		if (t != null && takenInPrivacyZone(t, gps)) {
			for (const size of Object.keys(SIZES)) fs.rmSync(path.join(OUT, size, `${id}.webp`), { force: true });
			private_++;
			continue;
		}

		let dims = null;
		try {
			for (const [size, { px, quality }] of Object.entries(SIZES)) {
				const out = path.join(OUT, size, `${id}.webp`);
				if (!fs.existsSync(out)) {
					// rotate() applies the EXIF orientation; sharp drops all metadata by default.
					// failOn 'none': phone JPEGs with minor header quirks still decode, as they do in viewers
					await sharp(src, { failOn: 'none' })
						.rotate()
						.resize(px, px, { fit: 'inside', withoutEnlargement: true })
						.webp({ quality })
						.toFile(out);
					resized++;
				}
				if (size === 'large') {
					const m = await sharp(out).metadata();
					dims = { w: m.width, h: m.height };
				}
			}
		} catch (e) {
			console.log(`  skipped ${file}: ${e.message}`);
			continue;
		}

		const where = t != null ? place(t, gps) : null;
		if (!where) {
			console.log(`  skipped ${file}: ${t == null ? 'no timestamp' : `no ride on ${ukDate(t)}`}`);
			continue;
		}
		photos.push({ id, t, ...dims, ...where });
		if ((photos.length + 1) % 50 === 0) process.stdout.write(`  ${photos.length}/${files.length}\r`);
	}
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

photos.sort((a, b) => a.t - b.t);
fs.writeFileSync('static/data/photos.json', JSON.stringify({ photos }));
const by = (k) => photos.filter((p) => p.placedBy === k).length;
const bytes = (dir) => fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
console.log(
	`\nWrote static/data/photos.json: ${photos.length} photos (${by('gps')} by GPS, ${by('time')} by time on the ride, ${by('time-offride')} off the bike); ${private_} withheld (privacy zones); resized ${resized} images`
);
console.log(`  thumbs ${(bytes(path.join(OUT, 'thumb')) / 1e6).toFixed(1)} MB, gallery ${(bytes(path.join(OUT, 'large')) / 1e6).toFixed(1)} MB`);
