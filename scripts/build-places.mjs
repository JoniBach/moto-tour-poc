// Places: the gazetteer the story editor links mentions with ("the Lakes" -> the moment the ride
// was there). For each place, every visit: the day and the clock time.
//  - national parks (parks.json): the moment each day's route first enters the park
//  - towns, villages, peaks and lakes along each day's route (osm.json): the moment the bike was
//    nearest, if it came within PLACE_WITHIN (peaks and water: VIEW_WITHIN, right by the road).
//    Nothing near a privacy zone (PRIVACY_MARGIN), as for the blog's "near …"
// Names: each place's own, a park's official name (tour.config.json protectedAreas) without
// "National Park", and nicknames from tours/<id>/places.json:
//   { "aliases": { "Lake District": ["Lakes", "Lakeland"], … } }
// (a leading "the" is always allowed when matching, so "Lakes" also matches "the Lakes").
// Output: static/data/tours/<id>/places.json  { places: [{ name, kind, aliases?, visits: [[day, t], …] }] }
// Run after build-tour and build-parks.
import fs from 'node:fs';
import path from 'node:path';
import { fromGrid, nearPrivacyZone, PRIVACY_MARGIN } from './lib/geo.mjs';
import { PATHS, TOUR } from './lib/tour.mjs';

const PLACE_WITHIN = 2500; // metres from the route: towns and villages passed through or by
const VIEW_WITHIN = 1500; // peaks and lakes right by the road (further off, there are thousands)
const KINDS = { town: PLACE_WITHIN, village: PLACE_WITHIN, peak: VIEW_WITHIN, water: VIEW_WITHIN };
const STEP = 3; // check every 3rd fix (a few seconds apart): plenty for "nearest"

const read = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
const manual = read(path.join(PATHS.dir, 'places.json'), { aliases: {} }).aliases ?? {};
const parks = read(PATHS.parksJson, { parks: [] }).parks;
const tour = read(PATHS.tourJson, { days: [] });

/** name -> place (same name on several days: one place, several visits) */
const places = new Map();
const add = (name, kind, day, t) => {
	let p = places.get(name);
	if (!p) places.set(name, (p = { name, kind, aliases: [], visits: [] }));
	if (!p.visits.some((v) => v.day === day)) p.visits.push({ day, t: Math.round(t) });
};

function inRing(e, n, ring) {
	let inside = false;
	for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
		const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
		if (yi > n !== yj > n && e < ((xj - xi) * (n - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

let skipped = 0;
for (const d of tour.days) {
	const dir = path.join(PATHS.days, d.day);
	const tr = read(path.join(dir, 'track.json'));
	const meta = read(path.join(dir, 'terrain.json'));
	if (!tr || !meta) continue;
	const fix = (i) => [tr.x[i] + meta.originE, tr.n[i] + meta.originN];

	// parks: the first fix inside each park the day passes through
	for (const park of parks.filter((p) => p.days.includes(d.day))) {
		for (let i = 0; i < tr.count; i += STEP) {
			const [e, n] = fix(i);
			if (park.rings.some((r) => inRing(e, n, r))) {
				add(park.name, 'park', d.day, tr.t0 + tr.t[i]);
				break;
			}
		}
	}

	// towns, villages, peaks and lakes: the nearest fix, if near enough
	const osm = read(path.join(dir, 'osm.json'), { places: [] });
	for (const pl of osm.places) {
		const within = KINDS[pl.kind];
		if (!within || !pl.name) continue;
		const [lon, lat] = fromGrid(pl.x + meta.originE, pl.n + meta.originN);
		if (nearPrivacyZone(lon, lat, PRIVACY_MARGIN)) {
			skipped++;
			continue;
		}
		let best = -1;
		let bd = within;
		for (let i = 0; i < tr.count; i += STEP) {
			const dd = Math.hypot(tr.x[i] - pl.x, tr.n[i] - pl.n);
			if (dd < bd) [best, bd] = [i, dd];
		}
		if (best >= 0) add(pl.name, pl.kind, d.day, tr.t0 + tr.t[best]);
	}
}

// the names they go by
const official = Object.fromEntries(Object.entries(TOUR.protectedAreas?.names ?? {}).map(([full, short]) => [short, full]));
for (const p of places.values()) {
	const names = new Set(manual[p.name] ?? []);
	if (p.kind === 'park' && official[p.name]) {
		names.add(official[p.name]);
		names.add(official[p.name].replace(/\s+National Park$/i, '').replace(/^Parc Cenedlaethol\s+/i, ''));
		names.add(`${p.name} National Park`);
	}
	names.delete(p.name);
	p.aliases = [...names].filter(Boolean);
	p.visits.sort((a, b) => a.t - b.t);
}
// nicknames for places not visited are just ignored (nothing to link to)
for (const name of Object.keys(manual)) if (!places.has(name)) console.log(`  places.json: "${name}" isn't on the tour's route; its nicknames are unused`);

const out = [...places.values()].map((p) => ({ name: p.name, kind: p.kind, ...(p.aliases.length ? { aliases: p.aliases } : {}), visits: p.visits.map((v) => [v.day, v.t]) })).sort((a, b) => (a.kind === 'park') === (b.kind === 'park') ? a.name.localeCompare(b.name) : a.kind === 'park' ? -1 : 1);
fs.writeFileSync(PATHS.placesJson, JSON.stringify({ places: out }));
const kb = (fs.statSync(PATHS.placesJson).size / 1024).toFixed(0);
const by = (k) => out.filter((p) => p.kind === k).length;
console.log(
	`Wrote ${PATHS.placesJson}: ${out.length} places (${by('park')} parks, ${by('town')} towns, ${by('village')} villages, ${by('peak')} peaks, ${by('water')} lakes); ${skipped} left out near privacy zones; ${kb} KB`
);
