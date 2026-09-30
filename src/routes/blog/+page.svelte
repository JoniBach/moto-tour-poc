<!--
  The whole tour as a blog: every day a chapter (its stamp, date, title, facts and route sketch),
  every moment in order under it, stories as the big cards. The journey rail beside it (in the
  layout) follows along as you scroll.
-->
<script lang="ts">
	import { distRound, distWord, tempRound, tempUnit } from '$lib/units';
	import { SITE_NAME, TOUR } from '$lib/tourConfig';
	import { on, tourOn, TOUR_NAME } from '$lib/flags';
	import { iso, longDate, shortDate } from '$lib/blog';
	import EventGroup from '$lib/blog/EventGroup.svelte';
	import EventItem from '$lib/blog/EventItem.svelte';
	import { arrange, inRange, shows, view } from '$lib/blog/view.svelte';
	import ViewControls from '$lib/blog/ViewControls.svelte';
	import { dayColor } from '$lib/colors';
	import RouteSketch from '$lib/ui/RouteSketch.svelte';

	let { data } = $props();
	const { days, totals } = $derived(data);

	const total = $derived(days.reduce((a, d) => a + d.events.length, 0));
	// the days and rows the current settings leave showing
	const visible = $derived(
		days
			.filter((d) => inRange(d.day))
			.map((d) => ({ d, rows: arrange(d.events, view.group), n: d.events.filter(shows).length }))
			.filter((x) => x.n > 0)
	);
	const shown = $derived(visible.reduce((a, x) => a + x.n, 0));
	const dayOptions = $derived(days.map((d) => ({ day: d.day, label: `Day ${d.index + 1}, ${shortDate(d.start)}` })));
</script>

<svelte:head>
	<title>{SITE_NAME} · Blog</title>
	<meta
		name="description"
		content="{TOUR.title}: {totals.days} days and {totals.distance} {distWord}, day by day."
	/>
</svelte:head>

<header class="intro">
	<p class="eyebrow">{TOUR.name} · {TOUR.when}</p>
	<h1>{TOUR.title}</h1>
	<p class="lede">
		{totals.days} days {TOUR.summary}, told moment by moment.{#if tourOn}{' '}Every moment links to the same spot in the {TOUR_NAME}.{/if}
	</p>
	<ul class="stats" aria-label="The tour in numbers">
		<li class="sage"><strong>{totals.days}</strong> days</li>
		<li class="sky"><strong>{totals.distance.toLocaleString(TOUR.locale)}</strong> {distWord}</li>
		{#if totals.parks}<li class="butter"><strong>{totals.parks}</strong> {TOUR.protectedAreas.many}</li>{/if}
		{#if totals.photos}<li class="lilac"><strong>{totals.photos}</strong> photos</li>{/if}
		{#if totals.stories}<li class="peach"><strong>{totals.stories}</strong> {totals.stories === 1 ? 'story' : 'stories'}</li>{/if}
	</ul>
	{#if on('blogFilters')}<ViewControls days={dayOptions} {shown} {total} />{/if}
</header>

{#each visible as { d, rows } (d.day)}
	{@const c = dayColor(d.index, days.length)}
	<section class="day" id="day-{d.index + 1}" data-day={d.day} aria-labelledby="h-{d.day}" style:--c={c}>
		<header class="chapter">
			<span class="stamp" aria-hidden="true"><small>Day</small>{d.index + 1}</span>
			<div class="heading">
				<p class="daynum"><span class="sr">Day {d.index + 1}, </span><time datetime={iso(d.start)}>{longDate(d.start)}</time></p>
				<h2 id="h-{d.day}"><a href="/blog/{d.day}">{d.title}</a></h2>
				<p class="meta">
					{distRound(d.km)} {distWord}{#if d.weather}{' · '}{tempRound(d.weather.minTemp)} to {tempRound(d.weather.maxTemp)} {tempUnit}{/if}{#if d.parks.length}{' · '}{d.parks.join(', ')}{/if}
				</p>
			</div>
			<span class="route"><RouteSketch s={d.sketch} color={c} /></span>
		</header>
		<ol class="events" aria-label="Day {d.index + 1}, moment by moment">
			{#each rows as r (r.key)}
				{#if r.kind === 'group'}
					<EventGroup events={r.events} title={r.title} icon={r.icon} day={d.day} />
				{:else}
					<EventItem e={r.e} day={d.day} />
				{/if}
			{/each}
		</ol>
		<p class="dayfoot"><a href="/blog/{d.day}">Day {d.index + 1} on its own page<span aria-hidden="true"> →</span></a></p>
	</section>
{:else}
	<p class="none">No events match these settings. Use “Reset to show everything” above to see the whole tour again.</p>
{/each}

<style>
	.intro {
		margin: 0.5rem 0 2rem;
	}
	.eyebrow {
		margin: 0 0 0.4rem;
		font-size: 0.8rem;
		font-weight: 750;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--b-accent);
	}
	h1 {
		margin: 0 0 0.6rem;
		font-size: clamp(2rem, 5vw, 2.9rem);
	}
	.lede {
		font-size: 1.15rem;
		color: var(--b-muted);
		max-width: 36em;
		margin-bottom: 1rem;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin: 0 0 1.25rem;
		padding: 0;
		list-style: none;
		font-size: 0.95rem;
	}
	.stats li {
		padding: 0.3rem 0.85rem;
		border-radius: 999px;
		background: var(--b-card);
		box-shadow: 0 0 0 1px var(--b-line);
	}
	/* pastel pills in the light theme; plain cards in the dark one (ink contrast stays ≥ 7:1) */
	@media (prefers-color-scheme: light), (prefers-color-scheme: no-preference) {
		.sage {
			background: #d5e8d8 !important;
			color: #214a32;
		}
		.sky {
			background: #d9e9f3 !important;
			color: #1f4560;
		}
		.butter {
			background: #f7e9b8 !important;
			color: #524008;
		}
		.lilac {
			background: #e6def3 !important;
			color: #44356a;
		}
		.peach {
			background: #f9e2d6 !important;
			color: #7a2e0f;
		}
		.stats li {
			box-shadow: none;
		}
	}
	.none {
		padding: 1.5rem 0;
		font-size: 1.1rem;
	}
	.day {
		margin: 2rem 0;
		padding: 1.25rem 1.25rem 0.5rem;
		border-radius: 24px;
		background: var(--b-card);
		box-shadow:
			0 0 0 1px var(--b-line),
			inset 0 6px 0 var(--c);
		scroll-margin-top: 4.5rem;
		/* off-screen days cost nothing to lay out or paint until they're scrolled near */
		content-visibility: auto;
		contain-intrinsic-size: auto 1800px;
	}
	/* a chapter heading: stamp · date, title, facts · the day's route */
	.chapter {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) 5.5rem;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}
	.stamp {
		display: grid;
		place-items: center;
		width: 3.1rem;
		height: 3.5rem;
		border: 3px dotted var(--c);
		border-radius: 7px;
		/* the day's colour as a tint with dark ink: the number stays at AAA contrast */
		background: color-mix(in srgb, var(--c) var(--b-tint), var(--b-card));
		color: var(--b-text);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.45rem;
		line-height: 1;
		transform: rotate(-4deg);
		box-shadow: 0 0 0 1px var(--b-line);
	}
	.stamp small {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.route {
		width: 5.5rem;
		height: 5.5rem;
		padding: 0.3rem;
		box-sizing: border-box;
		border-radius: 18px;
		background: color-mix(in srgb, var(--c) 10%, var(--b-bg));
	}
	.heading > * {
		margin: 0;
	}
	@media (max-width: 30rem) {
		.chapter {
			grid-template-columns: auto minmax(0, 1fr);
		}
		.route {
			display: none;
		}
	}
	.daynum {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--b-muted);
	}
	h2 {
		margin: 0.1rem 0 0.2rem;
		font-size: 1.6rem;
		line-height: 1.25;
	}
	h2 a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--b-text);
		text-decoration: none;
	}
	h2 a:hover {
		text-decoration: underline;
	}
	.meta {
		margin-bottom: 0.8rem;
		color: var(--b-muted);
	}
	.events {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.dayfoot a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 600;
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
