<!--
  The persistent world: sky, lights, camera rig, the UK backdrop and every day's route line,
  plus the active day's scene. Absolute-BNG layers sit in a group offset by the world origin;
  the day scene is at the origin already (the origin is the active day's origin).
-->
<script lang="ts">
	import { T } from '@threlte/core';
	import { Stars } from '@threlte/extras';
	import type { App } from '$lib/app.svelte';
	import CameraRig from './CameraRig.svelte';
	import DayMarkers from './DayMarkers.svelte';
	import DayScene from './DayScene.svelte';
	import TourRoutes from './TourRoutes.svelte';
	import UkLayer from './UkLayer.svelte';

	let { app, onselect }: { app: App; onselect: (day: string) => void } = $props();

	const activeDay = $derived(app.tour?.data.track.day ?? null);
	const active = $derived(app.summary(activeDay));
</script>

<T.Color attach="background" args={['#03070c']} />
<Stars radius={3_000_000} depth={600_000} count={4000} factor={7000} />

<T.AmbientLight intensity={0.6} />
<T.DirectionalLight position={[-30000, 40000, -20000]} intensity={1.6} />

<CameraRig {app} />

{#if app.uk && app.index}
	<T.Group position={[-app.origin.e, 0, app.origin.n]}>
		<T.Group scale.y={app.settings.exaggeration}>
			{#if app.settings.layers.points}<UkLayer uk={app.uk} {active} settings={app.settings} />{/if}
			<TourRoutes days={app.index.days} uk={app.uk} {activeDay} />
		</T.Group>
		<DayMarkers days={app.index.days} uk={app.uk} {activeDay} exaggeration={app.settings.exaggeration} {onselect} />
	</T.Group>
{/if}

{#if app.tour}
	{#key app.tour}
		<DayScene tour={app.tour} />
	{/key}
{/if}
