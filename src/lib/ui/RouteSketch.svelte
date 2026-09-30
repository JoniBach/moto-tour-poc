<!--
  A day's route sketch (src/lib/sketch.ts): the line in the day's colour, a hollow start, a solid
  finish, and a pulsing dot for a moment when there is one. Decorative unless given a label.
-->
<script lang="ts">
	import type { Sketch } from '$lib/sketch';

	let { s, color, label, width = 3.5 }: { s: Sketch; color: string; label?: string; width?: number } = $props();
</script>

<svg class="sketch" viewBox="0 0 100 100" style:--c={color} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
	{#each s.paths as p, i (i)}<path d={p} stroke-width={width} />{/each}
	{#if s.start}<circle class="start" cx={s.start[0]} cy={s.start[1]} r={width * 0.95} />{/if}
	{#if s.end}<circle class="end" cx={s.end[0]} cy={s.end[1]} r={width * 0.95} />{/if}
	{#if s.dot}
		<circle class="halo" cx={s.dot[0]} cy={s.dot[1]} r={width * 2.6} />
		<circle class="dot" cx={s.dot[0]} cy={s.dot[1]} r={width * 1.3} />
	{/if}
</svg>

<style>
	.sketch {
		display: block;
		width: 100%;
		height: 100%;
	}
	path {
		fill: none;
		stroke: var(--c);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.start {
		fill: #fff;
		stroke: #263238;
		stroke-width: 1.8;
	}
	.end {
		fill: #263238;
	}
	.dot {
		fill: #c2562d;
		stroke: #fff;
		stroke-width: 1.5;
	}
	.halo {
		fill: #c2562d;
		opacity: 0.25;
		animation: pulse 2.4s ease-in-out infinite;
		transform-box: fill-box;
		transform-origin: center;
	}
	@keyframes pulse {
		50% {
			transform: scale(1.5);
			opacity: 0.08;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.halo {
			animation: none;
		}
	}
</style>
