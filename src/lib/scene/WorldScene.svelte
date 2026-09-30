<!--
  The persistent world: sky, lights, camera rig, the region backdrop and every day's route line,
  plus the active day's scene. Absolute-BNG layers sit in a group offset by the world origin;
  the day scene is at the origin already (the origin is the active day's origin).
-->
<script lang="ts">
	import { T } from '@threlte/core';
	import { Stars } from '@threlte/extras';
	import type { App } from '$lib/app.svelte';
	import BlogPins from './BlogPins.svelte';
	import CameraRig from './CameraRig.svelte';
	import DayMarkers from './DayMarkers.svelte';
	import DayScene from './DayScene.svelte';
	import NationalParks from './NationalParks.svelte';
	import ParkLabels from './ParkLabels.svelte';
	import PhotoPins from './PhotoPins.svelte';
	import TourRoutes from './TourRoutes.svelte';
	import RegionLayer from './RegionLayer.svelte';

	let { app, onselect }: { app: App; onselect: (day: string) => void } = $props();

	const activeDay = $derived(app.tour?.data.track.day ?? null);
	const active = $derived(app.summary(activeDay));
</script>

<T.Color attach="background" args={['#03070c']} />
<Stars radius={3_000_000} depth={600_000} count={4000} factor={7000} />

<T.AmbientLight intensity={0.6} />
<T.DirectionalLight position={[-30000, 40000, -20000]} intensity={1.6} />

<CameraRig {app} />

{#if app.region && app.index}
	<T.Group position={[-app.origin.e, 0, app.origin.n]}>
		<T.Group scale.y={app.settings.exaggeration}>
			<RegionLayer region={app.region} {active} settings={app.settings} parkMask={app.parks?.mask ?? null} />
			<TourRoutes days={app.index.days} region={app.region} {activeDay} />
			{#if app.parks && app.settings.layers.parks}
				<NationalParks parks={app.parks} region={app.region} day={activeDay} dayTerrain={app.tour?.data.terrain ?? null} />
			{/if}
		</T.Group>
		{#if app.photos.length && app.settings.layers.photos}
			<PhotoPins
				photos={app.photos}
				region={app.region}
				dayTerrain={app.tour?.data.terrain ?? null}
				origin={app.origin}
				exaggeration={app.settings.exaggeration}
				onopen={(photos) => (app.gallery = { photos, index: 0 })}
			/>
		{/if}
		{#if app.posts.length && app.settings.layers.blog}
			<BlogPins
				posts={app.posts}
				region={app.region}
				dayTerrain={app.tour?.data.terrain ?? null}
				exaggeration={app.settings.exaggeration}
				reading={app.reading}
				onopen={(post) => (app.reading = post)}
			/>
		{/if}
		{#if app.parks && app.settings.layers.parks}
			<ParkLabels parks={app.parks} region={app.region} day={activeDay} exaggeration={app.settings.exaggeration} />
		{/if}
		<DayMarkers days={app.index.days} region={app.region} {activeDay} exaggeration={app.settings.exaggeration} {onselect} />
	</T.Group>
{/if}

{#if app.tour}
	{#key app.tour}
		<DayScene tour={app.tour} />
	{/key}
{/if}
