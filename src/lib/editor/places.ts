// Place mentions in a story, linked to the moment the ride was there. The gazetteer
// (scripts/build-places.mjs) gives every place on the route its names and visits; this finds them
// in the story's text (as written, capitalised; "the" in front allowed: "the Lakes"), and the
// editor underlines each one and offers to link it to the visit on the story's own day, else the
// first: [the Lakes](tour:2026-09-16T10:29).
//
// The underlines are only worked out once typing pauses, and never on the word under the cursor:
// on iPad Safari, redrawing the text being typed loses the cursor (each new letter replaced the
// last), so nothing near it changes while you write.
import { Extension, type Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

export interface Place {
	name: string;
	kind: string;
	aliases?: string[];
	/** [day, epoch seconds] */
	visits: [string, number][];
}

/** a mention found in the story */
export interface Mention {
	from: number;
	to: number;
	text: string;
	place: Place;
}

// capitalised words that are also village names: not worth an underline every time they open a sentence
const COMMON = new Set(
	'Street Church Bridge Hill Lane Bank Mill Green Common Cross Moor Wood Park Field Wells Bath Reading March Rest Ford Rock Bay Beach Water Castle Hall Farm Gate Heath Marsh Pool Port Rise Shop Station Tower Town Way Well Wick Wold Ash Oak Elm Box Buckle Hope Over Under Long Little Great High Low North South East West New Old'.split(' ')
);
const PAUSE_MS = 700;
const key = new PluginKey<DecorationSet>('places');

/** Builds the finder from the gazetteer: one pattern for every name, the longest first. */
export function placeFinder(places: Place[]) {
	const byName = new Map<string, Place>();
	for (const p of places) {
		for (const raw of [p.name, ...(p.aliases ?? [])]) {
			const name = raw.replace(/^the\s+/i, '');
			if (name.length < 4 || COMMON.has(name)) continue;
			// a park's own names win over a village called the same
			if (!byName.has(name) || p.kind === 'park') byName.set(name, p);
		}
	}
	if (!byName.size) return () => [] as { index: number; text: string; place: Place }[];
	const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(esc);
	const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:[Tt]he\\s+)?(${names.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
	return (text: string) => [...text.matchAll(re)].map((m) => ({ index: m.index!, text: m[0], place: byName.get(m[1])! }));
}

/** Every mention in the document that isn't a link already (and, if given, doesn't touch `avoid`). */
export function findMentions(doc: PmNode, find: ReturnType<typeof placeFinder>, avoid?: number): Mention[] {
	const out: Mention[] = [];
	doc.descendants((node, pos) => {
		if (!node.isTextblock) return true;
		if (node.type.name === 'photo' || node.type.name === 'mapShot') return false; // captions stay plain
		// the block's text, with what's linked blanked out (same length, so offsets hold)
		let text = '';
		node.forEach((child) => {
			const t = child.isText ? child.text! : ' '.repeat(child.nodeSize);
			text += child.marks.some((m) => m.type.name === 'link') ? ' '.repeat(t.length) : t;
		});
		for (const m of find(text)) {
			const from = pos + 1 + m.index;
			const to = from + m.text.length;
			if (avoid != null && avoid >= from && avoid <= to) continue;
			out.push({ from, to, text: m.text, place: m.place });
		}
		return false;
	});
	return out;
}

/** The visit to link: the one on the story's day, else the first. */
export const visitFor = (place: Place, day: string) => place.visits.find((v) => v[0] === day) ?? place.visits[0];

export interface PlacesOptions {
	find: ReturnType<typeof placeFinder>;
	/** a tap on an underlined mention */
	onPick: (m: Mention, view: EditorView) => void;
}

/** The underlines, and the tap that offers a link. */
export const PlaceMentions = Extension.create<PlacesOptions>({
	name: 'placeMentions',
	addOptions() {
		return { find: () => [], onPick: () => {} };
	},
	addProseMirrorPlugins() {
		const { find, onPick } = this.options;
		const scan = (doc: PmNode, cursor: number) =>
			DecorationSet.create(
				doc,
				findMentions(doc, find, cursor).map((m) =>
					Decoration.inline(m.from, m.to, { class: 'place-mention' }, { mention: m, inclusiveStart: false, inclusiveEnd: false })
				)
			);
		return [
			new Plugin<DecorationSet>({
				key,
				state: {
					init: (_, state) => scan(state.doc, state.selection.head),
					apply: (tr, set, _old, state) => (tr.getMeta(key) === 'scan' ? scan(state.doc, state.selection.head) : set.map(tr.mapping, tr.doc))
				},
				props: {
					decorations: (state) => key.getState(state),
					handleClick: (view, pos) => {
						const hit = key.getState(view.state)?.find(pos, pos)[0];
						if (hit) onPick((hit.spec as { mention: Mention }).mention, view);
						return false;
					}
				},
				// look again once typing pauses
				view: () => {
					let timer: ReturnType<typeof setTimeout> | undefined;
					return {
						update: (view, prev) => {
							if (view.state.doc.eq(prev.doc)) return;
							clearTimeout(timer);
							timer = setTimeout(() => !view.isDestroyed && view.dispatch(view.state.tr.setMeta(key, 'scan').setMeta('addToHistory', false)), PAUSE_MS);
						},
						destroy: () => clearTimeout(timer)
					};
				}
			})
		];
	}
});

/** Link a mention to its visit: [the Lakes](tour:2026-09-16T10:29). */
export function linkMention(editor: Editor, m: Mention, visit: [string, number], clock: (t: number) => string) {
	const href = `tour:${visit[0]}T${clock(visit[1])}`;
	editor.chain().setTextSelection({ from: m.from, to: m.to }).setLink({ href }).setTextSelection(m.to).run();
}

/** Look for mentions again now (the gazetteer has arrived, or the story's day changed). */
export function rescan(view: EditorView) {
	if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(key, 'scan').setMeta('addToHistory', false));
}
