<!--
  The day's card, top left in the globe and map views: a postage stamp with the day number, the
  date and title, a row of facts, and a "customise" button that opens the view's own settings
  (passed in as children) beneath. Closed by default: the view first, the knobs on request.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { A } from '$lib/activity';
	import { TOUR } from '$lib/tourConfig';
	import { distRound, distUnit, tempRound, tempUnit } from '$lib/units';
	import { app } from '$lib/app.svelte';
	import { dayColor } from '$lib/colors';
	import type { Tour } from '$lib/tour.svelte';

	let { tour, customise, children }: { tour: Tour; customise: string; children: Snippet } = $props();

	let open = $state(false);
	const summary = $derived(app.summary(tour.data.track.day));
	const total = $derived(app.index?.days.length ?? 1);
	const date = $derived(
		summary
			? new Date(summary.start * 1000).toLocaleDateString(TOUR.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: TOUR.timeZone })
			: ''
	);
</script>

<aside class="daycard scroll-y" aria-label="This day" style:--c={dayColor(summary?.index ?? 0, total)}>
	<header>
		<span class="stamp" aria-hidden="true"><small>Day</small>{(summary?.index ?? 0) + 1}</span>
		<div>
			<p class="date">{date}</p>
			<h2 class="display">{tour.data.track.title}</h2>
		</div>
	</header>
	{#if summary}
		<ul class="facts">
			<li>{distRound(summary.km)} {distUnit}</li>
			{#if summary.weather}<li>{tempRound(summary.weather.minTemp)}–{tempRound(summary.weather.maxTemp)}{tempUnit}</li>{/if}
			{#if tour.photos.length}<li>{tour.photos.length} photos</li>{/if}
			{#if summary.rides > 1}<li>{summary.rides} {A.legs}</li>{/if}
		</ul>
	{/if}
	<button type="button" class="tune" aria-expanded={open} onclick={() => (open = !open)}>
		<span aria-hidden="true">✦</span>
		{customise}
		<span class="caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
	</button>
	{#if open}<div class="drawer">{@render children()}</div>{/if}
</aside>

<style>
	.daycard {
		position: absolute;
		z-index: 100;
		top: 84px;
		left: 16px;
		width: 290px;
		max-height: calc(100% - 300px);
		box-sizing: border-box;
		padding: 16px 12px 16px 16px;
		border-radius: 24px;
		background: var(--glass);
		backdrop-filter: blur(12px);
		box-shadow: var(--shadow);
		color: var(--text);
		font-size: 14px;
	}
	header {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.stamp {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 50px;
		border: 3px dotted var(--card);
		border-radius: 6px;
		background: var(--c);
		color: #fff;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 21px;
		line-height: 1;
		transform: rotate(-4deg);
		text-shadow: 0 1px 1px rgb(0 0 0 / 0.25);
		box-shadow: 0 0 0 1px var(--line);
	}
	.stamp small {
		font-family: var(--font-ui);
		font-size: 9px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.date {
		margin: 0;
		font-size: 12px;
		font-weight: 650;
		color: var(--muted);
	}
	h2 {
		margin: 0;
		font-size: 20px;
		line-height: 1.15;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
		font-size: 12.5px;
		font-weight: 650;
	}
	.facts li {
		padding: 4px 10px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--c) 18%, var(--card));
	}
	.tune {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 42px;
		margin-top: 14px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: var(--card);
		color: var(--text);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
		box-shadow:
			var(--press),
			0 0 0 1px var(--line);
	}
	.tune:hover {
		background: var(--accent-soft);
	}
	.caret {
		margin-left: auto;
		color: var(--muted);
	}
	.drawer {
		margin-top: 4px;
	}
</style>
