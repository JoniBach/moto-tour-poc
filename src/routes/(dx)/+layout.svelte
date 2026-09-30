<!--
  The canvas and UI live here so they persist across pages: moving between / and /day/<date>
  animates within one scene instead of remounting it. Pages only say which day to show.
-->
<script lang="ts">
	import { on, tourOn, VIEWS_ON } from '$lib/flags';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { momentUrl } from '$lib/moment';
	import { onMount } from 'svelte';
	import { App, app } from '$lib/app.svelte';
	import BlogReader from '$lib/ui/BlogReader.svelte';
	import ControlPanel from '$lib/ui/ControlPanel.svelte';
	import EventsDrawer from '$lib/ui/EventsDrawer.svelte';
	import Gallery from '$lib/ui/Gallery.svelte';
	import GlobeBanner from '$lib/globe/GlobeBanner.svelte';
	import Scrubber from '$lib/ui/Scrubber.svelte';
	import TourIntro from '$lib/ui/TourIntro.svelte';
	import TripBar from '$lib/ui/TripBar.svelte';
	import MobileBar from '$lib/ui/MobileBar.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import { ui } from '$lib/ui.svelte';
	import { dayEvents } from '$lib/events';

	let { children } = $props();

	const openDay = (day: string) => goto(`/day/${day}`);

	onMount(() => {
		// every view of the tour switched off in this release: the blog is the whole site
		if (!tourOn) {
			if (on('blog')) location.replace('/blog');
			return;
		}
		app.onAdvance = openDay;
		// dev only: lets browser tests drive the app
		if (import.meta.env.DEV) (window as unknown as { __app: typeof app }).__app = app;
		app.view = App.startView(new URLSearchParams(location.search));
		app.init().catch((e) => (app.error = String(e)));
		// an app surface: no page scroll or pull-to-refresh bounce while the 3D view is open
		document.documentElement.classList.add('app-surface');
		const unwatch = ui.watch();
		return () => {
			unwatch();
			document.documentElement.classList.remove('app-surface');
		};
	});

	// phones render the 3D scene at a lower pixel ratio: most of the sharpness, much less GPU work
	const dpr = $derived(Math.min(globalThis.devicePixelRatio ?? 1, ui.mobile ? 1.5 : 2));

	const tour = $derived(app.tour);
	const eventCount = $derived(tour ? dayEvents(tour.data.track, tour.data.pins, tour.photos, tour.posts).length : 0);

	// keep the URL in step with the moment on screen and what's open, so it can be shared
	// (replaceState: no history entries; less often while playing)
	let urlTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (!app.momentReady) return;
		const href = momentUrl(app); // reads the ride's moment, the open post and the open photo
		const playing = app.tour?.playing ?? false;
		clearTimeout(urlTimer);
		urlTimer = setTimeout(() => {
			if (href !== location.href) replaceState(href, page.state);
		}, playing ? 1500 : 300);
	});

	function onkeydown(e: KeyboardEvent) {
		if ((e.target as HTMLElement).closest('input, select, textarea')) return;
		if (app.gallery) return; // the gallery has the keyboard while it's open
		// shift + arrows: previous / next day
		if (e.shiftKey && (e.code === 'ArrowRight' || e.code === 'ArrowLeft')) {
			const d = tour ? app.neighbour(e.code === 'ArrowRight' ? 1 : -1) : app.index?.days[0];
			if (d) openDay(d.day);
			return;
		}
		if (!tour) return;
		if (e.code === 'Space') {
			e.preventDefault();
			tour.togglePlay();
		} else if (e.code === 'ArrowRight') tour.seek(tour.rt + 30);
		else if (e.code === 'ArrowLeft') tour.seek(tour.rt - 30);
	}
</script>

<svelte:head>
	<title>{tour ? `${tour.data.track.title} · Moto Tour` : 'Moto Tour · UK 2026'}</title>
</svelte:head>
<svelte:window {onkeydown} />

<main>
	{#if app.index && (app.view !== '3d' || app.region)}
		<!-- each view is its own chunk: the 2D map never downloads the 3D scene, and vice versa -->
		{#if app.view === '3d'}
			{#await import('$lib/scene/Scene3D.svelte') then { default: Scene3D }}
				<Scene3D {app} {dpr} onselect={openDay} />
			{/await}
		{:else if app.view === '2d'}
			{#await import('$lib/map/Map2D.svelte') then { default: Map2D }}
				<Map2D {app} onselect={openDay} />
			{/await}
			<!-- a small live globe in the corner (its own chunk; only when the globe is released) -->
			{#if tour && VIEWS_ON.includes('globe')}
				{#await import('$lib/globe/MiniGlobe.svelte') then { default: MiniGlobe }}
					<MiniGlobe {app} />
				{/await}
			{/if}
		{:else}
			{#await import('$lib/globe/Globe3D.svelte') then { default: Globe3D }}
				<Globe3D {app} {dpr} />
			{/await}
		{/if}
		<TripBar {app} />
		{#if tour}
			{#key tour}
				<!-- the globe keeps its UI small: its own play bar and settings card -->
				{#if app.view !== 'globe'}
					<ControlPanel {tour} flat={app.view === '2d'} />
					<Scrubber {tour} />
				{/if}
				<!-- the day's moments in every view; light, like the globe, when over it -->
				<div class="events-wrap" class:light={app.view === 'globe'}>
					<EventsDrawer {tour} />
				</div>
				<!-- no pop-up cards anywhere: one quiet banner names the latest moment (the globe has
				     its own, in its play bar; here it sits above the scrubber) -->
				{#if app.view !== 'globe'}
					<div class="banner-dock"><GlobeBanner {tour} /></div>
				{/if}
			{/key}
		{:else if !app.pending}
			<!-- not while flying between days: the scene is briefly empty, the card would flash -->
			<TourIntro {app} />
		{/if}
		{#snippet credits()}
			Map data <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer"
				>{tour?.data.osm?.attribution ?? '© OpenStreetMap contributors'}</a
			>
			{#if tour?.imagery.attribution} · {tour.imagery.attribution}{/if}
			<!-- the 3D terrain and the globe's landscape are built from these elevation tiles -->
			{#if app.view !== '2d'}
				· Elevation <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer"
					>Terrain Tiles (Mapzen, AWS)</a
				>: contains OS data © Crown copyright and database right; Copernicus EU-DEM; SRTM (NASA)
			{/if}
			{#if tour?.data.weather}
				· <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{tour.data.weather.attribution}</a>
			{/if}
		{/snippet}
		{#if ui.mobile}
			<MobileBar {app} events={eventCount} />
			<Sheet open={ui.sheet === 'info'} title="About this map" onclose={() => (ui.sheet = null)} maxHeight="50dvh">
				<div class="info">
					<p>
						<b>Getting around</b><br />{app.view === '2d'
							? 'Drag to move · pinch to zoom.'
							: app.view === 'globe'
								? 'Drag to turn the globe · pinch to zoom.'
								: 'Drag to orbit · pinch to zoom · two fingers to pan.'} Tap pins and photos to open them.
					</p>
					<p class="credits">{@render credits()}</p>
				</div>
			</Sheet>
		{:else}
			<p class="attribution">{@render credits()}</p>
		{/if}
	{:else}
		<p class="loading">{app.error ?? 'Loading the tour…'}</p>
	{/if}
	<BlogReader {app} onride={openDay} />
	<Gallery {app} onride={openDay} />
	{#if app.error && app.index}<p class="error">{app.error}</p>{/if}
	{@render children()}
</main>

<style>
	main {
		position: fixed;
		inset: 0;
		/* an app surface, not a document: drags (scrubbing, orbiting over labels) shouldn't select text */
		user-select: none;
		-webkit-user-select: none;
	}
	.banner-dock {
		position: absolute;
		z-index: 104;
		left: 50%;
		bottom: var(--banner-bottom, 196px);
		transform: translateX(-50%);
		width: min(720px, calc(100% - 32px));
	}
	@media (max-width: 900px) {
		.banner-dock {
			bottom: var(--banner-bottom-phone, 182px);
		}
	}
	.events-wrap {
		display: contents;
	}
	/* the events drawer over the globe: the globe's light glass instead of the dark panels */
	.events-wrap.light {
		--glass: rgb(255 255 255 / 0.78);
		--text: #2c3a45;
		--muted: #56656f;
		--line: rgb(44 58 69 / 0.16);
		--accent: #b8400c;
		--accent-soft: #fdeee4;
		--sheet-bg: rgb(250 251 252 / 0.97);
	}
	.attribution {
		position: absolute;
		z-index: 100;
		right: 20px;
		bottom: 0;
		margin: 0;
		padding: 1px 6px;
		border-radius: 6px 6px 0 0;
		background: var(--glass);
		font-size: 10px;
		color: var(--muted);
	}
	.info {
		font-size: 13px;
		line-height: 1.5;
		color: var(--text);
	}
	.info .credits,
	.info .credits a {
		font-size: 12px;
		color: var(--muted);
	}
	.attribution a {
		color: inherit;
	}
	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		color: var(--muted);
		letter-spacing: 0.1em;
	}
	.error {
		position: absolute;
		z-index: 120;
		left: 50%;
		top: 80px;
		transform: translateX(-50%);
		padding: 6px 12px;
		border-radius: 8px;
		background: #5a1d1d;
		color: #ffd6d6;
		font-size: 12px;
	}
</style>
