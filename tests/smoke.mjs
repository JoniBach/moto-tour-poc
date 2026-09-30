// Smoke tests against a running site (dev server, `npm run preview`, or a deployment):
//   BASE=http://localhost:5199/the-parks-26 npm run test:smoke   (the tour's base path included)
// Needs Chrome (CHROME=path overrides the default Windows location). Checks that each released
// view loads and plays without errors, and that the blog meets WCAG 2.2 AAA per axe-core.
// Exits non-zero on any failure.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE ?? 'http://localhost:5199';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DAY = process.env.DAY ?? '2026-09-16';
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

let failures = 0;
const fail = (msg) => {
	failures++;
	console.log(`  ✗ ${msg}`);
};
const pass = (msg) => console.log(`  ✓ ${msg}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
let errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.text()) && errors.push(m.text()));
// a Content Security Policy that blocks something the site needs
await page.evaluateOnNewDocument(() =>
	document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP blocked ${e.blockedURI} (${e.violatedDirective})`))
);

async function visit(path, settle = 5000) {
	errors = [];
	const r = await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 120000 });
	await wait(settle);
	const status = r?.status() ?? 0;
	return status === 304 ? 200 : status; // served from cache: fine
}

// ---- the tour's views --------------------------------------------------------------------
for (const view of ['3d', '2d', 'globe']) {
	console.log(`tour · ${view}`);
	const status = await visit(`/day/${DAY}?t=10:42&view=${view}`, 7000);
	const shown = await page.evaluate(() => new URL(location.href).searchParams.get('view') ?? '3d');
	if (shown !== view) {
		pass(`${view} is switched off in this build (showed ${shown})`);
		continue;
	}
	if (status !== 200) fail(`status ${status}`);
	const drawn = await page.evaluate(() => !!document.querySelector('canvas'));
	drawn ? pass('drawn') : fail('nothing drawn');
	await page.keyboard.press('Space');
	await wait(2500);
	await page.keyboard.press('Space');
	errors.length ? fail(`errors: ${errors.slice(0, 3).join(' | ')}`) : pass('played without errors');
}

// ---- the blog ----------------------------------------------------------------------------
// the site's Content Security Policy (rightly) refuses the injected axe script: the views above
// ran under it; the accessibility audit below runs with it bypassed
await page.setBypassCSP(true);
const blogStatus = await visit('/blog', 1500);
if (blogStatus === 404) console.log('blog · switched off in this build');
else {
	// and one of the day's stories, if it has one
	await visit(`/blog/${DAY}`, 500);
	// the link is absolute (it carries the site's base path, which BASE already includes)
	let story = await page.evaluate(() => document.querySelector('h3.title a')?.getAttribute('href') ?? null);
	const basePath = new URL(BASE).pathname.replace(/\/$/, '');
	if (story && basePath && story.startsWith(basePath)) story = story.slice(basePath.length);
	for (const path of ['/blog', `/blog/${DAY}`, ...(story ? [story] : [])]) {
		console.log(`blog · ${path}`);
		const status = await visit(path, 1500);
		if (status !== 200) fail(`status ${status}`);
		await page.addStyleTag({ content: '.day{content-visibility:visible!important}' });
		await page.addScriptTag({ content: axeSource });
		const violations = await page.evaluate(async () =>
			// eslint-disable-next-line no-undef
			(await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => `${v.id} (${v.nodes.length})`)
		);
		violations.length ? fail(`axe: ${violations.join(', ')}`) : pass('axe WCAG 2.2 AAA: clean');
		errors.length ? fail(`errors: ${errors.slice(0, 3).join(' | ')}`) : pass('no errors');
	}
}

// ---- unknown pages -------------------------------------------------------------------------
console.log('404');
const missing = await visit('/nowhere-at-all', 500);
missing === 404 && (await page.evaluate(() => /isn't here/.test(document.body.textContent ?? '')))
	? pass('friendly 404')
	: fail(`status ${missing} / no friendly page`);

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
