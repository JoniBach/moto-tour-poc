// The mailing-list prompt's memory (src/lib/blog/SubscribePrompt.svelte), kept in this browser
// only: whether the visitor subscribed, said no, or "maybe later", and until when not to ask.
// Storage can be missing or throw (private windows, blocked site data): then it asks, and
// remembers nothing.

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

/** Remember the visitor's answer (subscribing anywhere on the site counts as yes). */
export function remember(answer: Answer, now = Date.now()) {
	try {
		localStorage.setItem(KEY, JSON.stringify(answer === 'yes' ? { answer } : { answer, until: now + QUIET_DAYS[answer] * DAY }));
	} catch {
		// nothing to remember with: it'll ask again next visit
	}
}
