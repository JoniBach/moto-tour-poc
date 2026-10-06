<!--
  Photo / blog / POI / fuel / food pins as DOM labels anchored in 3D.
  Pins light up as the bike reaches them; clicking one opens its card.
-->
<script lang="ts">
	import { T } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { PIN_META } from '$lib/data';
	import { clickThroughControls } from './controls';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();
</script>

{#each tour.data.pins as pin (pin.id)}
	{@const meta = PIN_META[pin.type]}
	{@const reached = tour.rt >= pin.rt}
	{@const active = Math.abs(tour.rt - pin.rt) < 25}
	<T.Group position={[pin.x, pin.h * tour.exaggeration, -pin.n]}>
		<HTML zIndexRange={[50, 0]}>
			<button
				class="pin"
				class:reached
				class:active
				class:selected={tour.selectedPin === pin.id}
				style:--pc-c={meta.color}
				title={pin.title}
				{@attach clickThroughControls}
				onclick={() => {
					// no pop-up card: jump the ride there, and the event banner tells the rest (a route opens its stretch)
					tour.openPin(pin);
				}}
			>
				<span class="head">{meta.icon}</span>
				<span class="stalk"></span>
			</button>
		</HTML>
	</T.Group>
{/each}

<style>
	.pin {
		all: unset;
		cursor: pointer;
		position: absolute;
		transform: translate(-50%, -100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		opacity: 0.45;
		transition: opacity 0.3s;
	}
	.pin.reached {
		opacity: 0.95;
	}
	.pin.active,
	.pin.selected,
	.pin:hover {
		opacity: 1;
	}
	.head {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 14px;
		color: #03070c;
		background: var(--pc-c);
		box-shadow: 0 0 12px var(--pc-c);
		transition: transform 0.2s;
	}
	.pin.active .head,
	.pin.selected .head,
	.pin:hover .head {
		transform: scale(1.3);
	}
	.stalk {
		width: 2px;
		height: 26px;
		background: linear-gradient(var(--pc-c), transparent);
	}
</style>
