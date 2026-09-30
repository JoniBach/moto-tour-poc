<!--
  The globe's event line: one thin banner above the play bar naming the latest moment the ride
  has passed (set off, a break, a place, photos, a story), with a small thumbnail at its right-hand
  end when there's a picture. Calm on purpose: each new event fades in where the last one was;
  nothing slides or covers the globe. Photos and stories open on click (and pause the ride).
-->
<script lang="ts">
	import { photoSrc } from '$lib/tourConfig';
	import { fade } from 'svelte/transition';
	import { app } from '$lib/app.svelte';
	import { clock, photoUrl } from '$lib/data';
	import { dayEvents, eventLabel, type TourEvent } from '$lib/events';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();

	// svelte-ignore state_referenced_locally — one tour for the component's lifetime
	const events = dayEvents(tour.data.track, tour.data.pins, tour.photos, tour.posts);

	const shown = (e: TourEvent) =>
		e.kind === 'photos' ? tour.layers.photos : e.kind === 'post' ? tour.layers.blog : e.kind === 'pin' ? tour.layers.pins : true;

	/**
	 * The latest event at or before the bike's moment, by the clock: riding time skips stops, so
	 * during a long stop it already equals the next ride's start, which isn't the moment yet.
	 */
	const current = $derived.by(() => {
		const now = tour.bike.time + 1;
		let last: TourEvent | null = null;
		for (const e of events) {
			if (e.t > now) break;
			if (shown(e)) last = e;
		}
		return last;
	});
	const key = $derived(current ? `${current.kind}${current.t}` : '');
	const label = $derived(current ? eventLabel(current) : null);
	const thumb = $derived(
		current?.kind === 'photos'
			? photoUrl(current.photos[0], 'thumb')
			: current?.kind === 'post' && current.post.cover
				? photoSrc('thumb', current.post.cover)
				: null
	);

	function open() {
		const e = current;
		if (!e) return;
		if (e.kind === 'photos') {
			tour.playing = false;
			app.gallery = { photos: tour.photos, index: Math.max(0, tour.photos.indexOf(e.photos[0])) };
		} else if (e.kind === 'post') {
			tour.playing = false;
			app.reading = e.post;
		}
	}
</script>

<!-- persistent live region: screen readers hear each new moment as it's reached -->
<div class="live" aria-live="polite">
{#if current && label}
	{#key key}
		{@const opens = current.kind === 'photos' || current.kind === 'post'}
		<!-- svelte-ignore a11y_no_static_element_interactions — it's a <button> whenever it has a click handler -->
		<svelte:element
			this={opens ? 'button' : 'div'}
			type={opens ? 'button' : undefined}
			class="banner"
			class:opens
			onclick={opens ? open : undefined}
			in:fade={{ duration: 300 }}
		>
			<span class="icon" style:color={label.color} aria-hidden="true">{label.icon}</span>
			<span class="time">{clock(current.t)}</span>
			<span class="title">
				{#if current.kind === 'post'}Story: {/if}{label.title}{#if current.kind === 'pin' && current.pin.body}<span class="body">{' · '}{current.pin.body}</span>{/if}
			</span>
			{#if opens}<span class="go">{current.kind === 'post' ? 'Read' : 'View'}</span>{/if}
			{#if thumb}<img src={thumb} alt="" width="36" height="36" />{/if}
		</svelte:element>
	{/key}
{/if}
</div>

<style>
	.live {
		display: grid;
	}
	.banner {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 44px;
		box-sizing: border-box;
		padding: 4px 4px 4px 16px;
		border: 0;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.6);
		backdrop-filter: blur(10px);
		box-shadow: 0 2px 12px rgb(40 50 70 / 0.1);
		color: #2c3a45;
		font: inherit;
		font-size: 14px;
		text-align: left;
	}
	.banner.opens {
		cursor: pointer;
	}
	.banner.opens:hover {
		background: rgb(255 255 255 / 0.8);
	}
	.icon {
		flex: none;
		font-size: 13px;
		filter: saturate(0.8) brightness(0.8);
	}
	.time {
		flex: none;
		font-variant-numeric: tabular-nums;
		font-weight: 650;
	}
	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.body {
		opacity: 0.7;
	}
	.go {
		flex: none;
		font-size: 12px;
		font-weight: 650;
		color: #b8400c;
	}
	img {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid #fff;
	}
	.banner:not(:has(img)) {
		padding-right: 16px;
	}
</style>
