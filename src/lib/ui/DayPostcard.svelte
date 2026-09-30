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

	// the day's route, fitted into a 100 × 100 box (north up, aspect kept)
	const sketch = $derived.by(() => {
		const { minE, maxE, minN, maxN } = d.extent;
		const span = Math.max(maxE - minE, maxN - minN) || 1;
		const ox = (100 - ((maxE - minE) / span) * 84) / 2;
		const oy = (100 - ((maxN - minN) / span) * 84) / 2;
		const x = (e: number) => (ox + ((e - minE) / span) * 84).toFixed(1);
		const y = (n: number) => (oy + ((maxN - n) / span) * 84).toFixed(1);
		const paths = d.lines.map((line) => {
			let s = '';
			for (let k = 0; k < line.length; k += 2) s += `${k ? 'L' : 'M'}${x(line[k])} ${y(line[k + 1])}`;
			return s;
		});
		const first = d.lines[0];
		const last = d.lines[d.lines.length - 1];
		return {
			paths,
			start: first ? [x(first[0]), y(first[1])] : null,
			end: last ? [x(last[last.length - 2]), y(last[last.length - 1])] : null
		};
	});
</script>

<a class="card" class:current {href} style:--c={color} aria-current={current ? 'page' : undefined} data-day={d.day}>
	<span class="art" class:photo={!!photo}>
		{#if photo}<img src={photoUrl(photo, 'thumb')} alt="" loading="lazy" draggable="false" />{/if}
		<svg viewBox="0 0 100 100" aria-hidden="true">
			{#each sketch.paths as p, i (i)}<path d={p} />{/each}
			{#if sketch.start}<circle class="start" cx={sketch.start[0]} cy={sketch.start[1]} r="3.2" />{/if}
			{#if sketch.end}<circle class="end" cx={sketch.end[0]} cy={sketch.end[1]} r="3.2" />{/if}
		</svg>
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
	svg {
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
	path {
		fill: none;
		stroke: var(--c);
		stroke-width: 4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	circle.start {
		fill: #fff;
		stroke: var(--ink);
		stroke-width: 2;
	}
	circle.end {
		fill: var(--ink);
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
