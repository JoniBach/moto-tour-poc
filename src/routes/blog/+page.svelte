<!-- The whole tour as a blog: every day and every one of its events, in order. -->
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
	<h1>{TOUR.title}</h1>
	<p class="lede">
		{totals.days} days, {totals.distance.toLocaleString(TOUR.locale)} {distWord}{#if totals.parks}{' '}and {totals.parks} {TOUR.protectedAreas.many}{/if}{#if totals.photos},
			{totals.photos} photos{/if}{#if totals.stories}{' '}and {totals.stories} stories{/if}, {TOUR.summary}.{#if tourOn}{' '}Every moment below links to the same spot in the {TOUR_NAME}.{/if}
	</p>
	<nav aria-label="Jump to a day" class="jump">
		<ul>
			{#each visible as { d } (d.day)}
				<li>
					<a href="#day-{d.index + 1}" style:--c={dayColor(d.index, days.length)}>
						<span class="sr">Day </span>{d.index + 1}<span class="sr">: {d.title}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
	{#if on('blogFilters')}<ViewControls days={dayOptions} {shown} {total} />{/if}
</header>

{#each visible as { d, rows } (d.day)}
	<section class="day" id="day-{d.index + 1}" aria-labelledby="h-{d.day}" style:--c={dayColor(d.index, days.length)}>
		<header>
			<p class="daynum">Day {d.index + 1} · <time datetime={iso(d.start)}>{longDate(d.start)}</time></p>
			<h2 id="h-{d.day}"><a href="/blog/{d.day}">{d.title}</a></h2>
			<p class="meta">
				{distRound(d.km)} {distWord}{#if d.weather}{' · '}{tempRound(d.weather.minTemp)} to {tempRound(d.weather.maxTemp)} {tempUnit}{/if}{#if d.parks.length}{' · '}{d.parks.join(', ')}{/if}
			</p>
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
		margin-bottom: 2rem;
	}
	h1 {
		margin: 0 0 0.5rem;
		font-size: clamp(1.7rem, 4vw, 2.3rem);
		line-height: 1.2;
	}
	.lede {
		font-size: 1.1rem;
		color: var(--b-muted);
	}
	.jump ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.jump a {
		display: grid;
		place-items: center;
		min-width: 2.75rem;
		height: 2.75rem;
		border-radius: 999px;
		background: var(--b-card);
		box-shadow:
			0 0 0 1px var(--b-line),
			inset 0 -4px 0 var(--c);
		font-weight: 700;
		text-decoration: none;
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
	.daynum {
		margin: 0;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--b-muted);
	}
	h2 {
		margin: 0.2rem 0 0.3rem;
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
