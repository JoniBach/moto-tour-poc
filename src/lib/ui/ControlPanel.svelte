<script lang="ts">
	import { speedShade } from '$lib/config';
	import type { MapStyle } from '$lib/imagery';
	import type { CameraMode, ColorBy, Tour } from '$lib/tour.svelte';
	import { ui } from '$lib/ui.svelte';
	import Sheet from './Sheet.svelte';

	let { tour }: { tour: Tour } = $props();
	// start collapsed on tablets, where it would cover much of the map
	let open = $state(globalThis.innerWidth > 1100);
	const tr = $derived(tour.data.track);
	const date = $derived(
		new Date(tr.t0 * 1000).toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'Europe/London'
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
		{ id: 'lean', label: 'Lean' },
		{ id: 'gradient', label: 'Gradient' }
	];
	const layerLabels: Record<keyof Tour['layers'], string> = {
		points: 'Hologram points',
		contours: 'Contour rings',
		terraces: 'Solid terraces',
		detail: 'Detail around bike',
		route: 'Route',
		roads: 'Roads (OSM)',
		water: 'Lakes & rivers',
		parks: 'National parks',
		photos: 'Photos',
		blog: 'Blog posts',
		ukPoints: 'UK backdrop points',
		weather: 'Weather (rain)',
		labels: 'Place names',
		pins: 'Pins',
		gpsAltitude: 'Raw GPS altitude'
	};
</script>

{#snippet controls()}
	<section>
		<h2>Camera</h2>
		<div class="seg">
			{#each cameras as c (c.id)}
				<button class:on={tour.camera === c.id} onclick={() => (tour.camera = c.id)}>{c.label}</button>
			{/each}
		</div>
	</section>

	<section>
		<h2>Map style</h2>
		<div class="seg">
			{#each mapStyles as m (m.id)}
				<button class:on={tour.mapStyle === m.id} onclick={() => (tour.mapStyle = m.id)}>{m.label}</button>
			{/each}
		</div>
	</section>

	<section>
		<h2>Colour route by</h2>
		<div class="seg">
			{#each colorModes as c (c.id)}
				<button class:on={tour.colorBy === c.id} onclick={() => (tour.colorBy = c.id)}>{c.label}</button>
			{/each}
		</div>
	</section>

	<section>
		<h2>Vertical exaggeration <output>{tour.exaggeration.toFixed(1)}×</output></h2>
		<input type="range" min="1" max="5" step="0.1" bind:value={tour.exaggeration} />
		<h2>Detail radius <output>{(tour.bubble / 1000).toFixed(1)} km</output></h2>
		<input type="range" min="600" max="2800" step="100" bind:value={tour.bubble} />
		<h2>Terrain radius <output>{(tour.horizon / 1000).toFixed(0)} km</output></h2>
		<input type="range" min="4000" max="60000" step="1000" bind:value={tour.horizon} />
		<h2>Point size <output>{tour.pointSize.toFixed(1)}×</output></h2>
		<input type="range" min="0.5" max="4" step="0.1" bind:value={tour.pointSize} />
		<h2>Point density <output>{tour.pointDensity.toFixed(1)}×</output></h2>
		<input type="range" min="0.4" max="2.5" step="0.1" bind:value={tour.pointDensity} />
		<h2>Point glow <output>{tour.pointGlow.toFixed(1)}×</output></h2>
		<input type="range" min="0.4" max="3" step="0.1" bind:value={tour.pointGlow} />
	</section>

	<section>
		<h2>Layers</h2>
		<div class="layers">
			{#each Object.keys(layerLabels) as key (key)}
				{@const k = key as keyof Tour['layers']}
				<label class="check"><input type="checkbox" bind:checked={tour.layers[k]} /> {layerLabels[k]}</label>
			{/each}
		</div>
	</section>

	{#if !ui.mobile}<p class="hint">Space: play/pause · ←/→: skip 30 s · drag to orbit</p>{/if}
{/snippet}

{#if ui.mobile}
	<Sheet open={ui.sheet === 'controls'} title="Map & view" onclose={() => (ui.sheet = null)}>
		<div class="touch">
			<p class="sheet-day">{tr.title} · {date}</p>
			{@render controls()}
		</div>
	</Sheet>
{:else}
	<aside class="panel scroll-y" class:open>
		<header>
			<div>
				<h1>{tr.title}</h1>
				<p>{date} · {(tr.dist[tr.count - 1] / 1609.34).toFixed(0)} mi</p>
			</div>
			<button class="toggle" onclick={() => (open = !open)} aria-expanded={open} aria-label="Toggle controls">
				{open ? '–' : '+'}
			</button>
		</header>
		{#if open}{@render controls()}{/if}
	</aside>
{/if}

<style>
	.panel {
		position: absolute;
		z-index: 100;
		top: 16px;
		left: 16px;
		width: 250px;
		max-height: calc(100% - 200px);
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--glass);
		backdrop-filter: blur(10px);
		color: var(--text);
		font-size: 13px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}
	h1 {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
		color: var(--accent);
	}
	header p {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 11px;
	}
	.toggle {
		all: unset;
		cursor: pointer;
		width: 22px;
		text-align: center;
		color: var(--muted);
		font-size: 18px;
	}
	section {
		margin-top: 14px;
	}
	h2 {
		display: flex;
		justify-content: space-between;
		margin: 8px 0 6px;
		font-size: 10px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted);
	}
	output {
		color: var(--text);
	}
	.seg {
		display: flex;
		border: 1px solid var(--line);
		border-radius: 8px;
		overflow: hidden;
	}
	.seg button {
		all: unset;
		cursor: pointer;
		flex: 1;
		text-align: center;
		padding: 5px 0;
		font-size: 12px;
		color: var(--muted);
	}
	.seg button.on {
		background: var(--accent-soft);
		color: var(--text);
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 2px 0;
		cursor: pointer;
	}
	.check input {
		accent-color: var(--accent);
	}
	.hint {
		margin: 14px 0 0;
		font-size: 11px;
		color: var(--muted);
	}
	/* phone sheet: finger-sized targets */
	.sheet-day {
		margin: 0 0 4px;
		font-size: 12px;
		color: var(--muted);
		text-align: center;
	}
	.touch .seg button {
		padding: 11px 0;
		font-size: 13px;
	}
	.touch h2 {
		font-size: 11px;
		margin-top: 14px;
	}
	.touch input[type='range'] {
		height: 28px;
	}
	.touch .layers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		column-gap: 10px;
	}
	.touch .check {
		padding: 9px 0;
		font-size: 13px;
	}
	.touch .check input {
		width: 20px;
		height: 20px;
	}
</style>
