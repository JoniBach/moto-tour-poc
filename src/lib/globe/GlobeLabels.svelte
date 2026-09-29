<!--
  Names on the globe from OSM: peaks (with their height), lakes, towns, villages and hamlets.
  Like the pins they fade in as they come over the rim and away as they leave. Only places within
  the landscape's reach are made at all, refreshed each time it re-samples.
  Lives in the group that moves the landscape under the bike (day-local metres, exaggerated y).
-->
<script lang="ts">
	import { useTask } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import type { Place } from '$lib/data';
	import type { Tour } from '$lib/tour.svelte';
	import type { GlobeState } from './state';

	let { tour, globe, radius, places }: { tour: Tour; globe: GlobeState; radius: number; places: Place[] } = $props();

	// small localities only on small globes, where there's room for them
	// svelte-ignore state_referenced_locally — a new radius remounts this component
	const kinds = new Set<Place['kind']>(['town', 'village', 'hamlet', 'peak', 'water', ...(radius <= 2500 ? (['locality'] as const) : [])]);

	type Label = { key: string; p: Place; h: number; rank: number };
	/** at most this many names at once: a big globe would otherwise be a word cloud */
	const MAX = 14;
	// most important first: towns, lakes, villages, peaks by height, then the small places
	const rank = (p: Place) =>
		({ town: 5000, water: 4000, village: 3000, peak: 1000 + (p.ele ?? 0), hamlet: 500, locality: 0 })[p.kind];
	let near = $state.raw<Label[]>([]);
	let inside = $state<Record<string, boolean>>({});
	let built = -1;

	useTask(() => {
		if (globe.version !== built && Number.isFinite(globe.patch.x)) {
			built = globe.version;
			const { x, n, reach } = globe.patch;
			near = places
				.filter((p) => kinds.has(p.kind) && Math.hypot(p.x - x, p.n - n) < reach)
				.map((p) => ({ key: `${p.kind}${p.name}${Math.round(p.x)}`, p, h: globe.ground(p.x, p.n), rank: rank(p) }))
				.sort((a, b) => b.rank - a.rank);
		}
		const b = tour.bike;
		const lim = radius * 0.92;
		let changed = false;
		let shown = 0;
		const next: Record<string, boolean> = {};
		// `near` is in rank order: the first MAX inside the rim win
		for (const l of near) {
			const v = shown < MAX && Math.hypot(l.p.x - b.x, l.p.n - b.n) < lim;
			if (v) shown++;
			next[l.key] = v;
			if (v !== !!inside[l.key]) changed = true;
		}
		if (changed || Object.keys(next).length !== Object.keys(inside).length) inside = next;
	});

	const lift = $derived(radius * 0.012);
</script>

{#each near as l (l.key)}
	<HTML position={[l.p.x, l.h * tour.exaggeration + lift, -l.p.n]} center pointerEvents="none" zIndexRange={[30, 0]}>
		<span class="gl {l.p.kind}" class:in={!!inside[l.key]} aria-hidden="true">
			{#if l.p.kind === 'peak'}<span class="tri">▲</span>{/if}{l.p.name}{#if l.p.kind === 'peak' && l.p.ele}<small>{' '}{l.p.ele} m</small>{/if}
		</span>
	</HTML>
{/each}

<style>
	.gl {
		display: block;
		white-space: nowrap;
		font: 500 11px/1.2 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
		letter-spacing: 0.04em;
		color: #3a3128;
		text-shadow:
			0 0 3px #fffaf2,
			0 0 6px #fffaf2,
			0 0 10px rgb(255 250 242 / 0.8);
		opacity: 0;
		transform: translateY(-4px);
		transition:
			opacity 0.5s ease,
			transform 0.5s ease;
	}
	.gl.in {
		opacity: 1;
		transform: translateY(-10px);
	}
	.town,
	.village {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.hamlet {
		font-size: 11px;
	}
	.locality {
		font-size: 10px;
		font-style: italic;
		color: #5c5247;
	}
	.water {
		font-size: 12px;
		font-style: italic;
		letter-spacing: 0.12em;
		color: #245a80;
	}
	.peak {
		font-size: 11px;
		font-weight: 600;
		color: #5a3f22;
	}
	.tri {
		margin-right: 3px;
		font-size: 9px;
	}
	small {
		font-weight: 400;
		color: #7a6147;
	}
	@media (prefers-reduced-motion: reduce) {
		.gl {
			transition: opacity 0.2s;
			transform: none;
		}
	}
</style>
