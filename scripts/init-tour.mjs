// Start a new tour, or finish setting one up once its rides are in place.
//   node scripts/init-tour.mjs <id>
// Creates tours/<id>/ (a tour.config.json to edit, gpx/, blog/, empty pins and day titles) if
// it isn't there, then, when tours/<id>/gpx/ has rides, sets region.centre to the middle of them:
// the centre of the tour's projection and of its overview. Run it before any other script.
// Stand-alone on purpose: the other scripts refuse a tour without a centre.
import fs from 'node:fs';
import path from 'node:path';

const id = process.argv[2];
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error('Usage: node scripts/init-tour.mjs <id>   (lower case, digits and dashes)');
const dir = path.join('tours', id);
const configFile = path.join(dir, 'tour.config.json');

if (!fs.existsSync(configFile)) {
	for (const sub of ['gpx', 'blog', 'photos-src/jpg']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
	fs.writeFileSync(path.join(dir, 'pins.json'), '[]\n');
	fs.writeFileSync(path.join(dir, 'day-titles.json'), '{}\n');
	fs.writeFileSync(path.join(dir, 'privacy.json'), JSON.stringify({ zones: [] }, null, '\t') + '\n');
	const config = {
		$comment: 'See the README (Tours) for every field. Public (committed); gpx/, photos-src/ and privacy.json stay private.',
		id,
		name: 'My Tour',
		when: 'Summer 2027',
		title: 'A tour of somewhere',
		summary: 'from here to there and back',
		activity: 'motorcycle',
		locale: 'en-GB',
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		units: { distance: 'km', temperature: 'C' },
		speed: 1,
		region: { name: 'Tour' },
		protectedAreas: { one: 'National Park', many: 'national parks' }
	};
	fs.writeFileSync(configFile, JSON.stringify(config, null, '\t') + '\n');
	console.log(`Created ${dir}/: edit tour.config.json, put the rides in gpx/ (named YYYY-MM-DD…gpx),
photos in photos-src/jpg/ and any privacy zones in privacy.json, then run this again.`);
}

const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const gpxDir = process.env.GPX_DIR ?? path.join(dir, 'gpx');
const files = fs.existsSync(gpxDir) ? fs.readdirSync(gpxDir).filter((f) => /\.gpx$/i.test(f)) : [];
if (!files.length) {
	console.log(`No rides in ${gpxDir} yet.`);
	process.exit(0);
}

// the middle of the rides' box (only the box is kept, never a position)
let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
for (const f of files)
	for (const m of fs.readFileSync(path.join(gpxDir, f), 'utf8').matchAll(/<trkpt\b[^>]*>/g)) {
		const lat = +/lat="([-\d.]+)"/.exec(m[0])?.[1];
		const lon = +/lon="([-\d.]+)"/.exec(m[0])?.[1];
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
		(w = Math.min(w, lon)), (s = Math.min(s, lat)), (e = Math.max(e, lon)), (n = Math.max(n, lat));
	}
if (!(w < e)) throw new Error(`No track points found in ${gpxDir}`);
const centre = [+((w + e) / 2).toFixed(4), +((s + n) / 2).toFixed(4)];
const km = (dLon, dLat) => Math.round(Math.hypot(dLon * 111.32 * Math.cos((centre[1] * Math.PI) / 180), dLat * 110.57));
console.log(`${files.length} ride file(s) spanning ~${km(e - w, 0)} x ${km(0, n - s)} km`);

if (config.region?.projection) {
	console.log('region.projection is set explicitly: leaving region.centre as it is');
} else {
	config.region = { ...config.region, centre };
	fs.writeFileSync(configFile, JSON.stringify(config, null, '\t') + '\n');
	console.log(`Set region.centre to [${centre}] in ${configFile}`);
}
if (km(e - w, n - s) > 2000)
	console.log('Warning: over ~2,000 km across; the default projection distorts beyond ~1,000 km from its centre.');
console.log(`Next: TOUR=${id} npm run data   (then data:photos, data:blog; TOUR=${id} npm run dev)`);
