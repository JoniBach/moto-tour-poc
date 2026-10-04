// Everything a fresh checkout is missing, in one encrypted file, to set up another machine:
//
//   npm run private:pack              the built site data, the private inputs and the secrets (~0.5 GB)
//   npm run private:pack -- --full    …and the original photos (+1.7 GB), to re-process them
//   TOUR=<id> npm run private:pack    another tour (default uk-2026)
//
// On the other machine (after git clone + npm install):
//   PACK_PASSWORD=… npm run private:unpack -- <file>
//
// What's in it (all git-ignored, see .gitignore):
//   static/data/tours/<id>/, static/photos/<id>/   built data: npm run dev shows the whole site
//   tours/<id>/gpx/, privacy.json, spotify/         private inputs the data is built from
//   .env.local                                      secrets (Spotify, Buttondown), as .env.local.pack
//   tours/<id>/photos-src/jpg/                      original photos (--full only)
// Not in it: node_modules, the tile cache (data/cache) and .vercel, which rebuild themselves,
// and VERCEL_OIDC_TOKEN, which belongs to one machine.
//
// privacy.json says where family live: the file is encrypted (AES-256-GCM, key from the password
// by scrypt) and safe to carry on a cloud drive or a private release. The password comes from
// PACK_PASSWORD, or one is made up and printed once: keep it somewhere safe, apart from the file.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { PATHS, TOUR_ID } from './lib/tour.mjs';
import { HEADER, keyFrom, tarCommand } from './lib/private-pack.mjs';

const full = process.argv.includes('--full');
const OUT_DIR = 'private-packs';
const stamp = new Date().toISOString().slice(0, 10);
const out = path.join(OUT_DIR, `${TOUR_ID}-${full ? 'full' : 'dev'}-${stamp}.tgz.enc`);

const want = [
	PATHS.out, // static/data/tours/<id>
	PATHS.photos, // static/photos/<id>
	PATHS.gpx,
	PATHS.privacy,
	path.join(PATHS.dir, 'spotify'),
	...(full ? [PATHS.photosSrc] : [])
];
const missing = want.filter((p) => !fs.existsSync(p));
if (missing.length) console.log(`Not here, so not packed: ${missing.join(', ')}`);
const files = want.filter((p) => fs.existsSync(p)).map((p) => p.split(path.sep).join('/'));

// the secrets, without this machine's own Vercel token
const STAGE = path.join(OUT_DIR, '.stage');
fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });
if (fs.existsSync('.env.local')) {
	const env = fs
		.readFileSync('.env.local', 'utf8')
		.split(/\r?\n/)
		.filter((l) => l.trim() && !/^VERCEL_OIDC_TOKEN=/.test(l));
	fs.writeFileSync(path.join(STAGE, '.env.local.pack'), `${env.join('\n')}\n`);
	console.log(`Secrets: ${env.filter((l) => /^\w+=/.test(l)).map((l) => l.split('=')[0]).join(', ')}`);
}
fs.writeFileSync(
	path.join(STAGE, 'private-pack.json'),
	JSON.stringify({ tour: TOUR_ID, tier: full ? 'full' : 'dev', made: new Date().toISOString(), files }, null, '\t')
);

let password = process.env.PACK_PASSWORD;
const madeUp = !password;
if (!password) password = crypto.randomBytes(18).toString('base64url');

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(password, salt), iv);
fs.mkdirSync(OUT_DIR, { recursive: true });
const sink = fs.createWriteStream(out);
sink.write(Buffer.concat([HEADER, salt, iv]));

console.log(`Packing ${files.join(', ')}…`);
// tar the repo's files, then the staged secrets and manifest from their own folder
const staged = fs.readdirSync(STAGE);
const tar = spawn(tarCommand(), ['-czf', '-', ...files, '-C', STAGE, ...staged], { stdio: ['ignore', 'pipe', 'inherit'] });
const done = once(tar, 'close');
for await (const chunk of tar.stdout.pipe(cipher)) if (!sink.write(chunk)) await once(sink, 'drain');
const [code] = await done;
if (code) throw new Error(`tar exited with ${code}`);
// GCM's authentication tag goes on the end: unpack checks nothing was changed or cut short
await new Promise((resolve) => sink.end(cipher.getAuthTag(), resolve));
fs.rmSync(STAGE, { recursive: true, force: true });

const mb = (fs.statSync(out).size / 1e6).toFixed(0);
console.log(`\nWrote ${out} (${mb} MB, encrypted)`);
if (madeUp) console.log(`Password (shown once, keep it apart from the file): ${password}`);
console.log(`On the other machine: PACK_PASSWORD=… npm run private:unpack -- ${path.basename(out)}`);
