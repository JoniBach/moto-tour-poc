// Counts how the mailing list is answered (src/lib/newsletter.ts count): one Redis counter per
// event, nothing about who. POST a known event name as the body; anything else is ignored. The
// counters live in Upstash Redis (free tier, added from the Vercel Marketplace, which sets the env
// vars); read them in Upstash's Data Browser (keys nl:*). Without the env vars it counts nothing.
import { env } from '$env/dynamic/private';
import { EVENTS } from '$lib/newsletter';

export const prerender = false;

export async function POST({ request }) {
	const event = (await request.text()).trim();
	const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
	const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
	if (url && token && (EVENTS as readonly string[]).includes(event)) {
		await fetch(`${url}/incr/nl:${event}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
	}
	return new Response(null, { status: 204 });
}
