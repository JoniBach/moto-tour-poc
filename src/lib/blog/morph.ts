// Put new HTML into an element while keeping the parts that didn't change. The story editor's
// preview re-renders the whole story as it's written; replacing it wholesale ({@html}) rebuilt every
// paragraph and photo each time (new <img>s to lay out and decode, the page jumping). Here each
// top-level node is matched by its markup: unchanged ones stay exactly where they are, untouched,
// and only the changed or new ones go in.
import type { Action } from 'svelte/action';

const keyOf = (n: Node) => (n.nodeType === Node.ELEMENT_NODE ? (n as Element).outerHTML : `#${n.nodeType}:${n.textContent}`);

function morph(el: HTMLElement, html: string) {
	const tpl = document.createElement('template');
	tpl.innerHTML = html;
	// what's there now, by markup (several identical blocks queue up in order)
	const pool = new Map<string, Node[]>();
	for (const n of el.childNodes) {
		const k = keyOf(n);
		const q = pool.get(k);
		if (q) q.push(n);
		else pool.set(k, [n]);
	}
	const next = [...tpl.content.childNodes].map((n) => pool.get(keyOf(n))?.shift() ?? n);
	// walk the new order, moving or inserting only where it differs; what's left over goes
	let at: ChildNode | null = el.firstChild;
	for (const n of next) {
		if (n === at) at = at.nextSibling;
		else el.insertBefore(n, at);
	}
	while (at) {
		const gone: ChildNode = at;
		at = at.nextSibling;
		gone.remove();
	}
}

/** use:html={markup}: like {@html markup}, but only what changed is replaced */
export const html: Action<HTMLElement, string> = (el, markup) => {
	morph(el, markup);
	return { update: (m) => morph(el, m) };
};
