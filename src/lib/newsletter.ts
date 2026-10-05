// The mailing-list prompt's memory (src/lib/blog/SubscribePrompt.svelte), kept in this browser
// only: whether the visitor subscribed, said no, or "maybe later", and until when not to ask.
// Storage can be missing or throw (private windows, blocked site data): then it asks, and
// remembers nothing.

import { base } from '$app/paths';

const KEY = 'gt-newsletter';
const DAY = 24 * 60 * 60 * 1000;

/** how long each answer keeps the prompt away: yes is for good */
export const QUIET_DAYS = { later: 3, no: 60 } as const;
export type Answer = 'yes' | keyof typeof QUIET_DAYS;

/** Should this visitor be asked? No if they've subscribed, or said no / later recently. */
export function shouldAsk(now = Date.now()): boolean {
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { answer: Answer; until?: number } | null;
		if (!saved) return true;
		if (saved.answer === 'yes') return false;
		return !(saved.until && now < saved.until);
	} catch {
		return true;
	}
}

/** What's counted (src/routes/api/nl): the prompt shown; its answers, "later" split by how it was
 * given (the button, ×, Esc); and a subscribe from the inline form. */
export const EVENTS = ['shown', 'yes', 'later', 'later-x', 'later-esc', 'no', 'form-yes'] as const;
export type Event = (typeof EVENTS)[number];

/** Add one to an event's count, fire and forget: a beacon survives the page moving on. Not in dev. */
export function count(event: Event) {
	if (import.meta.env.DEV) return;
	try {
		navigator.sendBeacon(`${base}/api/nl`, event);
	} catch {
		// uncounted
	}
}

/** Remember the visitor's answer (subscribing anywhere on the site counts as yes). */
export function remember(answer: Answer, now = Date.now()) {
	try {
		localStorage.setItem(KEY, JSON.stringify(answer === 'yes' ? { answer } : { answer, until: now + QUIET_DAYS[answer] * DAY }));
	} catch {
		// nothing to remember with: it'll ask again next visit
	}
}
