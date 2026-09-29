<!--
  Phone button strip under the trip bar: the views (all of them, the current one lit), then the
  bottom sheets (map & view settings, the day's events, map info + credits). One sheet at a time;
  tapping the open one's button closes it.
-->
<script lang="ts">
	import type { App, View } from '$lib/app.svelte';
	import { on, VIEWS_ON } from '$lib/flags';
	import { ui } from '$lib/ui.svelte';

	let { app, events }: { app: App; events: number } = $props();

	const ABOUT: Record<View, { icon: string; name: string }> = {
		'3d': { icon: '⛰', name: '3D view' },
		'2d': { icon: '🗺', name: 'flat map' },
		globe: { icon: '◍', name: 'globe' }
	};
</script>

<nav class="mbar" aria-label="Views and panels">
	<!-- every view that's on, always in the same place; the current one lit -->
	{#if VIEWS_ON.length > 1}
		<div class="views" role="group" aria-label="View">
			{#each VIEWS_ON as v (v)}
				<button class:on={app.view === v} aria-pressed={app.view === v} onclick={() => app.setView(v)} aria-label="The {ABOUT[v].name}">
					{ABOUT[v].icon}
				</button>
			{/each}
		</div>
	{/if}
	{#if app.tour}
		<button class:on={ui.sheet === 'controls'} onclick={() => ui.toggle('controls')} aria-label="Map and view settings">⚙</button>
		{#if app.view !== 'globe'}
			<button class:on={ui.sheet === 'events'} onclick={() => ui.toggle('events')} aria-label="Day events">
				☰{#if events}<span class="n">{events}</span>{/if}
			</button>
		{/if}
	{/if}
	{#if on('blog')}
		<a class="btn" href={app.tour ? `/blog/${app.tour.data.track.day}` : '/blog'} aria-label="Read as a blog">📖</a>
	{/if}
	<button class:on={ui.sheet === 'info'} onclick={() => ui.toggle('info')} aria-label="Map info and credits">ⓘ</button>
</nav>

<style>
	.mbar {
		position: fixed;
		z-index: 110;
		top: calc(env(safe-area-inset-top) + 66px);
		right: 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	button,
	.btn {
		all: unset;
		cursor: pointer;
		position: relative;
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--glass);
		backdrop-filter: blur(10px);
		color: var(--text);
		font-size: 19px;
	}
	/* the views as one segmented column, set apart from the panel buttons */
	.views {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 2px;
		margin-bottom: 6px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--glass);
		backdrop-filter: blur(10px);
	}
	.views button {
		border-color: transparent;
		background: none;
		backdrop-filter: none;
	}
	button.on {
		background: var(--accent-soft);
		border-color: var(--accent);
	}
	.n {
		position: absolute;
		top: -5px;
		right: -5px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		box-sizing: border-box;
		border-radius: 9px;
		background: var(--accent);
		color: #03070c;
		font-size: 10px;
		font-weight: 700;
		line-height: 18px;
		text-align: center;
	}
</style>
