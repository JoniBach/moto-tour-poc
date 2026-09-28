<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { onMount } from 'svelte';
	import { loadTour } from '$lib/data';
	import Scene from '$lib/scene/Scene.svelte';
	import { Tour } from '$lib/tour.svelte';
	import ControlPanel from '$lib/ui/ControlPanel.svelte';
	import PinCard from '$lib/ui/PinCard.svelte';
	import Scrubber from '$lib/ui/Scrubber.svelte';

	let tour = $state<Tour>();
	let error = $state<string>();

	onMount(() => {
		loadTour()
			.then((data) => (tour = new Tour(data)))
			.catch((e) => (error = String(e)));
	});

	function onkeydown(e: KeyboardEvent) {
		if (!tour || (e.target as HTMLElement).closest('input, select, textarea')) return;
		if (e.code === 'Space') {
			e.preventDefault();
			tour.togglePlay();
		} else if (e.code === 'ArrowRight') tour.seek(tour.rt + 30);
		else if (e.code === 'ArrowLeft') tour.seek(tour.rt - 30);
	}
</script>

<svelte:head><title>Moto Tour POC</title></svelte:head>
<svelte:window {onkeydown} />

<main>
	{#if tour}
		<Canvas>
			<Scene {tour} />
		</Canvas>
		<ControlPanel {tour} />
		<PinCard {tour} />
		<Scrubber {tour} />
		<p class="attribution">
			{#if tour.data.osm}
				Map data <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{tour.data.osm.attribution}</a>
			{/if}
			{#if tour.mapStyle !== 'hologram'} · {tour.imagery.attribution}{/if}
			{#if tour.data.weather}
				· <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{tour.data.weather.attribution}</a>
			{/if}
		</p>
	{:else}
		<p class="loading">{error ?? 'Loading terrain…'}</p>
	{/if}
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
</style>
