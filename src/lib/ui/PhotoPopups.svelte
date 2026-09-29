<!--
  The playback pop-up: as the bike rides past a photo or a blog post, one card slides in above
  the scrubber (replacing any card already there) and fades after a few seconds. Photos taken
  together share a card. Clicking pauses and opens the gallery at that photo, or the post.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { app } from '$lib/app.svelte';
	import { clock, photoUrl } from '$lib/data';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();

	// drop the card when its time is up
	onMount(() => {
		const id = setInterval(() => {
			if (tour.popup && tour.popup.until <= performance.now()) tour.popup = null;
		}, 250);
		return () => clearInterval(id);
	});

	const p = $derived(tour.popup);
	const key = $derived(p ? (p.kind === 'post' ? p.post.slug : p.photos[0].id) : null);
</script>

{#if p && (p.kind === 'post' ? tour.layers.blog : tour.layers.photos)}
	<div class="popups" class:beside-drawer={app.settings.eventsOpen}>
		{#key key}
			{#if p.kind === 'photos'}
				{@const first = p.photos[0]}
				<button
					class="card"
					in:fly={{ y: 24, duration: 350 }}
					out:fly={{ y: 12, duration: 300 }}
					onclick={() => {
						tour.playing = false;
						app.gallery = { photos: tour.photos, index: Math.max(0, tour.photos.indexOf(first)) };
					}}
					aria-label="Open photo taken at {clock(first.t)}"
				>
					<img src={photoUrl(first, 'thumb')} alt="" draggable="false" />
					<span>📷 {clock(first.t)}{#if p.photos.length > 1} · +{p.photos.length - 1}{/if}</span>
				</button>
			{:else}
				{@const post = p.post}
				<button
					class="card post"
					in:fly={{ y: 24, duration: 350 }}
					out:fly={{ y: 12, duration: 300 }}
					onclick={() => {
						tour.playing = false;
						app.reading = post;
					}}
					aria-label="Read: {post.title}"
				>
					{#if post.cover}<img src="/photos/thumb/{post.cover}.webp" alt="" draggable="false" />{/if}
					<span class="post-label">✎ Story</span>
					<b>{post.title}</b>
					<span>Read · {post.minutes} min</span>
				</button>
			{/if}
		{/key}
	</div>
{/if}

<style>
	.popups {
		position: absolute;
		z-index: 105;
		right: 24px;
		bottom: 212px;
		display: flex;
		align-items: flex-end; /* cards keep their own height */
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
	.card.post {
		width: 190px;
		border-color: #ffd166;
		box-shadow: 0 0 20px rgba(255, 209, 102, 0.35);
	}
	.card.post img {
		width: 100%;
	}
	.card.post b {
		font-size: 13px;
		padding: 0 2px;
		white-space: normal;
	}
	.post-label {
		color: #ffd166 !important;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: 10px !important;
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
