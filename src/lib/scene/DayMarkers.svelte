<!--
  A clickable "Day N" marker on each day's route for the UK overview. Hidden once the camera
  is down at a day (closer than ~60 km), except for days that aren't the active one.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { Vector3 } from 'three';
	import { dayColor } from '$lib/colors';
	import type { DaySummary, Terrain } from '$lib/data';

	let {
		days,
		uk,
		activeDay,
		exaggeration,
		onselect
	}: {
		days: DaySummary[];
		uk: Terrain;
		activeDay: string | null;
		exaggeration: number;
		onselect: (day: string) => void;
	} = $props();

	const { camera } = useThrelte();

	// marker at the middle point of each day's longest ride (absolute BNG)
	// svelte-ignore state_referenced_locally — the tour index never changes
	const markers = days.map((d) => {
		const line = d.lines.reduce((a, b) => (b.length > a.length ? b : a), []);
		const k = Math.floor(line.length / 4) * 2;
		const e = line[k];
		const n = line[k + 1];
		return { d, e, n, h: Math.max(0, uk.heightAt(e, n)) };
	});

	let far = $state(true);
	const cam = new Vector3();
	const target = new Vector3();
	useTask(() => {
		camera.current.getWorldPosition(cam);
		camera.current.getWorldDirection(target);
		// "far" = camera high enough that the whole tour is the point of interest
		far = cam.y > 60_000;
	});

	const date = (s: number) =>
		new Date(s * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
</script>

{#each markers as m (m.d.day)}
	{#if far || m.d.day !== activeDay}
		<T.Group position={[m.e, m.h * exaggeration + 400, -m.n]}>
			<HTML center zIndexRange={[45, 45]}>
				<button
					class="marker"
					class:active={m.d.day === activeDay}
					class:hidden={!far}
					style:--c={dayColor(m.d.index, days.length)}
					onclick={() => onselect(m.d.day)}
					title={m.d.title}
				>
					<b>Day {m.d.index + 1}</b>
					<span>{date(m.d.start)} · {m.d.title}</span>
				</button>
			</HTML>
		</T.Group>
	{/if}
{/each}

<style>
	.marker {
		all: unset;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 4px 9px;
		border-radius: 10px;
		border: 1px solid var(--c);
		background: rgba(4, 12, 20, 0.78);
		color: #e8f8ff;
		font-size: 11px;
		white-space: nowrap;
		box-shadow: 0 0 12px color-mix(in srgb, var(--c) 45%, transparent);
		transform: translateY(-18px);
	}
	.marker b {
		color: var(--c);
		font-size: 12px;
	}
	.marker span {
		color: #9fc2d0;
	}
	.marker.active {
		background: color-mix(in srgb, var(--c) 30%, rgba(4, 12, 20, 0.85));
	}
	.marker.hidden {
		opacity: 0.6;
		transform: translateY(-18px) scale(0.85);
	}
	.marker:hover {
		opacity: 1;
	}
</style>
