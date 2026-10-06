<!--
  Now playing: the track that was on at the ride's moment (scripts/build-music.mjs), as a small
  pill beside the event banner, and the in-page player above it once the viewer opens it. The name
  and artist are our own data and always show; the Spotify parts (cover, link, player) only while
  Spotify is usable (src/lib/spotify.svelte.ts): switched off for the build, offline, or Spotify
  not answering, they quietly go.
  pill={false} (small screens): the event banner shows the song between events instead
  (GlobeBanner's music), and only the player shows here.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { app } from '$lib/app.svelte';
	import { playingAt } from '$lib/data';
	import { embedUrl, player } from '$lib/spotify.svelte';
	import type { Tour } from '$lib/tour.svelte';
	import SongLine from './SongLine.svelte';

	let { tour, pill = true }: { tour: Tour; pill?: boolean } = $props();

	const now = $derived(pill && app.music ? playingAt(app.music, tour.bike.time) : null);
</script>

{#if now || player.id}
	<div class="music">
		{#if player.id}
			<div class="player" transition:fade={{ duration: 200 }}>
				<iframe
					title="Spotify player"
					src={embedUrl(player.id)}
					width="100%"
					height="80"
					allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
					loading="lazy"
				></iframe>
				<button type="button" class="close" onclick={() => player.close()} aria-label="Close the player">×</button>
			</div>
		{/if}
		{#if now}
			{#key now.start}
				<div class="np" in:fade={{ duration: 300 }}><SongLine song={now.song} /></div>
			{/key}
		{/if}
	</div>
{/if}

<style>
	.music {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
		min-width: 0;
		max-width: min(440px, 100%);
		margin-left: auto; /* the right-hand end of its row or column */
	}
	.np {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 100%;
		min-height: 36px;
		box-sizing: border-box;
		padding: 4px;
		border-radius: 999px;
		background: var(--pc-glass);
		backdrop-filter: blur(12px);
		box-shadow:
			var(--pc-shadow),
			0 0 0 1px var(--pc-line);
		color: var(--pc-ink);
		font-size: 13px;
	}
	.np:not(:has(:global(.go))) {
		padding-right: 14px;
	}
	.player {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
	}
	iframe {
		display: block;
		flex: 1;
		min-width: 0;
		border: 0;
		border-radius: 12px;
		box-shadow:
			var(--pc-shadow),
			0 0 0 1px var(--pc-line);
	}
	.close {
		flex: none;
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: 50%;
		background: var(--pc-glass);
		box-shadow: 0 0 0 1px var(--pc-line);
		color: var(--pc-ink);
		font: inherit;
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
	}
</style>
