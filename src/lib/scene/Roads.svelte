<!--
  OpenStreetMap road network draped on the DEM, one fat-line batch per road tier.
  Styled to sit under the ride: major roads bright, lanes and tracks faint.
-->
<script lang="ts">
	import { T } from '@threlte/core';
	import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
	import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import type { Osm } from '$lib/data';

	let { osm }: { osm: Osm } = $props();

	const LIFT = 0.8; // metres; just under the ride line's lift
	// motorway/trunk/primary, secondary/tertiary, minor, service, track
	const STYLES = [
		{ color: '#fff1c9', width: 2.8, opacity: 0.95 },
		{ color: '#d9fbff', width: 2.1, opacity: 0.85 },
		{ color: '#7fd8ea', width: 1.4, opacity: 0.6 },
		{ color: '#4a98aa', width: 1, opacity: 0.4 },
		{ color: '#6f8f7a', width: 1, opacity: 0.35 }
	];

	// svelte-ignore state_referenced_locally — `osm` is fixed for the component's lifetime
	const batches = STYLES.map((style, tier) => {
		const seg: number[] = [];
		for (const road of osm.roads) {
			if (road.tier !== tier) continue;
			const p = road.pts;
			for (let k = 3; k < p.length; k += 3)
				seg.push(p[k - 3], p[k - 1] + LIFT, -p[k - 2], p[k], p[k + 2] + LIFT, -p[k + 1]);
		}
		const geometry = new LineSegmentsGeometry();
		geometry.setPositions(seg);
		const material = new LineMaterial({
			color: style.color,
			linewidth: style.width,
			transparent: true,
			opacity: style.opacity,
			depthWrite: false
		});
		const lines = new LineSegments2(geometry, material);
		lines.frustumCulled = false;
		// after the additive point cloud, before the ride line
		lines.renderOrder = 8 - tier * 0.1;
		return lines;
	});

	$effect(() => () => {
		for (const b of batches) {
			b.geometry.dispose();
			b.material.dispose();
		}
	});
</script>

{#each batches as lines, i (i)}
	<T is={lines} />
{/each}
