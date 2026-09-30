<!--
  The globe view: its own chunk, loaded only when someone picks it. A transparent canvas over a
  sky gradient that follows the time of day (and eases from one day's light to the next), with a
  deliberately small UI (GlobeUI). One globe for the whole visit (GlobeStage): the overview's
  meadow with the vehicle parked on it, and each day's landscape, grow in and out of the same
  plinth as you move between them.
-->
<script lang="ts">
	import { TOUR } from '$lib/tourConfig';
	import { Canvas } from '@threlte/core';
	import { NoToneMapping, WebGLRenderer } from 'three';
	import type { App } from '$lib/app.svelte';
	import type { Tour } from '$lib/tour.svelte';
	import GlobeStage from './GlobeStage.svelte';
	import FrameGovernor from './FrameGovernor.svelte';
	import GlobeUI from './GlobeUI.svelte';
	import MiniMap from './MiniMap.svelte';
	import { VIEWS_ON } from '$lib/flags';

	let { app, dpr }: { app: App; dpr: number } = $props();

	const tour = $derived(app.tour);
	const summary = $derived(app.summary(tour?.data.track.day));
	const days = $derived(app.index?.days.length ?? 0);

	const labels = (t: Tour | null) => {
		const s = t ? app.summary(t.data.track.day) : undefined;
		if (!s) return { title: TOUR.title, date: `${TOUR.when} · ${days} days` };
		return {
			title: `Day ${s.index + 1} · ${s.title}`,
			date: new Date(s.start * 1000).toLocaleDateString(TOUR.locale, {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				timeZone: TOUR.timeZone
			})
		};
	};
	const origin = (t: Tour) => {
		const s = app.summary(t.data.track.day);
		return { e: s?.originE ?? 0, n: s?.originN ?? 0 };
	};

	const DAY_SKY = { top: '#bfe1f7', bottom: '#f3f8fb' };
	let top = $state(DAY_SKY.top);
	let bottom = $state(DAY_SKY.bottom);
</script>

<div class="globe" style:--top={top} style:--bottom={bottom}>
	<Canvas {dpr} toneMapping={NoToneMapping} createRenderer={(canvas) => new WebGLRenderer({ canvas, alpha: true, antialias: true })}>
		<FrameGovernor playing={() => app.tour?.playing ?? false} />
		<GlobeStage
			{tour}
			waiting={!!app.pending}
			parks={app.parks}
			{origin}
			{labels}
			onshown={(t) => {
				// the overview has a fair-weather daytime sky, whatever the last day's light was
				if (!t) ({ top, bottom } = DAY_SKY);
			}}
			onsky={(t, b) => ((top = t), (bottom = b))}
			onphotos={(photos) => (app.gallery = { photos, index: 0 })}
			onpost={(post) => (app.reading = post)}
		/>
	</Canvas>
	{#if tour}
		<!-- the map as a small card in the corner (when the map view is released) -->
		{#if VIEWS_ON.includes('2d')}
			{#key tour}<MiniMap {app} {tour} />{/key}
		{/if}
		{#key tour}
			<GlobeUI {tour} parks={app.parks} originE={summary?.originE ?? 0} originN={summary?.originN ?? 0} />
		{/key}
	{/if}
</div>

<style>
	/* registered so the sky gradient can ease between colours (a gradient itself can't transition) */
	@property --top {
		syntax: '<color>';
		inherits: true;
		initial-value: #bfe1f7;
	}
	@property --bottom {
		syntax: '<color>';
		inherits: true;
		initial-value: #f3f8fb;
	}
	.globe {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, var(--top), var(--bottom));
		transition:
			--top 1.2s ease,
			--bottom 1.2s ease;
	}
	/* Touch drags turn the globe, never scroll the page. The orbit controls set this on the canvas
	   wrapper, but three's OrbitControls resets it to `auto` when removed: pinned here so nothing
	   can undo it. */
	.globe :global(canvas),
	.globe :global(div:has(> canvas)) {
		touch-action: none !important;
	}
</style>
