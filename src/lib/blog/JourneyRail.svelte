<!--
  The journey rail: every day of the tour, in order, beside the blog. On wide screens a sticky
  column (a day stamp, title, date and a little route sketch per day, on a thread that fills up to
  where you are); on narrower ones a sticky strip of day stamps under the header. The day you're
  reading is lit and kept in view: on the all-days page it follows your scrolling (the days are
  anchors on the page), elsewhere it's the page's day (the days are links).
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { TOUR } from '$lib/tourConfig';
	import { dayColor } from '$lib/colors';
	import type { RailDay } from '$lib/server/blog-data';
	import RouteSketch from '$lib/ui/RouteSketch.svelte';

	let { days }: { days: RailDay[] } = $props();

	const onIndex = $derived(page.url.pathname === `${base}/blog`);
	// on the all-days page: the day section nearest the top of the screen
	let scrolled = $state<string | null>(null);
	const current = $derived(onIndex ? scrolled : (page.params.day ?? null));
	const at = $derived(days.findIndex((d) => d.day === current));

	$effect(() => {
		if (!onIndex) return;
		const sections = [...document.querySelectorAll<HTMLElement>('section.day[data-day]')];
		if (!sections.length) return;
		const seen = new Map<Element, boolean>();
		const pick = () => {
			const on = sections.filter((s) => seen.get(s));
			scrolled = (on[0] ?? null)?.dataset.day ?? scrolled;
		};
		// a band across the upper part of the screen: the day crossing it is the one being read
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) seen.set(e.target, e.isIntersecting);
				pick();
			},
			{ rootMargin: '-20% 0px -60% 0px' }
		);
		for (const s of sections) io.observe(s);
		return () => io.disconnect();
	});

	// keep the lit day in view inside the rail (without scrolling the page)
	let list = $state<HTMLOListElement>();
	$effect(() => {
		if (at < 0 || !list) return;
		const item = list.children[at] as HTMLElement | undefined;
		if (!item) return;
		const wide = list.scrollHeight > list.clientHeight + 4;
		if (wide) list.scrollTo({ top: item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2, behavior: 'smooth' });
		else list.scrollTo({ left: item.offsetLeft - list.clientWidth / 2 + item.offsetWidth / 2, behavior: 'smooth' });
	});

	const date = (s: number) => new Date(s * 1000).toLocaleDateString(TOUR.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TOUR.timeZone });
	const href = (d: RailDay) => (onIndex ? `#day-${d.index + 1}` : `${base}/blog/${d.day}`);
</script>

<nav class="rail" aria-label="The journey, day by day" style:--p={at < 0 ? 0 : (at + 0.5) / days.length}>
	<p class="head display">The journey</p>
	<ol bind:this={list}>
		{#each days as d (d.day)}
			{@const c = dayColor(d.index, days.length)}
			<li class:on={d.day === current} class:past={at >= 0 && d.index < at} style:--c={c}>
				<a href={href(d)} aria-current={d.day === current ? (onIndex ? 'location' : 'page') : undefined}>
					<span class="stamp" aria-hidden="true">{d.index + 1}</span>
					<!-- the name for screen readers, kept even where the strip hides the titles -->
					<span class="sr">Day {d.index + 1}: {d.title}, {date(d.start)}</span>
					<span class="what" aria-hidden="true">
						<span class="t">{d.title}</span>
						<span class="d">{date(d.start)}</span>
					</span>
					<span class="mini"><RouteSketch s={d.sketch} color={c} width={6} /></span>
				</a>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.rail {
		position: sticky;
		top: 4.5rem;
		align-self: start;
		max-height: calc(100vh - 6rem);
		display: flex;
		flex-direction: column;
	}
	.head {
		margin: 0 0 0.6rem 0.4rem;
		font-size: 1.1rem;
	}
	ol {
		position: relative;
		list-style: none;
		margin: 0;
		padding: 0.2rem 0.4rem 0.4rem 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}
	/* the thread through the stamps, filled up to the day you're reading */
	ol::before,
	ol::after {
		content: '';
		position: absolute;
		left: 1.35rem;
		top: 1.2rem;
		width: 3px;
		border-radius: 2px;
	}
	ol::before {
		bottom: 1.2rem;
		background: var(--b-line);
	}
	ol::after {
		height: calc((100% - 2.4rem) * var(--p));
		background: #c2562d;
		transition: height 0.4s ease;
	}
	li a {
		position: relative;
		z-index: 1;
		display: grid;
		grid-auto-flow: dense;
		grid-template-columns: 2.7rem minmax(0, 1fr) 2.2rem;
		align-items: center;
		gap: 0.55rem;
		min-height: 2.75rem;
		padding: 0.3rem 0.4rem 0.3rem 0;
		border-radius: 14px;
		color: var(--b-text) !important;
		text-decoration: none;
	}
	li a:hover {
		background: color-mix(in srgb, var(--c) 14%, transparent);
	}
	li.on a {
		background: color-mix(in srgb, var(--c) 22%, var(--b-card));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent);
	}
	.stamp {
		justify-self: center;
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 9px;
		background: var(--b-card);
		box-shadow: 0 0 0 2px var(--c);
		color: var(--b-text);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.95rem;
		transform: rotate(-4deg);
	}
	/* days read so far filled with a tint of their colour (dark ink stays at AAA contrast) */
	li.past .stamp,
	li.on .stamp {
		background: color-mix(in srgb, var(--c) 45%, var(--b-card));
	}
	.what {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.25;
	}
	.t {
		font-size: 0.9rem;
		font-weight: 650;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.d {
		font-size: 0.78rem;
		color: var(--b-muted);
	}
	.mini {
		width: 2.2rem;
		height: 2.2rem;
		opacity: 0.85;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	/* narrower screens: a sticky strip of stamps under the header */
	@media (max-width: 68rem) {
		.rail {
			top: calc(4.2rem + env(safe-area-inset-top));
			z-index: 4;
			max-height: none;
			margin: 0 -1rem 1rem;
			padding: 0.4rem 0;
			background: transparent;
			pointer-events: none;
		}
		.head,
		.what,
		.mini {
			display: none;
		}
		ol {
			pointer-events: auto;
			display: flex;
			gap: 0.1rem;
			margin: 0 0.75rem;
			padding: 0.25rem 0.6rem;
			border-radius: 999px;
			background: rgb(255 253 248 / 0.92);
			backdrop-filter: blur(12px);
			box-shadow:
				0 3px 0 rgb(38 50 56 / 0.18),
				0 0 0 1px rgb(38 50 56 / 0.14);
			overflow-x: auto;
			overflow-y: hidden;
			scrollbar-width: none;
		}
		ol::-webkit-scrollbar {
			display: none;
		}
		ol::before,
		ol::after {
			top: calc(50% - 1.5px);
			left: 1.6rem;
			width: auto;
			height: 3px;
		}
		ol::before {
			right: 1.6rem;
			bottom: auto;
		}
		ol::after {
			height: 3px;
			width: calc((100% - 3.2rem) * var(--p));
			transition: width 0.4s ease;
		}
		li a {
			display: grid;
			place-items: center;
			grid-template-columns: 1fr;
			width: 2.75rem;
			padding: 0;
		}
		li.on a {
			box-shadow: none;
			background: none;
		}
		li.on .stamp {
			transform: rotate(-4deg) scale(1.18);
		}
	}
</style>
