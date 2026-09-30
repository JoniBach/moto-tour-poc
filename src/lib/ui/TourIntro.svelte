<!--
  The whole-tour card shown on the UK overview: totals, then the days as a timeline (the same
  list as the events drawer) — date, a dot in the day's colour with its number, the title,
  miles and temperatures, and a strip of that day's photos. Each entry opens its day.
-->
<script lang="ts">
	import { distRound, distUnit, tempRound, tempUnit } from '$lib/units';
	import { SITE_NAME, TOUR } from '$lib/tourConfig';
	import type { App } from '$lib/app.svelte';
	import { dayColor } from '$lib/colors';
	import { photoUrl } from '$lib/data';
	import { ui } from '$lib/ui.svelte';
	import Timeline, { type TimelineItem } from './Timeline.svelte';

	// phones: a peek card at the bottom; tap the header to expand the day list
	let expanded = $state(false);

	let { app }: { app: App } = $props();
	const days = $derived(app.index?.days ?? []);
	const km = $derived(days.reduce((a, d) => a + d.km, 0));
	const parksVisited = $derived(app.parks?.parks.filter((p) => p.visited).length ?? 0);
	const parksTotal = $derived(app.parks?.parks.length ?? 0);
	const date = (s: number) =>
		new Date(s * 1000).toLocaleDateString(TOUR.locale, { day: 'numeric', month: 'short', timeZone: TOUR.timeZone });

	const THUMBS = 4;
	const items: TimelineItem[] = $derived(
		days.map((d) => {
			const photos = app.photos.filter((p) => p.day === d.day);
			// spread the strip across the day rather than showing its first few shots
			const pick = photos.length <= THUMBS ? photos : Array.from({ length: THUMBS }, (_, k) => photos[Math.floor(((k + 0.5) * photos.length) / THUMBS)]);
			return {
				key: d.day,
				when: date(d.start),
				icon: String(d.index + 1),
				color: dayColor(d.index, days.length),
				title: d.title,
				sub: `${distRound(d.km)} ${distUnit}${d.weather ? ` · ${tempRound(d.weather.minTemp)}–${tempRound(d.weather.maxTemp)}${tempUnit}` : ''}${photos.length ? ` · ${photos.length} photos` : ''}`,
				thumbs: pick.map((p) => photoUrl(p, 'thumb')),
				more: photos.length > THUMBS ? photos.length - THUMBS : undefined,
				href: `/day/${d.day}`
			};
		})
	);
</script>

{#if ui.mobile}
	<aside class="peek" class:expanded>
		<button class="peek-head" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
			<span class="grab" aria-hidden="true"></span>
			<span class="peek-title">{SITE_NAME}</span>
			<span class="peek-totals">
				{days.length} days · {distRound(km)} {distUnit}{#if parksVisited} · {parksVisited} {TOUR.protectedAreas.many}{/if}
			</span>
			<span class="peek-cta">{expanded ? 'Hide days ▾' : 'Show days ▴'}</span>
		</button>
		{#if expanded}
			<div class="peek-list scroll-y">
				<Timeline {items} whenWidth={44} />
			</div>
		{/if}
	</aside>
{:else}
<aside class="intro scroll-y">
	<h1>{SITE_NAME}</h1>
	<p class="totals">
		{days.length} days · {distRound(km)} {distUnit}{#if parksVisited}
			· <span class="parks">{parksVisited === parksTotal ? 'all ' : ''}{parksVisited}{parksVisited === parksTotal ? '' : `/${parksTotal}`} {TOUR.protectedAreas.many}</span>{/if}
	</p>
	<Timeline {items} whenWidth={42} />
	<p class="hint">Pick a day, or click a marker on the map.</p>
</aside>
{/if}

<style>
	.intro {
		position: absolute;
		z-index: 100;
		top: 16px;
		left: 16px;
		width: 300px;
		max-height: calc(100% - 32px);
		padding: 14px 10px 14px 12px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--glass);
		backdrop-filter: blur(10px);
		color: var(--text);
	}
	h1 {
		margin: 0 4px;
		font-size: 18px;
		color: var(--accent);
	}
	.totals {
		margin: 2px 4px 10px;
		color: var(--muted);
		font-size: 12px;
	}
	.parks {
		color: #b9f5c4;
	}
	.peek {
		position: fixed;
		z-index: 100;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		max-height: 70dvh;
		border: 1px solid var(--line);
		border-bottom: none;
		border-radius: 18px 18px 0 0;
		background: rgba(4, 12, 20, 0.92);
		backdrop-filter: blur(14px);
		padding-bottom: env(safe-area-inset-bottom);
	}
	.peek-head {
		all: unset;
		cursor: pointer;
		position: relative;
		display: grid;
		gap: 2px;
		padding: 18px 16px 12px;
		text-align: center;
	}
	.grab {
		position: absolute;
		top: 7px;
		left: 50%;
		width: 40px;
		height: 4px;
		margin-left: -20px;
		border-radius: 2px;
		background: var(--muted);
		opacity: 0.6;
	}
	.peek-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--accent);
	}
	.peek-totals {
		font-size: 12px;
		color: var(--muted);
	}
	.peek-cta {
		margin-top: 6px;
		font-size: 12px;
		color: var(--text);
	}
	.peek-list {
		flex: 1;
		min-height: 0;
		padding: 0 10px 12px;
	}
	.hint {
		margin: 10px 4px 0;
		font-size: 11px;
		color: var(--muted);
	}
</style>
