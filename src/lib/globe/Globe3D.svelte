<!--
  The globe view: its own chunk, loaded only when someone picks it. A transparent canvas over a
  sky gradient that follows the time of day, with a deliberately small UI (GlobeUI). Before a
  day is chosen (and while one loads) it shows the overview globe: a meadow with the bike parked
  on it, beside the day list.
-->
<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { NoToneMapping, WebGLRenderer } from 'three';
	import type { App } from '$lib/app.svelte';
	import GlobeOverview from './GlobeOverview.svelte';
	import GlobeScene from './GlobeScene.svelte';
	import GlobeUI from './GlobeUI.svelte';

	let { app, dpr }: { app: App; dpr: number } = $props();

	const tour = $derived(app.tour);
	const summary = $derived(app.summary(tour?.data.track.day));
	const date = $derived(
		summary
			? new Date(summary.start * 1000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })
			: ''
	);
	const days = $derived(app.index?.days.length ?? 0);

	const DAY_SKY = { top: '#bfe1f7', bottom: '#f3f8fb' };
	let top = $state(DAY_SKY.top);
	let bottom = $state(DAY_SKY.bottom);
	// the overview has a fair-weather daytime sky, whatever the last day's light was
	$effect(() => {
		if (!tour) ({ top, bottom } = DAY_SKY);
	});
</script>

<div class="globe" style:--top={top} style:--bottom={bottom}>
	<Canvas {dpr} toneMapping={NoToneMapping} createRenderer={(canvas) => new WebGLRenderer({ canvas, alpha: true, antialias: true })}>
		{#if tour && summary}
			{#key tour}
				<GlobeScene
					{tour}
					originE={summary.originE}
					originN={summary.originN}
					title={`Day ${summary.index + 1} · ${summary.title}`}
					{date}
					onsky={(t, b) => ((top = t), (bottom = b))}
					onphotos={(photos) => (app.gallery = { photos, index: 0 })}
					onpost={(post) => (app.reading = post)}
				/>
			{/key}
		{:else}
			<GlobeOverview title="A motorcycle tour of Britain's national parks" date={`September 2026 · ${days} days`} />
		{/if}
	</Canvas>
	{#if tour}
		{#key tour}
			<GlobeUI {tour} />
		{/key}
	{/if}
</div>

<style>
	.globe {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, var(--top), var(--bottom));
	}
</style>
