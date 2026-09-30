<!--
  Blog post markers: a ✎ badge with the post's title where the bike was at the post's moment.
  Clicking opens it in the reader. Every post on the tour is shown (there are few); the title
  label hides when the camera is high above the whole country.
  Positions are absolute projected metres; the parent group applies the world origin.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { Vector3 } from 'three';
	import type { BlogPost, Terrain } from '$lib/data';
	import { clickThroughControls } from './controls';

	let {
		posts,
		region,
		dayTerrain,
		exaggeration,
		reading,
		onopen
	}: {
		posts: BlogPost[];
		region: Terrain;
		dayTerrain: Terrain | null;
		exaggeration: number;
		reading: BlogPost | null;
		onopen: (post: BlogPost) => void;
	} = $props();

	// ground height: the active day's terrain where it has it, else the region backdrop
	function heightAt(e: number, n: number) {
		if (dayTerrain) {
			const { originE, originN, x0, n1, cols, rows, spacing } = dayTerrain.meta;
			const x = e - originE;
			const y = n - originN;
			if (x >= x0 && x <= x0 + (cols - 1) * spacing && y <= n1 && y >= n1 - (rows - 1) * spacing)
				return Math.max(0, dayTerrain.heightAt(x, y));
		}
		return Math.max(0, region.heightAt(e, n));
	}

	const { camera } = useThrelte();
	let high = $state(true);
	const cam = new Vector3();
	useTask(() => {
		high = camera.current.getWorldPosition(cam).y > 60_000;
	});
</script>

{#each posts as post (post.slug)}
	<T.Group position={[post.e, heightAt(post.e, post.n) * exaggeration, -post.n]}>
		<HTML zIndexRange={[49, 47]}>
			<button
				class="post-pin"
				class:open={reading === post}
				{@attach clickThroughControls}
				onclick={() => onopen(post)}
				title={post.title}
			>
				<span class="badge">✎</span>
				{#if !high}<span class="label">{post.title}</span>{/if}
			</button>
		</HTML>
	</T.Group>
{/each}

<style>
	.post-pin {
		all: unset;
		cursor: pointer;
		position: absolute;
		display: flex;
		align-items: center;
		gap: 6px;
		/* sits up and to the right of the spot, clear of photo pins */
		transform: translate(-13px, -58px);
		white-space: nowrap;
	}
	.post-pin::after {
		content: '';
		position: absolute;
		left: 12px;
		top: 26px;
		width: 2px;
		height: 32px;
		background: linear-gradient(#ffd166, transparent);
	}
	.badge {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: #ffd166;
		color: #03070c;
		font-size: 13px;
		box-shadow: 0 0 12px rgba(255, 209, 102, 0.7);
	}
	.label {
		padding: 3px 8px;
		border-radius: 8px;
		border: 1px solid #ffd166;
		background: rgba(4, 12, 20, 0.85);
		color: #ffe3a3;
		font-size: 12px;
	}
	.post-pin:hover .badge,
	.post-pin.open .badge {
		transform: scale(1.15);
		box-shadow: 0 0 18px #ffd166;
	}
</style>
