<!--
  Phone button strip under the trip bar: the views (all of them, the current one lit), then the
  bottom sheets (map & view settings, the day's events, map info + credits). One sheet at a time;
  tapping the open one's button closes it.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import type { App, View } from '$lib/app.svelte';
	import { on, VIEWS_ON } from '$lib/flags';
	import { ui } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';

	let { app, events }: { app: App; events: number } = $props();

	const ABOUT: Record<View, { icon: string; name: string }> = {
		'3d': { icon: 'mountain', name: '3D view' },
		'2d': { icon: 'map', name: 'flat map' },
		globe: { icon: 'globe', name: 'globe' }
	};
</script>

<nav class="mbar" aria-label="Views and panels">
	<!-- every view that's on, always in the same place; the current one lit -->
	{#if VIEWS_ON.length > 1}
		<div class="pc-segmented views" role="group" aria-label="View">
			{#each VIEWS_ON as v (v)}
				<button aria-pressed={app.view === v} onclick={() => app.setView(v)} aria-label="The {ABOUT[v].name}"><Icon name={ABOUT[v].icon} /></button>
			{/each}
		</div>
	{/if}
	{#if app.tour}
		<button class="pc-icon-button pc-icon-button--glass" aria-pressed={ui.sheet === 'controls'} onclick={() => ui.toggle('controls')} aria-label="Map and view settings"><Icon name="sliders" /></button>
		<button class="pc-icon-button pc-icon-button--glass" aria-pressed={ui.sheet === 'events'} onclick={() => ui.toggle('events')} aria-label="Day events">
			<Icon name="menu" />{#if events}<span class="pc-badge n">{events}</span>{/if}
		</button>
	{/if}
	{#if on('blog')}
		<a class="pc-icon-button pc-icon-button--glass" href={app.tour ? `${base}/blog/${app.tour.data.track.day}` : `${base}/blog`} aria-label="Read as a blog"><Icon name="book" /></a>
	{/if}
	<button class="pc-icon-button pc-icon-button--glass" aria-pressed={ui.sheet === 'info'} onclick={() => ui.toggle('info')} aria-label="Map info and credits"><Icon name="info" /></button>
</nav>

<style>
	/* a column of Postcard's frosted round buttons down the right edge, the views as a segmented column */
	.mbar {
		position: fixed;
		z-index: 110;
		top: calc(env(safe-area-inset-top) + 66px);
		right: 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.mbar > .pc-icon-button {
		position: relative;
	}
	.views {
		flex-direction: column;
		gap: 2px;
		padding: 2px;
		margin-bottom: 6px;
		backdrop-filter: blur(12px);
	}
	.views button {
		justify-content: center;
		width: 40px;
		min-height: 40px;
		padding: 0;
	}
	.n {
		position: absolute;
		top: -5px;
		right: -5px;
		min-width: 18px;
		height: 18px;
		font-size: 10px;
		background: var(--pc-accent);
		color: var(--pc-on-accent);
	}
</style>
