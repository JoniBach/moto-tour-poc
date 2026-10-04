// Blog posts: Markdown files in content/blog/, each tied to a moment of the ride.
//
//   ---
//   title: Up and over Honister
//   time: 2026-09-16 11:30        # the tour's local time (or full ISO); the post goes where the bike was
//   cover: 20260916_113010        # optional: a photo id for the header image
//   slug: 2026-09-16-honister     # optional: its address (default: the file name)
//   published: 2026-10-04         # optional: when it went out (default: when its file was first committed)
//   ---
//   Markdown body. Photos from the tour can be embedded by id:
//   ![Looking down Borrowdale](photo:20260916_115051)
//
// Each post is placed by its time against that day's track (like photos), rendered to HTML, and
// written to static/data/tours/<id>/blog.json. Posts whose moment falls inside a privacy zone are refused
// (with a message), and photos withheld for privacy are removed from posts.
// Files starting with "_" are drafts and skipped.
import { execFileSync } from 'node:child_process';
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
const moment = (day, time, end) => `/${TOUR.slug ?? TOUR.id}/day/${day}?t=${time}${end ? `&to=${end}` : ""}`;
const photoSrc = (id) => `/${TOUR.slug ?? TOUR.id}/photos/${TOUR.id}/large/${id}.webp`;

/**
 * When a story went out (epoch seconds): its header's "published" if it has one, else when its file
 * was first committed, else now (not committed yet). The RSS feed, and the mailing list that reads
 * it, go by this: a story about September that goes out in October is new in October.
 */
function publishedOf(file, data) {
	const own = data.published ? Date.parse(data.published) : NaN;
	if (Number.isFinite(own)) return Math.round(own / 1000);
	try {
		const added = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%at', '--', path.join(SRC, file)], { encoding: 'utf8' })
			.split('\n')
			.filter(Boolean);
		if (added.length) return +added.at(-1);
	} catch {
		// not a git checkout: now
	}
	return Math.round(Date.now() / 1000);
}

/** the tour's days, in order (for stories before and after the trip) */
const tourDays = fs.existsSync(PATHS.tourJson) ? JSON.parse(fs.readFileSync(PATHS.tourJson, 'utf8')).days : [];

fs.mkdirSync(SRC, { recursive: true });
const posts = [];
for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort()) {
	const { data, body } = frontmatter(fs.readFileSync(path.join(SRC, file), 'utf8'));
	// the header's slug if it has one (the story editor saves timestamped copies), else the file name
	const slug = data.slug || file.replace(/\.md$/, '');
	// before / after the trip: pinned to where it set off / ended (the first day's start, the last
	// day's end); its own date, if it has one, is just shown
	const when = data.when === 'before' || data.when === 'after' ? data.when : null;
	if (when) {
		if (!data.title) {
			console.log(`  skipped ${file}: needs a "title"`);
			continue;
		}
		const day = (when === 'before' ? tourDays[0] : tourDays.at(-1))?.day;
		const d = day && track(day);
		if (!d) {
			console.log(`  skipped ${file}: the tour has no days yet`);
			continue;
		}
		const { tr, meta } = d;
		const i = when === 'before' ? 0 : tr.count - 1;
		const own = data.time ? parseTourTime(/^\d{4}-\d{2}-\d{2}$/.test(data.time) ? `${data.time} 12:00` : data.time) : NaN;
		const { html, withheld } = renderStory(body, { photos, src: photoSrc, moment });
		if (withheld.length) console.log(`  ${file}: removed photo(s) ${withheld.join(', ')} (unknown or withheld)`);
		const text = plainText(body);
		posts.push({
			slug,
			title: data.title,
			// a second before setting off / after arriving, so they bookend the trip in the day's events
			t: tr.t0 + tr.t[i] + (when === 'before' ? -1 : 1),
			day,
			i,
			rt: tr.rt[i],
			e: Math.round(tr.x[i] + meta.originE),
			n: Math.round(tr.n[i] + meta.originN),
			cover: data.cover && photos.has(data.cover) ? data.cover : null,
			excerpt: excerptOf(text),
			minutes: minutesOf(text),
			html,
			published: publishedOf(file, data),
			when,
			...(Number.isFinite(own) ? { date: own } : {})
		});
		continue;
	}
	const t = parseTourTime(data.time ?? '');
	if (!data.title || !Number.isFinite(t)) {
		console.log(`  skipped ${file}: needs "title" and "time" (e.g. time: 2026-09-16 11:30), or "when: before" / "when: after"`);
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
		html,
		published: publishedOf(file, data)
	});
}
posts.sort((a, b) => a.t - b.t);
fs.writeFileSync(PATHS.blogJson, JSON.stringify({ posts }));
console.log(`Wrote ${PATHS.blogJson}: ${posts.length} post(s)`);
for (const p of posts) console.log(`  ${p.when ? `${p.when.padEnd(10)}` : p.day} ${new Date(p.t * 1000).toLocaleTimeString(TOUR.locale, { timeZone: TOUR.timeZone, hour: '2-digit', minute: '2-digit' })}  ${p.title}`);
