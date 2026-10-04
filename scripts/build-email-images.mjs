// Images for the RSS feed and the mailing list: email clients and feed readers don't all show WebP,
// and they never run the story page's script, so a map snapshot (drawn in the reader's browser)
// would arrive as an empty frame.
//
//   node scripts/build-email-images.mjs                 photos only
//   BASE=http://localhost:5173/the-parks-26 node scripts/build-email-images.mjs
//                                                       …and the map snapshots, from a running site
//
// Photos: every photo a story shows (its cover and the ones in its text), as a 1200 px JPEG in
// static/photos/<tour>/email/<id>.jpg, from the gallery WebP. Copies no story uses are removed.
// Maps: each story page is opened in Chrome, every snapshot scrolled to and drawn by the site's own
// code, and the still it leaves behind saved as static/photos/<tour>/maps/<ref>.jpg. Without BASE
// the snapshots already saved stay, and the feed links to the map instead of showing ones it lacks.
// The feed (src/routes/blog/feed.xml) uses whichever of these exist when the site is built.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { mapFile } from '../src/lib/story.js';
import { PATHS, TOUR } from './lib/tour.mjs';

const WIDTH = 1200;
const EMAIL = path.join(PATHS.photos, 'email');
const MAPS = path.join(PATHS.photos, 'maps');

const posts = fs.existsSync(PATHS.blogJson) ? JSON.parse(fs.readFileSync(PATHS.blogJson, 'utf8')).posts : [];

// ---- photos ----
const used = new Set();
for (const p of posts) {
	if (p.cover) used.add(p.cover);
	for (const m of p.html.matchAll(/data-photo="([^"]+)"/g)) used.add(m[1]);
}
fs.mkdirSync(EMAIL, { recursive: true });
let made = 0;
for (const id of used) {
	const src = path.join(PATHS.photos, 'large', `${id}.webp`);
	const out = path.join(EMAIL, `${id}.jpg`);
	if (!fs.existsSync(src)) {
		console.log(`  no gallery image for ${id}: run npm run data:photos`);
		continue;
	}
	if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) continue;
	await sharp(src).resize(WIDTH, WIDTH, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(out);
	made++;
}
let removed = 0;
for (const f of fs.readdirSync(EMAIL))
	if (!used.has(path.basename(f, '.jpg'))) {
		fs.rmSync(path.join(EMAIL, f));
		removed++;
	}
console.log(`Email photos: ${used.size} used by stories (${made} made, ${removed} no longer used removed)`);

// ---- map snapshots ----
const refs = new Map(); // ref -> a story that shows it
for (const p of posts) for (const m of p.html.matchAll(/data-map="([^"]+)"/g)) if (!refs.has(m[1])) refs.set(m[1], p);
fs.mkdirSync(MAPS, { recursive: true });
for (const f of fs.readdirSync(MAPS))
	if (![...refs.keys()].some((r) => mapFile(r) === f)) fs.rmSync(path.join(MAPS, f));

const BASE = process.env.BASE?.replace(/\/$/, '');
if (!refs.size) console.log('Map snapshots: none in the stories');
else if (!BASE) {
	const missing = [...refs.keys()].filter((r) => !fs.existsSync(path.join(MAPS, mapFile(r))));
	console.log(
		`Map snapshots: ${refs.size} in the stories, ${missing.length} not saved yet${missing.length ? ` (${missing.join(', ')}): run the site and pass BASE=http://localhost:5173/${TOUR.slug ?? TOUR.id}` : ''}`
	);
} else {
	const { default: puppeteer } = await import('puppeteer-core');
	const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
	const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage();
	// twice the pixels, so the 1200 px copy is sharp
	await page.setViewport({ width: 900, height: 1000, deviceScaleFactor: 2 });
	let saved = 0;
	for (const post of new Set(refs.values())) {
		await page.goto(`${BASE}/blog/${post.day}/${post.slug}`, { waitUntil: 'networkidle2', timeout: 120000 });
		const figures = await page.$$('figure.map-shot');
		for (const fig of figures) {
			const ref = await fig.evaluate((el) => el.dataset.map ?? '');
			if (!refs.has(ref)) continue;
			await fig.evaluate((el) => el.scrollIntoView({ block: 'center' }));
			// drawn when it nears the screen; done when the frame holds the still (or says it failed)
			const src = await fig
				.waitForSelector('.map-frame img, .map-frame.failed', { timeout: 60000 })
				.then((h) => h?.evaluate((el) => (el instanceof HTMLImageElement ? el.src : '')))
				.catch(() => '');
			if (!src?.startsWith('data:image/')) {
				console.log(`  ${ref}: the map didn't draw`);
				continue;
			}
			const png = Buffer.from(src.slice(src.indexOf(',') + 1), 'base64');
			await sharp(png).resize(WIDTH, WIDTH * 2, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(MAPS, mapFile(ref)));
			saved++;
		}
	}
	await browser.close();
	console.log(`Map snapshots: saved ${saved} of ${refs.size}`);
}
