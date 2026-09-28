<!--
  The whole-tour card shown on the UK overview: totals and a list of days to dive into.
-->
<script lang="ts">
	import type { App } from '$lib/app.svelte';
	import { dayColor } from '$lib/colors';

	let { app }: { app: App } = $props();
	const days = $derived(app.index?.days ?? []);
	const km = $derived(days.reduce((a, d) => a + d.km, 0));
	const date = (s: number) =>
		new Date(s * 1000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
</script>

<aside class="intro">
	<h1>UK tour · September 2026</h1>
	<p class="totals">{days.length} days · {(km / 1.609).toFixed(0)} mi</p>
	<ol>
		{#each days as d (d.day)}
			<li style:--c={dayColor(d.index, days.length)}>
				<a href="/day/{d.day}">
					<b>Day {d.index + 1}</b>
					<span class="title">{d.title}</span>
					<span class="meta">
						{date(d.start)} · {(d.km / 1.609).toFixed(0)} mi{#if d.weather}
							· {d.weather.minTemp.toFixed(0)}–{d.weather.maxTemp.toFixed(0)}°C{/if}
					</span>
				</a>
			</li>
		{/each}
	</ol>
	<p class="hint">Pick a day, or click a marker on the map.</p>
</aside>

<style>
	.intro {
		position: absolute;
		z-index: 100;
		top: 16px;
		left: 16px;
		width: 280px;
		max-height: calc(100% - 32px);
		overflow: auto;
		padding: 14px 16px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--glass);
		backdrop-filter: blur(10px);
		color: var(--text);
	}
	h1 {
		margin: 0;
		font-size: 18px;
		color: var(--accent);
	}
	.totals {
		margin: 2px 0 12px;
		color: var(--muted);
		font-size: 12px;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	a {
		display: grid;
		padding: 8px 10px;
		border-radius: 10px;
		border-left: 3px solid var(--c);
		background: rgba(255, 255, 255, 0.03);
		color: inherit;
		text-decoration: none;
	}
	a:hover {
		background: var(--accent-soft);
	}
	b {
		color: var(--c);
		font-size: 12px;
	}
	.title {
		font-size: 14px;
	}
	.meta,
	.hint {
		font-size: 11px;
		color: var(--muted);
	}
	.hint {
		margin: 12px 0 0;
	}
</style>
