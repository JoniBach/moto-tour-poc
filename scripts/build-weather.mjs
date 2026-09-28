// Historical weather along the ride from Open-Meteo (free, no key, CC BY 4.0).
// Samples the track every SAMPLE_MIN minutes of wall-clock time, asks for hourly weather at each
// sample's position (with the DEM height so temperature is lapse-rate corrected for the fells),
// and interpolates to the moment the bike was actually there.
// Output: static/data/weather.json
import crypto from 'node:crypto';
import fs from 'node:fs';
import { makeProjection } from './lib/geo.mjs';

const SAMPLE_MIN = 10;
// Historical forecast archive (uses the UK Met Office 2 km model in the UK); ERA5 archive as fallback
const APIS = ['https://historical-forecast-api.open-meteo.com/v1/forecast', 'https://archive-api.open-meteo.com/v1/archive'];
const HOURLY = [
	'temperature_2m',
	'apparent_temperature',
	'precipitation',
	'cloud_cover',
	'wind_speed_10m',
	'wind_direction_10m',
	'wind_gusts_10m',
	'weather_code',
	'is_day'
];

const meta = JSON.parse(fs.readFileSync('static/data/terrain.json', 'utf8'));
const track = JSON.parse(fs.readFileSync('static/data/track.json', 'utf8'));
const proj = makeProjection(meta.lon0, meta.lat0);

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

// ---------- sample points along the ride ----------
const end = track.t[track.count - 1];
const samples = [];
for (let s = 0; s <= end + 1; s += SAMPLE_MIN * 60) {
	const i = lastLE(track.t, Math.min(s, end));
	// Beeline stops recording while parked, so several samples can land on one fix: keep the first
	if (samples.at(-1)?.i === i) continue;
	const [lon, lat] = proj.inverse(track.x[i], track.n[i]);
	samples.push({ i, t: track.t0 + track.t[i], rt: track.rt[i], lon, lat, ele: Math.max(0, track.ground[i]) });
}
const day = (s) => new Date(s * 1000).toISOString().slice(0, 10);
const params = new URLSearchParams({
	latitude: samples.map((s) => s.lat.toFixed(4)).join(','),
	longitude: samples.map((s) => s.lon.toFixed(4)).join(','),
	elevation: samples.map((s) => s.ele.toFixed(0)).join(','),
	start_date: day(samples[0].t),
	end_date: day(samples.at(-1).t),
	hourly: HOURLY.join(','),
	daily: 'sunrise,sunset',
	timezone: 'GMT',
	wind_speed_unit: 'mph',
	timeformat: 'unixtime'
});

// ---------- fetch (cached) ----------
const cacheFile = `data/cache/weather-${crypto.createHash('md5').update(params.toString()).digest('hex').slice(0, 10)}.json`;
let res;
let source;
if (fs.existsSync(cacheFile)) {
	({ res, source } = JSON.parse(fs.readFileSync(cacheFile, 'utf8')));
	console.log(`Weather: cached ${cacheFile}`);
} else {
	for (const api of APIS) {
		console.log(`Weather: querying ${new URL(api).host}…`);
		const r = await fetch(`${api}?${params}`);
		if (r.ok) {
			res = await r.json();
			source = api;
			break;
		}
		console.log(`  failed (HTTP ${r.status}: ${(await r.text()).slice(0, 120)})`);
	}
	if (!res) throw new Error('Open-Meteo requests failed');
	fs.mkdirSync('data/cache', { recursive: true });
	fs.writeFileSync(cacheFile, JSON.stringify({ res, source }));
}
const locations = Array.isArray(res) ? res : [res];

// ---------- interpolate each sample to its exact time ----------
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const out = samples.map((s, k) => {
	const h = locations[k].hourly;
	const j = Math.max(0, Math.min(h.time.length - 2, lastLE(h.time, s.t)));
	const f = Math.max(0, Math.min(1, (s.t - h.time[j]) / (h.time[j + 1] - h.time[j])));
	const lerp = (key) => (h[key][j] == null ? null : h[key][j] + ((h[key][j + 1] ?? h[key][j]) - h[key][j]) * f);
	// wind direction: interpolate the shortest way round
	const d0 = h.wind_direction_10m[j];
	const dd = ((h.wind_direction_10m[j + 1] - d0 + 540) % 360) - 180;
	const nearest = f < 0.5 ? j : j + 1;
	return {
		rt: s.rt,
		t: s.t,
		temp: r1(lerp('temperature_2m')),
		feels: r1(lerp('apparent_temperature')),
		precip: r1(h.precipitation[nearest]), // mm in that hour: don't smear rain across hours
		cloud: Math.round(lerp('cloud_cover')),
		wind: r1(lerp('wind_speed_10m')),
		gust: r1(lerp('wind_gusts_10m')),
		windDir: Math.round((d0 + dd * f + 360) % 360),
		code: h.weather_code[nearest],
		isDay: h.is_day[nearest]
	};
});

const daily = locations[0].daily;
const temps = out.map((o) => o.temp).filter((v) => v != null);
const weather = {
	attribution: 'Weather data by Open-Meteo.com',
	source: new URL(source).host,
	sunrise: daily?.sunrise?.[0] ?? null,
	sunset: daily?.sunset?.[0] ?? null,
	summary: {
		minTemp: Math.min(...temps),
		maxTemp: Math.max(...temps),
		wettestHourMm: Math.max(...out.map((o) => o.precip ?? 0)),
		maxGust: Math.max(...out.map((o) => o.gust ?? 0))
	},
	samples: out
};
fs.writeFileSync('static/data/weather.json', JSON.stringify(weather));
console.log(
	`Wrote static/data/weather.json: ${out.length} samples from ${weather.source}; ${weather.summary.minTemp}–${weather.summary.maxTemp} °C, wettest ${weather.summary.wettestHourMm} mm/h, gusts to ${weather.summary.maxGust} mph`
);
