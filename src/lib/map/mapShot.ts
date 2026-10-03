// A map snapshot for a story: the 2D map (the same OpenFreeMap style in the tour's pastel colours) at
// a moment of a day's ride: the day's route, the part ridden by then, and the bike there. Drawn once
// in the reader's browser, then kept as a still image (no live map left running, so a story can
// hold several); the attribution sits on it. Stories embed one as ![caption](map:2026-09-16T11:30)
// or ![caption](map:2026-09-16T11:30@13) with a zoom (src/lib/story.js). Its own chunk, with
// MapLibre: loaded only by pages that show one.
import { Map as MlMap, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { bisect, loadDay, type TourData } from '$lib/data';
import { ukToEpoch } from '$lib/moment';
import * as F from './features';
import { pastel } from './pastel';
import { parseMapRef } from '$lib/story.js';

export { parseMapRef };

setWorkerUrl(workerUrl);

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
/** width : height of a snapshot */
export const SHOT_RATIO = 3 / 2;

const days = new Map<string, Promise<TourData>>();
const dayData = (day: string) => {
	let p = days.get(day);
	if (!p) {
		p = loadDay(day, true);
		days.set(day, p);
		p.catch(() => days.delete(day));
	}
	return p;
};

/** a snapshot's moment: the day, the tour's local time (hh:mm) and the zoom (story.js parseMapRef) */
export type Shot = { day: string; time: string; zoom: number };

/**
 * Draw the snapshot into `el` (sized by its width): a live map until it has finished drawing, then
 * an image in its place. Resolves when done; rejects if the day or the map can't load.
 */
export async function drawShot(el: HTMLElement, shot: Shot, signal?: AbortSignal): Promise<void> {
	const data = await dayData(shot.day);
	if (signal?.aborted) return;
	const tr = data.track;
	const { originE, originN } = data.terrain.meta;
	const pts = F.trackPoints(tr, originE, originN);
	// where the bike was at that moment (clamped to the day's riding), like the story's own spot
	const rel = ukToEpoch(shot.day, shot.time) - tr.t0;
	const i = rel <= 0 ? 0 : Math.min(bisect(tr.t, rel), tr.count - 1);
	const here = F.at(tr.x[i] + originE, tr.n[i] + originN);

	const width = Math.max(200, el.clientWidth);
	const height = Math.round(width / SHOT_RATIO);
	const box = document.createElement('div');
	box.style.cssText = `width:${width}px;height:${height}px`;
	el.replaceChildren(box);
	const map = new MlMap({
		container: box,
		style: STYLE,
		center: here,
		zoom: shot.zoom,
		interactive: false,
		attributionControl: false,
		fadeDuration: 0,
		canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true }
	});
	try {
		await new Promise<void>((done, fail) => {
			map.once('error', (e) => fail(e.error ?? new Error('The map couldn’t load')));
			map.once('load', () => {
				pastel(map);
				map.addSource('track', { type: 'geojson', data: F.ridden(pts) });
				map.addSource('ridden', { type: 'geojson', data: F.ridden(pts, i, here) });
				map.addSource('here', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: here } } });
				const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
				map.addLayer({ id: 'track-casing', type: 'line', source: 'track', layout: round, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 } });
				map.addLayer({ id: 'track', type: 'line', source: 'track', layout: round, paint: { 'line-color': '#8a969c', 'line-width': 4, 'line-dasharray': [1, 1.6] } });
				map.addLayer({ id: 'ridden', type: 'line', source: 'ridden', layout: round, paint: { 'line-color': '#c2562d', 'line-width': 5 } });
				map.addLayer({ id: 'here-halo', type: 'circle', source: 'here', paint: { 'circle-radius': 14, 'circle-color': '#c2562d', 'circle-opacity': 0.22 } });
				map.addLayer({ id: 'here', type: 'circle', source: 'here', paint: { 'circle-radius': 7, 'circle-color': '#c2562d', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 } });
				// everything drawn, tiles and all
				map.once('idle', () => done());
			});
			signal?.addEventListener('abort', () => done());
		});
		if (signal?.aborted) return;
		const img = new Image(width, height);
		img.src = map.getCanvas().toDataURL('image/png');
		img.alt = '';
		img.decoding = 'async';
		await img.decode().catch(() => {});
		el.replaceChildren(img);
	} finally {
		map.remove();
	}
}
