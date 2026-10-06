<!--
  Pins on the globe: the day's places, photos (as little round thumbnails, grouped where several
  were taken together) and stories. They grow in as they come over the rim and shrink away as they
  leave; only those inside are clickable or reachable by keyboard.
  Lives in the group that moves the landscape under the bike (day-local metres, exaggerated y).
-->
<script lang="ts">
	import { useTask } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { PIN_META, photoUrl, type BlogPost, type Photo } from '$lib/data';
	import { clickThroughControls } from '$lib/scene/controls';
	import type { Tour } from '$lib/tour.svelte';
	import type { GlobeState } from './state';

	let {
		tour,
		globe,
		radius,
		originE,
		originN,
		onphotos,
		onpost
	}: {
		tour: Tour;
		globe: GlobeState;
		/** metres of landscape from the bike to the rim */
		radius: number;
		originE: number;
		originN: number;
		onphotos: (photos: Photo[]) => void;
		onpost: (post: BlogPost) => void;
	} = $props();

	type Item = { key: string; x: number; n: number; kind: 'pin' | 'photos' | 'post'; label: string; run: () => void; icon?: string; color?: string; thumb?: string; count?: number };

	function items(): Item[] {
		const out: Item[] = [];
		if (tour.layers.pins)
			for (const p of tour.data.pins) {
				const m = PIN_META[p.type];
				out.push({ key: `pin${p.id}`, x: p.x, n: p.n, kind: 'pin', label: `${m.label}: ${p.title}`, icon: m.icon, color: m.color, run: () => tour.seek(p.rt) });
			}
		if (tour.layers.photos) {
			// photos taken together (within ~150 m) share one thumbnail
			let group: Photo[] = [];
			const flush = () => {
				if (!group.length) return;
				const first = group[0];
				const list = group;
				out.push({
					key: `ph${first.id}`,
					x: first.e - originE,
					n: first.n - originN,
					kind: 'photos',
					label: list.length > 1 ? `${list.length} photos` : 'A photo',
					thumb: photoUrl(first, 'thumb'),
					count: list.length,
					run: () => onphotos(list)
				});
				group = [];
			};
			for (const p of tour.photos) {
				const g = group[0];
				if (g && Math.hypot(p.e - g.e, p.n - g.n) > 150) flush();
				group.push(p);
			}
			flush();
		}
		if (tour.layers.blog)
			for (const p of tour.posts)
				out.push({ key: `post${p.slug}`, x: p.e - originE, n: p.n - originN, kind: 'post', label: `Story: ${p.title}`, icon: '✎', run: () => onpost(p) });
		return out;
	}

	const all = $derived(items());
	/** which items are inside the globe right now */
	let inside = $state<Record<string, boolean>>({});
	/** heights, refreshed when the landscape re-samples */
	let heights = $state<Record<string, number>>({});
	let draped = -1;

	useTask(() => {
		const b = tour.bike;
		const lim = radius * 0.9;
		let changed = false;
		const next: Record<string, boolean> = {};
		for (const it of all) {
			const v = Math.hypot(it.x - b.x, it.n - b.n) < lim;
			next[it.key] = v;
			if (v !== !!inside[it.key]) changed = true;
		}
		if (changed) inside = next;
		if (globe.version !== draped) {
			draped = globe.version;
			const h: Record<string, number> = {};
			for (const it of all) h[it.key] = globe.ground(it.x, it.n);
			heights = h;
		}
	});

	// a pin stands a little above the ground it marks
	const lift = $derived(radius * 0.03);
</script>

{#each all as it (it.key)}
	{@const on = !!inside[it.key]}
	<!-- the wrapper lets clicks through: only the (possibly shifted) button itself takes them -->
	<HTML position={[it.x, (heights[it.key] ?? 0) * tour.exaggeration + lift, -it.n]} center pointerEvents="none" zIndexRange={[40, 0]}>
		<button
			type="button"
			class="gp {it.kind}"
			class:in={on}
			style:--pc-c={it.color}
			aria-label={it.label}
			title={it.label}
			aria-hidden={!on}
			tabindex={on ? 0 : -1}
			{@attach clickThroughControls}
			onclick={it.run}
		>
			{#if it.thumb}
				<img src={it.thumb} alt="" width="40" height="40" loading="lazy" decoding="async" />
				{#if (it.count ?? 0) > 1}<span class="n">{it.count}</span>{/if}
			{:else}
				{it.icon}
			{/if}
		</button>
	</HTML>
{/each}

<style>
	/* Threlte's centring wrapper sits where the button would be unshifted: let clicks through it */
	:global(div:has(> .gp)) {
		pointer-events: none;
	}
	.gp {
		animation: appear 0.7s ease backwards;
		position: relative;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		padding: 0;
		border: 2px solid #fff;
		border-radius: 50%;
		background: #fffaf2;
		color: #3a2f25;
		font: 600 15px/1 system-ui, sans-serif;
		box-shadow: 0 2px 6px rgb(40 45 60 / 0.3);
		cursor: pointer;
		/* out of the globe: shrunk away */
		opacity: 0;
		transform: scale(0.2) translateY(12px);
		pointer-events: none;
		transition:
			opacity 0.45s ease,
			transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.gp.in {
		opacity: 1;
		transform: none;
		pointer-events: auto;
	}
	/* a story and a place at the same spot as photos step aside (up-right, up-left) instead of
	   covering them: height alone barely separates them from the camera's angle */
	.gp.post.in {
		transform: translate(22px, -26px);
	}
	.gp.pin.in {
		transform: translate(-20px, -22px);
	}
	.gp:focus-visible {
		outline: 3px solid #1c7ed6;
		outline-offset: 2px;
	}
	.gp.pin {
		border-color: var(--pc-c);
	}
	.gp.post {
		width: 38px;
		height: 38px;
		background: #ffd166;
		font-size: 18px;
	}
	.gp.photos {
		width: 44px;
		height: 44px;
		overflow: visible;
	}
	.gp img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
	.n {
		position: absolute;
		right: -6px;
		top: -6px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border-radius: 9px;
		background: #d9480f;
		color: #fff;
		font-size: 11px;
		line-height: 18px;
	}
	@media (prefers-reduced-motion: reduce) {
		.gp {
			transition: opacity 0.2s;
			transform: none;
		}
	}
	@keyframes appear {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
