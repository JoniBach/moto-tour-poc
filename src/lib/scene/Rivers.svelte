<!--
  OSM rivers and canals draped on the DEM as thin blue lines.
-->
<script lang="ts">
	import { T } from '@threlte/core';
	import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
	import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import type { Osm } from '$lib/data';

	let { osm }: { osm: Osm } = $props();

	const LIFT = 0.5;
	const seg: number[] = [];
	// svelte-ignore state_referenced_locally — `osm` is fixed for the component's lifetime
	for (const river of osm.rivers ?? []) {
		const p = river.pts;
		for (let k = 3; k < p.length; k += 3)
			seg.push(p[k - 3], p[k - 1] + LIFT, -p[k - 2], p[k], p[k + 2] + LIFT, -p[k + 1]);
	}
	const geometry = new LineSegmentsGeometry();
	geometry.setPositions(seg);
	const material = new LineMaterial({
		color: '#3d8bff',
		linewidth: 1.6,
		transparent: true,
		opacity: 0.85,
		depthWrite: false
	});
	const lines = new LineSegments2(geometry, material);
	lines.frustumCulled = false;
	lines.renderOrder = 7.5; // under the roads

	$effect(() => () => {
		geometry.dispose();
		material.dispose();
	});
</script>

<T is={lines} />
