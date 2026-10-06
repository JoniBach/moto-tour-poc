<!--
  Back-to-back events of the same kind folded into one row ("5 photo stops · 11 photos near …").
  Starts closed (that's the point of grouping); the chevron opens it to the events themselves.
-->
<script lang="ts">
	import { tourOn } from '$lib/flags';
	import { mapLink, time } from '$lib/blog';
	import type { BlogEvent } from '$lib/server/blog-data';
	import EventItem from './EventItem.svelte';
	import { fold } from './fold.svelte';
	import Row from './Row.svelte';

	let { events, title, icon, day, large = false }: { events: BlogEvent[]; title: string; icon: string; day: string; large?: boolean } =
		$props();

	const first = $derived(events[0]);
	const last = $derived(events[events.length - 1]);
	const kind = $derived(first.kind);
	const here = $derived(!tourOn ? undefined : mapLink(day, first.t, { photo: first.kind === 'photos' ? first.photos[0] : undefined }));
	const label = $derived(`${title}, ${time(first.t)} to ${time(last.t)}`);

	let open = $state(false);
	// closed by default, but "Collapse all / Expand all" applies once used
	let seen = fold.gen;
	$effect(() => {
		if (fold.gen !== seen) {
			seen = fold.gen;
			open = fold.open;
		}
	});
</script>

<Row href={here} t={first.t} {icon} cls="{kind} group" {label} foldable bind:open>
	{#snippet head()}
		<p class="title">
			{title}
			<span class="span">{time(first.t)} to {time(last.t)}</span>
		</p>
	{/snippet}
	<ol class="members" aria-label={label}>
		{#each events as e (e.t + e.kind)}
			<EventItem {e} {day} {large} />
		{/each}
	</ol>
</Row>

<style>
	.span {
		display: block;
		font-size: 0.9rem;
		color: var(--pc-muted);
	}
	.members {
		list-style: none;
		margin: 0;
		padding: 0 0 0 0.75rem;
		border-left: 2px dotted var(--pc-line-strong);
	}
</style>
