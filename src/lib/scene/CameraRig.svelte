<!--
  Camera modes (within a day):
   follow   – orbit freely; the rig carries your chosen offset along with the bike
   chase    – sits behind the bike along its heading
   overview – flies out to frame the whole day, then leaves you free
   free     – plain orbit controls, no tracking
  With no active day it frames the whole tour. It stays mounted across days and exposes a
  CameraController so the app can run day-to-day transitions (fly up, shift origin, fly down).
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { untrack } from 'svelte';
	import { PerspectiveCamera, Vector3 } from 'three';
	import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
	import type { App } from '$lib/app.svelte';

	let { app }: { app: App } = $props();

	let camera = $state<PerspectiveCamera>();
	let controls = $state<OrbitControlsImpl>();

	const tour = $derived(app.tour);
	// svelte-ignore state_referenced_locally — one app for the life of the page
	const settings = app.settings;

	// svelte-ignore state_referenced_locally — only the starting pose; the index is loaded by now
	const HOME_POSE = app.homePose();

	/** frame for the whole active day (its grid centre, in world metres) */
	function dayFrame() {
		const { cols, rows, spacing, x0, n1 } = tour!.data.terrain.meta;
		const centre = new Vector3(x0 + (cols * spacing) / 2, 0, -(n1 - (rows * spacing) / 2));
		return { centre, span: Math.max(cols, rows) * spacing };
	}

	const bikePos = new Vector3();
	const lastBike = new Vector3();
	const goalPos = new Vector3();
	const goalTarget = new Vector3();
	let flying = 0; // seconds of mode fly-in left
	/** set when the user's own drag/zoom changes the mode: keep their view, don't fly */
	let userSwitched = false;
	let hasLast = false;

	// explicit flights requested by the app (day transitions)
	let flight: { from: Vector3; fromT: Vector3; to: Vector3; toT: Vector3; t: number; dur: number; done: () => void } | null =
		null;

	function bikeWorld(out: Vector3) {
		const b = tour!.bike;
		return out.set(b.x, b.h * settings.exaggeration, -b.n);
	}

	function flyFor(mode: typeof settings.camera) {
		if (!tour) return;
		bikeWorld(bikePos);
		if (mode === 'overview') {
			// frame the terrain around the rider (see horizon.ts), or the whole day if that's smaller
			const day = dayFrame();
			const scoped = settings.horizon * 2 < day.span;
			const centre = scoped ? bikePos.clone().setY(0) : day.centre;
			const span = scoped ? settings.horizon * 2 : day.span;
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

	// react to mode changes with a fly-to (only the mode is tracked, not the moving bike)
	$effect(() => {
		const mode = settings.camera;
		if (!camera || !controls) return;
		untrack(() => {
			if (userSwitched) {
				userSwitched = false;
				hasLast = false;
			} else if (!flight) flyFor(mode);
		});
	});

	// hand the app a controller once the camera exists
	$effect(() => {
		if (!camera || !controls) return;
		const cam = camera;
		const ctl = controls;
		app.camera = {
			flyTo: (to, toT, dur) =>
				new Promise<void>((done) => {
					flying = 0;
					flight = { from: cam.position.clone(), fromT: ctl.target.clone(), to: to.clone(), toT: toT.clone(), t: 0, dur, done };
				}),
			shift: (delta) => {
				cam.position.add(delta);
				ctl.target.add(delta);
				if (flight) {
					for (const v of [flight.from, flight.fromT, flight.to, flight.toT]) v.add(delta);
				}
				hasLast = false;
			},
			reenter: () => flyFor(settings.camera),
			get target() {
				return ctl.target;
			}
		};
		// untracked as a whole: flyFor reads the bike's position, and tracking that would re-run
		// this setup (and its fly-in) every time the bike moved, snapping the user's zoom back
		if (tour) untrack(() => flyFor(settings.camera));
		// dev only: lets browser tests read the camera
		if (import.meta.env.DEV) (window as unknown as { __rig: object }).__rig = { camera: cam, controls: ctl };
		return () => {
			app.camera = null;
			// switched to the 2D map mid-flight: let the waiting day change carry on
			flight?.done();
			flight = null;
		};
	});

	const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

	useTask((dt) => {
		if (!camera || !controls) return;
		const k = 1 - Math.exp(-dt * 3.5);

		if (flight) {
			flight.t = Math.min(1, flight.t + dt / flight.dur);
			const e = ease(flight.t);
			camera.position.lerpVectors(flight.from, flight.to, e);
			controls.target.lerpVectors(flight.fromT, flight.toT, e);
			if (flight.t >= 1) {
				const done = flight.done;
				flight = null;
				done();
			}
		} else if (tour) {
			bikeWorld(bikePos);
			if (settings.camera === 'chase') {
				const h = tour.bike.heading;
				const fwd = new Vector3(Math.sin(h), 0, -Math.cos(h));
				goalPos.copy(bikePos).addScaledVector(fwd, -16).add(new Vector3(0, 6, 0));
				goalTarget.copy(bikePos).addScaledVector(fwd, 10).add(new Vector3(0, 1.5, 0));
				// never dip below the terrain behind the bike
				const ground = tour.data.terrain.heightAt(goalPos.x, -goalPos.z) * settings.exaggeration + 3;
				goalPos.y = Math.max(goalPos.y, ground);
				camera.position.lerp(goalPos, k);
				controls.target.lerp(goalTarget, k * 1.5);
			} else if (flying > 0) {
				flying -= dt;
				if (settings.camera === 'follow') {
					// keep the goal glued to the moving bike while we fly in
					const delta = bikePos.clone().sub(goalTarget);
					goalTarget.add(delta);
					goalPos.add(delta);
				}
				camera.position.lerp(goalPos, k);
				controls.target.lerp(goalTarget, k);
			} else if (settings.camera === 'follow') {
				if (hasLast) {
					// carry the viewer's chosen offset (zoom + angle) with the bike, however far it
					// jumps (scrubbing), so the framing they set is kept
					const delta = bikePos.clone().sub(lastBike);
					camera.position.add(delta);
					controls.target.add(delta);
				} else {
					controls.target.lerp(bikePos, k);
				}
			}
			lastBike.copy(bikePos);
			hasLast = true;
		}

		// keep depth precision sane from 20 m (chase) to 1,000 km (all of GB)
		const d = camera.position.distanceTo(controls.target);
		camera.near = Math.max(0.5, d / 400);
		camera.far = Math.max(20000, d * 12);
		camera.updateProjectionMatrix();
	});
</script>

<T.PerspectiveCamera makeDefault bind:ref={camera} fov={45} position={HOME_POSE.pos.toArray()}>
	<OrbitControls
		bind:ref={controls}
		target={HOME_POSE.target.toArray()}
		enableDamping
		dampingFactor={0.08}
		maxPolarAngle={Math.PI * 0.47}
		minDistance={20}
		maxDistance={3_000_000}
		onstart={() => {
			if (settings.camera === 'chase' || settings.camera === 'overview') {
				userSwitched = true; // the user is taking over the view: keep it where it is
				settings.camera = settings.camera === 'chase' ? 'follow' : 'free';
			}
			flying = 0;
		}}
	/>
</T.PerspectiveCamera>
