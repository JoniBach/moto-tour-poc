<!--
  One event in the blog timeline. The first line is always: time · icon · title · chevron.
  The time and the icon open that exact moment in the 3D view; the chevron folds the details
  (photos, note text) away so a day can be scanned as one-liners. Open by default. Stories never
  fold: their card always shows.
-->
<script lang="ts">
	import { tourOn } from '$lib/flags';
	import { eventSentence, mapLink, time } from '$lib/blog';
	import type { BlogEvent } from '$lib/server/blog-data';
	import { fold } from './fold.svelte';
	import Photo from './Photo.svelte';
	import Row from './Row.svelte';

	let { e, day, large = false }: { e: BlogEvent; day: string; large?: boolean } = $props();

	const s = $derived(eventSentence(e));
	const card = $derived(e.kind === 'post' ? e.card : undefined);
	const shown = $derived(e.kind === 'photos' ? e.photos.slice(0, large ? 12 : 6) : []);
	const where = $derived(e.place ? ` near ${e.place}` : '');
	const here = $derived(!tourOn ? undefined : mapLink(day, e.t, { post: card?.slug, photo: e.kind === 'photos' ? e.photos[0] : undefined }));
	const title = $derived(card ? card.title : e.kind === 'pin' ? `${s.label}: ${e.pin.title}` : s.text);
	// plain moments (set off, break, arrived) are all title, nothing to fold; stories are the
	// heart of the blog and always show in full, so folding the rest quietens the page around them
	const foldable = $derived(e.kind === 'photos' || (e.kind === 'pin' && !!e.pin.body));

	let open = $state(true);
	// follow "Collapse all / Expand all"
	$effect(() => {
		fold.gen;
		open = fold.open;
	});
</script>

<Row href={here} t={e.t} icon={s.icon} cls={e.kind} label={title} {foldable} always={!!card} bind:open>
	{#snippet head()}
		{#if card}
			<h3 class="title"><a href="/blog/{day}/{card.slug}">{card.title}</a></h3>
		{:else if e.kind === 'pin'}
			<p class="title"><strong>{s.label}:</strong> {e.pin.title}</p>
		{:else}
			<p class="title">{s.text}</p>
		{/if}
	{/snippet}
	{#if card}
		<article class="story" aria-label="Story: {card.title}">
			{#if card.cover}
				<a href="/blog/{day}/{card.slug}" tabindex="-1" aria-hidden="true">
					<Photo id={card.cover} alt="" size={e.sizes?.[card.cover]} sizes="(max-width: 46rem) 100vw, 42rem" />
				</a>
			{/if}
			<p class="kicker">Story{where}</p>
			<p>{card.excerpt}</p>
			<p class="more">
				<a href="/blog/{day}/{card.slug}">Continue reading<span class="sr"> “{card.title}”</span></a>
				<span aria-hidden="true"> · </span>
				<span>{card.minutes} minute read</span>
			</p>
		</article>
	{:else if e.kind === 'photos'}
		<ul class="grid" class:large aria-label="Photos taken at {time(e.t)}">
			{#each shown as id, i (id)}
				<li>
					<a href="/blog/{day}/photo/{id}">
						<Photo
							{id}
							size={e.sizes?.[id]}
							alt="Photo {i + 1} of {e.photos.length}, taken at {time(e.t)}{where}"
							sizes={large ? '(max-width: 46rem) 50vw, 22rem' : '(max-width: 46rem) 33vw, 8rem'}
						/>
					</a>
				</li>
			{/each}
			{#if e.photos.length > shown.length}
				<li class="rest">
					<a href="/blog/{day}/photo/{e.photos[shown.length]}">
						{e.photos.length - shown.length} more<span class="sr"> photos from {time(e.t)}</span>
					</a>
				</li>
			{/if}
		</ul>
	{:else if e.kind === 'pin'}
		<p class="note">{e.pin.body}</p>
	{/if}
</Row>

<style>
	.note {
		margin: 0;
		color: var(--b-muted);
	}
	.story {
		border: 1px solid var(--b-line);
		border-radius: 12px;
		background: var(--b-card);
		overflow: hidden;
		margin: 0.1rem 0 0.4rem;
	}
	.story :global(img) {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 16 / 9;
		object-fit: cover;
	}
	.story > :not(a) {
		margin-left: 1rem;
		margin-right: 1rem;
	}
	.kicker {
		margin-top: 0.8rem;
		margin-bottom: 0.2rem;
		font-size: 0.85rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--b-warm-text);
	}
	/* :global(.head) outranks Row's title spacing */
	:global(.event .head > h3.title) {
		padding-block: 0.3rem;
		font-size: 1.2rem;
		line-height: 1.3;
	}
	h3.title a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--b-text);
	}
	.more {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0 0.2rem;
		margin-bottom: 0.4rem;
		color: var(--b-muted);
	}
	.more a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 600;
	}
	.grid {
		list-style: none;
		margin: 0.4rem 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
		gap: 0.4rem;
	}
	.grid.large {
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
	}
	.grid a {
		display: block;
		border-radius: 8px;
		overflow: hidden;
	}
	.grid :global(img) {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		transition: transform 0.2s;
	}
	.grid a:hover :global(img) {
		transform: scale(1.04);
	}
	.rest a {
		display: grid;
		place-items: center;
		height: 100%;
		min-height: 4.5rem;
		background: var(--b-card);
		border: 1px solid var(--b-line);
		font-weight: 600;
		text-decoration: none;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}
	@media (prefers-reduced-motion: reduce) {
		.grid :global(img) {
			transition: none;
		}
	}
</style>
