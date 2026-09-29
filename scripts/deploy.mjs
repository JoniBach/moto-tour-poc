// Build locally and upload only the build output to Vercel as a *preview* deployment
// (Vercel protects previews by default: only people signed in to your account can open them).
//   node scripts/deploy.mjs            preview
//   node scripts/deploy.mjs --prod     production (public URL) — only once you mean it
// Steps: pack day files (.gz) -> vercel build -> drop the plain day files from the output
// (the app loads the .gz copies) -> vercel deploy --prebuilt.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const prod = process.argv.includes('--prod');
// which set of release flags the build uses (src/lib/flags.ts); FEATURES passes straight through
process.env.RELEASE = prod ? 'production' : 'preview';
console.log(`Release flags: ${process.env.RELEASE} set${process.env.FEATURES ? `, overrides: ${process.env.FEATURES}` : ''}`);
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

// the plain day files are working copies for the build scripts; the app reads the .gz ones
const days = '.vercel/output/static/data/days';
let dropped = 0;
for (const day of fs.readdirSync(days))
	for (const f of fs.readdirSync(path.join(days, day)))
		if (/\.(bin|json)$/.test(f) && fs.existsSync(path.join(days, day, `${f}.gz`))) {
			fs.rmSync(path.join(days, day, f));
			dropped++;
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
