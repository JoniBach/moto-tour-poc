<!--
  The 2D view: the same tour on a flat street map (MapLibre + OpenFreeMap tiles). It takes the
  3D scene's place inside the tour layout, so the scrubber, events, gallery, reader and shareable
  URLs all work unchanged. Draws every day's route, the active day's track (ridden part bright),
  the bike, national parks, photos, stories, pins and day markers; plays the day like the 3D view.
-->
<script lang="ts">
	import {
		Map as MlMap,
		Marker,
		NavigationControl,
		ScaleControl,
		setWorkerUrl,
		type GeoJSONSource,
		type LngLatBoundsLike
	} from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import { onMount, untrack } from 'svelte';
	import type { App } from '$lib/app.svelte';
	import { dayColor } from '$lib/colors';
	import { PIN_META } from '$lib/data';
	import { ui } from '$lib/ui.svelte';
	import * as F from './features';

	setWorkerUrl(workerUrl);

	let { app, onselect }: { app: App; onselect: (day: string) => void } = $props();

	// free vector tiles, no key: https://openfreemap.org (attribution comes with the style)
	const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

	let container: HTMLDivElement;
	let map: MlMap | null = null;
	let loaded = $state(false);
	/** keep the bike on screen; a drag hands the map to the viewer until they ask again */
	let follow = $state(true);

	const tour = $derived(app.tour);
	const activeDay = $derived(tour?.data.track.day ?? null);
	const days = $derived(app.index?.days ?? []);
	const layers = $derived(app.settings.layers);

	// room for the floating panels, so fitted routes aren't hidden underneath them
	const padding = () =>
		ui.mobile ? { top: 70, bottom: 150, left: 30, right: 30 } : { top: 90, bottom: 170, left: tour ? 300 : 60, right: app.settings.eventsOpen ? 380 : 60 };

	onMount(() => {
		map = new MlMap({
			container,
			style: STYLE,
			bounds: F.bounds(days) as LngLatBoundsLike,
			fitBoundsOptions: { padding: padding() },
			attributionControl: { compact: true },
			// a flat map: no tilt or spin to get lost in
			maxPitch: 0,
			dragRotate: false,
			pitchWithRotate: false,
			touchPitch: false
		});
		map.touchZoomRotate.disableRotation();
		map.keyboard.disableRotation();
		map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
		map.addControl(new ScaleControl({ unit: 'imperial' }), 'bottom-left');
		map.on('dragstart', () => (follow = false));
		map.on('load', () => {
			addLayers(map!);
			loaded = true;
		});

		// dev only: lets browser tests reach the map
		if (import.meta.env.DEV) (window as unknown as { __map: MlMap }).__map = map;

		return () => {
			stopped = true;
			cancelAnimationFrame(raf);
			for (const m of markers) m.remove();
			bike?.remove();
			map?.remove();
			map = null;
		};
	});

	// ---- the frame loop: runs only while the ride plays (MapLibre redraws itself on demand) ------

	let raf = 0;
	let last = 0;
	let stopped = false;
	function tick(now: number) {
		const dt = (now - last) / 1000;
		last = now;
		app.tour?.advance(Math.min(dt, 0.1));
		if (loaded) frame();
		// keep going only while playing: a paused map costs nothing
		raf = app.tour?.playing && !stopped ? requestAnimationFrame(tick) : 0;
	}
	/** one frame now (a seek, a new day), or the loop again when play starts */
	function kick() {
		if (raf || stopped) return;
		last = performance.now();
		raf = requestAnimationFrame(tick);
	}
	$effect(() => {
		// anything that moves the bike or starts playback
		void app.tour?.rt;
		void app.tour?.playing;
		void loaded;
		kick();
	});

	// ---- static layers (added once the style is in) ----------------------------------------

	function addLayers(m: MlMap) {
		m.getCanvas().setAttribute('aria-label', 'Map of the tour. The events list and the timeline below give the same moments without the map.');
		if (app.parks) {
			const p = F.parks(app.parks);
			m.addSource('parks', { type: 'geojson', data: p.shapes });
			m.addSource('park-labels', { type: 'geojson', data: p.labels });
			m.addLayer({ id: 'parks-fill', type: 'fill', source: 'parks', paint: { 'fill-color': '#2f9e44', 'fill-opacity': ['case', ['get', 'visited'], 0.14, 0.06] } });
			m.addLayer({ id: 'parks-line', type: 'line', source: 'parks', paint: { 'line-color': '#2b8a3e', 'line-width': 1.2, 'line-opacity': 0.6 } });
			m.addLayer({
				id: 'parks-label',
				type: 'symbol',
				source: 'park-labels',
				maxzoom: 10,
				layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 13 },
				paint: { 'text-color': '#1b5e20', 'text-halo-color': '#fff', 'text-halo-width': 1.5 }
			});
		}
		m.addSource('routes', { type: 'geojson', data: F.routes(days) });
		m.addLayer({
			id: 'routes',
			type: 'line',
			source: 'routes',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.85 }
		});
		// a wide invisible line: easier to click a day's route
		m.addLayer({ id: 'routes-hit', type: 'line', source: 'routes', paint: { 'line-color': '#000', 'line-width': 16, 'line-opacity': 0 } });
		m.on('click', 'routes-hit', (e) => {
			const day = e.features?.[0]?.properties?.day as string | undefined;
			if (day && day !== activeDay) onselect(day);
		});
		m.on('mouseenter', 'routes-hit', () => (m.getCanvas().style.cursor = 'pointer'));
		m.on('mouseleave', 'routes-hit', () => (m.getCanvas().style.cursor = ''));

		const empty = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
		m.addSource('track', { type: 'geojson', data: empty });
		m.addSource('ridden', { type: 'geojson', data: empty });
		m.addLayer({
			id: 'track-casing',
			type: 'line',
			source: 'track',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 }
		});
		m.addLayer({
			id: 'track',
			type: 'line',
			source: 'track',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': '#5c7080', 'line-width': 4, 'line-dasharray': [1, 1.5] }
		});
		m.addLayer({
			id: 'ridden',
			type: 'line',
			source: 'ridden',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': '#0b7285', 'line-width': 5 }
		});

		m.addSource('photos', { type: 'geojson', data: F.photos(app.photos), cluster: true, clusterRadius: 36, clusterMaxZoom: 16 });
		m.addLayer({
			id: 'photo-clusters',
			type: 'circle',
			source: 'photos',
			filter: ['has', 'point_count'],
			paint: {
				'circle-color': '#e67700',
				'circle-radius': ['step', ['get', 'point_count'], 13, 10, 17, 40, 22],
				'circle-stroke-color': '#fff',
				'circle-stroke-width': 2
			}
		});
		m.addLayer({
			id: 'photo-count',
			type: 'symbol',
			source: 'photos',
			filter: ['has', 'point_count'],
			layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true },
			paint: { 'text-color': '#fff' }
		});
		m.addLayer({
			id: 'photo-one',
			type: 'circle',
			source: 'photos',
			filter: ['!', ['has', 'point_count']],
			paint: { 'circle-color': '#e67700', 'circle-radius': 7, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }
		});
		const byId = new Map(app.photos.map((p) => [p.id, p]));
		m.on('click', 'photo-clusters', async (e) => {
			const f = e.features?.[0];
			if (!f) return;
			const src = m.getSource('photos') as GeoJSONSource;
			const leaves = await src.getClusterLeaves(f.properties.cluster_id, Infinity, 0);
			const list = leaves.map((l) => byId.get(l.properties?.id)).filter((p) => !!p).sort((a, b) => a.t - b.t);
			if (list.length) app.gallery = { photos: list, index: 0 };
		});
		m.on('click', 'photo-one', (e) => {
			const p = byId.get(e.features?.[0]?.properties?.id);
			if (p) app.gallery = { photos: [p], index: 0 };
		});
		for (const id of ['photo-clusters', 'photo-one']) {
			m.on('mouseenter', id, () => (m.getCanvas().style.cursor = 'pointer'));
			m.on('mouseleave', id, () => (m.getCanvas().style.cursor = ''));
		}
		placeMarkers(m);
	}

	// ---- DOM markers: real buttons, so they're reachable by keyboard and named for screen readers --

	let markers: Marker[] = [];
	let dayMarkers: { day: string; el: HTMLButtonElement }[] = [];
	let postMarkers: Marker[] = [];

	function button(cls: string, label: string, text: string, onclick: () => void) {
		const el = document.createElement('button');
		el.type = 'button';
		el.className = `mk ${cls}`;
		el.setAttribute('aria-label', label);
		el.title = label;
		el.textContent = text;
		el.addEventListener('click', (ev) => {
			ev.stopPropagation();
			onclick();
		});
		return el;
	}

	function placeMarkers(m: MlMap) {
		for (const d of days) {
			const at = F.dayStart(d);
			if (!at) continue;
			const el = button('day', `Day ${d.index + 1}: ${d.title}`, String(d.index + 1), () => onselect(d.day));
			el.style.setProperty('--c', dayColor(d.index, days.length));
			markers.push(new Marker({ element: el }).setLngLat(at).addTo(m));
			dayMarkers.push({ day: d.day, el });
		}
		for (const p of app.posts) {
			const el = button('post', `Story: ${p.title}`, '✎', () => (app.reading = p));
			const mk = new Marker({ element: el }).setLngLat(F.postAt(p)).addTo(m);
			markers.push(mk);
			postMarkers.push(mk);
		}
	}

	// pins belong to the active day
	let pinMarkers: Marker[] = [];
	$effect(() => {
		const t = tour;
		const m = map;
		if (!loaded || !m) return;
		untrack(() => {
			for (const mk of pinMarkers) mk.remove();
			pinMarkers = [];
			if (!t) return;
			const s = app.summary(t.data.track.day)!;
			for (const pin of t.data.pins) {
				const meta = PIN_META[pin.type];
				// no pop-up card: jump the ride there, and the event banner tells the rest
				const el = button('pin', `${meta.label}: ${pin.title}`, meta.icon, () => {
					t.seek(pin.rt);
					t.selectedPin = pin.id;
				});
				el.style.setProperty('--c', meta.color);
				pinMarkers.push(new Marker({ element: el }).setLngLat(F.at(pin.x + s.originE, pin.n + s.originN)).addTo(m));
			}
		});
	});

	// ---- the active day ----------------------------------------------------------------------

	let pts: ReturnType<typeof F.trackPoints> = [];
	let bike: Marker | null = null;
	let lastI = -1;

	$effect(() => {
		const t = tour;
		const m = map;
		if (!loaded || !m) return;
		untrack(() => {
			const track = m.getSource('track') as GeoJSONSource;
			const riddenSrc = m.getSource('ridden') as GeoJSONSource;
			bike?.remove();
			bike = null;
			lastI = -1;
			if (!t) {
				pts = [];
				track.setData({ type: 'FeatureCollection', features: [] });
				riddenSrc.setData({ type: 'FeatureCollection', features: [] });
				m.fitBounds(F.bounds(days) as LngLatBoundsLike, { padding: padding(), duration: 1200 });
				return;
			}
			const s = app.summary(t.data.track.day)!;
			pts = F.trackPoints(t.data.track, s.originE, s.originN);
			track.setData(F.ridden(pts));
			const el = document.createElement('div');
			el.className = 'bike';
			el.setAttribute('role', 'img');
			el.setAttribute('aria-label', 'The bike');
			el.innerHTML =
				'<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#0b7285" stroke="#fff" stroke-width="3"/><path d="M16 8l6 13-6-3.5-6 3.5z" fill="#fff"/></svg>';
			bike = new Marker({ element: el, rotationAlignment: 'map' }).setLngLat(pts[0]?.p ?? [0, 0]).addTo(m);
			follow = true;
			m.fitBounds(F.bounds([s]) as LngLatBoundsLike, { padding: padding(), duration: 1200, maxZoom: 13 });
		});
	});

	// fade the other days' routes while one is open; highlight its day marker
	$effect(() => {
		const day = activeDay;
		if (!loaded || !map) return;
		map.setPaintProperty('routes', 'line-opacity', day ? ['case', ['==', ['get', 'day'], day], 0, 0.35] : 0.85);
		for (const d of dayMarkers) d.el.classList.toggle('on', d.day === day);
	});

	// pressing play: back to following the bike
	$effect(() => {
		if (tour?.playing) follow = true;
	});

	// layer toggles from the settings panel
	$effect(() => {
		if (!loaded || !map) return;
		const vis = (on: boolean) => (on ? 'visible' : 'none');
		const set = (ids: string[], on: boolean) => ids.forEach((id) => map!.getLayer(id) && map!.setLayoutProperty(id, 'visibility', vis(on)));
		set(['routes', 'routes-hit', 'track-casing', 'track', 'ridden'], layers.route);
		set(['parks-fill', 'parks-line', 'parks-label'], layers.parks);
		set(['photo-clusters', 'photo-count', 'photo-one'], layers.photos);
		for (const mk of postMarkers) mk.getElement().hidden = !layers.blog;
		for (const mk of pinMarkers) mk.getElement().hidden = !layers.pins;
	});

	/** Every animation frame: move the bike, grow the ridden line, keep the bike in view. */
	function frame() {
		const t = app.tour;
		const m = map;
		if (!t || !m || !bike || !pts.length) return;
		const s = app.summary(t.data.track.day);
		if (!s) return;
		const b = t.bike;
		const here = F.at(b.x + s.originE, b.n + s.originN);
		bike.setLngLat(here);
		bike.setRotation((b.heading * 180) / Math.PI);
		if (b.i !== lastI) {
			lastI = b.i;
			(m.getSource('ridden') as GeoJSONSource).setData(F.ridden(pts, b.i, here));
		}
		if (follow && !m.isMoving()) {
			const p = m.project(here);
			const { clientWidth: w, clientHeight: h } = m.getContainer();
			const pad = padding();
			const inside = p.x > pad.left && p.x < w - pad.right && p.y > pad.top && p.y < h - pad.bottom;
			if (!inside) m.easeTo({ center: here, duration: 900 });
		}
	}

	function followBike() {
		follow = true;
		const t = app.tour;
		const s = t && app.summary(t.data.track.day);
		if (t && s && map) map.easeTo({ center: F.at(t.bike.x + s.originE, t.bike.n + s.originN), duration: 700 });
	}
</script>

<div class="map2d" bind:this={container}></div>
{#if tour && !follow}
	<button type="button" class="follow" onclick={followBike}>◎ Follow the bike</button>
{/if}

<style>
	.map2d {
		position: absolute;
		inset: 0;
		background: #e9eef0;
	}
	/* under the trip bar, and on desktop under the mini globe in the corner */
	.map2d :global(.maplibregl-ctrl-top-right) {
		top: 64px;
	}
	@media (min-width: 901px) {
		.map2d :global(.maplibregl-ctrl-top-right) {
			top: 264px;
		}
	}
	.map2d :global(.maplibregl-ctrl-bottom-left) {
		bottom: 130px;
	}
	.map2d :global(.maplibregl-ctrl-group button) {
		width: 36px;
		height: 36px;
	}
	/* not `all: unset`: that would also strip MapLibre's own marker positioning */
	.map2d :global(.mk) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
		appearance: none;
		display: grid;
		place-items: center;
		cursor: pointer;
		font: 700 13px/1 system-ui, sans-serif;
	}
	.map2d :global(.mk:focus-visible) {
		outline: 3px solid #1c7ed6;
		outline-offset: 2px;
	}
	.map2d :global(.mk.day) {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #fff;
		color: #1a2530;
		border: 3px solid var(--c);
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
	}
	.map2d :global(.mk.day.on) {
		background: var(--c);
		transform: scale(1.2);
	}
	.map2d :global(.mk.post) {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: #ffd166;
		color: #3d2a00;
		border: 2px solid #fff;
		font-size: 16px;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
	}
	.map2d :global(.mk.pin) {
		width: 26px;
		height: 26px;
		border-radius: 8px;
		background: #fff;
		border: 2px solid var(--c);
		font-size: 13px;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
	}
	.map2d :global(.bike) {
		filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.4));
		pointer-events: none;
	}
	.follow {
		position: absolute;
		z-index: 90;
		left: 50%;
		bottom: 150px;
		transform: translateX(-50%);
		min-height: 44px;
		padding: 0 16px;
		border: 1px solid var(--line);
		border-radius: 22px;
		background: var(--glass);
		backdrop-filter: blur(10px);
		color: var(--text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
</style>
