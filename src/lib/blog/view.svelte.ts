// The blog's view settings: which kinds of event to show, which days (index only), and whether
// back-to-back events of the same kind are grouped (on by default). Shared across blog pages while the reader
// moves between them, and mirrored in the URL (?show=photos,post&from=…&to=…&group=0) so a
// filtered view can be linked to. Pages are prerendered with everything showing; the URL is
// applied once the page is running.
import type { FeedEvent } from '$lib/data';
import { on } from '$lib/flags';
import { duration, eventSentence, plural } from '$lib/blog';

const ALL_TYPES = [
	{ key: 'ride', label: 'Set off and arrived', icon: '▶' },
	{ key: 'break', label: 'Breaks', icon: '⏸' },
	{ key: 'photos', label: 'Photos', icon: '📷' },
	{ key: 'pin', label: 'Notes and places', icon: '▲' },
	{ key: 'post', label: 'Stories', icon: '✎' }
] as const;
export type TypeKey = (typeof ALL_TYPES)[number]['key'];
/** the kinds offered: photos and stories only when released (src/lib/flags.ts) */
export const TYPES = ALL_TYPES.filter((t) => (t.key === 'photos' ? on('photos') : t.key === 'post' ? on('stories') : true));

export const typeOf = (e: FeedEvent): TypeKey => (e.kind === 'start' || e.kind === 'finish' ? 'ride' : e.kind);

const ALL = TYPES.map((t) => t.key);

export const view = $state({
	types: [...ALL] as TypeKey[],
	from: '' as string, // first day shown ('' = from the start)
	to: '' as string, // last day shown ('' = to the end)
	group: true
});

export const shows = (e: FeedEvent) => view.types.includes(typeOf(e));
export const inRange = (day: string) => (!view.from || day >= view.from) && (!view.to || day <= view.to);
/** how many settings differ from the default "everything, grouped" (for the panel's summary) */
export const changed = () => (view.types.length < ALL.length ? 1 : 0) + (view.from || view.to ? 1 : 0) + (view.group ? 0 : 1);

export function resetView() {
	view.types = [...ALL];
	view.from = view.to = '';
	view.group = true;
}

export function readUrl(search: URLSearchParams) {
	const show = search.get('show');
	if (show !== null) view.types = ALL.filter((k) => show.split(',').includes(k));
	view.from = search.get('from') ?? view.from;
	view.to = search.get('to') ?? view.to;
	if (search.has('group')) view.group = search.get('group') !== '0';
}

/** The current URL with the settings written in (defaults left out). */
export function withView(url: URL, range: boolean): URL {
	const u = new URL(url);
	for (const k of ['show', 'from', 'to', 'group']) u.searchParams.delete(k);
	if (view.types.length < ALL.length) u.searchParams.set('show', view.types.join(','));
	if (range && view.from) u.searchParams.set('from', view.from);
	if (range && view.to) u.searchParams.set('to', view.to);
	if (!view.group) u.searchParams.set('group', '0');
	return u;
}

// ---- grouping ----------------------------------------------------------------------------

export type Row<E extends FeedEvent> =
	| { kind: 'one'; key: string; e: E }
	| { kind: 'group'; key: string; type: TypeKey; events: E[]; title: string; icon: string };

// set off / arrived alternate, so a run of them isn't "similar"; stories are the heart of the blog
// and always stand on their own
const GROUPS: TypeKey[] = ['break', 'photos', 'pin'];

function groupTitle(type: TypeKey, events: FeedEvent[]): string {
	const places = [...new Set(events.map((e) => e.place).filter(Boolean))];
	const where = places.length === 0 ? '' : places.length <= 3 ? ` near ${places.join(', ').replace(/, ([^,]*)$/, ' and $1')}` : ` in ${places.length} places`;
	switch (type) {
		case 'photos': {
			const n = events.reduce((a, e) => a + (e.kind === 'photos' ? e.photos.length : 0), 0);
			return `${plural(events.length, 'photo stop')} · ${plural(n, 'photo')}${where}`;
		}
		case 'break': {
			const m = events.reduce((a, e) => a + (e.kind === 'break' ? e.minutes : 0), 0);
			return `${plural(events.length, 'break')}, ${duration(m)} in all${where}`;
		}
		default:
			return `${plural(events.length, 'note')}: ${events.map((e) => (e.kind === 'pin' ? e.pin.title : '')).join(', ')}`;
	}
}

/** The day's events after filtering, with back-to-back same-kind runs grouped when asked. */
export function arrange<E extends FeedEvent>(events: E[], group: boolean): Row<E>[] {
	const rows: Row<E>[] = [];
	let run: { e: E; i: number }[] = [];
	const flush = () => {
		if (run.length > 1) {
			const type = typeOf(run[0].e);
			const events = run.map((r) => r.e);
			rows.push({ kind: 'group', key: `g${run[0].i}`, type, events, title: groupTitle(type, events), icon: eventSentence(run[0].e).icon });
		} else if (run.length) rows.push({ kind: 'one', key: `e${run[0].i}`, e: run[0].e });
		run = [];
	};
	events.forEach((e, i) => {
		if (!shows(e)) return;
		const type = typeOf(e);
		if (group && GROUPS.includes(type) && run.length && typeOf(run[0].e) === type) run.push({ e, i });
		else {
			flush();
			run = [{ e, i }];
		}
	});
	flush();
	return rows;
}
