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

/** Under a stretch's snapshot: its facts, and its GPX to ride it. */
async function stretchCard(frame: HTMLElement, shot: import('$lib/map/mapShot').Shot) {
	const { stretchOf } = await import('$lib/map/mapShot');
	const { factsLine, gpxName, download } = await import('$lib/stretch');
	const s = await stretchOf(shot);
	const figure = frame.parentElement as HTMLElement;
	figure.querySelector('.stretch-facts')?.remove();
	if (!s) return;
	const p = document.createElement('p');
	p.className = 'stretch-facts';
	p.contentEditable = 'false';
	const text = document.createElement('span');
	text.textContent = factsLine(s.facts) + (s.facts.roads.length ? ` · on the ${s.facts.roads.join(', ')}` : '');
	const name = figure.querySelector('figcaption')?.textContent?.trim() || `A stretch of ${shot.day}`;
	const gpx = document.createElement('button');
	gpx.type = 'button';
	gpx.textContent = '⬇ GPX to ride it';
	gpx.addEventListener('click', () => download(gpxName(name), s.gpx(name)));
	p.append(text, ' ', gpx);
	frame.after(p);
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
		if (shot.end && !signal?.aborted) await stretchCard(frame, shot);
	} catch {
		if (signal?.aborted) return;
		frame.classList.add('failed');
		frame.textContent = 'The map couldn’t load';
	}
}
