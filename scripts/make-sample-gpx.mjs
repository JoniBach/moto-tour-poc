// Generates a realistic stand-in for a Beeline GPX export until real rides are dropped into data/raw.
// Real road geometry (OSRM demo server) + a simulated rider: corner speeds from curvature,
// accel/brake limits, two stops, GPS horizontal jitter and drifting barometric-ish altitude.
import fs from 'node:fs';
import path from 'node:path';
import { TerrariumSampler, haversine, writeGpx } from './lib/geo.mjs';

const OUT = 'data/sample/sample-applecross.gpx'; // copy into data/raw to use it
const START = Date.parse('2026-09-12T09:30:00Z') / 1000;

// Lochcarron -> Bealach na Ba -> Applecross -> coast road -> Shieldaig -> Torridon
const WAYPOINTS = [
	[-5.4905, 57.4005],
	[-5.811, 57.433],
	[-5.752, 57.536],
	[-5.648, 57.523],
	[-5.515, 57.547]
];
const LUNCH = [-5.811, 57.433];

// Deterministic PRNG so the sample is stable between runs
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

const url = `https://router.project-osrm.org/route/v1/driving/${WAYPOINTS.map((w) => w.join(',')).join(';')}?overview=full&geometries=geojson`;
console.log('Fetching route from OSRM…');
const route = (await (await fetch(url)).json()).routes[0];
const coords = route.geometry.coordinates;

// Resample polyline every STEP metres
const STEP = 5;
const res = [coords[0]];
let carry = 0;
for (let i = 1; i < coords.length; i++) {
	const [lo0, la0] = coords[i - 1];
	const [lo1, la1] = coords[i];
	const d = haversine(lo0, la0, lo1, la1);
	let s = STEP - carry;
	while (s <= d) {
		const f = s / d;
		res.push([lo0 + (lo1 - lo0) * f, la0 + (la1 - la0) * f]);
		s += STEP;
	}
	carry = d - (s - STEP);
}
const n = res.length;
console.log(`  ${(route.distance / 1000).toFixed(1)} km, ${n} samples @ ${STEP} m`);

const dem = new TerrariumSampler('data/cache/terrarium', 12);
const lons = res.map((p) => p[0]);
const lats = res.map((p) => p[1]);
await dem.prefetch([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]);
const ground = res.map(([lo, la]) => dem.sample(lo, la));

// Heading + curvature -> corner speed limit
const bearing = (a, b) => Math.atan2(b[0] - a[0], (b[1] - a[1]) / Math.cos(a[1] * (Math.PI / 180)));
const W = 4; // +/- 20 m window
const vmax = new Float64Array(n);
for (let i = 0; i < n; i++) {
	const a = res[Math.max(0, i - W)];
	const b = res[i];
	const c = res[Math.min(n - 1, i + W)];
	let dth = Math.abs(bearing(b, c) - bearing(a, b));
	if (dth > Math.PI) dth = 2 * Math.PI - dth;
	const r = (2 * W * STEP) / Math.max(dth, 1e-3);
	const grade = (ground[Math.min(n - 1, i + W)] - ground[Math.max(0, i - W)]) / (2 * W * STEP);
	const straight = 24 - Math.min(10, Math.abs(grade) * 60); // slower on the steep bits
	vmax[i] = Math.max(4, Math.min(straight, Math.sqrt(3.2 * r)));
}

// Stops: photo stop at the summit, lunch in Applecross
const summit = ground.indexOf(Math.max(...ground));
let lunch = 0;
for (let i = 0, best = Infinity; i < n; i++) {
	const d = haversine(res[i][0], res[i][1], LUNCH[0], LUNCH[1]);
	if (d < best) [best, lunch] = [d, i];
}
const stops = new Map([
	[summit, 9 * 60],
	[lunch, 48 * 60]
]);
for (const i of stops.keys()) vmax[i] = 0;
vmax[0] = 0;
vmax[n - 1] = 0;

// Forward (accel) / backward (brake) passes
const v = Float64Array.from(vmax);
const ACC = 1.8;
const DEC = 3.2;
for (let i = 1; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * ACC * STEP));
for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * DEC * STEP));
// Rider variation
let wob = 0;
for (let i = 0; i < n; i++) {
	wob = wob * 0.995 + gauss() * 0.02;
	v[i] = v[i] * (1 + Math.max(-0.15, Math.min(0.15, wob)));
}

// Integrate to time per sample
const t = new Float64Array(n);
for (let i = 1; i < n; i++) {
	const vm = Math.max(1.5, (v[i - 1] + v[i]) / 2);
	t[i] = t[i - 1] + STEP / vm + (stops.get(i - 1) ?? 0);
}

// Emit 1 Hz fixes (every 5 s while stationary) with noise
const out = [];
let altErr = 0;
const pushFix = (time, lo, la, g) => {
	altErr = altErr * 0.98 + gauss() * 1.2;
	const jitter = 2.5 / 111000;
	out.push({
		time: START + time,
		lon: lo + (gauss() * jitter) / Math.cos(la * (Math.PI / 180)),
		lat: la + gauss() * jitter,
		ele: g + 6 + altErr * 4
	});
};
let j = 0;
for (let time = 0; time <= t[n - 1]; ) {
	while (j < n - 2 && t[j + 1] < time) j++;
	// A stop at sample j occupies [t[j], t[j] + pause] before moving on to j+1
	const pause = stops.get(j) ?? 0;
	if (pause && time < t[j] + pause) {
		pushFix(time, res[j][0], res[j][1], ground[j]);
		time += 5;
		continue;
	}
	const f = Math.min(1, Math.max(0, (time - t[j] - pause) / (t[j + 1] - t[j] - pause)));
	const lo = res[j][0] + (res[j + 1][0] - res[j][0]) * f;
	const la = res[j][1] + (res[j + 1][1] - res[j][1]) * f;
	pushFix(time, lo, la, ground[j] + (ground[j + 1] - ground[j]) * f);
	time += 1;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, writeGpx('Applecross loop (synthetic sample)', out));
console.log(`Wrote ${OUT}: ${out.length} fixes, ${((t[n - 1]) / 3600).toFixed(2)} h`);
