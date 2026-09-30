<!--
  A two-handle range slider: two native range inputs laid over one track (each keeps its own
  keyboard control and label), kept at least `gap` apart. The track shows the band between the
  handles, with soft ends (fog) outside it. `lo` updates as it moves; `hi` too, and `onhicommit`
  fires when that handle is let go (for changes that are costly to apply while dragging).
-->
<script lang="ts">
	let {
		min,
		max,
		step,
		gap = step,
		lo = $bindable(),
		hi = $bindable(),
		loLabel,
		hiLabel,
		loText,
		hiText,
		onhicommit
	}: {
		min: number;
		max: number;
		step: number;
		gap?: number;
		lo: number;
		hi: number;
		loLabel: string;
		hiLabel: string;
		loText?: string;
		hiText?: string;
		onhicommit?: (v: number) => void;
	} = $props();

	const pct = (v: number) => ((v - min) / (max - min)) * 100;
	const snap = (v: number) => Math.round(v / step) * step;
</script>

<div class="range" style:--lo="{pct(lo)}%" style:--hi="{pct(hi)}%">
	<div class="track" aria-hidden="true"><span class="band"></span></div>
	<input
		type="range"
		{min}
		{max}
		{step}
		value={lo}
		aria-label={loLabel}
		aria-valuetext={loText}
		oninput={(e) => (lo = Math.min(snap(+(e.currentTarget as HTMLInputElement).value), hi - gap))}
		onchange={(e) => ((e.currentTarget as HTMLInputElement).value = String(lo))}
	/>
	<input
		type="range"
		{min}
		{max}
		{step}
		value={hi}
		aria-label={hiLabel}
		aria-valuetext={hiText}
		oninput={(e) => (hi = Math.max(snap(+(e.currentTarget as HTMLInputElement).value), lo + gap))}
		onchange={(e) => {
			(e.currentTarget as HTMLInputElement).value = String(hi);
			onhicommit?.(hi);
		}}
	/>
</div>

<style>
	.range {
		position: relative;
		height: 28px;
	}
	.track {
		position: absolute;
		left: 11px;
		right: 11px;
		top: 50%;
		height: 10px;
		margin-top: -5px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		overflow: hidden;
	}
	/* the clear band between the fogs, fading in and out at its ends */
	.band {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to right,
			transparent 0,
			transparent calc(var(--lo) - 8%),
			var(--accent) var(--lo),
			var(--accent) calc(var(--hi) - 6%),
			transparent var(--hi)
		);
	}
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		background: none;
		appearance: none;
		-webkit-appearance: none;
		pointer-events: none;
	}
	input::-webkit-slider-runnable-track {
		background: none;
	}
	input::-webkit-slider-thumb {
		-webkit-appearance: none;
		pointer-events: auto;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #fff;
		box-shadow:
			0 0 0 3px var(--accent),
			0 2px 4px rgb(0 0 0 / 0.2);
		cursor: grab;
	}
	input::-moz-range-track {
		background: none;
	}
	input::-moz-range-thumb {
		pointer-events: auto;
		width: 22px;
		height: 22px;
		border: 0;
		border-radius: 50%;
		background: #fff;
		box-shadow:
			0 0 0 3px var(--accent),
			0 2px 4px rgb(0 0 0 / 0.2);
		cursor: grab;
	}
	input:focus-visible {
		outline: none;
	}
	input:focus-visible::-webkit-slider-thumb {
		box-shadow:
			0 0 0 3px var(--accent),
			0 0 0 7px color-mix(in srgb, var(--accent) 35%, transparent);
	}
	input:focus-visible::-moz-range-thumb {
		box-shadow:
			0 0 0 3px var(--accent),
			0 0 0 7px color-mix(in srgb, var(--accent) 35%, transparent);
	}
</style>
