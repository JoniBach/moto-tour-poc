<!--
  Whatever the tour moves by: the tour's own 3D model when it has one (tour.config.json `model`,
  with a simple rider on top), else a figure built from primitives for its activity (motorbike and
  rider, bicycle and rider, car, or walker; also the stand-in while the model loads). Heading comes from the track,
  and lean too where leaning is a thing; it grows with camera distance so it stays findable, and
  a light beam marks it from the overview.
-->
<script lang="ts" module>
	/** which way the vehicle last faced, carried to the next globe so it turns to its new heading */
	let lastHeading: number | null = null;
</script>

<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { AdditiveBlending, Group, Mesh, Vector3 } from 'three';
	import type { Tour } from '$lib/tour.svelte';
	import { A, ACTIVITY } from '$lib/activity';
	import { TOUR } from '$lib/tourConfig';
	import { onMount } from 'svelte';
	import type { BufferGeometry } from 'three';
	import { vehicleGeometry, vehicleReady } from './vehicleModel';
	import { app } from '$lib/app.svelte';

	let {
		tour,
		beacon = true,
		grow = 1,
		groundAt
	}: {
		tour: Tour;
		/** the marker beam for zoomed-out views (the globe has no need of it) */
		beacon?: boolean;
		/** extra size factor (the globe shrinks the landscape, and would shrink the bike with it) */
		grow?: number;
		/** stand on this ground instead of the day grid's (the globe's sharper terrain) */
		groundAt?: (x: number, n: number) => number;
	} = $props();
	const { camera } = useThrelte();

	const outer = new Group();
	const tmp = new Vector3();
	let leanGroup = $state<Group>();
	let beam = $state<Mesh>();

	let turn: { from: number; t: number; dur: number } | null = null;
	useTask((dt) => {
		const b = tour.bike;
		outer.position.set(b.x, (groundAt ? groundAt(b.x, b.n) : b.h) * tour.exaggeration, -b.n);
		// turn to the heading rather than snapping to it: a new day's globe starts from where the
		// last one faced and swings round, easing in and out (slow start, slow finish, no kink),
		// taking longer for a bigger turn; after that it simply follows the track
		const goal = -b.heading;
		const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
		if (turn === null) {
			const from = lastHeading ?? goal;
			const angle = Math.abs(wrap(goal - from));
			turn = { from, t: 0, dur: angle < 0.02 ? 0 : 0.8 + 0.5 * (angle / Math.PI) };
		}
		turn.t += dt;
		const u = turn.dur ? Math.min(1, turn.t / turn.dur) : 1;
		const ease = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
		// measured against the live goal, so a heading that moves meanwhile is tracked too
		const facing = turn.from + wrap(goal - turn.from) * ease;
		lastHeading = facing;
		outer.rotation.y = facing;
		if (leanGroup) leanGroup.rotation.z = A.leans ? -b.lean : 0;
		const dist = camera.current.getWorldPosition(tmp).distanceTo(outer.position);
		const s = Math.min(60, Math.max(1, dist / 45));
		outer.scale.setScalar(s * grow * app.settings.vehicleScale);
		// the marker beam only helps when zoomed out; hide it for close-ups
		if (beam) beam.visible = beacon && s > 6;
	});

	let model = $state.raw<BufferGeometry | null>(vehicleReady());
	onMount(() => {
		let live = true;
		vehicleGeometry().then((g) => live && (model = g));
		return () => {
			live = false;
		};
	});
	const paint = { color: TOUR.model?.color ?? '#c2562d', roughness: 0.45, metalness: 0.15 };

	const body = { color: '#0c1a22', emissive: '#00c8ff', emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.6 };
	const person = { color: '#1b2b35', emissive: '#ffd166', emissiveIntensity: 0.25 };
	const head = { color: '#e8f7ff', emissive: '#7cf7ff', emissiveIntensity: 0.6 };
</script>

<T is={outer}>
	<T.Group bind:ref={leanGroup}>
		{#if model}
			<T.Mesh geometry={model} castShadow>
				<T.MeshStandardMaterial {...paint} />
			</T.Mesh>
			{#if TOUR.model?.rider}
				<!-- sitting upright, as on a scooter -->
				<T.Mesh position={[0, 1.02, 0.22]} rotation.x={0.12}>
					<T.CapsuleGeometry args={[0.19, 0.4, 4, 10]} />
					<T.MeshStandardMaterial color="#46535a" roughness={0.7} />
				</T.Mesh>
				<T.Mesh position={[0, 1.46, 0.18]}>
					<T.SphereGeometry args={[0.17, 16, 12]} />
					<T.MeshStandardMaterial color="#fbf6ec" roughness={0.4} />
				</T.Mesh>
			{/if}
		{:else if ACTIVITY === 'motorcycle'}
			{#each [-0.72, 0.72] as z (z)}
				<T.Mesh position={[0, 0.33, z]} rotation.y={Math.PI / 2}>
					<T.TorusGeometry args={[0.3, 0.07, 10, 28]} />
					<T.MeshStandardMaterial {...body} emissiveIntensity={0.8} />
				</T.Mesh>
			{/each}
			<T.Mesh position={[0, 0.72, 0]}>
				<T.BoxGeometry args={[0.32, 0.38, 1.1]} />
				<T.MeshStandardMaterial {...body} />
			</T.Mesh>
			<T.Mesh position={[0, 0.98, -0.25]}>
				<T.BoxGeometry args={[0.36, 0.2, 0.5]} />
				<T.MeshStandardMaterial {...body} />
			</T.Mesh>
			<!-- rider -->
			<T.Mesh position={[0, 1.3, 0.1]} rotation.x={-0.45}>
				<T.CapsuleGeometry args={[0.2, 0.45, 4, 10]} />
				<T.MeshStandardMaterial {...person} />
			</T.Mesh>
			<T.Mesh position={[0, 1.72, -0.12]}>
				<T.SphereGeometry args={[0.16, 16, 12]} />
				<T.MeshStandardMaterial {...head} />
			</T.Mesh>
			<T.Mesh position={[0, 0.85, -0.82]}>
				<T.SphereGeometry args={[0.08, 10, 8]} />
				<T.MeshBasicMaterial color="#fff6c8" />
			</T.Mesh>
		{:else if ACTIVITY === 'bicycle'}
			{#each [-0.52, 0.52] as z (z)}
				<T.Mesh position={[0, 0.35, z]} rotation.y={Math.PI / 2}>
					<T.TorusGeometry args={[0.34, 0.03, 8, 32]} />
					<T.MeshStandardMaterial {...body} emissiveIntensity={0.8} />
				</T.Mesh>
			{/each}
			<!-- frame: down tube, top tube, seat post, bars -->
			<T.Mesh position={[0, 0.55, -0.12]} rotation.x={0.5}>
				<T.BoxGeometry args={[0.05, 0.05, 0.75]} />
				<T.MeshStandardMaterial {...body} />
			</T.Mesh>
			<T.Mesh position={[0, 0.8, -0.05]}>
				<T.BoxGeometry args={[0.05, 0.05, 0.62]} />
				<T.MeshStandardMaterial {...body} />
			</T.Mesh>
			<T.Mesh position={[0, 0.62, 0.22]} rotation.x={-0.25}>
				<T.BoxGeometry args={[0.05, 0.6, 0.05]} />
				<T.MeshStandardMaterial {...body} />
			</T.Mesh>
			<T.Mesh position={[0, 0.98, -0.42]}>
				<T.BoxGeometry args={[0.46, 0.04, 0.04]} />
				<T.MeshStandardMaterial {...body} />
			</T.Mesh>
			<!-- rider, leaning over the bars -->
			<T.Mesh position={[0, 1.22, 0.02]} rotation.x={-0.7}>
				<T.CapsuleGeometry args={[0.17, 0.5, 4, 10]} />
				<T.MeshStandardMaterial {...person} />
			</T.Mesh>
			<T.Mesh position={[0, 1.52, -0.3]}>
				<T.SphereGeometry args={[0.14, 16, 12]} />
				<T.MeshStandardMaterial {...head} />
			</T.Mesh>
		{:else if ACTIVITY === 'car'}
			{#each [[-0.85, -1.35], [0.85, -1.35], [-0.85, 1.35], [0.85, 1.35]] as [x, z] (`${x},${z}`)}
				<T.Mesh position={[x, 0.32, z]} rotation.y={Math.PI / 2}>
					<T.TorusGeometry args={[0.24, 0.1, 10, 24]} />
					<T.MeshStandardMaterial {...body} emissiveIntensity={0.8} />
				</T.Mesh>
			{/each}
			<T.Mesh position={[0, 0.62, 0]}>
				<T.BoxGeometry args={[1.7, 0.5, 4.1]} />
				<T.MeshStandardMaterial {...body} />
			</T.Mesh>
			<T.Mesh position={[0, 1.1, 0.25]}>
				<T.BoxGeometry args={[1.5, 0.48, 2.1]} />
				<T.MeshStandardMaterial {...body} emissiveIntensity={0.55} />
			</T.Mesh>
			{#each [-0.6, 0.6] as x (x)}
				<T.Mesh position={[x, 0.66, -2.06]}>
					<T.SphereGeometry args={[0.1, 10, 8]} />
					<T.MeshBasicMaterial color="#fff6c8" />
				</T.Mesh>
			{/each}
		{:else}
			<!-- walker: two legs, body, pack, head -->
			{#each [-0.1, 0.1] as x (x)}
				<T.Mesh position={[x, 0.45, 0]}>
					<T.CapsuleGeometry args={[0.08, 0.7, 4, 8]} />
					<T.MeshStandardMaterial {...body} />
				</T.Mesh>
			{/each}
			<T.Mesh position={[0, 1.2, 0]}>
				<T.CapsuleGeometry args={[0.2, 0.45, 4, 10]} />
				<T.MeshStandardMaterial {...person} />
			</T.Mesh>
			<T.Mesh position={[0, 1.25, 0.24]}>
				<T.BoxGeometry args={[0.34, 0.45, 0.2]} />
				<T.MeshStandardMaterial {...body} />
			</T.Mesh>
			<T.Mesh position={[0, 1.68, -0.02]}>
				<T.SphereGeometry args={[0.15, 16, 12]} />
				<T.MeshStandardMaterial {...head} />
			</T.Mesh>
		{/if}
	</T.Group>
	<!-- marker beam + ground ring -->
	<T.Mesh position.y={8} bind:ref={beam}>
		<T.CylinderGeometry args={[0.05, 0.05, 16, 8, 1, true]} />
		<T.MeshBasicMaterial color="#ffd166" transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} />
	</T.Mesh>
	<T.Mesh rotation.x={-Math.PI / 2} position.y={0.1}>
		<T.RingGeometry args={[1.4, 1.8, 40]} />
		<T.MeshBasicMaterial color="#ffd166" transparent opacity={0.7} blending={AdditiveBlending} depthWrite={false} />
	</T.Mesh>
</T>
