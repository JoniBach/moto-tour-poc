// Remove place names in or near the privacy zones from already-built days (osm.json), and bring
// every day's title in line with data/day-titles.json, without rebuilding the days. New builds do
// both themselves (build-osm / build-track); this is for data built before those rules.
//   node scripts/scrub-places.mjs && npm run data:tour && npm run data:feed
import fs from 'node:fs';
import path from 'node:path';
import { makeProjection, nearPrivacyZone, PRIVACY_MARGIN } from './lib/geo.mjs';

const DAYS = 'static/data/days';
const titles = fs.existsSync('data/day-titles.json') ? JSON.parse(fs.readFileSync('data/day-titles.json', 'utf8')) : {};
let dropped = 0;
let retitled = 0;

for (const day of fs.readdirSync(DAYS)) {
	const dir = path.join(DAYS, day);
	const meta = JSON.parse(fs.readFileSync(path.join(dir, 'terrain.json'), 'utf8'));
	const proj = makeProjection(meta.originE, meta.originN);

	const osmFile = path.join(dir, 'osm.json');
	if (fs.existsSync(osmFile)) {
		const osm = JSON.parse(fs.readFileSync(osmFile, 'utf8'));
		const keep = osm.places.filter((p) => !nearPrivacyZone(...proj.inverse(p.x, p.n), PRIVACY_MARGIN));
		if (keep.length !== osm.places.length) {
			dropped += osm.places.length - keep.length;
			fs.writeFileSync(osmFile, JSON.stringify({ ...osm, places: keep }));
		}
	}

	const trackFile = path.join(dir, 'track.json');
	const track = JSON.parse(fs.readFileSync(trackFile, 'utf8'));
	if (titles[day] && track.title !== titles[day]) {
		track.title = titles[day];
		fs.writeFileSync(trackFile, JSON.stringify(track));
		retitled++;
	}
}
console.log(`Dropped ${dropped} place names near privacy zones; retitled ${retitled} day(s)`);
