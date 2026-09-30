<!--
  Every day's route as one glowing line across the region (simplified, from tour.json),
  each day in its own colour, draped on the region backdrop grid. The active day's line is hidden
  because its full-detail route is drawn by the day scene.
  Positions are absolute projected metres; the parent group applies the world origin offset.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Color, Vector3 } from 'three';
	import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
	import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import { dayColor } from '$lib/colors';
	import type { DaySummary, Terrain } from '$lib/data';

	let { days, region, activeDay }: { days: DaySummary[]; region: Terrain; activeDay: string | null } = $props();

	const LIFT = 60; // metres: 1 km terrain is coarse, keep the line clear of it

	// svelte-ignore state_referenced_locally — the tour index never changes
	const objects = days.map((d) => {
		const seg: number[] = [];
		for (const line of d.lines)
			for (let k = 2; k < line.length; k += 2) {
				const [ea, na, eb, nb] = [line[k - 2], line[k - 1], line[k], line[k + 1]];
				seg.push(ea, Math.max(0, region.heightAt(ea, na)) + LIFT, -na, eb, Math.max(0, region.heightAt(eb, nb)) + LIFT, -nb);
			}
		const geometry = new LineSegmentsGeometry();
		geometry.setPositions(seg);
		const material = new LineMaterial({
			color: new Color().setStyle(dayColor(d.index, days.length)),
			linewidth: 3,
			transparent: true,
			opacity: 0.95,
			depthWrite: false
		});
		const obj = new LineSegments2(geometry, material);
		obj.frustumCulled = false;
		obj.renderOrder = 11;
		return { day: d.day, obj };
	});

	// Other days' simplified lines are for the big picture: hide them once the camera is down at
	// a day (they're crude at 400 m resolution next to the real route).
	const { camera } = useThrelte();
	const cam = new Vector3();
	useTask(() => {
		const high = camera.current.getWorldPosition(cam).y > 25_000;
		for (const o of objects) o.obj.visible = o.day !== activeDay && (high || !activeDay);
	});

	$effect(() => () => {
		for (const o of objects) {
			o.obj.geometry.dispose();
			o.obj.material.dispose();
		}
	});
</script>

{#each objects as o (o.day)}
	<T is={o.obj} />
{/each}
