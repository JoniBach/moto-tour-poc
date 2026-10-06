// The mailing list's counts (src/routes/api/nl): how often the prompt was shown and how it was
// answered, read from Upstash Redis. Needs KV_REST_API_URL and KV_REST_API_READ_ONLY_TOKEN in
// .env.local: Vercel keeps the deployed ones secret, so copy them from the database's page in
// Upstash (REST API section); its UPSTASH_REDIS_REST_* names work too. Prefer the read-only token:
// it can look but never change a count.
//   npm run stats:newsletter
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_READ_ONLY_TOKEN ?? process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
	console.error('Missing KV_REST_API_URL / KV_REST_API_READ_ONLY_TOKEN in .env.local (copy them from Upstash, REST API section)');
	process.exit(1);
}

async function redis(...command) {
	const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(command) });
	const body = await res.json();
	if (!res.ok || body.error) throw new Error(`Upstash: ${body.error ?? res.status}`);
	return body.result;
}

const ROWS = [
	['shown', 'Prompt shown'],
	['yes', 'Yes, subscribe'],
	['later', 'Maybe later (button)'],
	['later-x', 'Maybe later (×)'],
	['later-esc', 'Maybe later (Esc)'],
	['no', 'No thanks'],
	['form-yes', 'Subscribed (inline form)']
];
const counts = (await redis('MGET', ...ROWS.map(([key]) => `nl:${key}`))).map(Number);
const n = Object.fromEntries(ROWS.map(([key], i) => [key, counts[i]]));
const pct = (x) => (n.shown ? ` (${Math.round((x / n.shown) * 100)}%)` : '');

const NONE = 'No answer (left the page)';
const width = Math.max(NONE.length, ...ROWS.map(([, label]) => label.length));
for (const [key, label] of ROWS) console.log(`${label.padEnd(width)}  ${String(n[key]).padStart(5)}${key === 'shown' || key === 'form-yes' ? '' : pct(n[key])}`);
const answered = n.yes + n.later + n['later-x'] + n['later-esc'] + n.no;
console.log(`${NONE.padEnd(width)}  ${String(Math.max(0, n.shown - answered)).padStart(5)}${pct(Math.max(0, n.shown - answered))}`);
console.log('\nYes counts submissions; Buttondown has the confirmed subscribers.');
