<!-- The whole tour as a blog: every day and every one of its events, in order. -->
<script lang="ts">
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
	<title>UK Tour · September 2026 · Blog</title>
	<meta
		name="description"
		content="A motorcycle tour of Britain's national parks: {totals.days} days and {totals.miles} miles, day by day, with photos and stories."
	/>
</svelte:head>

<header class="intro">
	<h1>A motorcycle tour of Britain's national parks</h1>
	<p class="lede">
		{totals.days} days, {totals.miles.toLocaleString('en-GB')} miles, {totals.parks} national parks, {totals.photos} photos
		and {totals.stories} stories, from Pembrokeshire to the Cairngorms and back. Every moment below links to the same
		spot in the 3D tour.
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
	<ViewControls days={dayOptions} {shown} {total} />
</header>

{#each visible as { d, rows } (d.day)}
	<section class="day" id="day-{d.index + 1}" aria-labelledby="h-{d.day}" style:--c={dayColor(d.index, days.length)}>
		<header>
			<p class="daynum">Day {d.index + 1} · <time datetime={iso(d.start)}>{longDate(d.start)}</time></p>
			<h2 id="h-{d.day}"><a href="/blog/{d.day}">{d.title}</a></h2>
			<p class="meta">
				{Math.round(d.km / 1.609)} miles{#if d.weather}{' · '}{d.weather.minTemp.toFixed(0)} to {d.weather.maxTemp.toFixed(0)} °C{/if}{#if d.parks.length}{' · '}{d.parks.join(', ')}{/if}
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
		border-radius: 8px;
		border: 1px solid var(--b-line);
		border-bottom: 3px solid var(--c);
		background: var(--b-card);
		font-weight: 600;
		text-decoration: none;
	}
	.none {
		padding: 1.5rem 0;
		font-size: 1.1rem;
	}
	.day {
		margin: 2.5rem 0;
		padding-top: 1rem;
		border-top: 4px solid var(--c);
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
