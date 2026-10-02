// Music: what was playing on the ride, from a Spotify listening-history export.
//  - reads tours/<id>/spotify/ (git-ignored): the account-data export (StreamingHistory_music_*.json:
//    endTime in UTC to the minute, artistName, trackName, msPlayed) and/or the extended history
//    (Streaming_History_Audio_*.json: ts to the second and the track's spotify_track_uri)
//  - keeps plays of 30 s or more that overlap a day's ride; drops any while inside a privacy zone
//  - finds each track on Spotify (ID, album art) with the app credentials in .env.local
//    (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET; client-credentials, no user login). The secret is
//    only used here: nothing it touches is published. Lookups are cached in
//    tours/<id>/spotify/lookup.json, misses included (--retry looks the misses up again);
//    tours/<id>/spotify/overrides.json corrects a match: { "Artist|Track": "<spotify track id>" | null }
//  - no credentials, or Spotify not answering: the tracks are written without IDs or art and the
//    site shows their names only
// Output: static/data/tours/<id>/music.json  { tracks: [{ name, artist, id?, art? }], plays: [[start, end, track]] }
// (start/end epoch seconds). Run after build-tour.
import fs from 'node:fs';
import path from 'node:path';
import { inPrivacyZoneAt } from './lib/geo.mjs';
import { PATHS } from './lib/tour.mjs';

const SRC = path.join(PATHS.dir, 'spotify');
const LOOKUP = path.join(SRC, 'lookup.json');
const OVERRIDES = path.join(SRC, 'overrides.json');
const OUT = path.join(PATHS.out, 'music.json');
const MIN_PLAYED = 30; // seconds: shorter plays are skips
const RETRY = process.argv.includes('--retry');

const read = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
const keyOf = (artist, name) => `${artist}|${name}`;

// ---------- plays, from either export format ----------
if (!fs.existsSync(SRC)) {
	console.log(`No listening history in ${SRC}: nothing to do`);
	process.exit(0);
}
const plays = [];
for (const f of fs.readdirSync(SRC).sort()) {
	const file = path.join(SRC, f);
	if (/^StreamingHistory_music_\d+\.json$/.test(f))
		for (const p of read(file, [])) {
			const end = Date.parse(`${p.endTime.replace(' ', 'T')}:00Z`) / 1000;
			plays.push({ artist: p.artistName, name: p.trackName, start: end - p.msPlayed / 1000, end, id: null });
		}
	else if (/^Streaming_History_Audio_.*\.json$/.test(f))
		for (const p of read(file, [])) {
			if (!p.master_metadata_track_name) continue; // podcasts, audiobooks
			const end = Date.parse(p.ts) / 1000;
			const id = p.spotify_track_uri?.split(':')[2] ?? null;
			plays.push({ artist: p.master_metadata_album_artist_name, name: p.master_metadata_track_name, start: end - p.ms_played / 1000, end, id });
		}
}
// both formats present: the extended one wins for the plays it has (same track ending within a minute)
plays.sort((a, b) => a.end - b.end || (b.id ? 1 : 0) - (a.id ? 1 : 0));
const deduped = plays.filter((p, i) => !plays.slice(Math.max(0, i - 3), i).some((q) => q.name === p.name && q.artist === p.artist && Math.abs(q.end - p.end) < 60));

// the rides' clock windows
const rides = [];
for (const day of fs.readdirSync(PATHS.days)) {
	const f = path.join(PATHS.days, day, 'track.json');
	if (!fs.existsSync(f)) continue;
	const tr = JSON.parse(fs.readFileSync(f, 'utf8'));
	rides.push([tr.t0, tr.t0 + tr.t[tr.count - 1]]);
}
let skips = 0;
let offRide = 0;
let private_ = 0;
const kept = deduped.filter((p) => {
	if (p.end - p.start < MIN_PLAYED) return skips++, false;
	if (!rides.some(([a, b]) => p.start < b && p.end > a)) return offRide++, false;
	if (inPrivacyZoneAt(p.start) || inPrivacyZoneAt(p.end)) return private_++, false;
	return true;
});

// ---------- Spotify lookups ----------
const lookup = read(LOOKUP, {});
const overrides = read(OVERRIDES, {});
const norm = (s) =>
	s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s[-–]\s.*$/, '') // " - Remastered 2011", " - Live"
		.replace(/[([](feat|ft|with)[^)\]]*[)\]]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

let token = null;
async function auth() {
	const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
	if (!id || !secret) return null;
	const r = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
		body: 'grant_type=client_credentials'
	});
	if (!r.ok) throw new Error(`Spotify sign-in failed: ${r.status}`);
	return (await r.json()).access_token;
}
async function api(url) {
	for (let attempt = 0; attempt < 5; attempt++) {
		const r = await fetch(`https://api.spotify.com/v1/${url}`, { headers: { Authorization: `Bearer ${token}` } });
		if (r.status === 429) {
			await new Promise((ok) => setTimeout(ok, (+(r.headers.get('retry-after') ?? 2) + 1) * 1000));
			continue;
		}
		if (!r.ok) throw new Error(`Spotify ${r.status} for ${url}`);
		return r.json();
	}
	throw new Error(`Spotify kept rate-limiting ${url}`);
}
const entry = (t) => ({ id: t.id, art: t.album.images.find((i) => i.width <= 64)?.url ?? t.album.images.at(-1)?.url ?? null });

/** The best search result: same title (normalised) and the artist among its artists. */
async function search(artist, name) {
	const q = encodeURIComponent(`track:${name.replace(/"/g, '')} artist:${artist.replace(/"/g, '')}`);
	const items = (await api(`search?type=track&limit=10&q=${q}`)).tracks?.items ?? [];
	const byArtist = items.filter((t) => t.artists.some((a) => norm(a.name) === norm(artist)));
	const hit = byArtist.find((t) => norm(t.name) === norm(name)) ?? byArtist.find((t) => norm(t.name).startsWith(norm(name)) || norm(name).startsWith(norm(t.name)));
	return hit ? entry(hit) : null;
}

const unique = new Map();
for (const p of kept) if (!unique.has(keyOf(p.artist, p.name))) unique.set(keyOf(p.artist, p.name), p);
const todo = [...unique.entries()].filter(([k, p]) => !p.id && !(k in overrides) && (!(k in lookup) || (RETRY && lookup[k] === null)));
const fixes = Object.entries(overrides).filter(([k, id]) => id && lookup[k]?.id !== id);
let failed = null;
try {
	token = todo.length || fixes.length ? await auth() : null;
	if (!token && (todo.length || fixes.length)) console.log('  no SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env.local: tracks without links or art');
	if (token) {
		let done = 0;
		for (const [k, p] of todo) {
			lookup[k] = await search(p.artist, p.name);
			if (++done % 25 === 0) process.stdout.write(`  looked up ${done}/${todo.length}\r`);
		}
		for (const [k, id] of fixes) lookup[k] = entry(await api(`tracks/${id}`));
		// the extended history names the track exactly: fetch art for those not seen yet
		for (const [k, p] of unique) if (p.id && lookup[k]?.id !== p.id) lookup[k] = entry(await api(`tracks/${p.id}`));
	}
} catch (e) {
	failed = e.message; // keep what was found; the rest go without links this time
} finally {
	fs.writeFileSync(LOOKUP, JSON.stringify(lookup, null, '\t'));
}

// ---------- write ----------
const tracks = [];
const index = new Map();
const out = kept.map((p) => {
	const k = keyOf(p.artist, p.name);
	if (!index.has(k)) {
		const found = k in overrides ? (overrides[k] ? lookup[k] : null) : lookup[k];
		index.set(k, tracks.length);
		tracks.push({ name: p.name, artist: p.artist, ...(found?.id ? { id: found.id, art: found.art ?? undefined } : {}) });
	}
	return [Math.round(p.start), Math.round(p.end), index.get(k)];
});
out.sort((a, b) => a[0] - b[0]); // by start: the app looks plays up by time
fs.writeFileSync(OUT, JSON.stringify({ tracks, plays: out }));
const linked = tracks.filter((t) => t.id).length;
console.log(
	`Wrote ${OUT}: ${out.length} plays of ${tracks.length} tracks (${linked} found on Spotify); left out ${skips} skips, ${offRide} off the bike, ${private_} in privacy zones`
);
if (failed) console.log(`  Spotify lookups stopped early (${failed}): run again to finish`);
const missed = tracks.filter((t) => !t.id).map((t) => keyOf(t.artist, t.name));
if (missed.length && token) console.log(`  not found (add to ${OVERRIDES} if you know them):\n    ${missed.slice(0, 15).join('\n    ')}${missed.length > 15 ? `\n    …and ${missed.length - 15} more` : ''}`);
