<!--
  Events drawer: the day's chronology down the right-hand side (shared Timeline list). The entry
  the ride has reached is highlighted and kept in view; clicking an entry jumps the tour there
  (photos also open the gallery, pins open their card). A tab on the right edge opens and closes it.
-->
<script lang="ts">
	import { photoSrc } from '$lib/tourConfig';
	import { app } from '$lib/app.svelte';
	import { clock, photoUrl } from '$lib/data';
	import { dayEvents, eventLabel, type TourEvent } from '$lib/events';
	import type { Tour } from '$lib/tour.svelte';
	import { ui } from '$lib/ui.svelte';
	import Sheet from './Sheet.svelte';
	import Timeline, { type TimelineItem } from './Timeline.svelte';

	let { tour }: { tour: Tour } = $props();

	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const events = dayEvents(tour.data.track, tour.data.pins, tour.photos, tour.posts);
	const open = $derived(app.settings.eventsOpen);

	// the last entry at or before the ride's current moment, by the clock (riding time skips
	// stops: during a long one it already equals the next ride's start)
	const current = $derived.by(() => {
		const now = tour.bike.time + 1;
		let k = -1;
		events.forEach((e, i) => {
			if (e.t <= now) k = i;
		});
		return k;
	});

	function go(e: TourEvent) {
		tour.seek(e.rt);
		if (ui.mobile) ui.sheet = null; // back to the map to see the moment
		if (e.kind === 'photos') {
			tour.playing = false;
			app.gallery = { photos: e.photos, index: 0 };
		} else if (e.kind === 'post') {
			tour.playing = false;
			app.reading = e.post;
		} else if (e.kind === 'pin') {
			tour.playing = false;
			tour.selectedPin = e.pin.id;
		}
	}

	const items: TimelineItem[] = events.map((e, i) => {
		const l = eventLabel(e);
		return {
			key: String(i),
			when: clock(e.t),
			icon: l.icon,
			color: l.color,
			title: l.title,
			sub: e.kind === 'pin' ? e.pin.body : e.kind === 'post' ? e.post.excerpt : undefined,
			thumbs:
				e.kind === 'photos'
					? e.photos.slice(0, 4).map((p) => photoUrl(p, 'thumb'))
					: e.kind === 'post' && e.post.cover
						? [photoSrc('thumb', e.post.cover)]
						: undefined,
			more: e.kind === 'photos' && e.photos.length > 4 ? e.photos.length - 4 : undefined,
			onclick: () => go(e)
		};
	});
</script>

{#if ui.mobile}
	<Sheet open={ui.sheet === 'events'} title="Day events · {events.length}" onclose={() => (ui.sheet = null)}>
		<Timeline {items} {current} fadePast whenWidth={44} />
	</Sheet>
{:else}
<button
	class="tab"
	class:open
	onclick={() => (app.settings.eventsOpen = !open)}
	aria-expanded={open}
	aria-controls="events-drawer"
>
	{open ? '›' : '‹'} Events <span class="n">{events.length}</span>
</button>

{#if open}
	<aside id="events-drawer" class="drawer">
		<header>
			<h2>Day events</h2>
			<span>{events.length} · click to jump</span>
		</header>
		<div class="list scroll-y">
			<Timeline {items} {current} fadePast />
		</div>
	</aside>
{/if}
{/if}

<style>
	.tab {
		all: unset;
		cursor: pointer;
		position: absolute;
		z-index: 101;
		right: 0;
		top: 50%;
		transform: translateY(-50%) rotate(180deg);
		writing-mode: vertical-rl;
		padding: 12px 6px;
		border: 1px solid var(--line);
		border-left: none;
		border-radius: 0 16px 16px 0;
		background: var(--glass);
		backdrop-filter: blur(10px);
		color: var(--text);
		font-size: 12px;
		letter-spacing: 0.08em;
	}
	.tab.open {
		right: 316px;
	}
	.tab .n {
		color: var(--accent);
	}
	.drawer {
		position: absolute;
		z-index: 101;
		top: 84px; /* below the trip bar */
		right: 16px;
		bottom: 216px;
		width: 300px;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--glass);
		box-shadow: var(--shadow);
		backdrop-filter: blur(10px);
		color: var(--text);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 12px 14px 8px;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0;
		font-size: 14px;
		color: var(--accent);
	}
	header span {
		font-size: 11px;
		color: var(--muted);
	}
	.list {
		flex: 1;
		min-height: 0;
		padding: 6px 4px 10px 8px;
	}
	@media (max-width: 700px) {
		.drawer {
			left: 16px;
			width: auto;
			top: 90px;
		}
		.tab.open {
			display: none;
		}
	}
</style>
