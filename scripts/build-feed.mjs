// The blog's feed: every day's events (the same list as the app's events drawer, from
// src/lib/events-core.js) with light, readable context — nearest town/village, the day's
// national parks and weather — so the blog never has to load the heavy 3D day data.
// Place names are left out near privacy zones. No coordinates are written.
// Output: static/data/feed.json. Run after build-tour, build-photos, build-blog and build-parks.
import fs from 'node:fs';
import path from 'node:path';
import { dayEventsCore } from '../src/lib/events-core.js';
import { makeProjection, nearPrivacyZone, PRIVACY_MARGIN } from './lib/geo.mjs';

const DAYS = 'static/data/days';
const PLACE_WITHIN = 6000; // metres: nearest town/village used as "near …"

const read = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
const tour = read('static/data/tour.json', { days: [] });
const photos = read('static/data/photos.json', { photos: [] }).photos;
const posts = read('static/data/blog.json', { posts: [] }).posts;
const parks = read('static/data/uk/parks.json', { parks: [] }).parks;

const days = tour.days.map((d) => {
	const dir = path.join(DAYS, d.day);
	const meta = read(path.join(dir, 'terrain.json'));
	const tr = read(path.join(dir, 'track.json'));
	const pins = read(path.join(dir, 'pins.json'), []);
	const osm = read(path.join(dir, 'osm.json'), { places: [] });
	const weather = read(path.join(dir, 'weather.json'), null);
	const proj = makeProjection(meta.originE, meta.originN);
	const towns = osm.places.filter((p) => p.kind === 'town' || p.kind === 'village');

	/** nearest town/village to local metres, unless it's near a privacy zone */
	function placeAt(x, n) {
		const [lon, lat] = proj.inverse(x, n);
		if (nearPrivacyZone(lon, lat, PRIVACY_MARGIN)) return null;
		let best = null;
		let bd = PLACE_WITHIN;
		for (const p of towns) {
			const dd = Math.hypot(p.x - x, p.n - n);
			if (dd < bd) [best, bd] = [p.name, dd];
		}
		return best;
	}
	const placeAtFix = (i) => placeAt(tr.x[i], tr.n[i]);

	const dayPhotos = photos.filter((p) => p.day === d.day);
	const dayPosts = posts.filter((p) => p.day === d.day);
	const events = dayEventsCore(tr, pins, dayPhotos, dayPosts).map((e) => {
		switch (e.kind) {
			case 'start':
			case 'finish':
				return { kind: e.kind, t: e.t, ride: e.ride, rides: e.rides, place: placeAtFix(e.i) };
			case 'break':
				return { kind: 'break', t: e.t, minutes: e.minutes, place: placeAtFix(e.i) };
			case 'photos': {
				const first = e.photos[0];
				return {
					kind: 'photos',
					t: e.t,
					photos: e.photos.map((p) => p.id),
					place: first.i != null ? placeAtFix(first.i) : null
				};
			}
			case 'pin':
				return { kind: 'pin', t: e.t, pin: { type: e.pin.type, title: e.pin.title, body: e.pin.body }, place: placeAtFix(e.pin.i) };
			case 'post':
				return { kind: 'post', t: e.t, post: e.post.slug, place: placeAtFix(e.post.i) };
		}
	});

	return {
		day: d.day,
		index: d.index,
		title: d.title,
		start: d.start,
		end: d.end,
		km: d.km,
		rides: d.rides,
		weather: weather?.summary ?? null,
		parks: parks.filter((p) => p.days.includes(d.day)).map((p) => p.name),
		photos: dayPhotos.length,
		events
	};
});

fs.writeFileSync('static/data/feed.json', JSON.stringify({ days }));
const n = days.reduce((a, d) => a + d.events.length, 0);
console.log(`Wrote static/data/feed.json: ${days.length} days, ${n} events (${(fs.statSync('static/data/feed.json').size / 1024).toFixed(0)} KB)`);
