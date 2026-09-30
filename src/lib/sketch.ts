// A day's route as a little drawing: its simplified lines (absolute projected metres, from
// tour.json) fitted north-up into a 100 × 100 box, as SVG paths, with the start, the finish and
// optionally one moment marked. Pure, so the blog can make it at build time and the tour in the
// browser. Drawn by RouteSketch.svelte.

export interface Sketch {
	paths: string[];
	start: [number, number] | null;
	end: [number, number] | null;
	/** a moment on the route (a story's), when asked for */
	dot: [number, number] | null;
}

/** Fit the lines into the box, `pad` units in from each side; keep at most `max` points a line. */
export function sketch(lines: number[][], opts: { dot?: { e: number; n: number }; pad?: number; max?: number } = {}): Sketch {
	const pad = opts.pad ?? 8;
	const max = opts.max ?? 160;
	let [e0, n0, e1, n1] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const line of lines)
		for (let k = 0; k < line.length; k += 2) {
			e0 = Math.min(e0, line[k]);
			e1 = Math.max(e1, line[k]);
			n0 = Math.min(n0, line[k + 1]);
			n1 = Math.max(n1, line[k + 1]);
		}
	if (!(e0 < e1 || n0 < n1)) return { paths: [], start: null, end: null, dot: null };
	const inner = 100 - pad * 2;
	const span = Math.max(e1 - e0, n1 - n0) || 1;
	const ox = pad + (inner - ((e1 - e0) / span) * inner) / 2;
	const oy = pad + (inner - ((n1 - n0) / span) * inner) / 2;
	const x = (e: number) => +(ox + ((e - e0) / span) * inner).toFixed(1);
	const y = (n: number) => +(oy + ((n1 - n) / span) * inner).toFixed(1);
	const paths = lines
		.filter((l) => l.length >= 4)
		.map((line) => {
			const pts = line.length / 2;
			const step = Math.max(1, Math.ceil(pts / max));
			let s = '';
			for (let p = 0; p < pts; p += step) s += `${s ? 'L' : 'M'}${x(line[p * 2])} ${y(line[p * 2 + 1])}`;
			// always end on the line's last point
			if ((pts - 1) % step) s += `L${x(line[line.length - 2])} ${y(line[line.length - 1])}`;
			return s;
		});
	const first = lines.find((l) => l.length >= 2);
	const last = [...lines].reverse().find((l) => l.length >= 2);
	return {
		paths,
		start: first ? [x(first[0]), y(first[1])] : null,
		end: last ? [x(last[last.length - 2]), y(last[last.length - 1])] : null,
		dot: opts.dot ? [x(opts.dot.e), y(opts.dot.n)] : null
	};
}
