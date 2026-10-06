<!--
  The whole tour as a blog: every day a chapter (its stamp, date, title, facts and route sketch),
  every moment in order under it, stories as the big cards. The journey rail beside it (in the
  layout) follows along as you scroll.
-->
<script lang="ts">
	import { base } from '$app/paths';
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
	import Photo from '$lib/blog/Photo.svelte';
	import Meta from '$lib/blog/Meta.svelte';
	import Subscribe from '$lib/blog/Subscribe.svelte';

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

<Meta title="{SITE_NAME} · Blog" description="{TOUR.title}: {totals.days} days and {totals.distance} {distWord}, day by day." image={data.share} />

<header class="intro">
	<p class="pc-eyebrow">{TOUR.name} · {TOUR.when}</p>
	<h1>{TOUR.title}</h1>
	<p class="pc-lede lede">
		{totals.days} days {TOUR.summary}, told moment by moment.{#if tourOn}{' '}Every moment links to the same spot in the {TOUR_NAME}.{/if}
	</p>
	<ul class="pc-tags stats" aria-label="The tour in numbers">
		<li class="pc-tag pc-tag--sage"><strong>{totals.days}</strong> days</li>
		<li class="pc-tag pc-tag--sky"><strong>{totals.distance.toLocaleString(TOUR.locale)}</strong> {distWord}</li>
		{#if totals.parks}<li class="pc-tag pc-tag--butter"><strong>{totals.parks}</strong> {TOUR.protectedAreas.many}</li>{/if}
		{#if totals.photos}<li class="pc-tag pc-tag--lilac"><strong>{totals.photos}</strong> photos</li>{/if}
		{#if totals.stories}<li class="pc-tag pc-tag--peach"><strong>{totals.stories}</strong> {totals.stories === 1 ? 'story' : 'stories'}</li>{/if}
	</ul>
	{#if on('stories')}<Subscribe />{/if}
	{#if on('blogFilters')}<ViewControls days={dayOptions} {shown} {total} />{/if}
</header>

{#each visible as { d, rows } (d.day)}
	{@const c = dayColor(d.index, days.length)}
	<section class="day" id="day-{d.index + 1}" data-day={d.day} aria-labelledby="h-{d.day}" style:--pc-c={c}>
		<header class="chapter">
			<!-- the day as a postcard: a photo from it (or its colour), its stamp and its route -->
			<a class="banner" class:photo={!!d.cover} href="{base}/blog/{d.day}" tabindex="-1" aria-hidden="true">
				{#if d.cover}<Photo id={d.cover.id} size={[d.cover.w, d.cover.h]} alt="" sizes="(max-width: 46rem) 100vw, 46rem" />{/if}
				<span class="pc-stamp stamp"><small>Day</small>{d.index + 1}</span>
				<span class="route"><RouteSketch s={d.sketch} color={c} /></span>
			</a>
			<p class="daynum"><span class="pc-sr-only">Day {d.index + 1}, </span><time datetime={iso(d.start)}>{longDate(d.start)}</time></p>
			<h2 id="h-{d.day}"><a href="{base}/blog/{d.day}">{d.title}</a></h2>
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
		<p class="dayfoot"><a href="{base}/blog/{d.day}">Day {d.index + 1} on its own page<span aria-hidden="true"> →</span></a></p>
	</section>
{:else}
	<p class="none">No events match these settings. Use “Reset to show everything” above to see the whole tour again.</p>
{/each}

<style>
	.intro {
		margin: 0.5rem 0 2rem;
	}
	h1 {
		margin: 0 0 0.6rem;
		font-size: clamp(2rem, 5vw, 2.9rem);
	}
	.lede {
		margin-bottom: 1rem;
	}
	.stats {
		margin: 0 0 1.25rem;
	}
		.none {
		padding: 1.5rem 0;
		font-size: 1.1rem;
	}
	/* each day an open chapter: no box, plenty of room */
	.day {
		margin: 3.5rem 0 0;
		scroll-margin-top: 5rem;
		/* off-screen days cost nothing to lay out or paint until they're scrolled near */
		content-visibility: auto;
		contain-intrinsic-size: auto 1800px;
	}
	.chapter {
		margin-bottom: 1rem;
	}
	.chapter > p,
	.chapter > h2 {
		margin: 0;
	}
	/* the postcard banner */
	.banner {
		position: relative;
		display: block;
		height: clamp(9rem, 26vw, 15rem);
		margin-bottom: 1rem;
		border-radius: 26px;
		overflow: hidden;
		background: color-mix(in srgb, var(--pc-c) 28%, var(--pc-paper));
		box-shadow: var(--pc-shadow);
		transition: transform 0.2s ease;
	}
	.banner:hover {
		transform: translateY(-2px) rotate(-0.25deg);
	}
	.banner :global(img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.banner.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(160deg, transparent 45%, color-mix(in srgb, var(--pc-c) 45%, transparent));
	}
	.stamp {
		position: absolute;
		z-index: 1;
		top: 0.9rem;
		left: 0.9rem;
	}
	.route {
		position: absolute;
		z-index: 1;
		right: 0.9rem;
		bottom: 0.9rem;
		width: 6rem;
		height: 6rem;
		padding: 0.3rem;
		box-sizing: border-box;
		border-radius: 18px;
		background: var(--pc-glass);
	}
	.banner:not(.photo) .route {
		width: 8.5rem;
		height: 8.5rem;
		background: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.banner:hover {
			transform: none;
		}
	}
	.daynum {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--pc-muted);
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
		color: var(--pc-ink);
		text-decoration: none;
	}
	h2 a:hover {
		text-decoration: underline;
	}
	.meta {
		margin-bottom: 0.8rem;
		color: var(--pc-muted);
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
</style>
