<!--
  Elevation rings from d3-contour, placed at their true XY and raised to their true height.
-->
<script lang="ts">
	import { T } from '@threlte/core';
	import { contours } from 'd3';
	import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, LineBasicMaterial } from 'three';
	import type { Tour } from '$lib/tour.svelte';

	let { tour, interval = 50 }: { tour: Tour; interval?: number } = $props();

	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const { terrain } = tour.data;
	const { cols, rows, spacing, x0, n1, maxH } = terrain.meta;

	// Contour on a 100 m grid: plenty for rings, and keeps polygon counts sane
	const STEP = 4;
	const gc = Math.floor(cols / STEP);
	const gr = Math.floor(rows / STEP);
	const values = new Float64Array(gc * gr);
	for (let r = 0; r < gr; r++)
		for (let c = 0; c < gc; c++) values[r * gc + c] = terrain.heights[r * STEP * cols + c * STEP];

	// svelte-ignore state_referenced_locally
	const levels = [1, ...Array.from({ length: Math.floor(maxH / interval) }, (_, i) => (i + 1) * interval)];
	const polys = contours().size([gc, gr]).thresholds(levels)(Array.from(values));

	// d3 grid coords (cell centres at +0.5) -> local metres
	const gx = (c: number) => x0 + (c - 0.5) * STEP * spacing;
	const gn = (r: number) => n1 - (r - 0.5) * STEP * spacing;

	const ringColor = (h: number) =>
		h <= 1 ? new Color('#3a6cff') : new Color().setHSL(0.52 - (h / maxH) * 0.12, 1, 0.45 + (h / maxH) * 0.35);

	function buildRings() {
		const pos: number[] = [];
		const col: number[] = [];
		for (const mp of polys) {
			const h = mp.value;
			const k = h <= 1 ? 1 : h % (interval * 5) === 0 ? 1 : 0.45; // brighter index contours
			const c = ringColor(h).multiplyScalar(k);
			for (const poly of mp.coordinates)
				for (const ring of poly)
					for (let i = 1; i < ring.length; i++) {
						pos.push(gx(ring[i - 1][0]), h, -gn(ring[i - 1][1]), gx(ring[i][0]), h, -gn(ring[i][1]));
						col.push(c.r, c.g, c.b, c.r, c.g, c.b);
					}
		}
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
		g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
		return g;
	}

	const rings = buildRings();
	const ringMat = new LineBasicMaterial({
		vertexColors: true,
		transparent: true,
		opacity: 0.8,
		blending: AdditiveBlending,
		depthWrite: false
	});

	$effect(() => () => {
		rings.dispose();
		ringMat.dispose();
	});
</script>

{#if tour.layers.contours}
	<T.LineSegments geometry={rings} material={ringMat} frustumCulled={false} />
{/if}
