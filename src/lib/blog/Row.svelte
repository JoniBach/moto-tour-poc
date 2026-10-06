<!--
  The timeline row shared by single events and groups: time · icon · title · chevron, with the
  foldable details below. The time and the icon open that moment in the 3D view.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { iso, time } from '$lib/blog';

	let {
		href,
		t,
		icon,
		cls,
		label,
		foldable,
		always = false,
		open = $bindable(true),
		head,
		children
	}: {
		/** the moment in the tour; without one (no view released) the time is plain text */
		href?: string;
		t: number;
		icon: string;
		cls: string;
		/** plain-text title, for the chevron's screen-reader label */
		label: string;
		foldable: boolean;
		/** details that always show and can't fold (a story's card) */
		always?: boolean;
		open?: boolean;
		head: Snippet;
		children?: Snippet;
	} = $props();
	const uid = $props.id();
</script>

<li class="event {cls}" class:shut={foldable && !open}>
	{#if href}
		<a class="when" {href} title="View on the map">
			<time datetime={iso(t)}>{time(t)}</time><span class="pc-sr-only">, view on the map</span>
		</a>
	{:else}
		<span class="when plain"><time datetime={iso(t)}>{time(t)}</time></span>
	{/if}
	<!-- same link as the time, for pointers; kept out of the tab order so keyboards meet it once -->
	{#if href}
		<a class="dot" {href} tabindex="-1" aria-hidden="true" title="View on the map">{icon}</a>
	{:else}
		<span class="dot" aria-hidden="true">{icon}</span>
	{/if}
	<div class="what">
		<div class="head">
			{@render head()}
			{#if foldable}
				<button type="button" class="fold" aria-expanded={open} aria-controls="{uid}-body" onclick={() => (open = !open)}>
					<span class="pc-sr-only">{open ? 'Hide' : 'Show'} details: {label}</span>
					<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
						<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			{/if}
		</div>
		{#if foldable || always}
			<div class="body" id="{uid}-body" hidden={foldable && !open}>
				{@render children?.()}
			</div>
		{/if}
	</div>
</li>

<style>
	.event {
		display: grid;
		grid-template-columns: 3.4rem 1.75rem minmax(0, 1fr);
		gap: 0.6rem;
		position: relative;
		padding: 0.2rem 0;
	}
	/* the day's thread through the dots */
	.event::before {
		content: '';
		position: absolute;
		left: calc(3.4rem + 0.6rem + 0.875rem);
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--pc-line);
	}
	/* the time is the map link: 44 px tall, underlined like any link */
	.when {
		align-self: start;
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		text-underline-offset: 0.2em;
	}
	.dot {
		position: relative;
		margin-top: 0.5rem;
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		background: var(--pc-paper);
		border: 2px solid var(--pc-line-strong);
		font-size: 0.8rem;
		color: var(--pc-muted);
		text-decoration: none;
	}
	/* 44 px touch area around the 28 px circle */
	.dot::after {
		content: '';
		position: absolute;
		inset: -8px;
	}
	.when.plain {
		font-weight: 600;
		color: var(--pc-muted);
	}
	a.dot:hover {
		background: var(--pc-card);
		border-color: var(--pc-accent-ink);
	}
	.post .dot,
	.photos .dot {
		border-color: var(--pc-gold);
		color: var(--pc-gold);
	}
	.start .dot,
	.finish .dot {
		border-color: var(--pc-accent-ink);
		color: var(--pc-accent-ink);
	}
	/* a group: a doubled ring */
	.group .dot {
		box-shadow: 0 0 0 3px var(--pc-paper), 0 0 0 5px currentColor;
	}
	.head {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}
	/* .head raises specificity over the layout's paragraph spacing */
	.head > :global(.title) {
		flex: 1;
		min-width: 0;
		margin: 0;
		padding: 0.55rem 0;
		line-height: 1.5;
	}
	/* 44 × 44 px (WCAG 2.5.5) */
	.fold {
		flex: none;
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid transparent;
		border-radius: 8px;
		background: none;
		color: var(--pc-ink);
		cursor: pointer;
	}
	.fold:hover {
		border-color: var(--pc-line-strong);
		background: var(--pc-card);
	}
	.fold svg {
		transition: transform 0.15s;
	}
	.shut .fold svg {
		transform: rotate(-90deg);
	}
	.body {
		padding-bottom: 0.3rem;
	}
	@media (max-width: 520px) {
		.event {
			grid-template-columns: 3rem 1.75rem minmax(0, 1fr);
			gap: 0.45rem;
		}
		.event::before {
			left: calc(3rem + 0.45rem + 0.875rem);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.fold svg {
			transition: none;
		}
	}
</style>
