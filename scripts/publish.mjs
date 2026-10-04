// Publish the blog: one command from "I've written a story" to "it's live and in subscribers' inbox".
//
//   npm run release                 commit stories, build, deploy to production, email new stories
//   npm run release -- --draft      …but leave the emails as drafts to check and send in Buttondown
//   npm run release -- --no-email   …without touching the mailing list
//   npm run release -- --no-deploy  build only (check a story before it goes out)
//   TOUR=<id> npm run release       another tour (default uk-2026)
//
// 1. Commits changes in tours/<id>/blog/: a story's "published" date is when its file was first
//    committed (build-blog.mjs), and the feed and emails go by it.
// 2. Builds the blog (build-blog), its email images (build-email-images; if a map snapshot has no
//    still yet, starts the site locally to draw it) and the events feed (build-feed).
// 3. Deploys to production (deploy.mjs --prod, which runs the privacy audit first).
// 4. Reads the live RSS feed back, and for each story not emailed yet creates the email in
//    Buttondown and sends it to subscribers (or leaves it as a draft with --draft). The emails are the
//    feed's own copy of each story. Which stories have been emailed is kept in
//    tours/<id>/emails.json (committed), so a story is never emailed twice.
//
// Needs BUTTONDOWN_API_KEY in .env.local (Buttondown → Settings → API) for step 4.
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mapFile } from '../src/lib/story.js';
import { PATHS, TOUR, TOUR_ID } from './lib/tour.mjs';

const args = process.argv.slice(2);
const SEND = !args.includes('--draft');
const EMAIL = !args.includes('--no-email');
const DEPLOY = !args.includes('--no-deploy');
const ORIGIN = (TOUR.origin ?? 'https://gt-retrospective.vercel.app').replace(/\/$/, '');
const SLUG = TOUR.slug ?? TOUR_ID;
const FEED_URL = `${ORIGIN}/${SLUG}/blog/feed.xml`;
const LEDGER = path.join(PATHS.dir, 'emails.json');
const API = 'https://api.buttondown.com/v1';
const KEY = process.env.BUTTONDOWN_API_KEY;

process.env.TOUR = TOUR_ID;
const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const step = (s) => console.log(`\n── ${s}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (EMAIL && DEPLOY && !KEY) console.log('No BUTTONDOWN_API_KEY in .env.local: publishing without emails (add it to email them)');

// ---- 1. commit the stories ----
step('Stories');
const changed = out(`git status --porcelain -- "${PATHS.blogSrc}"`);
if (changed) {
	sh(`git add -- "${PATHS.blogSrc}"`);
	const files = out(`git diff --cached --name-only -- "${PATHS.blogSrc}"`).split('\n').filter(Boolean);
	const msg = `Stories: ${files.map((f) => path.basename(f, '.md')).join(', ')}`;
	execSync('git commit -q -F -', { input: msg, stdio: ['pipe', 'inherit', 'inherit'] });
	console.log(`Committed ${files.length} file(s): ${files.join(', ')}`);
} else console.log('Nothing new to commit');

// ---- 2. build ----
step('Build');
sh('node scripts/build-blog.mjs');
const posts = JSON.parse(fs.readFileSync(PATHS.blogJson, 'utf8')).posts;
const maps = new Set(posts.flatMap((p) => [...p.html.matchAll(/data-map="([^"]+)"/g)].map((m) => m[1])));
const missing = [...maps].filter((r) => !fs.existsSync(path.join(PATHS.photos, 'maps', mapFile(r))));
if (missing.length) {
	// the stills are drawn by the site itself: run it for a moment
	const PORT = 5188;
	console.log(`${missing.length} map snapshot(s) to draw: starting the site on port ${PORT}`);
	const dev = spawn(`npx vite dev --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
	const base = `http://localhost:${PORT}/${SLUG}`;
	try {
		let up = false;
		for (let i = 0; i < 60 && !up; i++) {
			await wait(2000);
			up = await fetch(`${base}/blog`).then((r) => r.ok, () => false);
		}
		if (!up) throw new Error(`the site didn't start on port ${PORT}`);
		execSync('node scripts/build-email-images.mjs', { stdio: 'inherit', env: { ...process.env, BASE: base } });
	} finally {
		// npx under a shell: stop the whole tree
		if (process.platform === 'win32') execSync(`taskkill /pid ${dev.pid} /T /F`, { stdio: 'ignore' });
		else dev.kill();
	}
} else sh('node scripts/build-email-images.mjs');
sh('node scripts/build-feed.mjs');

if (!DEPLOY) {
	console.log('\nBuilt; not deployed (--no-deploy).');
	process.exit(0);
}

// ---- 3. deploy ----
step('Deploy to production');
sh('node scripts/deploy.mjs --prod');

// ---- 4. the live feed, and the emails ----
step('Check the live feed');
/** @returns {Promise<{ slug: string, title: string, link: string, html: string }[]>} */
async function liveItems() {
	const xml = await fetch(FEED_URL, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : ''));
	const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
	return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
		const link = /<link>([^<]+)<\/link>/.exec(item)?.[1] ?? '';
		const cdata = /<content:encoded><!\[CDATA\[([\s\S]*)\]\]><\/content:encoded>/.exec(item)?.[1] ?? '';
		return {
			slug: link.split('/').at(-1) ?? '',
			title: unesc(/<title>([\s\S]*?)<\/title>/.exec(item)?.[1] ?? ''),
			link,
			html: cdata.replaceAll(']]]]><![CDATA[>', ']]>')
		};
	});
}
let live = [];
for (let i = 0; i < 12; i++) {
	live = await liveItems();
	if (posts.every((p) => live.some((l) => l.slug === p.slug))) break;
	await wait(5000);
}
const absent = posts.filter((p) => !live.some((l) => l.slug === p.slug));
if (absent.length) throw new Error(`The live feed is missing ${absent.map((p) => p.slug).join(', ')}: not emailing anything`);
console.log(`${FEED_URL}: ${live.length} story(ies)`);

if (!EMAIL || !KEY) {
	console.log(EMAIL ? '\nPublished. Emails skipped: no BUTTONDOWN_API_KEY.' : '\nPublished. Emails skipped (--no-email).');
	process.exit(0);
}

step(SEND ? 'Email new stories' : 'Draft emails for new stories');
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const api = async (method, url, body) => {
	const r = await fetch(`${API}${url}`, {
		method,
		headers: { Authorization: `Token ${KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const text = await r.text();
	if (!r.ok) throw new Error(`Buttondown ${method} ${url}: ${r.status} ${text.slice(0, 300)}`);
	return JSON.parse(text);
};
const fresh = live.filter((l) => !ledger[l.slug]).reverse(); // oldest first
if (!fresh.length) console.log('Every story has been emailed already');
for (const item of fresh) {
	// always a draft first (nothing goes out by accident); sending is a separate, deliberate update
	const email = await api('POST', '/emails', { subject: item.title, body: item.html, status: 'draft' });
	ledger[item.slug] = { id: email.id, title: item.title, status: 'draft', at: new Date().toISOString() };
	if (SEND) {
		await api('PATCH', `/emails/${email.id}`, { status: 'about_to_send' });
		ledger[item.slug].status = 'sent';
	}
	fs.writeFileSync(LEDGER, `${JSON.stringify(ledger, null, '\t')}\n`);
	console.log(`${SEND ? 'Sent' : 'Drafted'}: ${item.title}`);
}
if (fresh.length) {
	sh(`git add -- "${LEDGER}"`);
	execSync('git commit -q -F -', { input: `Emails: ${SEND ? 'sent' : 'drafted'} ${fresh.map((f) => f.slug).join(', ')}`, stdio: ['pipe', 'inherit', 'inherit'] });
}
console.log(
	`\nPublished.${fresh.length && !SEND ? ` ${fresh.length} draft(s) waiting in Buttondown (Emails → Drafts): check and send.` : ''}`
);
