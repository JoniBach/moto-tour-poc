// A map snapshot for a story: the 2D map (the same OpenFreeMap style in the tour's pastel colours) at
// a moment of a day's ride: the day's route, the part ridden by then, and the bike there. Drawn once
// in the reader's browser, then kept as a still image (no live map left running, so a story can
// hold several); the attribution sits on it. Stories embed one as ![caption](map:2026-09-16T11:30)
// or ![caption](map:2026-09-16T11:30@13) with a zoom; or the whole journey, every day in its colour:
// ![caption](map:tour), or ![caption](map:tour~2026-09-16) with that day picked out; or a stretch,
// framed to fit: ![caption](map:2026-09-16T11:10-11:45) (src/lib/story.js). Its own chunk, with
// MapLibre: loaded only by pages that show one.
import { Map as MlMap, setWorkerUrl, type LngLatBoundsLike } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { bisect, loadDay, loadTourIndex, type TourData, type TourIndex } from '$lib/data';
import { dayColor } from '$lib/colors';
import { stretchFacts, stretchFixes, stretchGpx } from '$lib/stretch';
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

/** what a snapshot shows (story.js parseMapRef): a moment of a day, or the whole journey (day: the one picked out) */
export type Shot = { day: string; time: string; zoom: number; whole?: boolean; end?: string };

/** width : height: a moment is landscape; the whole journey (Britain is tall) a little portrait */
export const shotRatio = (shot: Pick<Shot, 'whole'>) => (shot.whole ? 4 / 5 : SHOT_RATIO);

let index: Promise<TourIndex> | null = null;
const tourIndex = () => (index ??= loadTourIndex().catch((e) => ((index = null), Promise.reject(e))));

const round = { 'line-cap': 'round', 'line-join': 'round' } as const;

/** a moment: the day's route, the part ridden by then, and the bike there */
async function moment(shot: Shot) {
	const data = await dayData(shot.day);
	const tr = data.track;
	const { originE, originN } = data.terrain.meta;
	const pts = F.trackPoints(tr, originE, originN);
	// where the bike was at that moment (clamped to the day's riding), like the story's own spot
	const rel = ukToEpoch(shot.day, shot.time) - tr.t0;
	const i = rel <= 0 ? 0 : Math.min(bisect(tr.t, rel), tr.count - 1);
	const here = F.at(tr.x[i] + originE, tr.n[i] + originN);
	return {
		view: { center: here, zoom: shot.zoom },
		layers(map: MlMap) {
			map.addSource('track', { type: 'geojson', data: F.ridden(pts) });
			map.addSource('ridden', { type: 'geojson', data: F.ridden(pts, i, here) });
			map.addSource('here', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: here } } });
			map.addLayer({ id: 'track-casing', type: 'line', source: 'track', layout: round, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 } });
			map.addLayer({ id: 'track', type: 'line', source: 'track', layout: round, paint: { 'line-color': '#8a969c', 'line-width': 4, 'line-dasharray': [1, 1.6] } });
			map.addLayer({ id: 'ridden', type: 'line', source: 'ridden', layout: round, paint: { 'line-color': '#c2562d', 'line-width': 5 } });
			map.addLayer({ id: 'here-halo', type: 'circle', source: 'here', paint: { 'circle-radius': 14, 'circle-color': '#c2562d', 'circle-opacity': 0.22 } });
			map.addLayer({ id: 'here', type: 'circle', source: 'here', paint: { 'circle-radius': 7, 'circle-color': '#c2562d', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 } });
		}
	};
}

/** A stretch's facts and its GPX (for the card under its snapshot); null if it isn't on the ride. */
export async function stretchOf(shot: Shot) {
	if (!shot.end) return null;
	const data = await dayData(shot.day);
	const fixes = stretchFixes(data.track, { day: shot.day, from: shot.time, to: shot.end });
	if (!fixes) return null;
	const { originE, originN } = data.terrain.meta;
	return {
		facts: stretchFacts(data.track, data.osm, fixes.i, fixes.j),
		gpx: (name: string) => stretchGpx(data.track, originE, originN, fixes.i, fixes.j, name)
	};
}

/** a stretch: framed to fit; the rest of the day faint, the stretch bold, its start and finish marked */
async function stretch(shot: Shot) {
	const data = await dayData(shot.day);
	const tr = data.track;
	const fixes = stretchFixes(tr, { day: shot.day, from: shot.time, to: shot.end! });
	if (!fixes) throw new Error('That stretch isn’t on the day’s ride');
	const { originE, originN } = data.terrain.meta;
	const pts = F.trackPoints(tr, originE, originN);
	const line = F.segment(pts, fixes.i, fixes.j);
	const box = F.lineBounds(line);
	if (!box) throw new Error('That stretch is too short to draw');
	const ends: GeoJSON.FeatureCollection<GeoJSON.Point> = {
		type: 'FeatureCollection',
		features: [
			{ type: 'Feature', properties: { end: 0 }, geometry: { type: 'Point', coordinates: F.at(tr.x[fixes.i] + originE, tr.n[fixes.i] + originN) } },
			{ type: 'Feature', properties: { end: 1 }, geometry: { type: 'Point', coordinates: F.at(tr.x[fixes.j] + originE, tr.n[fixes.j] + originN) } }
		]
	};
	return {
		view: { bounds: box as LngLatBoundsLike },
		layers(map: MlMap) {
			map.addSource('track', { type: 'geojson', data: F.ridden(pts) });
			map.addSource('stretch', { type: 'geojson', data: line });
			map.addSource('ends', { type: 'geojson', data: ends });
			map.addLayer({ id: 'track', type: 'line', source: 'track', layout: round, paint: { 'line-color': '#8a969c', 'line-width': 3, 'line-dasharray': [1, 1.6], 'line-opacity': 0.7 } });
			map.addLayer({ id: 'stretch-band', type: 'line', source: 'stretch', layout: round, paint: { 'line-color': '#f2b134', 'line-width': 14, 'line-opacity': 0.5 } });
			map.addLayer({ id: 'stretch-casing', type: 'line', source: 'stretch', layout: round, paint: { 'line-color': '#ffffff', 'line-width': 8 } });
			map.addLayer({ id: 'stretch', type: 'line', source: 'stretch', layout: round, paint: { 'line-color': '#c2562d', 'line-width': 5 } });
			// start: hollow; finish: solid (as the route sketches draw them)
			map.addLayer({
				id: 'ends',
				type: 'circle',
				source: 'ends',
				paint: {
					'circle-radius': 7,
					'circle-color': ['case', ['==', ['get', 'end'], 1], '#263238', '#ffffff'],
					'circle-stroke-color': ['case', ['==', ['get', 'end'], 1], '#ffffff', '#263238'],
					'circle-stroke-width': 2.5
				}
			});
		}
	};
}

/** the whole journey: every day's route in its own colour, numbered where each day set off; one day picked out (the rest faded) if asked */
async function whole(shot: Shot) {
	const days = (await tourIndex()).days;
	const pick = days.some((d) => d.day === shot.day) ? shot.day : '';
	const starts: GeoJSON.FeatureCollection<GeoJSON.Point> = {
		type: 'FeatureCollection',
		features: days.flatMap((d) => {
			const at = F.dayStart(d);
			return at
				? [{ type: 'Feature' as const, properties: { n: String(d.index + 1), day: d.day, color: dayColor(d.index, days.length) }, geometry: { type: 'Point' as const, coordinates: at } }]
				: [];
		})
	};
	// the picked-out day as it is, the rest faded
	const faded = (on: number, off: number) => (pick ? ['case', ['==', ['get', 'day'], pick], on, off] : on) as never;
	return {
		view: { bounds: F.bounds(days) as LngLatBoundsLike },
		layers(map: MlMap) {
			map.addSource('routes', { type: 'geojson', data: F.routes(days) });
			map.addSource('starts', { type: 'geojson', data: starts });
			map.addLayer({ id: 'routes-casing', type: 'line', source: 'routes', layout: round, paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': faded(0.95, 0.5) } });
			map.addLayer({ id: 'routes', type: 'line', source: 'routes', layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': faded(5, 3), 'line-opacity': faded(1, 0.35) } });
			map.addLayer({
				id: 'starts',
				type: 'circle',
				source: 'starts',
				paint: { 'circle-radius': 9, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-opacity': faded(1, 0.45), 'circle-stroke-opacity': faded(1, 0.45) }
			});
			map.addLayer({
				id: 'start-numbers',
				type: 'symbol',
				source: 'starts',
				layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true },
				paint: { 'text-color': '#ffffff', 'text-opacity': faded(1, 0.6) }
			});
		}
	};
}

/**
 * Draw the snapshot into `el` (sized by its width): a live map until it has finished drawing, then
 * an image in its place. Resolves when done; rejects if the data or the map can't load.
 */
export async function drawShot(el: HTMLElement, shot: Shot, signal?: AbortSignal): Promise<void> {
	const plan = shot.whole ? await whole(shot) : shot.end ? await stretch(shot) : await moment(shot);
	if (signal?.aborted) return;
	const width = Math.max(200, el.clientWidth);
	const height = Math.round(width / shotRatio(shot));
	const box = document.createElement('div');
	box.style.cssText = `width:${width}px;height:${height}px`;
	el.replaceChildren(box);
	const map = new MlMap({
		container: box,
		style: STYLE,
		...plan.view,
		fitBoundsOptions: { padding: Math.round(width * (shot.end ? 0.1 : 0.06)), maxZoom: 15 },
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
				plan.layers(map);
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
