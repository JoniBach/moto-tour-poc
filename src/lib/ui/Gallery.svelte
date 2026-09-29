<!--
  Photo gallery: opens on a clicked pin's photos. Large image, previous / next (buttons, ←/→,
  swipe), a thumbnail strip, when and on which day it was taken, and "Ride here" to jump the
  tour to that moment. Esc or the backdrop closes it.
-->
<script lang="ts">
	import type { App } from '$lib/app.svelte';
	import { clock, photoUrl } from '$lib/data';
	import { copyLink, momentUrl } from '$lib/moment';

	let linked = $state(false);
	async function share() {
		if (!photo?.day) return;
		const url = new URL(momentUrl(app, { photo: photo.id, t: photo.t }));
		url.pathname = `/day/${photo.day}`;
		url.searchParams.delete('post');
		linked = await copyLink(url.toString());
		setTimeout(() => (linked = false), 1500);
	}

	let { app, onride }: { app: App; onride: (day: string) => void } = $props();

	const g = $derived(app.gallery);
	const photo = $derived(g ? g.photos[g.index] : null);
	const day = $derived(app.summary(photo?.day));
	const date = (s: number) =>
		new Date(s * 1000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });

	function go(step: number) {
		if (!app.gallery) return;
		const n = app.gallery.photos.length;
		app.gallery.index = (app.gallery.index + step + n) % n;
	}
	const close = () => (app.gallery = null);

	function onkeydown(e: KeyboardEvent) {
		if (!app.gallery) return;
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowRight') go(1);
		else if (e.key === 'ArrowLeft') go(-1);
		else return;
		e.preventDefault();
	}

	// swipe on touch screens
	let touchX: number | null = null;

	// keep the current thumbnail in view in the strip
	let strip = $state<HTMLDivElement>();
	$effect(() => {
		if (!g) return;
		strip?.children[g.index]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
	});
</script>

<svelte:window {onkeydown} />

{#if g && photo}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={close}>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="viewer"
			onclick={(e) => e.stopPropagation()}
			ontouchstart={(e) => (touchX = e.touches[0].clientX)}
			ontouchend={(e) => {
				if (touchX == null) return;
				const dx = e.changedTouches[0].clientX - touchX;
				if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
				touchX = null;
			}}
			role="dialog"
			aria-modal="true"
			aria-label="Photo gallery"
			tabindex="-1"
		>
			<header>
				<div class="meta">
					{#if day}<b>Day {day.index + 1}</b> · {day.title}<br />{/if}
					<span>{date(photo.t)} · {clock(photo.t)}{#if photo.placedBy === 'time-offride'} · off the bike{/if}</span>
				</div>
				<div class="actions">
					<span class="pos">{g.index + 1} / {g.photos.length}</span>
					{#if photo.day}
						<button onclick={share} title="Copy a link to this photo">{linked ? '✓ Copied' : '🔗 Link'}</button>
					{/if}
					{#if photo.day}
						<button
							onclick={() => {
								app.rideTo(photo, onride);
								close();
							}}>Ride here</button
						>
					{/if}
					<button class="close" onclick={close} aria-label="Close">×</button>
				</div>
			</header>

			<div class="stage">
				{#key photo.id}
					<img src={photoUrl(photo, 'large')} alt="Taken {date(photo.t)} {clock(photo.t)}" width={photo.w} height={photo.h} />
				{/key}
				{#if g.photos.length > 1}
					<button class="nav prev" onclick={() => go(-1)} aria-label="Previous photo">‹</button>
					<button class="nav next" onclick={() => go(1)} aria-label="Next photo">›</button>
				{/if}
			</div>

			{#if g.photos.length > 1}
				<div class="strip scroll-x" bind:this={strip}>
					{#each g.photos as p, k (p.id)}
						<button class:on={k === g.index} onclick={() => app.gallery && (app.gallery.index = k)} aria-label="Photo {k + 1}">
							<img src={photoUrl(p, 'thumb')} alt="" loading="lazy" draggable="false" />
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		/* one column no wider than the screen: without minmax(0, …) the column grows to fit
		   the thumbnail strip's full width (a whole day's photos) and the viewer is pushed off-screen */
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
		background: rgba(2, 5, 9, 0.82);
		backdrop-filter: blur(6px);
	}
	.viewer {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: min(1100px, 100%);
		min-width: 0;
		max-height: 100%;
		box-sizing: border-box;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 16px;
		background: var(--glass);
		outline: none;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		font-size: 13px;
	}
	.meta b {
		color: var(--accent);
	}
	.meta span,
	.pos {
		color: var(--muted);
		font-size: 12px;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}
	.actions button {
		all: unset;
		cursor: pointer;
		padding: 5px 12px;
		border-radius: 8px;
		background: var(--accent-soft);
		font-size: 12px;
	}
	.actions .close {
		padding: 0 6px;
		background: none;
		font-size: 22px;
		color: var(--muted);
	}
	.stage {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 0;
		flex: 1;
	}
	.stage img {
		max-width: 100%;
		/* dvh: the visible height on phones (100vh includes space under the browser toolbars) */
		max-height: calc(100dvh - 230px);
		width: auto;
		height: auto;
		border-radius: 10px;
		animation: fade 0.25s ease-out;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.nav {
		all: unset;
		cursor: pointer;
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: rgba(4, 12, 20, 0.7);
		border: 1px solid var(--line);
		color: var(--text);
		font-size: 26px;
	}
	.nav:hover {
		background: var(--accent-soft);
	}
	.prev {
		left: 8px;
	}
	.next {
		right: 8px;
	}
	.strip {
		display: flex;
		gap: 6px;
		min-width: 0;
	}
	.strip button {
		all: unset;
		cursor: pointer;
		flex: 0 0 auto;
		width: 64px;
		height: 48px;
		border-radius: 6px;
		overflow: hidden;
		opacity: 0.55;
		border: 2px solid transparent;
	}
	.strip button.on {
		opacity: 1;
		border-color: var(--accent);
	}
	.strip button:hover {
		opacity: 1;
	}
	.strip img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
