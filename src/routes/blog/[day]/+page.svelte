<!-- One day of the tour as a blog page: its details, then every event with larger photos. -->
<script lang="ts">
	import { base } from '$app/paths';
	import { A } from '$lib/activity';
	import { TOUR } from '$lib/tourConfig';
	import { distRound, distWord, tempRound, tempUnit } from '$lib/units';
	import { on } from '$lib/flags';
	import { iso, longDate } from '$lib/blog';
	import EventGroup from '$lib/blog/EventGroup.svelte';
	import EventItem from '$lib/blog/EventItem.svelte';
	import Meta from '$lib/blog/Meta.svelte';
	import { arrange, shows, view } from '$lib/blog/view.svelte';
	import ViewControls from '$lib/blog/ViewControls.svelte';
	import { dayColor } from '$lib/colors';
	import RouteSketch from '$lib/ui/RouteSketch.svelte';
	import Photo from '$lib/blog/Photo.svelte';

	let { data } = $props();
	const { day: d, dayCount, prev, next } = $derived(data);
	const rows = $derived(arrange(d.events, view.group));
	const shown = $derived(d.events.filter(shows).length);
</script>

<Meta
	title="Day {d.index + 1}: {d.title} · {TOUR.name} blog"
	description="Day {d.index + 1} of {TOUR.title.replace(/^A /, 'a ')}: {d.title}, {distRound(d.km)} {distWord}."
	image={data.share}
/>

<article style:--pc-c={dayColor(d.index, dayCount)}>
	<nav aria-label="Breadcrumb" class="crumb">
		<ol>
			<li><a href="{base}/blog">All days</a></li>
			<li aria-current="page">Day {d.index + 1}</li>
		</ol>
	</nav>
	<header>
		<!-- the day as a postcard: a photo from it (or its colour), its stamp and its route -->
		<div class="banner" class:photo={!!d.cover}>
			{#if d.cover}<Photo id={d.cover.id} size={[d.cover.w, d.cover.h]} alt="" sizes="(max-width: 46rem) 100vw, 46rem" priority />{/if}
			<span class="pc-stamp stamp" aria-hidden="true"><small>Day</small>{d.index + 1}</span>
			<span class="route"><RouteSketch s={d.sketch} color={dayColor(d.index, dayCount)} label="The day's route, from the hollow start dot to the solid finish" /></span>
		</div>
		<p class="daynum">Day {d.index + 1} of {dayCount} · <time datetime={iso(d.start)}>{longDate(d.start)}</time></p>
		<h1>{d.title}</h1>
		<ul class="facts">
			<li><strong>{distRound(d.km)}</strong> {distWord}{#if d.rides > 1} over {d.rides} {A.legs}{/if}</li>
			{#if d.weather}<li>
					<strong>{tempRound(d.weather.minTemp)} to {tempRound(d.weather.maxTemp)} {tempUnit}</strong>{#if d.weather.wettestHourMm > 0.2}, some rain{/if}
				</li>{/if}
			{#if d.photos}<li><strong>{d.photos}</strong> photos</li>{/if}
			{#if d.parks.length}<li>{d.parks.join(', ')}</li>{/if}
		</ul>
		<p class="go">
			{#if on('dx3d')}<a class="dx" href="{base}/day/{d.day}?view=3d">{A.go} this day in the 3D tour<span aria-hidden="true"> ↗</span></a>{/if}
			{#if on('map')}<a class="dx alt" href="{base}/day/{d.day}?view=2d">See it on a map<span aria-hidden="true"> ↗</span></a>{/if}
			{#if on('globe')}<a class="dx alt" href="{base}/day/{d.day}?view=globe">Watch it as a globe<span aria-hidden="true"> ↗</span></a>{/if}
		</p>
		{#if on('blogFilters')}<ViewControls {shown} total={d.events.length} />{/if}
	</header>

	<h2 class="pc-sr-only">The day, moment by moment</h2>
	<ol class="events">
		{#each rows as r (r.key)}
			{#if r.kind === 'group'}
				<EventGroup events={r.events} title={r.title} icon={r.icon} day={d.day} large />
			{:else}
				<EventItem e={r.e} day={d.day} large />
			{/if}
		{/each}
	</ol>
	{#if !rows.length}
		<p class="none">No events on this day match these settings.</p>
	{/if}

	<nav class="pager" aria-label="Other days">
		{#if prev}<a rel="prev" href="{base}/blog/{prev.day}"><span aria-hidden="true">← </span>Day {prev.index + 1}: {prev.title}</a>{:else}<span></span>{/if}
		{#if next}<a rel="next" href="{base}/blog/{next.day}">Day {next.index + 1}: {next.title}<span aria-hidden="true"> →</span></a>{/if}
	</nav>
</article>

<style>
	.crumb ol {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		margin: 0 0 0.5rem;
		padding: 0;
		font-size: 0.95rem;
		color: var(--pc-muted);
	}
	.crumb li + li::before {
		content: '/';
		margin: 0 0.5rem;
	}
	.crumb a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		min-width: 2.75rem;
	}
	.crumb li {
		display: flex;
		align-items: center;
	}
	.daynum {
		margin: 0;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pc-muted);
		border-left: 6px solid var(--pc-c);
		border-radius: 3px;
		padding-left: 0.6rem;
		font-weight: 700;
	}
	h1 {
		margin: 0.3rem 0 0.6rem;
		font-size: clamp(1.9rem, 4.5vw, 2.6rem);
	}
	/* the postcard banner */
	.banner {
		position: relative;
		height: clamp(11rem, 32vw, 19rem);
		margin: 0.25rem 0 1.25rem;
		border-radius: 28px;
		overflow: hidden;
		background: color-mix(in srgb, var(--pc-c) 28%, var(--pc-paper));
		box-shadow: var(--pc-shadow);
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
		right: 1rem;
		bottom: 1rem;
		width: 8rem;
		height: 8rem;
		padding: 0.35rem;
		box-sizing: border-box;
		border-radius: 22px;
		background: var(--pc-glass);
	}
	.banner:not(.photo) .route {
		width: 11rem;
		height: 11rem;
		background: none;
	}
	@media (max-width: 30rem) {
		.route {
			width: 5.5rem;
			height: 5.5rem;
			border-radius: 16px;
		}
	}
	.facts {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		color: var(--pc-muted);
	}
	.facts li {
		padding: 0.2rem 0.8rem;
		border-radius: 999px;
		background: var(--pc-card);
		box-shadow: 0 0 0 1px var(--pc-line);
	}
	.facts strong {
		color: var(--pc-ink);
	}
	.none {
		font-size: 1.1rem;
	}
	.go {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.dx.alt {
		background: var(--pc-card);
		color: var(--pc-accent-ink) !important;
		box-shadow: 0 0 0 1px var(--pc-accent-ink);
	}
	.dx {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 1.2rem;
		border-radius: 999px;
		background: var(--pc-accent-ink);
		color: var(--pc-paper) !important;
		font-weight: 650;
		text-decoration: none;
	}
	.events {
		list-style: none;
		margin: 1.5rem 0 0;
		padding: 0;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 2.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--pc-line);
		font-weight: 600;
	}
	.pager a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}
	.pager a[rel='next'] {
		text-align: right;
	}
</style>
