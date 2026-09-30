<!--
  One day's scene. Everything anchored to the terrain lives in one group scaled on Y by the
  vertical exaggeration, so the slider is live without rebuilding geometry.
  The bike and pins sit outside the group (they must not be squashed) and scale their own Y.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import type { Tour } from '$lib/tour.svelte';
	import Traveller from './Traveller.svelte';
	import Contours from './Contours.svelte';
	import DetailBubble from './DetailBubble.svelte';
	import HoloPoints from './HoloPoints.svelte';
	import Pins from './Pins.svelte';
	import PlaceLabels from './PlaceLabels.svelte';
	import Rain from './Rain.svelte';
	import Rivers from './Rivers.svelte';
	import Roads from './Roads.svelte';
	import Route from './Route.svelte';
	import Terraces from './Terraces.svelte';

	let { tour }: { tour: Tour } = $props();

	useTask((dt) => {
		tour.advance(Math.min(dt, 0.1));
		tour.imagery.update(tour.bike.x, tour.bike.n);
	});
	$effect(() => tour.imagery.setStyle(tour.mapStyle));
</script>

<T.Group scale.y={tour.exaggeration}>
	{#if tour.layers.points}<HoloPoints {tour} />{/if}
	<Contours {tour} />
	{#if tour.layers.terraces}<Terraces {tour} />{/if}
	{#if tour.layers.detail}<DetailBubble {tour} />{/if}
	{#if tour.layers.water && tour.data.osm}<Rivers osm={tour.data.osm} />{/if}
	{#if tour.layers.roads && tour.data.osm}<Roads osm={tour.data.osm} />{/if}
	{#if tour.layers.route}<Route {tour} />{/if}
</T.Group>

<Traveller {tour} />
{#if tour.layers.weather && tour.data.weather}<Rain {tour} />{/if}
{#if tour.layers.labels && tour.data.osm}<PlaceLabels osm={tour.data.osm} exaggeration={tour.exaggeration} />{/if}
{#if tour.layers.pins}<Pins {tour} />{/if}
