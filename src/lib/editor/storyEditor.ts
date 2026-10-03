// The story editor's document: Tiptap (ProseMirror) set up for exactly what a story can hold, read
// from and written back to the story's Markdown (@tiptap/markdown, which parses with Marked like
// the build's renderer, src/lib/story.js). So what can be written is what gets published:
//  - paragraphs, ## and ### headings (the title is the page's h1), bold, italic, links, quotes,
//    bullet and numbered lists (and, kept from a file though not on the toolbar: inline code, code
//    blocks, rules, strikethrough)
//  - tour photos, ![caption](photo:ID) on a line of their own: a figure with the photo and an
//    editable caption
//  - map snapshots, ![caption](map:2026-09-16T11:30@13) on a line of their own: the 2D map at that
//    moment (drawn as you write, src/lib/map/mapShot.ts), with zoom and time controls and a caption
import { Editor, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Placeholder } from '@tiptap/extensions';
import { TextSelection } from '@tiptap/pm/state';
import { MAP_ZOOM, mapRef, parseMapRef } from '$lib/story.js';

const PHOTO_LINE = /^!\[([^\]\n]*)\]\(photo:([\w-]+)\)[ \t]*(?:\n+|$)/;

const MAP_LINE = /^!\[([^\]\n]*)\]\(map:([^)\s]+)\)[ \t]*(?:\n+|$)/;

/**
 * A map snapshot with its caption: the 2D map at a moment of a day's ride. The editor draws it as
 * you write (the same drawing as the story page), with − / + for the zoom and the time to change
 * the moment.
 */
export const MapFigure = Node.create({
	name: 'mapShot',
	group: 'block',
	content: 'text*',
	marks: '',
	defining: true,
	isolating: true,
	draggable: true,

	addAttributes() {
		return { day: { default: '' }, time: { default: '12:00' }, zoom: { default: MAP_ZOOM } };
	},

	parseHTML() {
		return [
			{
				tag: 'figure[data-map]',
				contentElement: 'figcaption',
				getAttrs: (el) => parseMapRef((el as HTMLElement).dataset.map ?? '') ?? false
			}
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const ref = mapRef(node.attrs as { day: string; time: string; zoom: number });
		return ['figure', mergeAttributes(HTMLAttributes, { class: 'map-shot', 'data-map': ref }), ['div', { class: 'map-frame', contenteditable: 'false' }], ['figcaption', 0]];
	},

	addNodeView() {
		return ({ node, getPos, editor }) => {
			let current = node;
			const dom = document.createElement('figure');
			dom.className = 'map-shot';
			const frame = document.createElement('div');
			frame.className = 'map-frame';
			frame.contentEditable = 'false';
			const tools = document.createElement('div');
			tools.className = 'map-tools';
			tools.contentEditable = 'false';
			const caption = document.createElement('figcaption');
			dom.append(frame, tools, caption);

			const set = (attrs: Record<string, unknown>) => {
				const pos = typeof getPos === 'function' ? getPos() : undefined;
				if (pos == null) return;
				editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, ...attrs }));
			};
			const button = (label: string, title: string, act: () => void) => {
				const b = document.createElement('button');
				b.type = 'button';
				b.textContent = label;
				b.title = title;
				b.setAttribute('aria-label', title);
				b.addEventListener('mousedown', (e) => e.preventDefault());
				b.addEventListener('click', act);
				return b;
			};
			const time = document.createElement('input');
			time.type = 'time';
			time.setAttribute('aria-label', 'The moment (the tour’s local time)');
			time.addEventListener('change', () => /^\d{2}:\d{2}$/.test(time.value) && set({ time: time.value }));
			tools.append(
				button('−', 'Zoom out', () => set({ zoom: Math.max(5, (current.attrs.zoom as number) - 1) })),
				button('+', 'Zoom in', () => set({ zoom: Math.min(17, (current.attrs.zoom as number) + 1) })),
				time
			);

			let drawing: AbortController | null = null;
			let drawn = '';
			const draw = () => {
				const ref = mapRef(current.attrs as { day: string; time: string; zoom: number });
				dom.dataset.map = ref;
				time.value = current.attrs.time as string;
				if (ref === drawn) return;
				drawn = ref;
				drawing?.abort();
				drawing = new AbortController();
				import('$lib/blog/shots').then(({ drawFrame }) => drawFrame(frame, drawing!.signal));
			};
			// drawn once it's in the page (it needs its width)
			requestAnimationFrame(draw);

			return {
				dom,
				contentDOM: caption,
				update: (n) => {
					if (n.type !== current.type) return false;
					current = n;
					draw();
					return true;
				},
				// the map and its controls are the node view's own, not the editor's
				stopEvent: (e) => tools.contains(e.target as globalThis.Node) || frame.contains(e.target as globalThis.Node),
				ignoreMutation: (m) => !caption.contains(m.target),
				destroy: () => drawing?.abort()
			};
		};
	},

	markdownTokenizer: {
		name: 'mapShot',
		level: 'block',
		start: (src: string) => src.indexOf('!['),
		tokenize: (src: string) => {
			const m = MAP_LINE.exec(src);
			const shot = m && parseMapRef(m[2]);
			return m && shot ? { type: 'mapShot', raw: m[0], caption: m[1], ...shot } : undefined;
		}
	},

	parseMarkdown: (token) => {
		const { caption, day, time, zoom } = token as unknown as { caption?: string; day: string; time: string; zoom: number };
		return { type: 'mapShot', attrs: { day, time, zoom }, content: caption ? [{ type: 'text', text: caption }] : [] };
	},

	renderMarkdown: (node) => {
		const caption = (node.content ?? []).map((c) => c.text ?? '').join('').replace(/[[\]]/g, '');
		return `![${caption}](map:${mapRef(node.attrs as { day: string; time: string; zoom: number })})`;
	}
});

/** A tour photo with its caption (the caption is the node's text; the photo is its id). */
export const PhotoFigure = Node.create<{ src: (id: string) => string; known: (id: string) => boolean }>({
	name: 'photo',
	group: 'block',
	content: 'text*',
	marks: '',
	defining: true,
	isolating: true,
	draggable: true,

	addOptions() {
		return { src: (id) => id, known: () => true };
	},

	addAttributes() {
		return { id: { default: '' } };
	},

	parseHTML() {
		return [
			{
				tag: 'figure[data-photo]',
				contentElement: 'figcaption',
				getAttrs: (el) => ({ id: (el as HTMLElement).dataset.photo ?? '' })
			}
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const id = node.attrs.id as string;
		const known = this.options.known(id);
		return [
			'figure',
			mergeAttributes(HTMLAttributes, { 'data-photo': id, class: known ? null : 'missing' }),
			known
				? ['img', { src: this.options.src(id), alt: '', contenteditable: 'false', draggable: 'false' }]
				: ['div', { class: 'missing-photo', contenteditable: 'false' }, `Photo ${id} isn’t in the tour (or is kept private): it won’t show`],
			['figcaption', 0]
		];
	},

	markdownTokenizer: {
		name: 'photo',
		level: 'block',
		start: (src: string) => src.indexOf('!['),
		tokenize: (src: string) => {
			const m = PHOTO_LINE.exec(src);
			return m ? { type: 'photo', raw: m[0], caption: m[1], id: m[2] } : undefined;
		}
	},

	parseMarkdown: (token) => {
		const { caption, id } = token as unknown as { caption?: string; id?: string };
		return { type: 'photo', attrs: { id: id ?? '' }, content: caption ? [{ type: 'text', text: caption }] : [] };
	},

	renderMarkdown: (node) => {
		const caption = (node.content ?? []).map((c) => c.text ?? '').join('').replace(/[[\]]/g, '');
		return `![${caption}](photo:${node.attrs?.id ?? ''})`;
	}
});

export interface StoryEditorOptions {
	/** the element that becomes the editable story (its classes are kept) */
	el: HTMLElement;
	markdown: string;
	photoSrc: (id: string) => string;
	photoKnown: (id: string) => boolean;
	/** after any change to the text (called on every transaction that changes it: keep it cheap) */
	onChange: () => void;
	/** selection or formatting moved (for the toolbar's state) */
	onSelection: () => void;
}

export function createStoryEditor(o: StoryEditorOptions) {
	const className = o.el.className;
	return new Editor({
		element: { mount: o.el },
		extensions: [
			StarterKit.configure({
				heading: { levels: [2, 3] },
				// no Markdown for underline; code, code blocks, rules and strikethrough have no buttons but
				// are kept, so a story that has them comes back as it was
				underline: false,
				link: { openOnClick: false, autolink: true, linkOnPaste: true }
			}),
			Markdown,
			PhotoFigure.configure({ src: o.photoSrc, known: o.photoKnown }),
			MapFigure,
			Placeholder.configure({
				placeholder: ({ node, editor }) =>
					node.type.name === 'photo' || node.type.name === 'mapShot' ? 'Add a caption…' : editor.isEmpty ? 'Write the story…' : '',
				includeChildren: false
			})
		],
		content: o.markdown,
		contentType: 'markdown',
		editorProps: {
			// ProseMirror sets the editable element's class: keep the page's own (its styles apply)
			attributes: { class: className, 'aria-label': 'The story', spellcheck: 'true' }
		},
		onCreate: ({ editor }) => softBreaks(editor),
		onUpdate: o.onChange,
		onSelectionUpdate: o.onSelection,
		onTransaction: ({ transaction }) => {
			if (!transaction.docChanged) o.onSelection();
		}
	});
}

/**
 * Markdown's soft line breaks (a newline inside a paragraph, as when a line is wrapped in the file)
 * are spaces: the parser keeps them as newlines in the text, which would show as line breaks and be
 * saved back as hard ones. Call after loading Markdown (not part of the undo history).
 */
export function softBreaks(editor: Editor) {
	const found: { pos: number; size: number; text: string; marks: readonly import('@tiptap/pm/model').Mark[] }[] = [];
	editor.state.doc.descendants((n, pos) => {
		if (n.isText && n.text?.includes('\n')) found.push({ pos, size: n.nodeSize, text: n.text.replace(/[ \t]*\n[ \t]*/g, ' '), marks: n.marks });
	});
	if (!found.length) return;
	const tr = editor.state.tr;
	for (const t of found.reverse()) tr.replaceWith(t.pos, t.pos + t.size, editor.schema.text(t.text, t.marks));
	editor.view.dispatch(tr.setMeta('addToHistory', false));
}

/** Insert a figure (a photo, or a map snapshot) at the cursor, and put the cursor in its caption. */
export function insertFigure(editor: Editor, type: 'photo' | 'mapShot', attrs: Record<string, unknown>) {
	editor.chain().focus().insertContent({ type, attrs }).run();
	// the cursor lands after the new figure: move it into the caption of the nearest one before it
	const { doc, selection } = editor.state;
	let caption = -1;
	doc.descendants((n, pos) => {
		if (pos >= selection.from) return false;
		if (n.type.name === type) caption = pos + 1;
		return n.type.name !== type;
	});
	if (caption >= 0) editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(doc, caption)));
	editor.commands.focus();
}
export const insertPhoto = (editor: Editor, id: string) => insertFigure(editor, 'photo', { id });

/** The photo ids embedded in the story, in order. */
export function photoIds(editor: Editor): string[] {
	const out: string[] = [];
	editor.state.doc.descendants((n) => {
		if (n.type.name === 'photo') out.push(n.attrs.id as string);
		return n.type.name !== 'photo';
	});
	return out;
}
