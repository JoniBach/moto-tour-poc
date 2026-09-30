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

<a class="card" class:current {href} style:--c={color} aria-current={current ? 'page' : undefined} data-day={d.day}>
	<span class="art" class:photo={!!photo}>
		{#if photo}<img src={photoUrl(photo, 'thumb')} alt="" loading="lazy" draggable="false" />{/if}
		<span class="map"><RouteSketch s={drawn} {color} width={4} /></span>
		<span class="stamp" aria-hidden="true"><small>Day</small>{d.index + 1}</span>
	</span>
	<span class="body">
		<span class="date">{date}</span>
		<span class="title display"><span class="sr">Day {d.index + 1}: </span>{d.title}</span>
		<span class="facts">
			{distRound(d.km)} {distUnit}{#if d.weather}{' · '}{tempRound(d.weather.minTemp)}–{tempRound(d.weather.maxTemp)}{tempUnit}{/if}{#if photos}{' · '}{photos} photos{/if}
		</span>
	</span>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		border-radius: var(--radius);
		background: var(--card);
		color: var(--text);
		text-decoration: none;
		box-shadow:
			var(--press),
			0 0 0 1px var(--line);
		overflow: hidden;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}
	.card:hover {
		transform: translateY(-3px) rotate(-0.4deg);
		box-shadow:
			0 6px 0 rgb(38 50 56 / 0.12),
			0 0 0 1px var(--line),
			var(--shadow);
	}
	.card:active {
		transform: translateY(1px);
	}
	.card.current {
		box-shadow:
			var(--press),
			0 0 0 3px var(--c);
	}
	.art {
		position: relative;
		display: block;
		flex: none;
		height: 118px;
		margin: 8px 8px 0;
		border-radius: calc(var(--radius) - 8px);
		/* a day with no photos: its own colour, washed out */
		background: color-mix(in srgb, var(--c) 30%, var(--paper));
		overflow: hidden;
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* the photo softened a little so the sketch reads over it */
	.art.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(160deg, transparent 40%, color-mix(in srgb, var(--c) 45%, transparent));
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
		background: rgb(255 253 248 / 0.82);
		box-sizing: border-box;
	}
	/* a postage stamp: scalloped edge from a dotted border, the day number in Fraunces */
	.stamp {
		position: absolute;
		z-index: 1;
		top: 8px;
		left: 8px;
		display: grid;
		place-items: center;
		width: 42px;
		height: 46px;
		border: 3px dotted var(--card);
		border-radius: 6px;
		background: var(--c);
		color: #fff;
		font-family: var(--font-display);
		font-variation-settings:
			'SOFT' 100,
			'WONK' 1;
		font-size: 19px;
		font-weight: 700;
		line-height: 1;
		transform: rotate(-4deg);
		text-shadow: 0 1px 1px rgb(0 0 0 / 0.25);
	}
	.stamp small {
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 14px 14px;
	}
	.date {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
		letter-spacing: 0.02em;
	}
	.title {
		font-size: 17px;
		line-height: 1.2;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.facts {
		margin-top: 2px;
		font-size: 12px;
		color: var(--muted);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
