<!--
  The map's companion in its corner: a small live globe of the same moment (the globe scene in
  its mini mode: no controls, labels, pins, surroundings or weather). The map plays the ride; the
  globe follows. Clicking it switches to the globe view. Its own chunk, loaded only in map view.
-->
<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { NoToneMapping, WebGLRenderer } from 'three';
	import type { App } from '$lib/app.svelte';
	import GlobeScene from './GlobeScene.svelte';

	let { app }: { app: App } = $props();

	const tour = $derived(app.tour);
	const summary = $derived(app.summary(tour?.data.track.day));
	let top = $state('#bfe1f7');
	let bottom = $state('#f3f8fb');
</script>

{#if tour && summary}
	<button type="button" class="inset" style:--top={top} style:--bottom={bottom} onclick={() => app.setView('globe')} aria-label="Switch to the globe" title="Switch to the globe">
		<Canvas dpr={1} toneMapping={NoToneMapping} createRenderer={(canvas) => new WebGLRenderer({ canvas, alpha: true, antialias: true })}>
			{#key tour}
				<GlobeScene
					{tour}
					mini
					originE={summary.originE}
					originN={summary.originN}
					parks={app.parks}
					title={`Day ${summary.index + 1} · ${summary.title}`}
					date=""
					onsky={(t, b) => ((top = t), (bottom = b))}
					onphotos={() => {}}
					onpost={() => {}}
				/>
			{/key}
		</Canvas>
		<span class="label"><span aria-hidden="true">◍</span> Globe</span>
	</button>
{/if}

<style>
	.inset {
		position: absolute;
		z-index: 100;
		top: 84px;
		right: 16px;
		width: 168px;
		height: 168px;
		padding: 0;
		border: 1px solid rgb(44 58 69 / 0.15);
		border-radius: 18px;
		background: linear-gradient(to bottom, var(--top), var(--bottom));
		box-shadow: 0 4px 20px rgb(40 50 70 / 0.18);
		cursor: pointer;
		overflow: hidden;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}
	.inset:hover {
		transform: scale(1.03);
		box-shadow: 0 6px 24px rgb(40 50 70 / 0.24);
	}
	.inset:focus-visible {
		outline: 3px solid #1c7ed6;
		outline-offset: 2px;
	}
	/* the globe can't be turned here: the whole card is the button */
	.inset :global(canvas) {
		pointer-events: none;
	}
	.label {
		position: absolute;
		left: 8px;
		bottom: 6px;
		padding: 1px 6px;
		border-radius: 8px;
		background: rgb(255 255 255 / 0.7);
		font-size: 11px;
		font-weight: 650;
		color: #2c3a45;
	}
	@media (max-width: 900px) {
		.inset {
			top: calc(env(safe-area-inset-top) + 76px);
			left: 8px;
			right: auto;
			width: 112px;
			height: 112px;
			border-radius: 14px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.inset {
			transition: none;
		}
		.inset:hover {
			transform: none;
		}
	}
</style>
