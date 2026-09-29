// "Collapse all / Expand all" for the blog's event lists. Each EventItem keeps its own open state
// and follows this whenever `gen` changes; everything starts open.
export const fold = $state({ open: true, gen: 0 });

export function foldAll(open: boolean) {
	fold.open = open;
	fold.gen++;
}
