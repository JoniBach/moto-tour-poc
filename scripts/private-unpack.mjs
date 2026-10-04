// Restore a private pack (scripts/private-pack.mjs) into this checkout:
//
//   PACK_PASSWORD=… npm run private:unpack -- private-packs/uk-2026-dev-2026-10-04.tgz.enc
//
// Checks the password and that the file is whole (GCM's authentication tag) *before* anything is
// written, then unpacks into the repo. The secrets become .env.local; if there's one already,
// they're left beside it as .env.local.pack to merge by hand.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import { HEADER, IV, SALT, TAG, keyFrom, tarCommand } from './lib/private-pack.mjs';

const file = process.argv.slice(2).find((a) => !a.startsWith('-'));
const password = process.env.PACK_PASSWORD;
if (!file || !fs.existsSync(file)) throw new Error('Which pack? npm run private:unpack -- <file>');
if (!password) throw new Error('Set PACK_PASSWORD to the password the pack was made with');

const size = fs.statSync(file).size;
const fd = fs.openSync(file, 'r');
const head = Buffer.alloc(HEADER.length + SALT + IV);
fs.readSync(fd, head, 0, head.length, 0);
if (!head.subarray(0, HEADER.length).equals(HEADER)) throw new Error(`${file} isn't a private pack`);
const tag = Buffer.alloc(TAG);
fs.readSync(fd, tag, 0, TAG, size - TAG);
fs.closeSync(fd);
const salt = head.subarray(HEADER.length, HEADER.length + SALT);
const iv = head.subarray(HEADER.length + SALT);
const key = keyFrom(password, salt);
const body = { start: head.length, end: size - TAG - 1 };

/** Decrypt the body into `sink` (or nowhere); throws if the password is wrong or the file damaged. */
async function decrypt(sink) {
	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	for await (const chunk of fs.createReadStream(file, body).pipe(decipher)) if (sink && !sink.write(chunk)) await once(sink, 'drain');
}

// first pass: verify only (GCM only knows the data was genuine once it has seen all of it)
console.log('Checking the password and the file…');
try {
	await decrypt(null);
} catch {
	throw new Error('Wrong password, or the file is damaged or incomplete: nothing was unpacked');
}

// second pass: into tar
console.log('Unpacking…');
const tar = spawn(tarCommand(), ['-xzf', '-'], { stdio: ['pipe', 'inherit', 'inherit'] });
const closed = once(tar, 'close');
await decrypt(tar.stdin);
tar.stdin.end();
const [code] = await closed;
if (code) throw new Error(`tar exited with ${code}`);

const manifest = fs.existsSync('private-pack.json') ? JSON.parse(fs.readFileSync('private-pack.json', 'utf8')) : null;
fs.rmSync('private-pack.json', { force: true });
if (fs.existsSync('.env.local.pack')) {
	if (fs.existsSync('.env.local')) console.log('.env.local already here: the packed secrets are in .env.local.pack to merge by hand');
	else {
		fs.renameSync('.env.local.pack', '.env.local');
		console.log('Secrets restored to .env.local');
	}
}
if (manifest) console.log(`Restored ${manifest.tour} (${manifest.tier}, packed ${manifest.made.slice(0, 10)}): ${manifest.files.join(', ')}`);
console.log('Next: npm run dev');
