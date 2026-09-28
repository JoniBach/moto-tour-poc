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
			{/key}
		{:else}
			<TourIntro {app} />
		{/if}
		<p class="attribution">
			Map data <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
			{#if tour?.imagery.attribution} · {tour.imagery.attribution}{/if}
			{#if tour?.data.weather}
				· <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{tour.data.weather.attribution}</a>
			{/if}
		</p>
	{:else}
		<p class="loading">{app.error ?? 'Loading the tour…'}</p>
	{/if}
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
