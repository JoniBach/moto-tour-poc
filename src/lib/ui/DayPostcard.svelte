<!--
  One day of the tour as a postcard: a photo from the day (or its colour, when it has none) with
  the day's route sketched over it, a postage-stamp day number, then the date, title and a line of
  facts. A link to the day. Used by the journey picker's rail and the day menu.
-->
<script lang="ts">
	import { TOUR } from '$lib/tourConfig';
	import { distRound, distUnit, tempRound, tempUnit } from '$lib/units';
	import { dayColor } from '$lib/colors';
	import { photoUrl, type DaySummary, type Photo } from '$lib/data';
	import { sketch } from '$lib/sketch';
	import RouteSketch from './RouteSketch.svelte';

	let {
		d,
		total,
		photo,
		photos = 0,
		href,
		current = false
	}: { d: DaySummary; total: number; photo?: Photo; photos?: number; href: string; current?: boolean } = $props();

	const color = $derived(dayColor(d.index, total));
	const date = $derived(
		new Date(d.start * 1000).toLocaleDateString(TOUR.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TOUR.timeZone })
	);

	const drawn = $derived(sketch(d.lines, { pad: 8 }));
</script>

<a class="pc-postcard card" class:is-current={current} {href} style:--pc-c={color} aria-current={current ? 'page' : undefined} data-day={d.day}>
	<span class="pc-postcard__art art" class:photo={!!photo}>
		{#if photo}<img src={photoUrl(photo, 'thumb')} alt="" loading="lazy" draggable="false" />{/if}
		<span class="map"><RouteSketch s={drawn} {color} width={4} /></span>
		<span class="pc-stamp pc-stamp--solid" aria-hidden="true"><small>Day</small>{d.index + 1}</span>
	</span>
	<span class="pc-postcard__body">
		<span class="pc-postcard__meta">{date}</span>
		<span class="pc-postcard__title pc-display"><span class="pc-sr-only">Day {d.index + 1}: </span>{d.title}</span>
		<span class="pc-postcard__facts">
			{distRound(d.km)} {distUnit}{#if d.weather}{' · '}{tempRound(d.weather.minTemp)}–{tempRound(d.weather.maxTemp)}{tempUnit}{/if}{#if photos}{' · '}{photos} photos{/if}
		</span>
	</span>
</a>

<style>
	/* a Postcard postcard: the stamp, art, body and the lift on hover are Postcard's. Here: it fills its
	   grid cell, a slightly taller picture, and the route sketch inset in the corner */
	.card {
		height: 100%;
	}
	.art {
		height: 118px;
	}
	.map {
		display: block;
		position: absolute;
		z-index: 1;
		right: 6px;
		bottom: 6px;
		width: 64px;
		height: 64px;
		padding: 4px;
		border-radius: 14px;
		background: var(--pc-glass);
	}
</style>
