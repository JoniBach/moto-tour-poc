// Step 1 of the WYSIWYG story editor: a bare Tiptap editor with on-device keystroke timing, to
// check typing on iPad Safari before building on it. Used twice: inside the site
// (/wysiwyg/spike, with the site's layout and styles) and alone (static/tiptap-test.html, bundled
// with nothing but Tiptap). Temporary: goes once the editor is built.
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';

const SAMPLE = `## Up and over Honister

We climbed out of Borrowdale with the cloud sitting on the tops, the road wet and shining, and every bend opened onto another view down to the lake. The slate mine at the top was quiet, a few walkers huddled in the café doorway.

Coming down the far side the sun **broke through** over Buttermere, and for a minute the whole valley went *green and gold*.

- Honister Pass, 356 m
- Down to Gatesgarth
- Lunch at the Fish Inn

> The best road of the trip so far.

Then on round the lake to Cockermouth for fuel.`;

/**
 * @param {HTMLElement} el where the editor goes
 * @param {HTMLElement} out where the timing shows
 */
export function mountSpike(el, out) {
	const editor = new Editor({
		element: el,
		extensions: [StarterKit, Markdown],
		content: SAMPLE,
		contentType: 'markdown'
	});
	/** @type {number[]} */
	let lat = [];
	const pct = (/** @type {number} */ p) => {
		const s = [...lat].sort((a, b) => a - b);
		return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : 0;
	};
	const show = () =>
		(out.textContent = `${lat.length} keys · median ${pct(0.5)} ms · slowest 10% ${pct(0.9)} ms · ${editor.state.doc.textContent.length} characters`);
	// the same measure as before: from the keystroke's input event to the next painted frame
	editor.view.dom.addEventListener('beforeinput', (e) => {
		const t0 = e.timeStamp;
		requestAnimationFrame(() =>
			setTimeout(() => {
				lat.push(performance.now() - t0);
				if (lat.length > 60) lat.shift();
				show();
			})
		);
	});
	show();
	return {
		editor,
		reset() {
			lat = [];
			show();
		},
		markdown: () => editor.getMarkdown(),
		destroy: () => editor.destroy()
	};
}
