<!--
  The globe's companion in its corner: the whole day as a small map card, drawn in SVG (no map
  engine: cheap, and it reads better this small). The route, the part ridden in the accent colour,
  the bike with its heading, a ring for the ground the globe covers, north up. Clicking it
  switches to the map view.
-->
<script lang="ts">
	import type { App } from '$lib/app.svelte';
	import type { Tour } from '$lib/tour.svelte';

	let { app, tour }: { app: App; tour: Tour } = $props();

	const SIZE = 100; // viewBox units; the card sets the size on screen
	const PAD = 8;

	// svelte-ignore state_referenced_locally — one tour for the component's lifetime (keyed)
	const tr = tour.data.track;
	const step = Math.max(1, Math.ceil(tr.count / 600));
	let minX = Infinity;
	let maxX = -Infinity;
	let minN = Infinity;
	let maxN = -Infinity;
	for (let i = 0; i < tr.count; i++) {
		minX = Math.min(minX, tr.x[i]);
		maxX = Math.max(maxX, tr.x[i]);
		minN = Math.min(minN, tr.n[i]);
		maxN = Math.max(maxN, tr.n[i]);
	}
	const span = Math.max(maxX - minX, maxN - minN, 1);
	const scale = (SIZE - PAD * 2) / span;
	const ox = PAD + (SIZE - PAD * 2 - (maxX - minX) * scale) / 2;
	const oy = PAD + (SIZE - PAD * 2 - (maxN - minN) * scale) / 2;
	const X = (x: number) => ox + (x - minX) * scale;
	const Y = (n: number) => oy + (maxN - n) * scale;

	// rides as separate paths (never joined across a gap), thinned to ~600 points
	const breaks = new Set(tr.breaks ?? []);
	function path(upTo: number) {
		let d = '';
		for (let i = 0; i < Math.min(upTo, tr.count); i++) {
			if (i % step && !breaks.has(i) && i !== upTo - 1 && i !== tr.count - 1) continue;
			d += `${i === 0 || breaks.has(i) ? 'M' : 'L'}${X(tr.x[i]).toFixed(1)},${Y(tr.n[i]).toFixed(1)}`;
		}
		return d;
	}
	const whole = path(tr.count);
	// only re-drawn as the bike passes each thinned point
	const riddenTo = $derived(Math.min(tr.count, Math.floor(tour.bike.i / step) * step + 1));
	const ridden = $derived(path(riddenTo));

	const bx = $derived(X(tour.bike.x));
	const by = $derived(Y(tour.bike.n));
	const heading = $derived((tour.bike.heading * 180) / Math.PI);
	const reach = $derived(tour.settings.globeRadius * scale);
</script>

<button type="button" class="inset" onclick={() => app.setView('2d')} aria-label="Switch to the map" title="Switch to the map">
	<svg viewBox="0 0 {SIZE} {SIZE}" aria-hidden="true">
		<path d={whole} class="route" />
		<path d={ridden} class="ridden" />
		<circle cx={bx} cy={by} r={reach} class="reach" />
		<g transform="translate({bx} {by}) rotate({heading})">
			<circle r="3.4" class="bike" />
			<path d="M0,-2.4 L1.7,1.6 L0,0.8 L-1.7,1.6 Z" class="arrow" />
		</g>
		<text x={SIZE - 6} y="11" class="north">N</text>
	</svg>
	<span class="label"><span aria-hidden="true">🗺</span> Map</span>
</button>

<style>
	.inset {
		position: absolute;
		z-index: 100;
		top: 84px;
		right: 16px;
		width: 168px;
		height: 168px;
		padding: 0;
		border: 1px solid rgb(44 58 69 / 0.15);
		border-radius: 18px;
		background: rgb(255 255 255 / 0.72);
		backdrop-filter: blur(10px);
		box-shadow: 0 4px 20px rgb(40 50 70 / 0.14);
		cursor: pointer;
		overflow: hidden;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}
	.inset:hover {
		transform: scale(1.03);
		box-shadow: 0 6px 24px rgb(40 50 70 / 0.2);
	}
	.inset:focus-visible {
		outline: 3px solid #1c7ed6;
		outline-offset: 2px;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.route {
		fill: none;
		stroke: #9aa7b1;
		stroke-width: 1.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.ridden {
		fill: none;
		stroke: #d9480f;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.reach {
		fill: rgb(217 72 15 / 0.08);
		stroke: rgb(217 72 15 / 0.45);
		stroke-width: 0.6;
		stroke-dasharray: 1.5 1.5;
	}
	.bike {
		fill: #0b7285;
		stroke: #fff;
		stroke-width: 1;
	}
	.arrow {
		fill: #fff;
	}
	.north {
		font: 700 7px system-ui, sans-serif;
		fill: #56656f;
		text-anchor: middle;
	}
	.label {
		position: absolute;
		left: 8px;
		bottom: 6px;
		font-size: 11px;
		font-weight: 650;
		color: #2c3a45;
	}
	@media (max-width: 900px) {
		/* phones: the right side is the button strip */
		.inset {
			top: calc(env(safe-area-inset-top) + 76px);
			left: 8px;
			right: auto;
			width: 112px;
			height: 112px;
			border-radius: 14px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.inset {
			transition: none;
		}
		.inset:hover {
			transform: none;
		}
	}
</style>
