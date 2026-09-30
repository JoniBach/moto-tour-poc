<!--
  Vertical timeline list shared by the events drawer and the tour's day list: a "when" column,
  a coloured dot on a thread, a title with an optional line of detail and photo thumbnails.
  Entries are links (href) or buttons (onclick). `current` highlights one entry, fades the ones
  before it (when `fadePast`) and keeps it scrolled into view.
-->
<script lang="ts" module>
	export interface TimelineItem {
		key: string;
		when: string;
		icon: string;
		color: string;
		title: string;
		sub?: string;
		thumbs?: string[];
		more?: number; // "+N" after the thumbnails
		href?: string;
		onclick?: () => void;
	}
</script>

<script lang="ts">
	let {
		items,
		current = -1,
		fadePast = false,
		whenWidth = 40
	}: { items: TimelineItem[]; current?: number; fadePast?: boolean; whenWidth?: number } = $props();

	let list = $state<HTMLOListElement>();
	$effect(() => {
		if (current < 0) return;
		list?.children[current]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	});
</script>

{#snippet content(item: TimelineItem)}
	<span class="when">{item.when}</span>
	<span class="dot">{item.icon}</span>
	<span class="body">
		<span class="title">{item.title}</span>
		{#if item.sub}<span class="sub">{item.sub}</span>{/if}
		{#if item.thumbs?.length}
			<span class="thumbs">
				{#each item.thumbs as src (src)}<img {src} alt="" loading="lazy" draggable="false" />{/each}
				{#if item.more}<span class="more">+{item.more}</span>{/if}
			</span>
		{/if}
	</span>
{/snippet}

<ol class="timeline" bind:this={list} style:--when="{whenWidth}px">
	{#each items as item, i (item.key)}
		<li class:past={fadePast && current >= 0 && i < current} class:now={i === current} style:--c={item.color}>
			{#if item.href}
				<a class="entry" href={item.href} onclick={item.onclick}>{@render content(item)}</a>
			{:else}
				<button class="entry" onclick={item.onclick}>{@render content(item)}</button>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.timeline {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.entry {
		all: unset;
		cursor: pointer;
		box-sizing: border-box;
		width: 100%;
		display: grid;
		grid-template-columns: var(--when) 22px 1fr;
		gap: 6px;
		align-items: start;
		padding: 6px;
		border-radius: 14px;
		position: relative;
		color: var(--text);
	}
	/* the thread through the dots */
	.entry::before {
		content: '';
		position: absolute;
		left: calc(6px + var(--when) + 6px + 11px);
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--line);
	}
	li:first-child .entry::before {
		top: 14px;
	}
	li:last-child .entry::before {
		bottom: calc(100% - 14px);
	}
	.entry:hover {
		background: var(--accent-soft);
	}
	li.now .entry {
		background: color-mix(in srgb, var(--c) 16%, transparent);
		box-shadow: inset 2px 0 0 var(--c);
	}
	li.past {
		opacity: 0.6;
	}
	.when {
		font-size: 11px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		padding-top: 2px;
	}
	.dot {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--card);
		border: 2px solid var(--c);
		color: var(--c);
		font-size: 10px;
		font-weight: 600;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.title {
		font-size: 13px;
	}
	.sub {
		font-size: 11px;
		color: var(--muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.thumbs {
		display: flex;
		gap: 3px;
		align-items: center;
	}
	.thumbs img {
		width: 42px;
		height: 32px;
		object-fit: cover;
		border-radius: 8px;
	}
	.more {
		font-size: 11px;
		color: var(--muted);
		padding-left: 2px;
	}
</style>
