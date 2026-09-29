<!--
  The canvas and UI live here so they persist across pages: moving between / and /day/<date>
  animates within one scene instead of remounting it. Pages only say which day to show.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import { Canvas } from '@threlte/core';
	import { onMount } from 'svelte';
	import { app } from '$lib/app.svelte';
	import WorldScene from '$lib/scene/WorldScene.svelte';
	import ControlPanel from '$lib/ui/ControlPanel.svelte';
	import EventsDrawer from '$lib/ui/EventsDrawer.svelte';
	import Gallery from '$lib/ui/Gallery.svelte';
	import PhotoPopups from '$lib/ui/PhotoPopups.svelte';
	import PinCard from '$lib/ui/PinCard.svelte';
	import Scrubber from '$lib/ui/Scrubber.svelte';
	import TourIntro from '$lib/ui/TourIntro.svelte';
	import TripBar from '$lib/ui/TripBar.svelte';

	let { children } = $props();

	const openDay = (day: string) => goto(`/day/${day}`);

	onMount(() => {
		app.onAdvance = openDay;
		app.init().catch((e) => (app.error = String(e)));
	});

	const tour = $derived(app.tour);

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
	<link rel="icon" href={favicon} />
	<title>{tour ? `${tour.data.track.title} · Moto Tour` : 'Moto Tour · UK 2026'}</title>
</svelte:head>
<svelte:window {onkeydown} />

<main>
	{#if app.index && app.uk}
		<Canvas>
			<WorldScene {app} onselect={openDay} />
		</Canvas>
		<TripBar {app} />
		{#if tour}
			{#key tour}
				<ControlPanel {tour} />
				<PinCard {tour} />
				<Scrubber {tour} />
				<PhotoPopups {tour} />
				<EventsDrawer {tour} />
			{/key}
		{:else if !app.pending}
			<!-- not while flying between days: the scene is briefly empty, the card would flash -->
			<TourIntro {app} />
		{/if}
		<p class="attribution">
			Map data <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer"
				>{tour?.data.osm?.attribution ?? '© OpenStreetMap contributors'}</a
			>
			{#if tour?.imagery.attribution} · {tour.imagery.attribution}{/if}
			{#if tour?.data.weather}
				· <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{tour.data.weather.attribution}</a>
			{/if}
		</p>
	{:else}
		<p class="loading">{app.error ?? 'Loading the tour…'}</p>
	{/if}
	<Gallery {app} onride={openDay} />
	{#if app.error && app.index}<p class="error">{app.error}</p>{/if}
	{@render children()}
</main>

<style>
	:global(:root) {
		--text: #dff6ff;
		--muted: #7b98a8;
		--accent: #7cf7ff;
		--accent-soft: rgba(124, 247, 255, 0.18);
		--line: rgba(124, 247, 255, 0.18);
		--glass: rgba(4, 12, 20, 0.72);
	}
	/*
	  Themed, "safe" scrolling for the glass panels. Add class="scroll-y" / "scroll-x".
	  - the bar gets its own gutter (never drawn over content) and sits inset from rounded corners
	  - overscroll-behavior stops a panel's wheel scroll leaking into the 3D scene's zoom
	  Chrome ignores ::-webkit-scrollbar styling once the standard scrollbar-* properties are set,
	  so those are applied to Firefox only.
	*/
	:global(.scroll-y) {
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
	}
	:global(.scroll-x) {
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior: contain;
		padding-bottom: 6px; /* room for the bar under the content */
	}
	:global(.scroll-y::-webkit-scrollbar),
	:global(.scroll-x::-webkit-scrollbar) {
		width: 6px;
		height: 5px;
	}
	:global(.scroll-y::-webkit-scrollbar-track),
	:global(.scroll-x::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(.scroll-y::-webkit-scrollbar-track) {
		margin: 14px 0; /* clear of the panel's rounded corners */
	}
	:global(.scroll-x::-webkit-scrollbar-track) {
		margin: 0 10px;
	}
	:global(.scroll-y::-webkit-scrollbar-thumb),
	:global(.scroll-x::-webkit-scrollbar-thumb) {
		border-radius: 6px;
		background: linear-gradient(rgba(124, 247, 255, 0.45), rgba(124, 247, 255, 0.25));
		box-shadow: 0 0 6px rgba(124, 247, 255, 0.35);
	}
	:global(.scroll-y::-webkit-scrollbar-thumb:hover),
	:global(.scroll-x::-webkit-scrollbar-thumb:hover) {
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
	}
	:global(.scroll-y::-webkit-scrollbar-corner),
	:global(.scroll-x::-webkit-scrollbar-corner) {
		background: transparent;
	}
	@supports (-moz-appearance: none) {
		:global(.scroll-y),
		:global(.scroll-x) {
			scrollbar-width: thin;
			scrollbar-color: rgba(124, 247, 255, 0.4) transparent;
		}
	}
	:global(html, body) {
		margin: 0;
		height: 100%;
		background: #03070c;
		color: var(--text);
		font-family: 'Inter', system-ui, sans-serif;
		overflow: hidden;
	}
	main {
		position: fixed;
		inset: 0;
		/* an app surface, not a document: drags (scrubbing, orbiting over labels) shouldn't select text */
		user-select: none;
		-webkit-user-select: none;
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
