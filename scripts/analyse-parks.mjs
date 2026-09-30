// Which national parks each day's route passes through (OpenMapTiles `park` layer, class
// national_park), in order along the route with the share of the ride inside each, plus the
// nearest town/village at the start and end. Used to name days for the national parks theme.
//   node scripts/analyse-parks.mjs
import fs from 'node:fs';
import path from 'node:path';
import { makeProjection } from './lib/geo.mjs';
import { readTiles, tilesAround } from './lib/vtiles.mjs';
import { PATHS } from './lib/tour.mjs';

const inRing = (ring, lon, lat) => {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
};
const inPoly = (poly, lon, lat) => inRing(poly[0], lon, lat) && !poly.slice(1).some((h) => inRing(h, lon, lat));

for (const day of fs.readdirSync(PATHS.days).sort()) {
	const dir = path.join(PATHS.days, day);
	const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
	const meta = read('terrain.json');
	const track = read('track.json');
	const osm = read('osm.json');
	const proj = makeProjection(meta.originE, meta.originN);
	const pts = track.x.map((x, i) => proj.inverse(x, track.n[i])).filter((_, i) => i % 15 === 0);

	// park pieces (tile-clipped polygons) with bounding boxes to skip most containment tests
	const parks = [];
	await readTiles(tilesAround(pts, 10, 0), ['park'], (_, f) => {
		// UK national parks come through as class 'conservation'; match them by name (incl. Welsh + the Broads)
		const nm = `${f.properties.name ?? ''} ${f.properties['name:en'] ?? ''}`;
		if (!/National Park|Parc Cenedlaethol|\bBroads\b/i.test(nm)) return;
		const g = f.geometry;
		const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
		for (const poly of polys) {
			let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
			for (const [lon, lat] of poly[0]) (w = Math.min(w, lon)), (e = Math.max(e, lon)), (s = Math.min(s, lat)), (n = Math.max(n, lat));
			parks.push({ name: f.properties['name:en'] ?? f.properties.name, poly, box: [w, s, e, n] });
		}
	});

	const seen = new Map();
	pts.forEach(([lon, lat], k) => {
		const hit = parks.find(
			(p) => lon >= p.box[0] && lon <= p.box[2] && lat >= p.box[1] && lat <= p.box[3] && inPoly(p.poly, lon, lat)
		);
		if (!hit) return;
		const s = seen.get(hit.name) ?? { first: k, n: 0 };
		s.n++;
		seen.set(hit.name, s);
	});
	const order = [...seen.entries()]
		.sort((a, b) => a[1].first - b[1].first)
		.map(([name, s]) => `${name} ${Math.round((s.n / pts.length) * 100)}%`);

	const near = (x, n) => {
		let best = null;
		for (const p of osm.places)
			if (p.kind === 'town' || p.kind === 'village') {
				const d = Math.hypot(p.x - x, p.n - n);
				if (!best || d < best.d) best = { d, name: p.name };
			}
		return best?.name ?? '?';
	};
	const last = track.count - 1;
	console.log(
		`${day} | ${track.title} | ${near(track.x[0], track.n[0])} -> ${near(track.x[last], track.n[last])} | ${(track.dist[last] / 1609).toFixed(0)} mi | ${order.join(', ') || '—'}`
	);
}
