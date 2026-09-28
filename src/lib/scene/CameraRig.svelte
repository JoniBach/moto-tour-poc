<!--
  Camera modes:
   follow   – orbit freely; the rig carries your chosen offset along with the bike
   chase    – sits behind the bike along its heading
   overview – flies out to frame the whole region, then leaves you free
   free     – plain orbit controls, no tracking
  Switching modes eases the camera over rather than cutting.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { untrack } from 'svelte';
	import { PerspectiveCamera, Vector3 } from 'three';
	import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();

	let camera = $state<PerspectiveCamera>();
	let controls = $state<OrbitControlsImpl>();

	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const { cols, rows, spacing, x0, n1 } = tour.data.terrain.meta;
	const centre = new Vector3(x0 + (cols * spacing) / 2, 0, -(n1 - (rows * spacing) / 2));
	const span = Math.max(cols, rows) * spacing;

	const bikePos = new Vector3();
	const lastBike = new Vector3();
	const goalPos = new Vector3();
	const goalTarget = new Vector3();
	let flying = 0; // seconds of easing left
	let hasLast = false;

	function bikeWorld(out: Vector3) {
		const b = tour.bike;
		return out.set(b.x, b.h * tour.exaggeration, -b.n);
	}

	// react to mode changes with a fly-to (only the mode is tracked, not the moving bike)
	$effect(() => {
		const mode = tour.camera;
		if (!camera || !controls) return;
		untrack(() => flyFor(mode));
	});

	function flyFor(mode: typeof tour.camera) {
		bikeWorld(bikePos);
		if (mode === 'overview') {
			goalTarget.copy(centre);
			goalPos.set(centre.x, span * 0.75, centre.z + span * 0.7);
			flying = 1.6;
		} else if (mode === 'follow') {
			const back = new Vector3(Math.sin(tour.bike.heading), 0, -Math.cos(tour.bike.heading)).multiplyScalar(-2600);
			goalTarget.copy(bikePos);
			goalPos.copy(bikePos).add(back).add(new Vector3(0, 2000, 0));
			flying = 1.6;
		}
		hasLast = false;
	}

	useTask((dt) => {
		if (!camera || !controls) return;
		bikeWorld(bikePos);
		const k = 1 - Math.exp(-dt * 3.5);

		if (tour.camera === 'chase') {
			const h = tour.bike.heading;
			const fwd = new Vector3(Math.sin(h), 0, -Math.cos(h));
			goalPos.copy(bikePos).addScaledVector(fwd, -16).add(new Vector3(0, 6, 0));
			goalTarget.copy(bikePos).addScaledVector(fwd, 10).add(new Vector3(0, 1.5, 0));
			// never dip below the terrain behind the bike
			const ground = tour.data.terrain.heightAt(goalPos.x, -goalPos.z) * tour.exaggeration + 3;
			goalPos.y = Math.max(goalPos.y, ground);
			camera.position.lerp(goalPos, k);
			controls.target.lerp(goalTarget, k * 1.5);
		} else if (flying > 0) {
			flying -= dt;
			if (tour.camera === 'follow') {
				// keep the goal glued to the moving bike while we fly in
				const delta = bikePos.clone().sub(goalTarget);
				goalTarget.add(delta);
				goalPos.add(delta);
			}
			camera.position.lerp(goalPos, k);
			controls.target.lerp(goalTarget, k);
		} else if (tour.camera === 'follow') {
			if (hasLast) {
				const delta = bikePos.clone().sub(lastBike);
				camera.position.add(delta);
				controls.target.add(delta);
			} else {
				controls.target.lerp(bikePos, k);
			}
		}
		lastBike.copy(bikePos);
		hasLast = true;

		// keep depth precision sane from 50 m to 50 km
		const d = camera.position.distanceTo(controls.target);
		camera.near = Math.max(0.5, d / 400);
		camera.far = Math.max(20000, d * 12);
		camera.updateProjectionMatrix();
	});
</script>

<T.PerspectiveCamera
	makeDefault
	bind:ref={camera}
	fov={45}
	position={[centre.x, span * 0.75, centre.z + span * 0.7]}
>
	<OrbitControls
		bind:ref={controls}
		target={[centre.x, 0, centre.z]}
		enableDamping
		dampingFactor={0.08}
		maxPolarAngle={Math.PI * 0.47}
		minDistance={20}
		maxDistance={span * 2.5}
		onstart={() => {
			if (tour.camera === 'chase' || tour.camera === 'overview') tour.camera = tour.camera === 'chase' ? 'follow' : 'free';
			flying = 0;
		}}
	/>
</T.PerspectiveCamera>
