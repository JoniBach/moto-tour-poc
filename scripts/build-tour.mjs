// Tour index: every built day with its title, origin, extent, stats and a simplified route line
// (absolute BNG metres) for the UK overview and the day switcher.
// Output: static/data/tour.json
import fs from 'node:fs';
import path from 'node:path';

const DAYS_DIR = 'static/data/days';
const SIMPLIFY = 400; // metres between kept points on the overview line

const days = fs
	.readdirSync(DAYS_DIR)
	.filter((d) => fs.existsSync(path.join(DAYS_DIR, d, 'track.json')))
	.sort()
	.map((day, index) => {
		const read = (f) => JSON.parse(fs.readFileSync(path.join(DAYS_DIR, day, f), 'utf8'));
		const meta = read('terrain.json');
		const track = read('track.json');
		const weather = fs.existsSync(path.join(DAYS_DIR, day, 'weather.json')) ? read('weather.json') : null;

		// simplified absolute line, split where separate rides break
		const breaks = new Set(track.breaks ?? []);
		const lines = [[]];
		for (let i = 0, last = -Infinity; i < track.count; i++) {
			if (breaks.has(i)) {
				lines.push([]);
				last = -Infinity;
			}
			if (track.dist[i] - last >= SIMPLIFY || i === track.count - 1) {
				lines.at(-1).push(Math.round(track.x[i] + meta.originE), Math.round(track.n[i] + meta.originN));
				last = track.dist[i];
			}
		}
		const { x0, n1, cols, rows, spacing } = meta;
		return {
			index,
			day,
			title: track.title,
			originE: meta.originE,
			originN: meta.originN,
			// day grid extent in absolute BNG metres
			extent: {
				minE: meta.originE + x0,
				maxE: meta.originE + x0 + (cols - 1) * spacing,
				minN: meta.originN + n1 - (rows - 1) * spacing,
				maxN: meta.originN + n1
			},
			km: Math.round(track.dist[track.count - 1] / 100) / 10,
			rides: (track.breaks?.length ?? 0) + 1,
			start: track.t0,
			end: track.t0 + track.t[track.count - 1],
			weather: weather?.summary ?? null,
			lines
		};
	});

fs.writeFileSync('static/data/tour.json', JSON.stringify({ days }));
console.log(`Wrote static/data/tour.json: ${days.length} days, ${days.reduce((a, d) => a + d.km, 0).toFixed(0)} km`);
