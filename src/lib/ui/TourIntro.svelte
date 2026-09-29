<!--
  The whole-tour card shown on the UK overview: totals, then the days as a timeline (the same
  list as the events drawer) — date, a dot in the day's colour with its number, the title,
  miles and temperatures, and a strip of that day's photos. Each entry opens its day.
-->
<script lang="ts">
	import type { App } from '$lib/app.svelte';
	import { dayColor } from '$lib/colors';
	import { photoUrl } from '$lib/data';
	import Timeline, { type TimelineItem } from './Timeline.svelte';

	let { app }: { app: App } = $props();
	const days = $derived(app.index?.days ?? []);
	const km = $derived(days.reduce((a, d) => a + d.km, 0));
	const parksVisited = $derived(app.parks?.parks.filter((p) => p.visited).length ?? 0);
	const parksTotal = $derived(app.parks?.parks.length ?? 0);
	const date = (s: number) =>
		new Date(s * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });

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
				sub: `${(d.km / 1.609).toFixed(0)} mi${d.weather ? ` · ${d.weather.minTemp.toFixed(0)}–${d.weather.maxTemp.toFixed(0)}°C` : ''}${photos.length ? ` · ${photos.length} photos` : ''}`,
				thumbs: pick.map((p) => photoUrl(p, 'thumb')),
				more: photos.length > THUMBS ? photos.length - THUMBS : undefined,
				href: `/day/${d.day}`
			};
		})
	);
</script>

<aside class="intro scroll-y">
	<h1>UK tour · September 2026</h1>
	<p class="totals">
		{days.length} days · {(km / 1.609).toFixed(0)} mi{#if parksTotal}
			· <span class="parks">{parksVisited === parksTotal ? 'all ' : ''}{parksVisited}{parksVisited === parksTotal ? '' : `/${parksTotal}`} national parks</span>{/if}
	</p>
	<Timeline {items} whenWidth={42} />
	<p class="hint">Pick a day, or click a marker on the map.</p>
</aside>

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
	.hint {
		margin: 10px 4px 0;
		font-size: 11px;
		color: var(--muted);
	}
</style>
