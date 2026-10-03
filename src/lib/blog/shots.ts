// The story page's map snapshots (figure.map-shot, from src/lib/story.js): each is drawn as it comes
// near the screen, by src/lib/map/mapShot.ts, which brings MapLibre with it, so only stories with a
// map snapshot load the map. Used as an attachment on the story's text.
export function shots(el: HTMLElement) {
	const frames = [...el.querySelectorAll<HTMLElement>('figure.map-shot > .map-frame')];
	if (!frames.length) return;
	const stop = new AbortController();
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				io.unobserve(e.target);
				drawFrame(e.target as HTMLElement, stop.signal);
			}
		},
		{ rootMargin: '400px 0px' }
	);
	for (const f of frames) io.observe(f);
	return () => {
		io.disconnect();
		stop.abort();
	};
}

/** Draw one snapshot into its frame (the figure's data-map says which moment). */
export async function drawFrame(frame: HTMLElement, signal?: AbortSignal) {
	const ref = (frame.parentElement as HTMLElement).dataset.map ?? '';
	frame.classList.remove('failed');
	try {
		const { drawShot, parseMapRef } = await import('$lib/map/mapShot');
		const shot = parseMapRef(ref);
		if (!shot) throw new Error('not a map moment');
		await drawShot(frame, shot, signal);
	} catch {
		if (signal?.aborted) return;
		frame.classList.add('failed');
		frame.textContent = 'The map couldn’t load';
	}
}
