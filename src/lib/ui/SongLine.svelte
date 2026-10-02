<!--
  One song's line: cover (or a note), title · artist, and the Spotify buttons while Spotify is
  usable (src/lib/spotify.svelte.ts). Used by the now-playing pill and, on small screens, inside
  the event banner; the container gives it its chrome.
-->
<script lang="ts">
	import type { Song } from '$lib/data';
	import { player, spotify, trackUrl } from '$lib/spotify.svelte';

	let { song }: { song: Song } = $props();

	const linked = $derived(spotify.ok && !!song.id);
</script>

{#if linked && song.art && !player.broken[song.id!]}
	<img src={song.art} alt="" width="28" height="28" onerror={() => player.coverFailed(song.id!)} />
{:else}
	<span class="note" aria-hidden="true">♪</span>
{/if}
<span class="title" title="{song.name} · {song.artist}"
	><span class="sr">Now playing: </span><b>{song.name}</b><span class="artist">{' · '}{song.artist}</span></span
>
{#if linked}
	{#if player.id !== song.id}
		<button
			type="button"
			class="go"
			onclick={() => player.listen(song.id!)}
			disabled={player.opening}
			aria-label="Listen to {song.name} here">{player.opening ? '…' : '▶ Listen'}</button
		>
	{/if}
	<a class="go" href={trackUrl(song.id!)} target="_blank" rel="noreferrer" aria-label="Open {song.name} in Spotify (new tab)"
		>Spotify ↗</a
	>
{/if}

<style>
	img,
	.note {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
	}
	img {
		object-fit: cover;
	}
	.note {
		display: grid;
		place-items: center;
		background: var(--accent-soft);
		color: var(--accent-ink);
		font-size: 14px;
	}
	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.title b {
		font-weight: 650;
	}
	.artist {
		opacity: 0.7;
	}
	.go {
		flex: none;
		padding: 4px 10px;
		border: 0;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-ink);
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}
	.go:hover {
		background: var(--card);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	@media (max-width: 360px) {
		.artist {
			display: none;
		}
	}
</style>
