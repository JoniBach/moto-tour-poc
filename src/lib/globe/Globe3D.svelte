<!--
  The globe view: its own chunk, loaded only when someone picks it. A transparent canvas over a
  sky gradient that follows the time of day, with a deliberately small UI (GlobeUI).
-->
<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { NoToneMapping, WebGLRenderer } from 'three';
	import type { App } from '$lib/app.svelte';
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

	let top = $state('#bfe1f7');
	let bottom = $state('#f3f8fb');
</script>

<div class="globe" style:--top={top} style:--bottom={bottom}>
	{#if tour && summary}
		<Canvas {dpr} toneMapping={NoToneMapping} createRenderer={(canvas) => new WebGLRenderer({ canvas, alpha: true, antialias: true })}>
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
		</Canvas>
		{#key tour}
			<GlobeUI {tour} />
		{/key}
	{:else if !app.pending}
		<p class="pick">Pick a day to see it in the globe.</p>
	{/if}
</div>

<style>
	.globe {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, var(--top), var(--bottom));
	}
	.pick {
		position: absolute;
		left: 50%;
		bottom: 18%;
		transform: translateX(-50%);
		margin: 0;
		padding: 10px 16px;
		border-radius: 22px;
		background: rgb(255 255 255 / 0.75);
		color: #2c3a45;
		font-weight: 600;
	}
</style>
