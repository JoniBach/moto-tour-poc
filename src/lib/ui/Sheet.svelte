<!--
  Bottom sheet for small screens: slides up over the map with a dimmed backdrop, a grab bar,
  a title and a close button. Tap the backdrop, press Esc, or drag the sheet down to close.
  Respects the home-indicator safe area. Content scrolls inside it.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	let {
		open,
		title,
		onclose,
		maxHeight = '72dvh',
		children
	}: { open: boolean; title: string; onclose: () => void; maxHeight?: string; children: Snippet } = $props();

	// drag-to-close from the grab bar / header
	let dragY = $state(0);
	let startY: number | null = null;
	function down(e: PointerEvent) {
		startY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (startY != null) dragY = Math.max(0, e.clientY - startY);
	}
	function up() {
		if (startY == null) return;
		if (dragY > 80) onclose();
		dragY = 0;
		startY = null;
	}

	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') onclose();
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="backdrop" transition:fade={{ duration: 180 }} onclick={onclose}></div>
	<div
		class="sheet"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		style:max-height={maxHeight}
		style:transform={dragY ? `translateY(${dragY}px)` : undefined}
		class:dragging={dragY > 0}
		transition:fly={{ y: 400, duration: 260, opacity: 1 }}
	>
		<!-- drag-to-close is a shortcut; the close button and Esc do the same for keyboard users -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<header onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
			<span class="grab" aria-hidden="true"></span>
			<h2>{title}</h2>
			<button class="close" onclick={onclose} onpointerdown={(e) => e.stopPropagation()} aria-label="Close">×</button>
		</header>
		<div class="body scroll-y">
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 150;
		background: rgba(2, 5, 9, 0.45);
	}
	.sheet {
		position: fixed;
		z-index: 151;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-bottom: none;
		border-radius: 18px 18px 0 0;
		/* themeable: the events sheet over the globe is light */
		background: var(--sheet-bg, rgba(4, 12, 20, 0.94));
		backdrop-filter: blur(14px);
		color: var(--text);
		padding-bottom: env(safe-area-inset-bottom);
		transition: transform 0.2s ease-out;
	}
	.sheet.dragging {
		transition: none;
	}
	header {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px 16px 10px;
		touch-action: none;
		cursor: grab;
	}
	.grab {
		position: absolute;
		top: 7px;
		left: 50%;
		width: 40px;
		height: 4px;
		margin-left: -20px;
		border-radius: 2px;
		background: var(--muted);
		opacity: 0.6;
	}
	h2 {
		margin: 0;
		font-size: 15px;
		color: var(--accent);
	}
	.close {
		all: unset;
		cursor: pointer;
		position: absolute;
		right: 8px;
		top: 8px;
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		color: var(--muted);
		font-size: 26px;
	}
	.body {
		flex: 1;
		min-height: 0;
		padding: 0 14px 16px;
	}
</style>
