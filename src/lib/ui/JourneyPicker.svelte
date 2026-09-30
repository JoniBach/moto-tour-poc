<!--
  The front door of the tour (no day chosen): a welcome card with what the tour was and a way in,
  and every day as a postcard on a rail along the bottom, the globe (or map) between them.
  The rail scrolls sideways (wheel, drag, swipe, the arrow buttons or the keyboard) and snaps to
  cards; each card opens its day.
-->
<script lang="ts">
	import { A } from '$lib/activity';
	import { on } from '$lib/flags';
	import { TOUR } from '$lib/tourConfig';
	import { distRound, distWord } from '$lib/units';
	import type { App } from '$lib/app.svelte';
	import type { Photo } from '$lib/data';
	import DayPostcard from './DayPostcard.svelte';

	let { app }: { app: App } = $props();

	const days = $derived(app.index?.days ?? []);
	const km = $derived(days.reduce((a, d) => a + d.km, 0));
	const parksVisited = $derived(app.parks?.parks.filter((p) => p.visited).length ?? 0);
	const photosByDay = $derived.by(() => {
		const m = new Map<string, Photo[]>();
		for (const p of app.photos) if (p.day) m.set(p.day, [...(m.get(p.day) ?? []), p]);
		return m;
	});
	// a postcard's picture: the middle of the day's photos, usually out on the road
	const cover = (day: string) => {
		const ps = photosByDay.get(day);
		return ps?.length ? ps[Math.floor(ps.length / 2)] : undefined;
	};

	let rail = $state<HTMLOListElement>();
	let atStart = $state(true);
	let atEnd = $state(false);
	const onscroll = () => {
		if (!rail) return;
		atStart = rail.scrollLeft < 8;
		atEnd = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 8;
	};
	$effect(() => {
		if (days.length) queueMicrotask(onscroll);
	});
	const page = (dir: 1 | -1) => rail?.scrollBy({ left: dir * rail.clientWidth * 0.8, behavior: 'smooth' });
	// a vertical wheel over the rail scrolls it sideways
	function onwheel(e: WheelEvent) {
		if (!rail || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
		rail.scrollLeft += e.deltaY;
		e.preventDefault();
	}
</script>

<section class="hero" aria-labelledby="tour-title">
	<p class="eyebrow">{TOUR.name} · {TOUR.when}</p>
	<h1 id="tour-title" class="display">{TOUR.title}</h1>
	<p class="summary">{days.length} days {TOUR.summary}.</p>
	<ul class="stats" aria-label="The tour in numbers">
		<li class="sage"><b>{days.length}</b> days</li>
		<li class="sky"><b>{distRound(km).toLocaleString(TOUR.locale)}</b> {distWord}</li>
		{#if parksVisited}<li class="butter"><b>{parksVisited}</b> {TOUR.protectedAreas.many}</li>{/if}
		{#if app.photos.length}<li class="lilac"><b>{app.photos.length}</b> photos</li>{/if}
	</ul>
	<div class="actions">
		{#if days[0]}<a class="go" href="/day/{days[0].day}">{A.go} from day 1 <span aria-hidden="true">→</span></a>{/if}
		{#if on('blog')}<a class="read" href="/blog">Read the blog</a>{/if}
	</div>
</section>

<section class="rail-wrap" aria-labelledby="rail-title">
	<header>
		<h2 id="rail-title" class="display">Pick a day</h2>
		<div class="arrows">
			<button type="button" onclick={() => page(-1)} disabled={atStart} aria-label="Earlier days">‹</button>
			<button type="button" onclick={() => page(1)} disabled={atEnd} aria-label="Later days">›</button>
		</div>
	</header>
	<ol class="rail scroll-x" bind:this={rail} {onscroll} {onwheel}>
		{#each days as d (d.day)}
			<li>
				<DayPostcard {d} total={days.length} photo={cover(d.day)} photos={photosByDay.get(d.day)?.length ?? 0} href="/day/{d.day}" />
			</li>
		{/each}
	</ol>
</section>

<style>
	.hero {
		position: absolute;
		z-index: 100;
		top: 88px;
		left: 24px;
		width: min(380px, calc(100% - 48px));
		box-sizing: border-box;
		padding: 22px 24px 24px;
		border-radius: 28px;
		background: var(--glass);
		backdrop-filter: blur(12px);
		box-shadow: var(--shadow);
		color: var(--text);
	}
	.eyebrow {
		margin: 0 0 6px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent-ink);
	}
	h1 {
		margin: 0;
		font-size: 30px;
		line-height: 1.08;
	}
	.summary {
		margin: 10px 0 14px;
		font-size: 15px;
		line-height: 1.45;
		color: var(--muted);
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0 0 18px;
		padding: 0;
		list-style: none;
		font-size: 13px;
	}
	.stats li {
		padding: 5px 11px;
		border-radius: 999px;
	}
	.stats b {
		font-weight: 800;
	}
	.sage {
		background: var(--sage);
		color: var(--sage-ink);
	}
	.sky {
		background: var(--sky);
		color: var(--sky-ink);
	}
	.butter {
		background: var(--butter);
		color: var(--butter-ink);
	}
	.lilac {
		background: var(--lilac);
		color: var(--lilac-ink);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.go,
	.read {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 46px;
		padding: 0 20px;
		border-radius: 999px;
		font-weight: 700;
		font-size: 15px;
		text-decoration: none;
		transition: transform 0.12s ease;
	}
	.go {
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--accent) 55%, #000);
	}
	.read {
		color: var(--text);
		background: var(--card);
		box-shadow:
			var(--press),
			0 0 0 1px var(--line);
	}
	.go:hover,
	.read:hover {
		transform: translateY(-1px);
	}
	.go:active,
	.read:active {
		transform: translateY(2px);
		box-shadow: none;
	}

	.rail-wrap {
		position: absolute;
		z-index: 100;
		left: 0;
		right: 0;
		bottom: 18px;
		color: var(--text);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px 8px;
	}
	h2 {
		margin: 0;
		padding: 4px 14px;
		border-radius: 999px;
		background: var(--glass);
		backdrop-filter: blur(8px);
		font-size: 18px;
	}
	.arrows {
		display: flex;
		gap: 8px;
	}
	.arrows button {
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: 50%;
		background: var(--card);
		color: var(--text);
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
		box-shadow:
			var(--press),
			0 0 0 1px var(--line);
	}
	.arrows button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.rail {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 230px;
		gap: 14px;
		margin: 0;
		padding: 6px 24px 14px;
		list-style: none;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: 24px;
	}
	.rail li {
		scroll-snap-align: start;
	}
	@media (max-width: 900px) {
		.hero {
			top: calc(env(safe-area-inset-top) + 64px);
			left: 12px;
			width: calc(100% - 24px);
			padding: 16px 18px;
			border-radius: 22px;
		}
		h1 {
			font-size: 22px;
		}
		.summary {
			display: none;
		}
		.stats {
			margin: 10px 0 12px;
		}
		.go,
		.read {
			min-height: 42px;
			padding: 0 16px;
			font-size: 14px;
		}
		.rail-wrap {
			bottom: calc(env(safe-area-inset-bottom) + 64px);
		}
		header {
			padding: 0 12px 6px;
		}
		.arrows {
			display: none;
		}
		.rail {
			grid-auto-columns: 200px;
			padding-inline: 12px;
			scroll-padding-inline: 12px;
		}
	}
</style>
