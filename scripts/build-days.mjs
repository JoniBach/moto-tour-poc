// Builds day bundles and the tour index.
//   node scripts/build-days.mjs                 every day found in tours/<id>/gpx
//   node scripts/build-days.mjs 2026-09-16 …    just these days
// Per day: terrain -> track -> osm -> weather. OSM and weather are optional extras: if the public
// APIs fail, the day still builds and the app runs without roads/weather for it.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { listDays } from './lib/geo.mjs';

const days = process.argv.slice(2).length ? process.argv.slice(2) : listDays();
const run = (script, day) => spawnSync(process.execPath, [`scripts/${script}.mjs`, ...(day ? [day] : [])], { stdio: 'inherit' }).status === 0;

if (!fs.existsSync('static/data/uk/terrain.bin')) run('build-uk');

const failed = [];
for (const day of days) {
	console.log(`\n=== ${day} ===`);
	if (!run('build-terrain', day) || !run('build-track', day)) {
		failed.push(`${day} (terrain/track)`);
		continue;
	}
	if (!run('build-osm', day)) failed.push(`${day} (osm)`);
	if (!run('build-weather', day)) failed.push(`${day} (weather)`);
}
run('build-tour');
run('build-parks'); // parks record which days pass through them
run('build-feed'); // the blog's event list
if (failed.length) console.log(`\nIncomplete: ${failed.join(', ')} — re-run those days later (results are cached).`);
