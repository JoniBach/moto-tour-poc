<!--
  Town / village / hamlet / peak names from OSM as DOM labels. Smaller places only appear
  once the camera is close enough, so the overview doesn't turn into a word cloud.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { Vector3 } from 'three';
	import type { Osm, Place } from '$lib/data';

	let { osm, exaggeration }: { osm: Osm; exaggeration: number } = $props();
	const { camera } = useThrelte();

	// metres of camera distance within which each kind is shown
	const SHOW_WITHIN: Record<Place['kind'], number> = {
		town: Infinity,
		village: 16000,
		peak: 3000, // see showWithin: big fells are visible from further away
		hamlet: 9000,
		locality: 5000,
		water: 22000
	};

	const showWithin = (p: Place) =>
		p.kind === 'peak' ? ((p.ele ?? 0) >= 850 ? 18000 : (p.ele ?? 0) >= 600 ? 7000 : SHOW_WITHIN.peak) : SHOW_WITHIN[p.kind];

	let visible = $state.raw<Place[]>([]); // raw: replaced wholesale, compared by identity
	const cam = new Vector3();
	let since = 1;

	useTask((dt) => {
		// re-evaluate a few times a second, not every frame
		since += dt;
		if (since < 0.25) return;
		since = 0;
		camera.current.getWorldPosition(cam);
		const next = osm.places.filter(
			(p) => Math.hypot(p.x - cam.x, p.h * exaggeration - cam.y, -p.n - cam.z) < showWithin(p)
		);
		if (next.length !== visible.length || next.some((p, i) => p !== visible[i])) visible = next;
	});
</script>

{#each visible as p (p.name + p.x)}
	<T.Group position={[p.x, p.h * exaggeration, -p.n]}>
		<HTML center pointerEvents="none" zIndexRange={[40, 0]}>
			<span class="label {p.kind}">
				{#if p.kind === 'peak'}▲ {/if}{p.name}{#if p.kind === 'peak' && p.ele}<small> {p.ele} m</small>{/if}
			</span>
		</HTML>
	</T.Group>
{/each}

<style>
	.label {
		display: block;
		white-space: nowrap;
		font-size: 11px;
		letter-spacing: 0.06em;
		color: #cfefff;
		text-shadow:
			0 0 4px #03070c,
			0 0 8px #03070c;
		transform: translateY(-10px);
	}
	.town,
	.village {
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: #ffffff;
	}
	.hamlet {
		color: #a9dbe8;
	}
	.locality {
		font-style: italic;
		color: #7fb2c2;
		font-size: 10px;
	}
	.water {
		font-style: italic;
		font-size: 12px;
		letter-spacing: 0.12em;
		color: #7fb4ff;
	}
	.peak {
		color: #ffe3a3;
		font-size: 10px;
	}
	small {
		color: #b99a5b;
	}
</style>
