<!--
  The globe's controls, built into its base: surface keys (one stays pressed), lever switches
  with a little indicator light, and − / + buttons for size and relief. They sit on the ledge,
  facing out, their labels engraved by the plinth. Each has a larger invisible hit area, so
  they're easy to catch from a distance. (Keyboard and screen readers use GlobeUI's panel.)
-->
<script lang="ts">
	import { T } from '@threlte/core';
	import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';
	import type { Tour } from '$lib/tour.svelte';
	import { around, RELIEFS, SIZES, STEPPERS, step, SURFACE_KEYS, SWITCHES, type Layout } from './layout';

	let { tour, L, V }: { tour: Tour; L: Layout; V: number } = $props();

	// svelte-ignore state_referenced_locally — sizes are fixed for the component's lifetime
	const u = V * 0.001; // one "unit" of control size
	// svelte-ignore state_referenced_locally
	const Y = L.ledge.top;
	const RAD = Math.PI / 180;

	const keyGeo = new BoxGeometry(56 * u, 22 * u, 44 * u);
	const baseGeo = new BoxGeometry(34 * u, 10 * u, 40 * u);
	const leverGeo = new CylinderGeometry(4 * u, 5 * u, 52 * u, 12);
	const tipGeo = new SphereGeometry(9 * u, 16, 12);
	const ledGeo = new SphereGeometry(6 * u, 12, 8);
	const buttonGeo = new CylinderGeometry(20 * u, 22 * u, 14 * u, 28);
	const hitGeo = new BoxGeometry(95 * u, 90 * u, 95 * u);

	let hover = $state<string | null>(null);
	let pressed = $state<string | null>(null);

	function enter(id: string) {
		hover = id;
		document.body.style.cursor = 'pointer';
	}
	function leave(id: string) {
		if (hover === id) hover = null;
		document.body.style.cursor = '';
	}
	/** a button's brief dip when pressed */
	function press(id: string) {
		pressed = id;
		setTimeout(() => pressed === id && (pressed = null), 160);
	}

	function stepper(key: 'size' | 'relief', dir: number) {
		press(`${key}${dir}`);
		if (key === 'size') tour.settings.globeRadius = step(SIZES, tour.settings.globeRadius, dir);
		else tour.exaggeration = step(RELIEFS, tour.exaggeration, dir);
	}

	const CREAM = '#f4efe6';
	const ACCENT = '#d9480f';

	$effect(() => () => {
		for (const g of [keyGeo, baseGeo, leverGeo, tipGeo, ledGeo, buttonGeo, hitGeo]) g.dispose();
		document.body.style.cursor = '';
	});
</script>

{#snippet hit(id: string, run: () => void)}
	<T.Mesh
		geometry={hitGeo}
		position.y={30 * u}
		onclick={(e: { stopPropagation: () => void }) => {
			e.stopPropagation();
			run();
		}}
		onpointerenter={() => enter(id)}
		onpointerleave={() => leave(id)}
	>
		<T.MeshBasicMaterial transparent opacity={0} depthWrite={false} />
	</T.Mesh>
{/snippet}

<!-- surface keys: the chosen one stays down and glows -->
{#each SURFACE_KEYS as k (k.id)}
	{@const on = tour.mapStyle === k.id}
	<T.Group position={around(L.switchR, k.at, Y)} rotation.y={k.at * RAD}>
		<T.Mesh geometry={keyGeo} position.y={(on ? 5 : 11) * u + (hover === k.id && !on ? 3 * u : 0)}>
			<T.MeshStandardMaterial
				color={on ? '#ffd8c2' : CREAM}
				emissive={on ? ACCENT : '#ffffff'}
				emissiveIntensity={on ? 0.35 : 0.25}
				roughness={0.6}
			/>
		</T.Mesh>
		{@render hit(k.id, () => (tour.mapStyle = k.id))}
	</T.Group>
{/each}

<!-- lever switches: up and towards you is on; a light shows it -->
{#each SWITCHES as s (s.key)}
	{@const on = tour.layers[s.key]}
	<T.Group position={around(L.switchR, s.at, Y)} rotation.y={s.at * RAD}>
		<T.Mesh geometry={baseGeo} position.y={5 * u}>
			<T.MeshStandardMaterial color="#cfc6b6" roughness={0.7} />
		</T.Mesh>
		<T.Group position.y={10 * u} rotation.x={on ? 0.5 : -0.5}>
			<T.Mesh geometry={leverGeo} position.y={26 * u}>
				<T.MeshStandardMaterial color="#8a7d6c" metalness={0.4} roughness={0.4} />
			</T.Mesh>
			<T.Mesh geometry={tipGeo} position.y={54 * u}>
				<T.MeshStandardMaterial color={hover === s.key ? '#ffffff' : CREAM} emissive="#ffffff" emissiveIntensity={0.3} roughness={0.5} />
			</T.Mesh>
		</T.Group>
		<T.Mesh geometry={ledGeo} position={[0, 8 * u, -26 * u]}>
			<T.MeshBasicMaterial color={on ? '#ff8a3d' : '#9d968b'} />
		</T.Mesh>
		{@render hit(s.key, () => (tour.layers[s.key] = !tour.layers[s.key]))}
	</T.Group>
{/each}

<!-- − / + buttons -->
{#each STEPPERS as s (s.key)}
	{#each [-1, 1] as dir (dir)}
		{@const id = `${s.key}${dir}`}
		<T.Group position={around(L.switchR, dir < 0 ? s.minus : s.plus, Y)} rotation.y={(dir < 0 ? s.minus : s.plus) * RAD}>
			<T.Mesh geometry={buttonGeo} position.y={(pressed === id ? 3 : 8) * u + (hover === id ? 2 * u : 0)}>
				<T.MeshStandardMaterial color={CREAM} emissive={hover === id ? ACCENT : '#ffffff'} emissiveIntensity={hover === id ? 0.2 : 0.25} roughness={0.6} />
			</T.Mesh>
			{@render hit(id, () => stepper(s.key, dir))}
		</T.Group>
	{/each}
{/each}
