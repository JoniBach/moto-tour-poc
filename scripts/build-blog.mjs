// Blog posts: Markdown files in content/blog/, each tied to a moment of the ride.
//
//   ---
//   title: Up and over Honister
//   time: 2026-09-16 11:30        # the tour's local time (or full ISO); the post goes where the bike was
//   cover: 20260916_113010        # optional: a photo id for the header image
//   slug: 2026-09-16-honister     # optional: its address (default: the file name)
//   ---
//   Markdown body. Photos from the tour can be embedded by id:
//   ![Looking down Borrowdale](photo:20260916_115051)
//
// Each post is placed by its time against that day's track (like photos), rendered to HTML, and
// written to static/data/tours/<id>/blog.json. Posts whose moment falls inside a privacy zone are refused
// (with a message), and photos withheld for privacy are removed from posts.
// Files starting with "_" are drafts and skipped.
import fs from 'node:fs';
import path from 'node:path';
import { excerptOf, frontmatter, minutesOf, plainText, renderStory } from '../src/lib/story.js';
import { inPrivacyZoneAt, parseTourTime, tourDate } from './lib/geo.mjs';
import { PATHS, TOUR } from './lib/tour.mjs';

const SRC = PATHS.blogSrc;
const DAYS = PATHS.days;

const photos = fs.existsSync(PATHS.photosJson)
	? new Map(JSON.parse(fs.readFileSync(PATHS.photosJson, 'utf8')).photos.map((p) => [p.id, p]))
	: new Map();

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
const tracks = new Map();
function track(day) {
	if (!tracks.has(day)) {
		const dir = path.join(DAYS, day);
		tracks.set(
			day,
			fs.existsSync(path.join(dir, 'track.json'))
				? {
						meta: JSON.parse(fs.readFileSync(path.join(dir, 'terrain.json'), 'utf8')),
						tr: JSON.parse(fs.readFileSync(path.join(dir, 'track.json'), 'utf8'))
					}
				: null
		);
	}
	return tracks.get(day);
}

// photo embeds: ![caption](photo:ID) -> the gallery-size image (src/lib/story.js)
// places linked to a moment: [the Lakes](tour:2026-09-16T10:29) -> the tour at that moment (src/lib/blog.ts mapLink)
const moment = (day, time) => `/${TOUR.slug ?? TOUR.id}/day/${day}?t=${time}`;
const photoSrc = (id) => `/${TOUR.slug ?? TOUR.id}/photos/${TOUR.id}/large/${id}.webp`;

fs.mkdirSync(SRC, { recursive: true });
const posts = [];
for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort()) {
	const { data, body } = frontmatter(fs.readFileSync(path.join(SRC, file), 'utf8'));
	// the header's slug if it has one (the story editor saves timestamped copies), else the file name
	const slug = data.slug || file.replace(/\.md$/, '');
	const t = parseTourTime(data.time ?? '');
	if (!data.title || !Number.isFinite(t)) {
		console.log(`  skipped ${file}: needs "title" and "time" (e.g. time: 2026-09-16 11:30)`);
		continue;
	}
	if (inPrivacyZoneAt(t)) {
		console.log(`  skipped ${file}: its moment is inside a privacy zone`);
		continue;
	}
	const day = tourDate(t);
	const d = track(day);
	if (!d) {
		console.log(`  skipped ${file}: no ride on ${day}`);
		continue;
	}
	const { tr, meta } = d;
	const rel = t - tr.t0;
	const i = rel <= 0 ? 0 : lastLE(tr.t, rel);
	const { html, withheld } = renderStory(body, { photos, src: photoSrc, moment });
	if (withheld.length) console.log(`  ${file}: removed photo(s) ${withheld.join(', ')} (unknown or withheld)`);
	const text = plainText(body);
	const cover = data.cover && photos.has(data.cover) ? data.cover : null;
	posts.push({
		slug,
		title: data.title,
		t,
		day,
		i,
		rt: tr.rt[i],
		e: Math.round(tr.x[i] + meta.originE),
		n: Math.round(tr.n[i] + meta.originN),
		cover,
		excerpt: excerptOf(text),
		minutes: minutesOf(text),
		html
	});
}
posts.sort((a, b) => a.t - b.t);
fs.writeFileSync(PATHS.blogJson, JSON.stringify({ posts }));
console.log(`Wrote ${PATHS.blogJson}: ${posts.length} post(s)`);
for (const p of posts) console.log(`  ${p.day} ${new Date(p.t * 1000).toLocaleTimeString(TOUR.locale, { timeZone: TOUR.timeZone, hour: '2-digit', minute: '2-digit' })}  ${p.title}`);
