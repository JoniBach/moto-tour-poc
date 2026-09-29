<!--
  National park outlines, traced on the terrain. Positions are absolute BNG metres (the parent
  group applies the world origin and vertical exaggeration). Inside the active day's grid the
  outline drapes on that day's detailed terrain; elsewhere on the 1 km UK grid. Parks the active
  day passes through glow brighter.
-->
<script lang="ts">
	import { T } from '@threlte/core';
	import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
	import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import type { Parks, Terrain } from '$lib/data';

	let {
		parks,
		uk,
		day,
		dayTerrain
	}: { parks: Parks; uk: Terrain; day: string | null; dayTerrain: Terrain | null } = $props();

	const LIFT = 25; // metres; clear of the terrain without floating visibly

	// svelte-ignore state_referenced_locally — the park set never changes
	const lines = parks.parks.map((park) => {
		const geometry = new LineSegmentsGeometry();
		const material = new LineMaterial({
			color: '#8ff0a4',
			linewidth: 2,
			transparent: true,
			opacity: 0.55,
			depthWrite: false
		});
		const obj = new LineSegments2(geometry, material);
		obj.frustumCulled = false;
		obj.renderOrder = 9.5;
		return { park, geometry, material, obj };
	});

	// drape: the active day's terrain where it has it, the UK grid elsewhere
	function heightAt(e: number, n: number) {
		if (dayTerrain) {
			const { originE, originN, x0, n1, cols, rows, spacing } = dayTerrain.meta;
			const x = e - originE;
			const y = n - originN;
			if (x >= x0 && x <= x0 + (cols - 1) * spacing && y <= n1 && y >= n1 - (rows - 1) * spacing)
				return Math.max(0, dayTerrain.heightAt(x, y));
		}
		return Math.max(0, uk.heightAt(e, n));
	}

	$effect(() => {
		void dayTerrain; // re-drape when the day changes
		for (const l of lines) {
			const seg: number[] = [];
			for (const ring of l.park.rings)
				for (let k = 2; k < ring.length; k += 2) {
					const [ea, na, eb, nb] = [ring[k - 2], ring[k - 1], ring[k], ring[k + 1]];
					seg.push(ea, heightAt(ea, na) + LIFT, -na, eb, heightAt(eb, nb) + LIFT, -nb);
				}
			l.geometry.setPositions(seg);
		}
	});

	$effect(() => {
		for (const l of lines) {
			const today = !!day && l.park.days.includes(day);
			l.material.opacity = today ? 0.95 : 0.5;
			l.material.linewidth = today ? 3 : 2;
		}
	});

	$effect(() => () => {
		for (const l of lines) {
			l.geometry.dispose();
			l.material.dispose();
		}
	});
</script>

{#each lines as l (l.park.name)}
	<T is={l.obj} />
{/each}
