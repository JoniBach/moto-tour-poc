<!--
  One globe for the whole visit: the camera, its controls and the plinth stay put, and only the
  land on the plinth changes. Moving to a day (or back to the overview, or on to the next day)
  lets the relief sink flat into the plinth and the new land's hills rise up out of it: straight
  up and down, nothing spreading or springing, so it feels like the same globe changing rather
  than a new scene. While the next day loads, the old land waits half sunk. The camera keeps
  wherever you turned it.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import type { BlogPost, Parks, Photo } from '$lib/data';
	import type { Tour } from '$lib/tour.svelte';
	import GlobeOverview from './GlobeOverview.svelte';
	import GlobeScene from './GlobeScene.svelte';
	import Plinth from './Plinth.svelte';
	import { busy } from './FrameGovernor.svelte';

	let {
		tour,
		waiting,
		parks,
		origin,
		labels,
		onshown,
		onsky,
		onphotos,
		onpost
	}: {
		/** the day to show; null: the overview */
		tour: Tour | null;
		/** the next day is loading: keep what's there, settled down */
		waiting: boolean;
		parks: Parks | null;
		/** a day's projection origin */
		origin: (tour: Tour) => { e: number; n: number };
		/** what's lettered around the plinth for a day (or the overview) */
		labels: (tour: Tour | null) => { title: string; date: string };
		/** the land now on the plinth changed (the sky follows it) */
		onshown: (tour: Tour | null) => void;
		onsky: (top: string, bottom: string) => void;
		onphotos: (photos: Photo[]) => void;
		onpost: (post: BlogPost) => void;
	} = $props();

	const V = 1800;
	let width = $state(globalThis.innerWidth ?? 1);
	let height = $state(globalThis.innerHeight ?? 1);
	// svelte-ignore state_referenced_locally — the first frame only; after that the viewer's orbit wins
	const fit = Math.max(1, 1.25 / Math.max(0.3, width / height));

	// what's on the plinth now, and how far its relief has risen (0 flat .. 1 full height)
	// svelte-ignore state_referenced_locally — starts with whatever the page opened on, then animates
	let shown = $state.raw<Tour | null>(tour);
	// the plinth's shadow eases to where the land on it wants it
	let shadow = $state(0.5);
	let shadowGoal = 0.5;
	const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

	let rise = 1;
	const risen = () => rise;
	let phase: 'idle' | 'fall' | 'rise' = 'idle';
	let t = 0;
	let from = 1;
	const FALL = 0.7;
	const RISE = 1.4;
	const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
	const clamp = (u: number) => Math.min(1, Math.max(0, u));

	function swap() {
		shown = tour;
		shadowGoal = 0.5;
		onshown(shown);
	}

	useTask((dt) => {
		// full frame rate through a change of day, and a moment after (the light and sun settle)
		if (phase !== 'idle' || waiting) busy(1500);
		const eased = shadow + (shadowGoal - shadow) * Math.min(1, dt * 2);
		if (Math.abs(eased - shadow) > 0.004) shadow = eased;
		if (still) {
			if (tour !== shown && !waiting) swap();
			rise = 1;
			return;
		}
		if (phase === 'idle') {
			if (tour !== shown && !waiting) {
				phase = 'fall';
				t = 0;
				from = rise;
			} else {
				// waiting for the next day: sink part way and hold; otherwise stand at full height
				const goal = waiting ? 0.35 : 1;
				rise += (goal - rise) * Math.min(1, dt * 4);
			}
		} else if (phase === 'fall') {
			t += dt;
			rise = from * (1 - easeInOut(clamp(t / FALL)));
			if (t >= FALL) {
				swap();
				phase = 'rise';
				t = 0;
				rise = 0;
			}
		} else {
			t += dt;
			rise = easeInOut(clamp(t / RISE));
			if (t >= RISE) phase = 'idle';
		}
	});

	const plinth = $derived(labels(shown));
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

<T.PerspectiveCamera makeDefault position={[0, V * 2.1 * fit, V * 3.9 * fit]} fov={34} near={V * 0.01} far={V * 40}>
	<OrbitControls target={[0, V * 0.04, 0]} enablePan={false} enableDamping minDistance={V * 1.3} maxDistance={V * 6 * fit} maxPolarAngle={Math.PI * 0.47} />
</T.PerspectiveCamera>

<!-- the lettering fades out as the land falls and back in as the new land rises -->
<Plinth R={V} title={plinth.title} date={plinth.date} {shadow} lettering={() => (phase === 'idle' ? 1 : rise)} />

<!-- a keyed list, not {#if}: a day's scene keeps its own tour to the end, never null mid-teardown -->
{#each shown ? [shown] : [] as day (day)}
	{@const o = origin(day)}
	<GlobeScene
		tour={day}
		staged
		originE={o.e}
		originN={o.n}
		{parks}
		title={plinth.title}
		date={plinth.date}
		{onsky}
		rise={risen}
		onshadow={(s) => (shadowGoal = s)}
		{onphotos}
		{onpost}
	/>
{:else}
	<GlobeOverview title={plinth.title} date={plinth.date} staged rise={risen} />
{/each}
