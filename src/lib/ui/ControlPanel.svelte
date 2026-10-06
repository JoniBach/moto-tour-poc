<!--
  The map and 3D views' settings, in the day's card (DayCard) on desktop and a sheet on phones:
  camera, surface, route colour and the terrain sliders (3D only), then which layers to show.
-->
<script lang="ts">
	import { A } from '$lib/activity';
	import { TOUR } from '$lib/tourConfig';
	import { layerAvailable } from '$lib/flagLayers';
	import { speedShade } from '$lib/config';
	import type { MapStyle } from '$lib/imagery';
	import type { CameraMode, ColorBy, Tour } from '$lib/tour.svelte';
	import { ui } from '$lib/ui.svelte';
	import Sheet from './Sheet.svelte';
	import DayCard from './DayCard.svelte';

	/** flat: the 2D map, which has no camera, terrain or point cloud to tune */
	let { tour, flat = false }: { tour: Tour; flat?: boolean } = $props();
	const tr = $derived(tour.data.track);
	const date = $derived(
		new Date(tr.t0 * 1000).toLocaleDateString(TOUR.locale, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: TOUR.timeZone
		})
	);

	const cameras: { id: CameraMode; label: string }[] = [
		{ id: 'follow', label: 'Follow' },
		{ id: 'chase', label: 'Chase' },
		{ id: 'overview', label: 'Overview' },
		{ id: 'free', label: 'Free' }
	];
	const mapStyles: { id: MapStyle; label: string }[] = [
		{ id: 'hologram', label: 'Hologram' },
		{ id: 'satellite', label: 'Satellite' },
		{ id: 'sentinel', label: 'Sentinel-2' },
		{ id: 'topo', label: 'Topo' }
	];
	const colorModes: { id: ColorBy; label: string }[] = [
		...(speedShade() ? [{ id: 'speed' as const, label: 'Speed' }] : []),
		...(A.leans ? [{ id: 'lean' as const, label: 'Lean' }] : []),
		{ id: 'gradient', label: 'Gradient' }
	];
	// what the flat map draws
	const FLAT_LAYERS = ['route', 'parks', 'photos', 'blog', 'pins'];
	const layerLabels: Record<keyof Tour['layers'], string> = {
		points: 'Hologram points',
		contours: 'Contour rings',
		terraces: 'Solid terraces',
		detail: `Detail around ${A.mover}`,
		route: 'Route',
		roads: 'Roads (OSM)',
		water: 'Lakes & rivers',
		parks: 'Parks',
		photos: 'Photos',
		blog: 'Stories',
		backdropPoints: 'Backdrop points',
		weather: 'Weather (rain)',
		labels: 'Place names',
		pins: 'Pins',
		gpsAltitude: 'Raw GPS altitude'
	};
</script>

{#snippet controls()}
	{#if !flat}
		<fieldset class="pc-knobs">
			<legend>Camera</legend>
			<div class="pc-pills">
				{#each cameras as c (c.id)}
					<button type="button" aria-pressed={tour.camera === c.id} onclick={() => (tour.camera = c.id)}>{c.label}</button>
				{/each}
			</div>
		</fieldset>
		<fieldset class="pc-knobs">
			<legend>Surface</legend>
			<div class="pc-pills">
				{#each mapStyles as m (m.id)}
					<button type="button" aria-pressed={tour.mapStyle === m.id} onclick={() => (tour.mapStyle = m.id)}>{m.label}</button>
				{/each}
			</div>
		</fieldset>
		<fieldset class="pc-knobs">
			<legend>Route colour</legend>
			<div class="pc-pills">
				{#each colorModes as c (c.id)}
					<button type="button" aria-pressed={tour.colorBy === c.id} onclick={() => (tour.colorBy = c.id)}>{c.label}</button>
				{/each}
			</div>
		</fieldset>
		<label class="pc-slider"><span>Vertical exaggeration <output>{tour.exaggeration.toFixed(1)}×</output></span>
			<input type="range" min="1" max="5" step="0.1" bind:value={tour.exaggeration} /></label>
		<label class="pc-slider"><span>Detail radius <output>{(tour.bubble / 1000).toFixed(1)} km</output></span>
			<input type="range" min="600" max="2800" step="100" bind:value={tour.bubble} /></label>
		<label class="pc-slider"><span>Terrain radius <output>{(tour.horizon / 1000).toFixed(0)} km</output></span>
			<input type="range" min="4000" max="60000" step="1000" bind:value={tour.horizon} /></label>
		<label class="pc-slider"><span>Point size <output>{tour.pointSize.toFixed(1)}×</output></span>
			<input type="range" min="0.5" max="4" step="0.1" bind:value={tour.pointSize} /></label>
		<label class="pc-slider"><span>Point density <output>{tour.pointDensity.toFixed(1)}×</output></span>
			<input type="range" min="0.4" max="2.5" step="0.1" bind:value={tour.pointDensity} /></label>
		<label class="pc-slider"><span>Point glow <output>{tour.pointGlow.toFixed(1)}×</output></span>
			<input type="range" min="0.4" max="3" step="0.1" bind:value={tour.pointGlow} /></label>
	{/if}
	<fieldset class="pc-knobs">
		<legend>Show</legend>
		<div class="pc-chips">
			{#each Object.keys(layerLabels).filter((k) => (!flat || FLAT_LAYERS.includes(k)) && layerAvailable(k)) as key (key)}
				{@const k = key as keyof Tour['layers']}
				<label class="pc-chip"><input type="checkbox" bind:checked={tour.layers[k]} /><span class="pc-chip__tick" aria-hidden="true"></span>{layerLabels[k]}</label>
			{/each}
		</div>
	</fieldset>
	{#if !ui.mobile}<p class="hint">Space: play/pause · ←/→: skip 30 s · drag to {flat ? 'move' : 'orbit'}</p>{/if}
{/snippet}

{#if ui.mobile}
	<Sheet open={ui.sheet === 'controls'} title={flat ? 'Customise the map' : 'Customise the view'} onclose={() => (ui.sheet = null)}>
		<p class="sheet-day">{tr.title} · {date}</p>
		{@render controls()}
	</Sheet>
{:else}
	<DayCard {tour} customise={flat ? 'Customise the map' : 'Customise the view'}>{@render controls()}</DayCard>
{/if}

<style>
	.hint {
		margin: 12px 0 0;
		font-size: 12px;
		color: var(--pc-muted);
	}
	.sheet-day {
		margin: 0 0 4px;
		font-size: 13px;
		color: var(--pc-muted);
		text-align: center;
	}
</style>
