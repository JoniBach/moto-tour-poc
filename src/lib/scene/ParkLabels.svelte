<!--
  National park names at their centres, for the big picture: shown while the camera is high,
  plus (at any height) the parks the active day passes through.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { Vector3 } from 'three';
	import type { Parks, Terrain } from '$lib/data';

	let {
		parks,
		region,
		day,
		exaggeration
	}: { parks: Parks; region: Terrain; day: string | null; exaggeration: number } = $props();

	const { camera } = useThrelte();
	let high = $state(true);
	const cam = new Vector3();
	useTask(() => {
		high = camera.current.getWorldPosition(cam).y > 40_000;
	});
</script>

{#each parks.parks as p (p.name)}
	{@const today = !!day && p.days.includes(day)}
	{#if high || today}
		<T.Group position={[p.label.e, Math.max(0, region.heightAt(p.label.e, p.label.n)) * exaggeration + 800, -p.label.n]}>
			<HTML center pointerEvents="none" zIndexRange={[42, 42]}>
				<span class="park" class:today>
					{p.name}
					<small>National Park</small>
				</span>
			</HTML>
		</T.Group>
	{/if}
{/each}

<style>
	.park {
		display: flex;
		flex-direction: column;
		align-items: center;
		white-space: nowrap;
		font-size: 11px;
		font-style: italic;
		letter-spacing: 0.08em;
		color: #b9f5c4;
		opacity: 0.75;
		text-shadow:
			0 0 4px #03070c,
			0 0 8px #03070c;
	}
	.park small {
		font-size: 8px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #6fbf80;
	}
	.park.today {
		opacity: 1;
		font-size: 13px;
		color: #d8ffe0;
	}
</style>
