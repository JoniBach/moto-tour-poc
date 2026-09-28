<!--
  Trip-level navigation: home (UK), previous/next day, and one chip per day of the tour.
  Days are pages (/day/<date>), so this is just links; the app animates the move.
-->
<script lang="ts">
	import type { App } from '$lib/app.svelte';
	import { dayColor } from '$lib/colors';

	let { app }: { app: App } = $props();

	const days = $derived(app.index?.days ?? []);
	const activeDay = $derived(app.tour?.data.track.day ?? null);
	const prev = $derived(activeDay ? app.neighbour(-1) : undefined);
	const next = $derived(activeDay ? app.neighbour(1) : days[0]);
	const date = (s: number) =>
		new Date(s * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
</script>

<nav class="trip" aria-label="Tour days">
	<a class="home" class:on={!activeDay} href="/" title="Whole tour">⌂ UK</a>
	<a class="step" class:disabled={!prev} href={prev ? `/day/${prev.day}` : undefined} aria-label="Previous day">◀</a>
	<div class="chips">
		{#each days as d (d.day)}
			<a
				class="chip"
				class:on={d.day === activeDay}
				style:--c={dayColor(d.index, days.length)}
				href="/day/{d.day}"
				title="{d.title} · {d.km.toFixed(0)} km"
			>
				<b>{d.index + 1}</b>
				<span>{date(d.start)}</span>
			</a>
		{/each}
	</div>
	<a class="step" class:disabled={!next} href={next ? `/day/${next.day}` : undefined} aria-label="Next day">▶</a>
	{#if app.busy}<span class="busy">flying…</span>{/if}
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
		overflow-x: auto;
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
