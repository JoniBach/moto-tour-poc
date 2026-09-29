<!--
  Trip-level navigation: home (UK), previous/next day, and one chip per day of the tour.
  Days are pages (/day/<date>), so this is just links; the app animates the move.
-->
<script lang="ts">
	import type { App } from '$lib/app.svelte';
	import { dayColor } from '$lib/colors';

	let { app }: { app: App } = $props();

	const days = $derived(app.index?.days ?? []);
	// the day on screen, or the one we're flying to while the scene is empty
	const activeDay = $derived(app.currentDay);
	const prev = $derived(activeDay ? app.neighbour(-1) : undefined);
	const next = $derived(activeDay ? app.neighbour(1) : days[0]);
	// keep the active day's chip in view as the tour moves on
	let chips = $state<HTMLDivElement>();
	$effect(() => {
		if (!activeDay) return;
		chips
			?.querySelector<HTMLElement>(`[data-day="${activeDay}"]`)
			?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
	});
	// a vertical wheel over the strip scrolls it sideways
	function onwheel(e: WheelEvent) {
		if (!chips || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
		chips.scrollLeft += e.deltaY;
		e.preventDefault();
	}

	const date = (s: number) =>
		new Date(s * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
</script>

<nav class="trip" aria-label="Tour days">
	<a class="home" class:on={!activeDay} href="/" title="Whole tour">⌂ UK</a>
	<a class="step" class:disabled={!prev} href={prev ? `/day/${prev.day}` : undefined} aria-label="Previous day">◀</a>
	<div class="chips scroll-x" bind:this={chips} {onwheel}>
		{#each days as d (d.day)}
			<a
				class="chip"
				class:on={d.day === activeDay}
				style:--c={dayColor(d.index, days.length)}
				href="/day/{d.day}"
				data-day={d.day}
				title="{d.title} · {d.km.toFixed(0)} km"
			>
				<b>{d.index + 1}</b>
				<span>{date(d.start)}</span>
			</a>
		{/each}
	</div>
	<a class="step" class:disabled={!next} href={next ? `/day/${next.day}` : undefined} aria-label="Next day">▶</a>
	{#if app.pending}
		<span class="busy">Loading Day {app.pending.index + 1}…</span>
	{:else if app.busy}
		<span class="busy">flying…</span>
	{/if}
</nav>

<style>
	.trip {
		position: absolute;
		z-index: 110;
		top: 16px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 6px;
		max-width: calc(100% - 600px);
		padding: 6px 8px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--glass);
		backdrop-filter: blur(10px);
		font-size: 12px;
	}
	a {
		color: var(--text);
		text-decoration: none;
	}
	.home,
	.step {
		padding: 5px 8px;
		border-radius: 8px;
		color: var(--muted);
	}
	.home.on,
	.home:hover,
	.step:hover {
		color: var(--text);
		background: var(--accent-soft);
	}
	.step.disabled {
		opacity: 0.3;
		pointer-events: none;
	}
	.chips {
		display: flex;
		gap: 4px;
		/* fade the ends so it's obvious the strip scrolls */
		mask-image: linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent);
		padding-inline: 10px;
		margin-bottom: -6px; /* the scroll-x bar room sits under the chips, not in the bar's height */
	}
	.chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 44px;
		padding: 3px 6px;
		border-radius: 8px;
		border: 1px solid transparent;
		border-bottom: 2px solid var(--c);
	}
	.chip b {
		font-size: 12px;
	}
	.chip span {
		font-size: 9px;
		color: var(--muted);
		white-space: nowrap;
	}
	.chip.on {
		border-color: var(--c);
		background: color-mix(in srgb, var(--c) 18%, transparent);
	}
	.chip:hover {
		background: var(--accent-soft);
	}
	.busy {
		color: var(--accent);
		font-size: 11px;
		padding: 0 4px;
	}
	@media (max-width: 1100px) {
		.trip {
			top: auto;
			bottom: 196px;
			max-width: calc(100% - 32px);
		}
	}
</style>
