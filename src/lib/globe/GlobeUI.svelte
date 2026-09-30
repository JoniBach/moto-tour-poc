<!--
  The globe's deliberately small UI: a play bar (play/pause, speed, the time, the weather, a
  slider through the day) and a little settings card (surface, elevation lines, weather, pins,
  relief). On phones the card opens as the settings sheet.
-->
<script lang="ts">
	import { TOUR } from '$lib/tourConfig';
	import { tempRound, tempUnit } from '$lib/units';
	import { layerAvailable } from '$lib/flagLayers';
	import { weatherAt, weatherLabel } from '$lib/data';
	import type { MapStyle } from '$lib/imagery';
	import { ukClock } from '$lib/time';
	import type { Tour } from '$lib/tour.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import { LEGENDS } from '$lib/colors';
	import { speedShade } from '$lib/config';
	import type { ColorBy } from '$lib/tour.svelte';
	import GlobeBanner from './GlobeBanner.svelte';
	import { parkAt } from './lines';
	import type { Parks } from '$lib/data';
	import { ui } from '$lib/ui.svelte';

	let { tour, parks, originE, originN }: { tour: Tour; parks: Parks | null; originE: number; originN: number } = $props();

	// which national park the bike is in: checked once a second (the outlines are long)
	let park = $state<string | null>(null);
	$effect(() => {
		const check = () => (park = parkAt(parks, tour.bike.x + originE, tour.bike.n + originN));
		check();
		const id = setInterval(check, 1000);
		return () => clearInterval(id);
	});

	let open = $state(globalThis.innerWidth > 1100);
	const surfaces: { id: MapStyle; label: string }[] = [
		{ id: 'hologram', label: 'Plain' },
		{ id: 'satellite', label: 'Satellite' },
		{ id: 'sentinel', label: 'Sentinel-2' },
		{ id: 'topo', label: 'Topo' }
	];
	// the ride's data on the route, as in the 3D view (speed only as a relative shade)
	const colourings: { id: 'plain' | ColorBy; label: string }[] = [
		{ id: 'plain', label: 'Plain' },
		...(speedShade() ? [{ id: 'speed' as const, label: 'Speed' }] : []),
		{ id: 'lean', label: 'Lean' },
		{ id: 'gradient', label: 'Gradient' }
	];
	const toggles: { key: keyof Tour['layers']; label: string }[] = [
		{ key: 'contours', label: 'Elevation lines' },
		{ key: 'route', label: 'Route' },
		{ key: 'roads', label: 'Roads' },
		{ key: 'water', label: 'Rivers and lakes' },
		{ key: 'parks', label: 'National parks' },
		{ key: 'weather', label: 'Weather' },
		{ key: 'labels', label: 'Place names' },
		{ key: 'pins', label: 'Places' },
		{ key: 'photos', label: 'Photos' },
		{ key: 'blog', label: 'Stories' }
	].filter((t) => layerAvailable(t.key)) as { key: keyof Tour['layers']; label: string }[];

	// size: shown live while dragging, applied on release (a new size rebuilds the landscape)
	// svelte-ignore state_referenced_locally — the settings object is shared and fixed; the slider starts from it
	let size = $state(tour.settings.globeRadius);
	const km = (m: number) => `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;

	const clock = $derived(ukClock(tour.bike.time).slice(0, 5));
	const wx = $derived(weatherAt(tour.data.weather, tour.rt));
	const wxText = $derived(wx ? `${weatherLabel(wx.code, wx.isDay).label}, ${tempRound(wx.temp ?? 0)}${tempUnit}` : '');
	const wxIcon = $derived(wx ? weatherLabel(wx.code, wx.isDay).icon : '');
</script>

{#snippet settings()}
	<fieldset>
		<legend>Surface</legend>
		<div class="seg">
			{#each surfaces as s (s.id)}
				<button type="button" aria-pressed={tour.mapStyle === s.id} onclick={() => (tour.mapStyle = s.id)}>{s.label}</button>
			{/each}
		</div>
	</fieldset>
	<fieldset>
		<legend>Route colour</legend>
		<div class="seg">
			{#each colourings as c (c.id)}
				<button type="button" aria-pressed={tour.settings.globeColorBy === c.id} onclick={() => (tour.settings.globeColorBy = c.id)}>{c.label}</button>
			{/each}
		</div>
		{#if tour.settings.globeColorBy !== 'plain'}
			{@const key = LEGENDS[tour.settings.globeColorBy]}
			<div class="key">
				<span>{key.min}</span>
				<span class="ramp" style:background="linear-gradient(to right, {[0, 0.25, 0.5, 0.75, 1].map((t) => key.interp(t)).join(', ')})"></span>
				<span>{key.max}</span>
			</div>
		{/if}
	</fieldset>
	<fieldset>
		<legend>Show</legend>
		{#each toggles as t (t.key)}
			<label class="check"><input type="checkbox" bind:checked={tour.layers[t.key]} /> {t.label}</label>
		{/each}
	</fieldset>
	<label class="check"><input type="checkbox" bind:checked={tour.settings.globeHalo} /> Surroundings</label>
	<label class="relief">
		<span>Size <output>{km(size)} to the rim</output></span>
		<input
			type="range"
			min="800"
			max="6000"
			step="200"
			bind:value={size}
			onchange={() => (tour.settings.globeRadius = size)}
			aria-valuetext="{km(size)} from the centre to the rim"
		/>
	</label>
	<label class="relief">
		<span>Relief <output>{tour.exaggeration.toFixed(1)}×</output></span>
		<input type="range" min="1" max="4" step="0.1" bind:value={tour.exaggeration} />
	</label>
	<p class="hint">Drag to turn the globe · scroll or pinch to zoom · Space to play</p>
{/snippet}

{#if ui.mobile}
	<Sheet open={ui.sheet === 'controls'} title="Globe" onclose={() => (ui.sheet = null)}>
		<div class="card sheet">{@render settings()}</div>
	</Sheet>
{:else}
	<aside class="card side" aria-label="Globe settings">
		<header>
			<h2>{tour.data.track.title}</h2>
			<button type="button" class="more" aria-expanded={open} onclick={() => (open = !open)} aria-label="Globe settings">{open ? '–' : '+'}</button>
		</header>
		{#if open}{@render settings()}{/if}
	</aside>
{/if}

<div class="dock">
{#if park && tour.layers.parks}<p class="park"><span aria-hidden="true">⛰</span> {park} {TOUR.protectedAreas.one}</p>{/if}
<GlobeBanner {tour} />
<div class="play" role="group" aria-label="Playback">
	<button type="button" class="pp" onclick={() => tour.togglePlay()} aria-label={tour.playing ? 'Pause' : 'Play'}>{tour.playing ? '❚❚' : '▶'}</button>
	<select bind:value={tour.rate} aria-label="Playback speed">
		{#each [5, 20, 60, 200] as r (r)}<option value={r}>{r}×</option>{/each}
	</select>
	<span class="clock">{clock}</span>
	{#if wxText}<span class="wx" title={wxText}><span aria-hidden="true">{wxIcon}</span> <span class="wxt">{wxText}</span></span>{/if}
	<input
		class="through"
		type="range"
		min="0"
		max={tour.duration}
		step="1"
		value={tour.rt}
		oninput={(e) => tour.seek(+(e.currentTarget as HTMLInputElement).value)}
		aria-label="Through the day"
		aria-valuetext={clock}
	/>
</div>
</div>

<style>
	.card {
		color: #2c3a45;
		font-size: 14px;
	}
	.side {
		position: absolute;
		z-index: 100;
		top: 16px;
		left: 16px;
		width: 230px;
		padding: 12px 14px;
		border-radius: 16px;
		background: rgb(255 255 255 / 0.72);
		backdrop-filter: blur(10px);
		box-shadow: 0 4px 20px rgb(40 50 70 / 0.12);
	}
	.sheet {
		color: var(--text);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 650;
	}
	.more {
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: inherit;
		font-size: 18px;
		cursor: pointer;
	}
	fieldset {
		margin: 10px 0 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 4px;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.7;
	}
	.seg {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.seg button {
		min-height: 32px;
		padding: 0 9px;
		border: 1px solid rgb(44 58 69 / 0.2);
		border-radius: 8px;
		background: rgb(255 255 255 / 0.6);
		color: inherit;
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}
	.seg button[aria-pressed='true'] {
		border-color: #d9480f;
		background: #fff4ec;
		font-weight: 650;
	}
	.key {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 6px;
		font-size: 11px;
		opacity: 0.8;
	}
	.ramp {
		flex: 1;
		height: 6px;
		border-radius: 3px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 30px;
		cursor: pointer;
	}
	.check input {
		accent-color: #d9480f;
	}
	.relief {
		display: grid;
		gap: 2px;
		margin-top: 10px;
	}
	.relief input,
	.through {
		accent-color: #d9480f;
	}
	.hint {
		margin: 10px 0 0;
		font-size: 12px;
		opacity: 0.7;
	}
	/* the event banner above the play bar, both centred along the bottom */
	.park {
		align-self: flex-start;
		margin: 0;
		padding: 4px 12px;
		border-radius: 999px;
		background: rgb(235 247 238 / 0.85);
		backdrop-filter: blur(8px);
		color: #1f5f32;
		font-size: 13px;
		font-weight: 600;
	}
	.dock {
		position: absolute;
		z-index: 100;
		left: 50%;
		bottom: 18px;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: min(720px, calc(100% - 32px));
	}
	.play {
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		padding: 8px 16px 8px 8px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.75);
		backdrop-filter: blur(10px);
		box-shadow: 0 4px 20px rgb(40 50 70 / 0.12);
		color: #2c3a45;
	}
	.pp {
		flex: none;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: #d9480f;
		color: #fff;
		font-size: 15px;
		cursor: pointer;
	}
	select {
		flex: none;
		min-height: 32px;
		border: 1px solid rgb(44 58 69 / 0.2);
		border-radius: 8px;
		background: transparent;
		color: inherit;
		font: inherit;
	}
	.clock {
		flex: none;
		font-size: 20px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}
	.wx {
		flex: none;
		font-size: 13px;
		opacity: 0.85;
	}
	.through {
		flex: 1;
		min-width: 60px;
	}
	@media (max-width: 900px) {
		.park {
		align-self: flex-start;
		margin: 0;
		padding: 4px 12px;
		border-radius: 999px;
		background: rgb(235 247 238 / 0.85);
		backdrop-filter: blur(8px);
		color: #1f5f32;
		font-size: 13px;
		font-weight: 600;
	}
	.dock {
			bottom: 12px;
		}
		.play {
			gap: 8px;
		}
		.wxt {
			display: none;
		}
	}
</style>
