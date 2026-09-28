<script lang="ts">
	import { clock, PIN_META } from '$lib/data';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();
	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const tr = tour.data.track;
	const pin = $derived(tour.data.pins.find((p) => p.id === tour.selectedPin));
</script>

{#if pin}
	{@const meta = PIN_META[pin.type]}
	<article class="card" style:--c={meta.color}>
		<header>
			<span class="badge">{meta.icon} {meta.label}</span>
			<button class="close" onclick={() => (tour.selectedPin = null)} aria-label="Close">×</button>
		</header>
		<h3>{pin.title}</h3>
		<p class="when">{clock(tr.t0 + tr.t[pin.i])} · {(tr.dist[pin.i] / 1609.34).toFixed(1)} mi in</p>
		{#if pin.type === 'photo'}
			<div class="photo">photo thumbnail goes here</div>
		{/if}
		<p>{pin.body}</p>
		<footer>
			<small>Placed by {pin.placedBy === 'gps' ? 'GPS position' : 'timestamp against the track'}</small>
			<button
				onclick={() => {
					tour.seek(pin.rt);
					tour.camera = 'follow';
				}}>Ride here</button
			>
		</footer>
	</article>
{/if}

<style>
	.card {
		position: absolute;
		z-index: 100;
		top: 16px;
		right: 16px;
		width: 290px;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-top: 3px solid var(--c);
		border-radius: 14px;
		background: var(--glass);
		backdrop-filter: blur(10px);
		color: var(--text);
		font-size: 13px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.badge {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--c);
	}
	.close {
		all: unset;
		cursor: pointer;
		font-size: 18px;
		color: var(--muted);
	}
	h3 {
		margin: 6px 0 2px;
		font-size: 16px;
	}
	.when {
		margin: 0 0 8px;
		font-size: 11px;
		color: var(--muted);
	}
	.photo {
		display: grid;
		place-items: center;
		height: 140px;
		border-radius: 8px;
		border: 1px dashed var(--line);
		color: var(--muted);
		font-size: 11px;
	}
	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}
	footer small {
		color: var(--muted);
		font-size: 10px;
	}
	footer button {
		all: unset;
		cursor: pointer;
		padding: 4px 10px;
		border-radius: 8px;
		background: var(--accent-soft);
		font-size: 12px;
		white-space: nowrap;
	}
	@media (max-width: 700px) {
		.card {
			top: auto;
			bottom: 200px;
			left: 16px;
			right: 16px;
			width: auto;
		}
	}
</style>
