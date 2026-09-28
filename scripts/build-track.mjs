// Turns raw GPX into the playback track, the route corridor mask and resolved pins.
//  - projects fixes into the day's BNG metres and drapes them on full-res DEM tiles (not the
//    possibly coarse day grid), so the line also sits on the streamed near-bike terrain
//  - derives smoothed speed, heading and lean from the fixes
//  - detects stops and builds a compressed "riding time" axis for the scrubber
//  - distance-transforms the route into a corridor raster (drives the dense point cloud)
//  - places pins that only have a timestamp (e.g. photos without GPS) onto the track
//  - records breaks between separate rides on the same day so they aren't joined up
// Outputs (per day): track.json, corridor.bin, pins.json
import fs from 'node:fs';
import path from 'node:path';
import { TerrariumSampler, dayContext, loadTerrainGrid, makeProjection, parseGpx } from './lib/geo.mjs';

const STOP_RADIUS = 40; // metres
const STOP_MIN = 120; // seconds stationary before it counts as a stop
const STOP_KEEP = 6; // seconds of scrubber time a stop collapses to
const G = 9.81;

const ctx = dayContext();
const { meta } = loadTerrainGrid(ctx.out);
const { cols, rows, spacing, x0, n1 } = meta;

// read file by file so we know where one ride ends and the next begins
const rides = ctx.files.map((f) => parseGpx(fs.readFileSync(f, 'utf8')).filter((p) => p.time != null));
rides.sort((a, b) => a[0].time - b[0].time);
const raw = rides.flat();
const breaks = [];
rides.reduce((start, r) => (start && breaks.push(start), start + r.length), 0);
const proj = makeProjection(meta.originE, meta.originN);

// full-resolution DEM along the route only
const dem = new TerrariumSampler('data/cache/terrarium', 12);
await dem.prefetchPoints(raw.map((p) => [p.lon, p.lat]));
const groundAt = (x, n) => dem.sample(...proj.inverse(x, n));
const N = raw.length;
const t = raw.map((p) => p.time);
const x = new Float64Array(N);
const n = new Float64Array(N);
for (let i = 0; i < N; i++) [x[i], n[i]] = proj.forward(raw[i].lon, raw[i].lat);

// ---------- stops ----------
// grow a cluster while fixes stay within STOP_RADIUS of its running centroid
let stops = [];
for (let i = 0; i < N; ) {
	let j = i;
	let cx = x[i];
	let cn = n[i];
	while (j + 1 < N && Math.hypot(x[j + 1] - cx, n[j + 1] - cn) < STOP_RADIUS) {
		j++;
		cx += (x[j] - cx) / (j - i + 1);
		cn += (n[j] - cn) / (j - i + 1);
	}
	if (t[j] - t[i] >= STOP_MIN) {
		stops.push({ start: i, end: j });
		i = j + 1;
	} else i++;
}
// merge stops split by a stray fix
stops = stops.reduce((acc, s) => {
	const prev = acc.at(-1);
	if (prev && t[s.start] - t[prev.end] < 60 && Math.hypot(x[s.start] - x[prev.end], n[s.start] - n[prev.end]) < STOP_RADIUS * 2) prev.end = s.end;
	else acc.push(s);
	return acc;
}, []);
const inStop = new Uint8Array(N);
for (const s of stops) for (let k = s.start; k <= s.end; k++) inStop[k] = 1;

// ---------- positions: smooth the GPS jitter, pin stationary fixes to one spot ----------
const smooth = (arr, w) => {
	const out = new Float64Array(arr.length);
	for (let i = 0; i < arr.length; i++) {
		let s = 0;
		let c = 0;
		for (let k = Math.max(0, i - w); k <= Math.min(arr.length - 1, i + w); k++) s += arr[k], c++;
		out[i] = s / c;
	}
	return out;
};
const sx = smooth(x, 2);
const sn = smooth(n, 2);
for (const s of stops) {
	for (let k = s.start; k <= s.end; k++) [sx[k], sn[k]] = [sx[s.start], sn[s.start]];
}

// ---------- distance, speed, heading, lean ----------
const dist = new Float64Array(N);
const speedRaw = new Float64Array(N);
for (let i = 1; i < N; i++) {
	const d = Math.hypot(sx[i] - sx[i - 1], sn[i] - sn[i - 1]);
	dist[i] = dist[i - 1] + d;
	speedRaw[i] = inStop[i] ? 0 : d / Math.max(1, t[i] - t[i - 1]);
}
// rolling median kills jitter spikes, then a light mean
const median = (arr, w) =>
	arr.map((_, i) => {
		const win = Array.from(arr.slice(Math.max(0, i - w), i + w + 1)).sort((a, b) => a - b);
		return win[win.length >> 1];
	});
const speed = smooth(Float64Array.from(median(speedRaw, 3)), 2);

const heading = new Float64Array(N); // radians, 0 = north, clockwise
for (let i = 0; i < N; i++) {
	// look along the path ~15 m either side for a stable bearing
	let a = i;
	let b = i;
	while (a > 0 && dist[i] - dist[a] < 15) a--;
	while (b < N - 1 && dist[b] - dist[i] < 15) b++;
	heading[i] = b > a && dist[b] - dist[a] > 2 ? Math.atan2(sx[b] - sx[a], sn[b] - sn[a]) : i ? heading[i - 1] : 0;
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawRate = new Float64Array(N);
for (let i = 1; i < N - 1; i++) yawRate[i] = wrap(heading[i + 1] - heading[i - 1]) / Math.max(1, t[i + 1] - t[i - 1]);
// lean = atan(v * omega / g); positive = leaning right
const lean = smooth(yawRate, 2).map((w, i) => Math.max(-0.8, Math.min(0.8, Math.atan((speed[i] * w) / G))));

// ---------- riding time: collapse stops and recording gaps ----------
// each stop's fixes share STOP_KEEP seconds; moving gaps are capped at 10 s
const stepInStop = new Float64Array(N);
for (const s of stops) for (let k = s.start + 1; k <= s.end; k++) stepInStop[k] = STOP_KEEP / (s.end - s.start);
const rt = new Float64Array(N);
for (let i = 1; i < N; i++) rt[i] = rt[i - 1] + (stepInStop[i] || Math.min(t[i] - t[i - 1], 10));

const ground = Array.from({ length: N }, (_, i) => groundAt(sx[i], sn[i]));

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
// "2026-09-16_tour_lakes-fig8.gpx" -> "Lakes Fig8"; data/day-titles.json can override per day
const titleOverrides = fs.existsSync('data/day-titles.json')
	? JSON.parse(fs.readFileSync('data/day-titles.json', 'utf8'))
	: {};
const title =
	titleOverrides[ctx.day] ??
	ctx.files
	.map((f) =>
		path
			.basename(f)
			.replace(/\.gpx$/i, '')
			.replace(/^\d{4}-\d{2}-\d{2}_?/, '')
			.replace(/^tour[_-]?/i, '')
			.split(/[-_ ]+/)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ')
	)
	.join(' + ');
const track = {
	day: ctx.day,
	title,
	breaks, // fix indices where a new ride starts: don't join the previous point to these
	count: N,
	t0: t[0],
	t: t.map((v) => v - t[0]),
	rt: Array.from(rt, r1),
	x: Array.from(sx, r1),
	n: Array.from(sn, r1),
	ele: raw.map((p) => r1(p.ele ?? NaN)),
	ground: ground.map(r1),
	dist: Array.from(dist, r1),
	speed: Array.from(speed, r1),
	heading: Array.from(heading, r3),
	lean: Array.from(lean, r3),
	stops: stops.map((s) => ({ start: s.start, end: s.end, duration: t[s.end] - t[s.start] }))
};
fs.writeFileSync(ctx.file('track.json'), JSON.stringify(track));
console.log(`${ctx.day} "${title}": ${rides.length} ride(s), ${N} fixes, ${(dist[N - 1] / 1000).toFixed(1)} km, ${stops.length} stops, riding ${(rt[N - 1] / 60).toFixed(0)} min, max ${(Math.max(...speed) * 2.237).toFixed(0)} mph`);
for (const s of stops) console.log(`  stop @ ${new Date(t[s.start] * 1000).toISOString()} for ${((t[s.end] - t[s.start]) / 60).toFixed(0)} min`);

// ---------- corridor: chamfer distance transform from the route ----------
const INF = 65535;
const dfield = new Uint16Array(cols * rows).fill(INF);
for (let i = 1; i < N; i++) {
	const steps = Math.ceil(Math.hypot(sx[i] - sx[i - 1], sn[i] - sn[i - 1]) / (spacing / 2)) || 1;
	for (let k = 0; k <= steps; k++) {
		const f = k / steps;
		const c = Math.round((sx[i - 1] + (sx[i] - sx[i - 1]) * f - x0) / spacing);
		const r = Math.round((n1 - (sn[i - 1] + (sn[i] - sn[i - 1]) * f)) / spacing);
		if (c >= 0 && c < cols && r >= 0 && r < rows) dfield[r * cols + c] = 0;
	}
}
// 3-4 chamfer: units of spacing/3
const relax = (idx, other, w) => {
	if (dfield[other] + w < dfield[idx]) dfield[idx] = dfield[other] + w;
};
for (let r = 0; r < rows; r++)
	for (let c = 0; c < cols; c++) {
		const i = r * cols + c;
		if (c > 0) relax(i, i - 1, 3);
		if (r > 0) {
			relax(i, i - cols, 3);
			if (c > 0) relax(i, i - cols - 1, 4);
			if (c < cols - 1) relax(i, i - cols + 1, 4);
		}
	}
for (let r = rows - 1; r >= 0; r--)
	for (let c = cols - 1; c >= 0; c--) {
		const i = r * cols + c;
		if (c < cols - 1) relax(i, i + 1, 3);
		if (r < rows - 1) {
			relax(i, i + cols, 3);
			if (c < cols - 1) relax(i, i + cols + 1, 4);
			if (c > 0) relax(i, i + cols - 1, 4);
		}
	}
// store in cells (spacing units), capped at 255
const corridor = new Uint8Array(cols * rows);
for (let i = 0; i < corridor.length; i++) corridor[i] = Math.min(255, Math.round(dfield[i] / 3));
fs.writeFileSync(ctx.file('corridor.bin'), Buffer.from(corridor.buffer));

// ---------- pins ----------
// Source pins may carry lat/lon (geotagged photo, POI) or only a time (receipt, untagged photo).
const src = fs.existsSync('data/pins.json') ? JSON.parse(fs.readFileSync('data/pins.json', 'utf8')) : [];
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
// keep pins belonging to this day: timed ones inside its riding window, GPS ones near its route
const pins = src
	.map((p, id) => {
		let i;
		if (p.lat != null && p.lon != null) {
			const [px, pn] = proj.forward(p.lon, p.lat);
			i = 0;
			for (let k = 1, best = Infinity; k < N; k++) {
				const d = (sx[k] - px) ** 2 + (sn[k] - pn) ** 2;
				if (d < best) [best, i] = [d, k];
			}
			if (Math.hypot(sx[i] - px, sn[i] - pn) > 1000) return null;
			return { id, ...p, i, rt: r1(rt[i]), x: r1(px), n: r1(pn), h: r1(groundAt(px, pn)), placedBy: 'gps' };
		}
		const pt = Date.parse(p.time) / 1000;
		if (pt < t[0] - 3600 || pt > t[N - 1] + 3600) return null;
		i = lastLE(t, pt);
		return { id, ...p, i, rt: r1(rt[i]), x: r1(sx[i]), n: r1(sn[i]), h: r1(ground[i]), placedBy: 'time' };
	})
	.filter(Boolean);
fs.writeFileSync(ctx.file('pins.json'), JSON.stringify(pins, null, 2));
console.log(`  ${pins.length} pins`);
