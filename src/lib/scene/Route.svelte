<!--
  The ride, draped on the DEM. A dim "ghost" of the whole route plus a bright line that is
  revealed up to the bike via instanceCount; drawn as segments so separate rides stay apart. Colour encodes speed / lean / gradient.
  Optional thin line at raw GPS altitude shows why we drape instead of trusting <ele>.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial } from 'three';
	import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
	import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import { colorScale } from '$lib/colors';
	import type { ColorBy, Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();
	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const tr = tour.data.track;
	const LIFT = 1.5; // metres above ground so the line doesn't z-fight the terrain

	// Segments rather than one polyline, so separate rides on the same day aren't joined up.
	// segStart[k] = fix index where segment k starts; segsBefore[i] = segments ending at or before fix i
	const breaks = new Set(tr.breaks ?? []);
	const segStart: number[] = [];
	const segsBefore = new Uint32Array(tr.count);
	for (let i = 1; i < tr.count; i++) {
		if (!breaks.has(i)) segStart.push(i - 1);
		segsBefore[i] = segStart.length;
	}
	const positions: number[] = [];
	const vert = (i: number) => positions.push(tr.x[i], tr.ground[i] + LIFT, -tr.n[i]);
	for (const i of segStart) vert(i), vert(i + 1);

	function colors(by: ColorBy) {
		const scale = colorScale(tr, by);
		const perFix: number[] = [];
		const c = new Color();
		for (let i = 0; i < tr.count; i++) {
			c.setStyle(scale(i)); // d3 gives sRGB; Color converts to the linear working space
			perFix.push(c.r, c.g, c.b);
		}
		const out: number[] = [];
		for (const i of segStart) out.push(...perFix.slice(i * 3, i * 3 + 6));
		return out;
	}

	const ghostGeo = new LineSegmentsGeometry();
	ghostGeo.setPositions(positions);
	const liveGeo = new LineSegmentsGeometry();
	liveGeo.setPositions(positions);

	const ghostMat = new LineMaterial({ vertexColors: true, linewidth: 2, transparent: true, opacity: 0.22, depthWrite: false });
	const liveMat = new LineMaterial({ vertexColors: true, linewidth: 4.5, transparent: true });
	const ghost = new LineSegments2(ghostGeo, ghostMat);
	const live = new LineSegments2(liveGeo, liveMat);
	ghost.frustumCulled = live.frustumCulled = false;
	// transparent + high renderOrder: draw after the additive point cloud so it isn't washed out
	ghost.renderOrder = 9;
	live.renderOrder = 10;

	$effect(() => {
		const c = colors(tour.colorBy);
		ghostGeo.setColors(c);
		liveGeo.setColors(c);
	});

	useTask(() => {
		liveGeo.instanceCount = segsBefore[tour.bike.i];
	});

	const gpsGeo = new BufferGeometry();
	gpsGeo.setAttribute(
		'position',
		new BufferAttribute(Float32Array.from(tr.x.flatMap((x, i) => [x, tr.ele[i], -tr.n[i]])), 3)
	);
	const gpsMat = new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 });

	$effect(() => () => {
		ghostGeo.dispose();
		liveGeo.dispose();
		ghostMat.dispose();
		liveMat.dispose();
		gpsGeo.dispose();
		gpsMat.dispose();
	});
</script>

<T is={ghost} />
<T is={live} />
{#if tour.layers.gpsAltitude}
	<T.Line geometry={gpsGeo} material={gpsMat} frustumCulled={false} />
{/if}
