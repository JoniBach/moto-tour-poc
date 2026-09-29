<!--
  Photos popping up during playback: as the bike rides past where a photo was taken, a card
  slides in above the scrubber (newest on the right) and fades after a few seconds.
  Clicking one pauses and opens the day's gallery at that photo.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { app } from '$lib/app.svelte';
	import { clock, photoUrl } from '$lib/data';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();

	// drop cards whose time is up
	onMount(() => {
		const id = setInterval(() => {
			const now = performance.now();
			if (tour.popups.some((p) => p.until <= now)) tour.popups = tour.popups.filter((p) => p.until > now);
		}, 250);
		return () => clearInterval(id);
	});
</script>

{#if tour.layers.photos && tour.popups.length}
	<div class="popups" class:beside-drawer={app.settings.eventsOpen}>
		{#each tour.popups as p (p.photo.id)}
			<button
				class="card"
				in:fly={{ y: 24, duration: 350 }}
				out:fly={{ y: 12, duration: 400 }}
				onclick={() => {
					tour.playing = false;
					app.gallery = { photos: tour.photos, index: Math.max(0, tour.photos.indexOf(p.photo)) };
				}}
				aria-label="Open photo taken at {clock(p.photo.t)}"
			>
				<img src={photoUrl(p.photo, 'thumb')} alt="" draggable="false" />
				<span>📷 {clock(p.photo.t)}</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.popups {
		position: absolute;
		z-index: 105;
		right: 24px;
		bottom: 212px;
		display: flex;
		gap: 10px;
		pointer-events: none;
	}
	.popups.beside-drawer {
		right: 332px;
	}
	.card {
		all: unset;
		cursor: pointer;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 5px;
		border: 1px solid #ffd166;
		border-radius: 10px;
		background: var(--glass);
		backdrop-filter: blur(8px);
		box-shadow: 0 0 16px rgba(255, 209, 102, 0.25);
		transition: transform 0.15s;
	}
	.card:hover {
		transform: translateY(-3px);
	}
	.card img {
		width: 150px;
		height: 112px;
		object-fit: cover;
		border-radius: 6px;
	}
	.card span {
		font-size: 11px;
		color: var(--muted);
		padding: 0 2px;
	}
	@media (max-width: 700px) {
		.popups {
			right: 16px;
			left: 16px;
			bottom: 230px;
			justify-content: flex-end;
		}
		.card img {
			width: 96px;
			height: 72px;
		}
	}
</style>
