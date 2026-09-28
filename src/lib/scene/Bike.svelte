<!--
  Placeholder bike + rider built from primitives (swap for a glTF of the real bike later).
  Heading and lean come from the track; it grows with camera distance so it stays findable,
  and a light beam marks it from the overview.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { AdditiveBlending, Group, Mesh, Vector3 } from 'three';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();
	const { camera } = useThrelte();

	const outer = new Group();
	const tmp = new Vector3();
	let leanGroup = $state<Group>();
	let beam = $state<Mesh>();

	useTask(() => {
		const b = tour.bike;
		outer.position.set(b.x, b.h * tour.exaggeration, -b.n);
		outer.rotation.y = -b.heading;
		if (leanGroup) leanGroup.rotation.z = -b.lean;
		const dist = camera.current.getWorldPosition(tmp).distanceTo(outer.position);
		const s = Math.min(60, Math.max(1, dist / 45));
		outer.scale.setScalar(s);
		// the marker beam only helps when zoomed out; hide it for close-ups
		if (beam) beam.visible = s > 6;
	});

	const body = { color: '#0c1a22', emissive: '#00c8ff', emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.6 };
</script>

<T is={outer}>
	<T.Group bind:ref={leanGroup}>
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
			<T.MeshStandardMaterial color="#1b2b35" emissive="#ffd166" emissiveIntensity={0.25} />
		</T.Mesh>
		<T.Mesh position={[0, 1.72, -0.12]}>
			<T.SphereGeometry args={[0.16, 16, 12]} />
			<T.MeshStandardMaterial color="#e8f7ff" emissive="#7cf7ff" emissiveIntensity={0.6} />
		</T.Mesh>
		<T.Mesh position={[0, 0.85, -0.82]}>
			<T.SphereGeometry args={[0.08, 10, 8]} />
			<T.MeshBasicMaterial color="#fff6c8" />
		</T.Mesh>
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
