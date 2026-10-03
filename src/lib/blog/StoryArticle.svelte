<!--
  A story as it reads on its page, shared by the story page and the story editor (/wysiwyg),
  where it's written in place: its day and time, a large cover, the text at a comfortable measure (about 65
  characters a line), then where it happened (the day's route with the moment marked, and a link
  to it in the tour) and, on the page, the stories either side of it as postcards.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { tourOn, TOUR_NAME } from '$lib/flags';
	import { iso, longDate, mapLink, time } from '$lib/blog';
	import { dayColor } from '$lib/colors';
	import type { Sketch } from '$lib/sketch';
	import Photo from '$lib/blog/Photo.svelte';
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import RouteSketch from '$lib/ui/RouteSketch.svelte';
	import { shots } from '$lib/blog/shots';

	type Neighbour = { slug: string; day: string; index: number; title: string; cover: { id: string; w: number; h: number } | null } | null;
	let {
		post,
		cover,
		day,
		dayCount,
		where,
		place,
		prev = null,
		next = null,
		preview = false,
		titleSlot,
		coverSlot,
		prose
	}: {
		post: { slug: string; title: string; t: number; html: string; minutes: number };
		cover: { id: string; w: number; h: number } | null;
		day: { day: string; index: number; title: string };
		dayCount: number;
		where: Sketch | null;
		place: string | null;
		prev?: Neighbour;
		next?: Neighbour;
		/** in the editor: no breadcrumb or links into the tour */
		preview?: boolean;
		/** the editor: the title's text (editable), the cover (with its picker), and the story itself
		    (the editor mounts on the .prose element, so the story's own styles apply as it's written) */
		titleSlot?: Snippet;
		coverSlot?: Snippet;
		prose?: Attachment<HTMLElement>;
	} = $props();
	const c = $derived(dayColor(day.index, dayCount));
</script>

<article class="post" style:--c={c}>
	{#if !preview}<nav aria-label="Breadcrumb" class="crumb">
		<ol>
			<li><a href="{base}/blog">All days</a></li>
			<li><a href="{base}/blog/{day.day}">Day {day.index + 1}</a></li>
			<li aria-current="page">Story</li>
		</ol>
	</nav>{/if}
	<header>
		<p class="kicker"><span class="chip">Day {day.index + 1}</span> {day.title}</p>
		<h1>{#if titleSlot}{@render titleSlot()}{:else}{post.title}{/if}</h1>
		<p class="meta">
			<time datetime={iso(post.t)}>{longDate(post.t)}, {time(post.t)}</time>{#if place}{' · '}near {place}{/if}{' · '}{post.minutes} minute read
		</p>
	</header>
	{#if coverSlot}
		{@render coverSlot()}
	{:else if cover}
		<!-- the page's main image: fetched first, never lazy -->
		<Photo class="cover" id={cover.id} size={[cover.w, cover.h]} alt="" sizes="(max-width: 46rem) 100vw, 46rem" priority />
	{/if}
	{#if prose}
		<div class="prose" {@attach prose}></div>
	{:else}
		<!-- the author's own Markdown, rendered at build time (scripts/build-blog.mjs); its map
		     snapshots are drawn here, as they come into view -->
		<div class="prose" {@attach (el) => (post.html, shots(el))}>
			{@html post.html}
		</div>
	{/if}

	{#if where}<aside class="where" aria-labelledby="where-h">
		<span class="route">
			<RouteSketch s={where} color={c} pulse={!preview} label="Day {day.index + 1}'s route, with this story's moment marked" />
		</span>
		<div>
			<h2 id="where-h">Where this happened</h2>
			<p>
				Day {day.index + 1}, {day.title}, at {time(post.t)}{#if place}{' '}near {place}{/if}.
			</p>
			{#if tourOn && !preview}
				<a class="go" href={mapLink(day.day, post.t, { post: post.slug })}>See this moment in the {TOUR_NAME}<span aria-hidden="true"> →</span></a>
			{/if}
		</div>
	</aside>{/if}

	{#if !preview && (prev || next)}
		<nav class="more" aria-label="Other stories">
			{#each [prev, next] as s, k (k)}
				{#if s}
					<a class="card" rel={k ? 'next' : 'prev'} href="{base}/blog/{s.day}/{s.slug}" style:--c={dayColor(s.index, dayCount)}>
						{#if s.cover}<span class="thumb"><Photo id={s.cover.id} size={[s.cover.w, s.cover.h]} alt="" sizes="12rem" /></span>{/if}
						<span class="txt">
							<span class="which">{k ? 'Next story' : 'Previous story'} · Day {s.index + 1}</span>
							<span class="t">{s.title}</span>
						</span>
					</a>
				{:else}
					<span></span>
				{/if}
			{/each}
		</nav>
	{/if}
</article>

<style>
	.crumb ol {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		margin: 0 0 0.5rem;
		padding: 0;
		font-size: 0.95rem;
		color: var(--b-muted);
	}
	.crumb li {
		display: flex;
		align-items: center;
	}
	.crumb li + li::before {
		content: '/';
		margin: 0 0.5rem;
	}
	.crumb a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		min-width: 2.75rem;
	}
	.kicker {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-weight: 650;
		color: var(--b-muted);
	}
	.chip {
		padding: 0.15rem 0.7rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--c) 28%, var(--b-card));
		box-shadow: inset 0 0 0 2px var(--c);
		color: var(--b-text);
		font-size: 0.85rem;
		font-weight: 750;
		letter-spacing: 0.04em;
	}
	h1 {
		margin: 0.5rem 0 0.5rem;
		font-size: clamp(2.1rem, 6vw, 3.1rem);
		line-height: 1.08;
	}
	.meta {
		color: var(--b-muted);
	}
	.post :global(.cover) {
		display: block;
		width: 100%;
		height: auto;
		max-height: 72vh;
		object-fit: cover;
		border-radius: 24px;
		margin: 0.5rem 0 2rem;
		box-shadow: 0 12px 30px rgb(70 55 30 / 0.15);
	}
	/* the reading measure: about 65 characters a line */
	.prose {
		max-width: 65ch;
		font-size: 1.15rem;
		line-height: 1.75;
	}
	.prose :global(p) {
		margin: 0 0 1.5em;
	}
	/* a drop cap to open, unless the story opens on an italic aside; on the published page only, not
	   in the editor (iOS Safari loses the cursor in a ::first-letter as you type, and switching it
	   on and off with focus made the letter jump) */
	.prose:not(:global(.ProseMirror)) > :global(p:first-child:not(:has(> em:first-child))::first-letter) {
		float: left;
		margin: 0.1em 0.12em 0 0;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 3.4em;
		line-height: 0.85;
		color: var(--b-accent);
	}
	.prose :global(em) {
		color: var(--b-muted);
	}
	.prose :global(figure) {
		margin: 2rem 0;
	}
	.prose :global(figure img) {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 18px;
	}
	/* map snapshots (src/lib/map/mapShot.ts): the frame holds its shape while the map is drawn */
	.prose :global(.map-frame) {
		position: relative;
		aspect-ratio: 3 / 2;
		overflow: hidden;
		border-radius: 18px;
		background: #f6f0e3;
	}
	.prose :global(.map-frame img) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.prose :global(.map-frame::after) {
		content: '© OpenMapTiles © OpenStreetMap';
		position: absolute;
		right: 0;
		bottom: 0;
		padding: 1px 6px;
		border-radius: 6px 0 0 0;
		background: rgb(255 255 255 / 0.7);
		font-size: 10px;
		color: #46535a;
	}
	.prose :global(.map-frame.failed) {
		display: grid;
		place-items: center;
		font-size: 0.9rem;
		color: var(--b-muted);
	}
	.prose :global(figcaption) {
		margin-top: 0.5rem;
		font-size: 0.95rem;
		color: var(--b-muted);
	}
	.prose :global(blockquote) {
		margin: 0 0 1.5em;
		padding: 0.6rem 1.2rem;
		border-left: 5px solid var(--c);
		border-radius: 4px 16px 16px 4px;
		background: var(--b-card);
		font-family: var(--font-display);
		font-size: 1.2em;
		color: var(--b-text);
	}
	/* where it happened: the day's route with the moment on it */
	.where {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr);
		align-items: center;
		gap: 1.25rem;
		margin: 2.5rem 0 0;
		padding: 1.1rem;
		border-radius: 28px;
		/* a patch of the globe's sky */
		background: linear-gradient(135deg, #e6f1f6, #f4f8f6);
	}
	.route {
		width: 8rem;
		height: 8rem;
		border-radius: 18px;
		background: rgb(255 253 248 / 0.9);
		box-shadow: 0 4px 14px rgb(70 55 30 / 0.1);
	}
	.where h2 {
		margin: 0 0 0.3rem;
		font-size: 1.3rem;
	}
	.where p {
		margin: 0 0 0.6rem;
		color: var(--b-muted);
	}
	.go {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 1.1rem;
		border-radius: 999px;
		background: var(--b-accent);
		color: var(--b-bg) !important;
		font-weight: 650;
		text-decoration: none;
	}
	/* the stories either side, as postcards */
	.more {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 2rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		border-radius: 20px;
		background: var(--b-card);
		box-shadow: 0 10px 26px rgb(70 55 30 / 0.12);
		color: var(--b-text) !important;
		text-decoration: none;
		overflow: hidden;
		transition: transform 0.15s ease;
	}
	.card:hover {
		transform: translateY(-2px) rotate(-0.3deg);
	}
	.card[rel='next'] {
		text-align: right;
	}
	.thumb :global(img) {
		display: block;
		width: 100%;
		height: 7.5rem;
		object-fit: cover;
	}
	.txt {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.8rem 1rem 1rem;
	}
	.which {
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--b-muted);
	}
	.t {
		font-family: var(--font-display);
		font-weight: 650;
		font-size: 1.15rem;
		line-height: 1.2;
	}
	@media (max-width: 34rem) {
		.where {
			grid-template-columns: 5.5rem minmax(0, 1fr);
		}
		.route {
			width: 5.5rem;
			height: 5.5rem;
		}
		.more {
			grid-template-columns: 1fr;
		}
		.card[rel='next'] {
			text-align: left;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card:hover {
			transform: none;
		}
	}
</style>
