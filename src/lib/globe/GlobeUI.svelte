<!--
  The globe's deliberately small UI: a card for the day (its stamp, title, date and facts) with a
  "customise" drawer (surface, route colour, what to show as toggle chips, size, relief), and
  along the bottom the park you're in, the latest moment and a play bar (play/pause, speed, the
  time, the weather, a slider through the day). On phones the drawer is the settings sheet.
-->
<script lang="ts">
	import Icon from '$lib/ui/Icon.svelte';
	import { A, cap } from '$lib/activity';
	import { TOUR } from '$lib/tourConfig';
	import { tempRound, tempUnit } from '$lib/units';
	import { layerAvailable } from '$lib/flagLayers';
	import { weatherAt, weatherLabel } from '$lib/data';
	import type { MapStyle } from '$lib/imagery';
	import { tourClock } from '$lib/time';
	import type { Tour } from '$lib/tour.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import { LEGENDS } from '$lib/colors';
	import { speedShade } from '$lib/config';
	import type { ColorBy } from '$lib/tour.svelte';
	import GlobeBanner from './GlobeBanner.svelte';
	import NowPlaying from '$lib/ui/NowPlaying.svelte';
	import { parkAt } from './lines';
	import type { Parks } from '$lib/data';
	import { ui } from '$lib/ui.svelte';
	import DayCard from '$lib/ui/DayCard.svelte';
	import RangeSlider from '$lib/ui/RangeSlider.svelte';
	import { FOG_GAP, FOG_MAX, FOG_MIN } from '$lib/settings.svelte';

	let { tour, parks, originE, originN }: { tour: Tour; parks: Parks | null; originE: number; originN: number } = $props();

	// which national park the bike is in: checked once a second (the outlines are long)
	let park = $state<string | null>(null);
	$effect(() => {
		const check = () => (park = parkAt(parks, tour.bike.x + originE, tour.bike.n + originN));
		check();
		const id = setInterval(check, 1000);
		return () => clearInterval(id);
	});

	// how far through the day, for the slider's filled track
	const progress = $derived(tour.duration ? (tour.rt / tour.duration) * 100 : 0);

	const surfaces: { id: MapStyle; label: string }[] = [
		{ id: 'hologram', label: 'Painted' },
		{ id: 'satellite', label: 'Satellite' },
		{ id: 'sentinel', label: 'Sentinel-2' },
		{ id: 'topo', label: 'Topo' }
	];
	// the ride's data on the route (speed only as a relative shade)
	const colourings: { id: 'plain' | ColorBy; label: string }[] = [
		{ id: 'plain', label: 'Plain' },
		...(speedShade() ? [{ id: 'speed' as const, label: 'Speed' }] : []),
		...(A.leans ? [{ id: 'lean' as const, label: 'Lean' }] : []),
		{ id: 'gradient', label: 'Gradient' }
	];
	const toggles: { key: keyof Tour['layers']; label: string }[] = [
		{ key: 'contours', label: 'Elevation lines' },
		{ key: 'route', label: 'Route' },
		{ key: 'roads', label: 'Roads' },
		{ key: 'water', label: 'Water' },
		{ key: 'parks', label: 'Parks' },
		{ key: 'weather', label: 'Weather' },
		{ key: 'labels', label: 'Place names' },
		{ key: 'pins', label: 'Places' },
		{ key: 'photos', label: 'Photos' },
		{ key: 'blog', label: 'Stories' }
	].filter((t) => layerAvailable(t.key)) as { key: keyof Tour['layers']; label: string }[];

	// size: shown live while dragging, applied on release (a new size rebuilds the landscape)
	// svelte-ignore state_referenced_locally — the settings object is shared and fixed; the slider starts from it
	let size = $state(tour.settings.globeRadius);
	// follow the setting when it changes elsewhere (the reset button, a URL on load)
	$effect(() => {
		size = tour.settings.globeRadius;
	});
	// the fog: the inner edge applies live; the outer one (it rebuilds the surroundings) on release
	// svelte-ignore state_referenced_locally
	let fogOut = $state(tour.settings.fogOut);
	$effect(() => {
		fogOut = tour.settings.fogOut;
	});
	const fogKm = (k: number) => km(k * tour.settings.globeRadius);
	const km = (m: number) => `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;

	const clock = $derived(tourClock(tour.bike.time).slice(0, 5));
	const wx = $derived(weatherAt(tour.data.weather, tour.rt));
	const wxText = $derived(wx ? `${weatherLabel(wx.code, wx.isDay).label}, ${tempRound(wx.temp ?? 0)}${tempUnit}` : '');
	const wxIcon = $derived(wx ? weatherLabel(wx.code, wx.isDay).icon : '');
</script>

{#snippet settings()}
	<fieldset class="pc-knobs">
		<legend>Surface</legend>
		<div class="pc-pills">
			{#each surfaces as s (s.id)}
				<button type="button" aria-pressed={tour.mapStyle === s.id} onclick={() => (tour.mapStyle = s.id)}>{s.label}</button>
			{/each}
		</div>
	</fieldset>
	<fieldset class="pc-knobs">
		<legend>Route colour</legend>
		<div class="pc-pills">
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
	<fieldset class="pc-knobs">
		<legend>Show</legend>
		<div class="pc-chips">
			{#each toggles as t (t.key)}
				<label class="pc-chip"><input type="checkbox" bind:checked={tour.layers[t.key]} /><span class="pc-chip__tick" aria-hidden="true"></span>{t.label}</label>
			{/each}
			<label class="pc-chip"><input type="checkbox" bind:checked={tour.settings.globeHalo} /><span class="pc-chip__tick" aria-hidden="true"></span>Surroundings</label>
		</div>
	</fieldset>
	<label class="pc-slider">
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
	<label class="pc-slider">
		<span>Relief <output>{tour.exaggeration.toFixed(1)}×</output></span>
		<input type="range" min="1" max="4" step="0.1" bind:value={tour.exaggeration} />
	</label>
	{#if tour.settings.globeHalo}
		<div class="pc-slider">
			<span>Surroundings <output>from {fogKm(tour.settings.fogIn)} · gone by {fogKm(fogOut)}</output></span>
			<RangeSlider
				min={FOG_MIN}
				max={FOG_MAX}
				step={0.05}
				gap={FOG_GAP}
				bind:lo={tour.settings.fogIn}
				bind:hi={fogOut}
				loLabel="Inner edge: the surroundings begin at"
				hiLabel="Outer fog: the surroundings have faded out by"
				loText="{fogKm(tour.settings.fogIn)} from the centre"
				hiText="{fogKm(fogOut)} from the centre"
				onhicommit={(v) => (tour.settings.fogOut = v)}
			/>
		</div>
	{/if}
	<label class="pc-slider">
		<span>{cap(A.mover.replace(/^the /, ''))} size <output>{tour.settings.vehicleScale.toFixed(1)}×</output></span>
		<input type="range" min="0.5" max="3" step="0.1" bind:value={tour.settings.vehicleScale} />
	</label>
	<div class="reset-row">
		<button type="button" class="reset" disabled={!tour.settings.globeCustomised} onclick={() => tour.settings.resetGlobe()}>
			<Icon name="reset" size="sm" /> Reset to the defaults
		</button>
	</div>
	<p class="hint">Drag to turn the globe · scroll or pinch to zoom · Space to play. Your choices stay in the page's address, so a refresh or a shared link keeps them.</p>
{/snippet}

{#if ui.mobile}
	<Sheet open={ui.sheet === 'controls'} title="Customise the globe" onclose={() => (ui.sheet = null)}>
		{@render settings()}
	</Sheet>
{:else}
	<DayCard {tour} customise="Customise the globe">{@render settings()}</DayCard>
{/if}

<div class="dock">
	<!-- the park on the left, the music on the right -->
	<div class="row">
		{#if park && tour.layers.parks}<p class="park"><Icon name="mountain" size="sm" /> {park} {TOUR.protectedAreas.one}</p>{/if}
		<NowPlaying {tour} pill={!ui.compact} />
	</div>
	<GlobeBanner {tour} music={ui.compact} />
	<div class="play" role="group" aria-label="Playback">
		<button type="button" class="pp" class:playing={tour.playing} onclick={() => tour.togglePlay()} aria-label={tour.playing ? 'Pause' : 'Play'}
			><Icon name={tour.playing ? 'pause' : 'play'} /></button
		>
		<button type="button" class="cut" onclick={() => tour.pickStretch()} aria-label="Share a stretch" title="Choose a stretch to share, with a GPX to ride it"><Icon name="scissors" /></button>
		<select bind:value={tour.rate} aria-label="Playback speed">
			{#each [5, 20, 60, 200] as r (r)}<option value={r}>{r}×</option>{/each}
		</select>
		<span class="clock pc-display">{clock}</span>
		{#if wxText}<span class="wx" title={wxText}><span aria-hidden="true">{wxIcon}</span> <span class="wxt">{wxText}</span></span>{/if}
		<input
			class="through"
			style:--p="{progress}%"
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
	.key {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		font-size: 11px;
		color: var(--pc-muted);
	}
	.ramp {
		flex: 1;
		height: 8px;
		border-radius: 4px;
	}
	.cut {
		flex: none;
		width: 36px;
		height: 36px;
		border: 1px dashed var(--pc-line);
		border-radius: 50%;
		background: transparent;
		color: var(--pc-ink);
		font-size: 15px;
		cursor: pointer;
	}
	.reset-row {
		margin-top: 14px;
	}
	.reset {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 36px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: var(--pc-card);
		color: var(--pc-ink);
		font: inherit;
		font-size: 13px;
		font-weight: 650;
		cursor: pointer;
		box-shadow:
			var(--pc-press),
			0 0 0 1px var(--pc-line);
	}
	.reset:hover:not(:disabled) {
		background: var(--pc-accent-soft);
	}
	.reset:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.hint {
		margin: 12px 0 0;
		font-size: 12px;
		color: var(--pc-muted);
	}
	/* the park, the latest moment and the play bar, centred along the bottom */
	.row {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		min-width: 0;
	}
	.row:empty {
		display: none;
	}
	.park {
		flex: none;
		align-self: flex-end;
		margin: 0;
		padding: 5px 14px;
		border-radius: 999px;
		background: var(--pc-sage);
		color: var(--pc-sage-ink);
		font-size: 13px;
		font-weight: 700;
		box-shadow: var(--pc-press);
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
		gap: 14px;
		box-sizing: border-box;
		padding: 8px 20px 8px 8px;
		border-radius: 999px;
		background: var(--pc-glass);
		backdrop-filter: blur(12px);
		box-shadow:
			var(--pc-shadow),
			0 0 0 1px var(--pc-line);
		color: var(--pc-ink);
	}
	.pp {
		flex: none;
		width: 52px;
		height: 52px;
		border: 0;
		border-radius: 50%;
		background: var(--pc-accent);
		color: var(--pc-on-accent);
		font-size: 17px;
		cursor: pointer;
		box-shadow: 0 4px 0 var(--pc-accent-deep);
		transition: transform 0.1s ease;
	}
	.pp:active {
		transform: translateY(3px);
		box-shadow: 0 1px 0 var(--pc-accent-deep);
	}
	.pp.playing {
		background: var(--pc-ink);
		box-shadow: 0 4px 0 #000;
	}
	select {
		flex: none;
		min-height: 34px;
		padding: 0 8px;
		border: 0;
		border-radius: 999px;
		background: var(--pc-card);
		color: inherit;
		font: inherit;
		font-weight: 650;
		box-shadow: 0 0 0 1px var(--pc-line);
	}
	.clock {
		flex: none;
		font-size: 24px;
		font-variant-numeric: tabular-nums;
	}
	.wx {
		flex: none;
		font-size: 13px;
		color: var(--pc-muted);
	}
	/* the slider through the day: a fat rounded track, filled up to the moment on screen */
	.through {
		flex: 1;
		min-width: 60px;
		height: 22px;
		margin: 0;
		background: none;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
	}
	.through::-webkit-slider-runnable-track {
		height: 10px;
		border-radius: 5px;
		background: linear-gradient(to right, var(--pc-accent) var(--p), color-mix(in srgb, var(--pc-ink) 14%, transparent) var(--p));
	}
	.through::-moz-range-track {
		height: 10px;
		border-radius: 5px;
		background: linear-gradient(to right, var(--pc-accent) var(--p), color-mix(in srgb, var(--pc-ink) 14%, transparent) var(--p));
	}
	.through::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 22px;
		height: 22px;
		margin-top: -6px;
		border-radius: 50%;
		background: #fff;
		box-shadow:
			0 0 0 3px var(--pc-accent),
			0 2px 4px rgb(0 0 0 / 0.2);
	}
	.through::-moz-range-thumb {
		width: 22px;
		height: 22px;
		border: 0;
		border-radius: 50%;
		background: #fff;
		box-shadow:
			0 0 0 3px var(--pc-accent),
			0 2px 4px rgb(0 0 0 / 0.2);
	}
	@media (max-width: 900px) {
		.dock {
			bottom: 12px;
		}
		.play {
			gap: 8px;
			padding-right: 14px;
		}
		.pp {
			width: 46px;
			height: 46px;
		}
		.clock {
			font-size: 20px;
		}
		.wxt {
			display: none;
		}
	}
</style>
