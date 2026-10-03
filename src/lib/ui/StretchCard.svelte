<!--
  A stretch of the day's ride (src/lib/stretch.ts), in every view: choosing one (move along the
  ride, "Start here", move on, "End here"), then what it is: its name, distance, climb, highest
  point and roads (no ride time: the tour shows no speeds), and Play it / GPX / Share. Opened by a
  shared link (?t=…&to=…), a named stretch in the pins, or "Share a stretch".
-->
<script lang="ts">
	import { app } from '$lib/app.svelte';
	import { clock } from '$lib/data';
	import { copyLink, momentUrl } from '$lib/moment';
	import { download, factsLine, gpxName, stretchFacts, stretchGpx } from '$lib/stretch';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();

	const tr = $derived(tour.data.track);
	const at = (i: number) => clock(tr.t0 + tr.t[i]);
	const s = $derived(tour.stretch);
	const title = $derived(s?.title || `A stretch of ${tr.title}`);
	const facts = $derived(s ? stretchFacts(tr, tour.data.osm, s.i, s.j) : null);

	function startHere() {
		tour.playing = false;
		tour.picking = { i: tour.bike.i };
	}
	function endHere() {
		const a = tour.picking?.i;
		if (a == null) return;
		tour.playing = false;
		const b = tour.bike.i;
		if (b === a) return; // nothing between
		tour.stretch = { i: Math.min(a, b), j: Math.max(a, b), title: null };
		tour.picking = null;
	}
	function play() {
		if (!s) return;
		tour.seek(tr.rt[s.i]);
		tour.playing = true;
	}
	function gpx() {
		if (!s) return;
		const { originE, originN } = tour.data.terrain.meta;
		download(gpxName(title), stretchGpx(tr, originE, originN, s.i, s.j, title));
	}
	let shared = $state('');
	async function share() {
		const url = momentUrl(app, { post: '', photo: '' });
		if (navigator.share) {
			try {
				await navigator.share({ title, url });
				return;
			} catch (e) {
				if ((e as Error).name === 'AbortError') return;
			}
		}
		shared = (await copyLink(url)) ? '✓ Link copied' : 'Couldn’t copy';
		setTimeout(() => (shared = ''), 1800);
	}
	function close() {
		tour.stretch = null;
		tour.picking = null;
	}
</script>

{#if tour.picking}
	<div class="card picking" role="dialog" aria-label="Choose a stretch to share">
		<p class="what"><span aria-hidden="true">✂</span> <b>Choose a stretch</b></p>
		{#if tour.picking.i == null}
			<p>Move to where it starts (play, or drag the timeline), then:</p>
			<div class="row">
				<button type="button" class="go" onclick={startHere}>Start here · {at(tour.bike.i)}</button>
				<button type="button" onclick={close}>Cancel</button>
			</div>
		{:else}
			<p>From {at(tour.picking.i)}. Now move to where it ends, then:</p>
			<div class="row">
				<button type="button" class="go" onclick={endHere} disabled={tour.bike.i === tour.picking.i}>End here · {at(tour.bike.i)}</button>
				<button type="button" onclick={() => (tour.picking = { i: null })}>Start again</button>
				<button type="button" onclick={close}>Cancel</button>
			</div>
		{/if}
	</div>
{:else if s && facts}
	<div class="card" role="region" aria-label="A stretch of the ride">
		<p class="what"><span aria-hidden="true">⤳</span> <b>{title}</b></p>
		<p class="facts">{factsLine(facts)}{#if facts.roads.length}<br /><span class="roads">on the {facts.roads.join(', ')}</span>{/if}</p>
		<div class="row">
			<button type="button" class="go" onclick={play}>▶ Play it</button>
			<button type="button" onclick={gpx} title="A GPX file to ride it: for a satnav, Beeline, Garmin…">⬇ GPX</button>
			<button type="button" onclick={share}>{shared || 'Share'}</button>
			<button type="button" class="x" onclick={close} aria-label="Close the stretch">×</button>
		</div>
	</div>
{/if}

<style>
	.card {
		position: absolute;
		z-index: 110;
		top: 84px;
		left: 50%;
		transform: translateX(-50%);
		width: min(420px, calc(100% - 24px));
		box-sizing: border-box;
		padding: 12px 14px;
		border-radius: 20px;
		background: var(--glass);
		backdrop-filter: blur(12px);
		box-shadow:
			var(--shadow),
			0 0 0 1px var(--line);
		color: var(--text);
		font-size: 14px;
	}
	p {
		margin: 0 0 8px;
	}
	.what {
		font-size: 15px;
	}
	.facts {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.5;
	}
	.roads {
		color: var(--text);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	button {
		min-height: 36px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: var(--card);
		box-shadow:
			var(--press),
			0 0 0 1px var(--line);
		color: var(--text);
		font: inherit;
		font-size: 13px;
		font-weight: 650;
		cursor: pointer;
	}
	button.go {
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 3px 0 color-mix(in srgb, var(--accent) 55%, #000);
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.x {
		margin-left: auto;
		padding: 0 12px;
		font-size: 16px;
	}
	@media (max-width: 900px) {
		.card {
			top: 70px;
		}
	}
</style>
