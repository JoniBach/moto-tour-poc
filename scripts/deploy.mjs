// Build locally and upload only the build output to Vercel as a *preview* deployment
// (Vercel protects previews by default: only people signed in to your account can open them).
//   node scripts/deploy.mjs            preview
//   node scripts/deploy.mjs --prod     production (public URL) — only once you mean it
//   TOUR=<id> node scripts/deploy.mjs  another tour (tours/<id>/); default uk-2026
// Steps: pack day files (.gz) -> vercel build -> drop the plain day files from the output
// (the app loads the .gz copies) and every other tour's data and photos -> vercel deploy --prebuilt.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TOUR_ID } from './lib/tour.mjs';

const prod = process.argv.includes('--prod');
// which set of release flags the build uses (src/lib/flags.ts); FEATURES passes straight through
process.env.RELEASE = prod ? 'production' : 'preview';
console.log(`Release flags: ${process.env.RELEASE} set${process.env.FEATURES ? `, overrides: ${process.env.FEATURES}` : ''}`);
// the child builds (vite, the scripts) pick the tour up from here too
process.env.TOUR = TOUR_ID;
console.log(`Tour: ${TOUR_ID}`);
const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });
// pinned: a deploy shouldn't change because a new CLI came out (bump deliberately)
const VERCEL = 'vercel@61.0.0';
const vercel = (args) => sh(`npx --yes ${VERCEL} ${args}`);

if (!fs.existsSync('.vercel/project.json')) vercel('link --yes');
vercel(`pull --yes --environment=${prod ? 'production' : 'preview'}`);
sh('node scripts/pack.mjs');
// refuses (non-zero exit -> execSync throws) if any personal position falls in a privacy zone
sh('node scripts/audit-privacy.mjs');
vercel(`build${prod ? ' --prod' : ''}`);

// Building on Windows writes each function's handler as a Windows path relative to somewhere
// else ("..\\..\\workspaces\\…\\.svelte-kit\\vercel-tmp\\index.js"); Vercel's Linux runtime can't
// load that, so every request reaching the function (unknown URLs, whose 404 page it renders)
// failed. The file itself is inside the function: point the handler at it.
const findConfigs = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = path.join(dir, e.name);
		return e.isDirectory() ? findConfigs(p) : e.name === '.vc-config.json' ? [p] : [];
	});
for (const file of fs.existsSync('.vercel/output/functions') ? findConfigs('.vercel/output/functions') : []) {
	const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
	if (!cfg.handler || !/[\\]|\.\./.test(cfg.handler)) continue;
	const parts = cfg.handler.split(/[\\/]/);
	const from = parts.indexOf('.svelte-kit');
	const handler = parts.slice(from).join('/');
	if (from < 0 || !fs.existsSync(path.join(path.dirname(file), handler))) throw new Error(`Can't fix function handler ${cfg.handler} in ${file}`);
	fs.writeFileSync(file, JSON.stringify({ ...cfg, handler }, null, '\t'));
	console.log(`Fixed function handler: ${handler}`);
}

// the plain day files are working copies for the build scripts; the app reads the .gz ones
const days = `.vercel/output/static/data/tours/${TOUR_ID}/days`;
let dropped = 0;
for (const day of fs.readdirSync(days))
	for (const f of fs.readdirSync(path.join(days, day)))
		if (/\.(bin|json)$/.test(f) && fs.existsSync(path.join(days, day, `${f}.gz`))) {
			fs.rmSync(path.join(days, day, f));
			dropped++;
		}
// one deployment is one tour: other tours built on this machine stay here
for (const root of ['.vercel/output/static/data/tours', '.vercel/output/static/photos'])
	for (const id of fs.existsSync(root) ? fs.readdirSync(root) : [])
		if (id !== TOUR_ID) {
			fs.rmSync(path.join(root, id), { recursive: true });
			console.log(`Left out tour ${id}`);
		}
const size = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`Dropped ${dropped} plain day files; output is ${(size('.vercel/output') / 1e6).toFixed(0)} MB`);

// uploads resume, so a dropped connection just means trying again
for (let attempt = 1; ; attempt++) {
	try {
		vercel(`deploy --prebuilt${prod ? ' --prod' : ''}`);
		break;
	} catch (e) {
		if (attempt >= 8) throw e;
		console.log(`Upload interrupted; retrying (${attempt + 1} of 8)…`);
	}
}
