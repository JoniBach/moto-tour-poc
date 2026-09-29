<!-- A blog post as a normal article page. -->
<script lang="ts">
	import { tourOn, TOUR_NAME } from '$lib/flags';
	import { iso, longDate, mapLink, time } from '$lib/blog';
	import Photo from '$lib/blog/Photo.svelte';

	let { data } = $props();
	const { post, cover, day, place, prev, next } = $derived(data);
</script>

<svelte:head>
	<title>{post.title} · UK Tour blog</title>
	<meta name="description" content={post.excerpt} />
</svelte:head>

<article class="post">
	<nav aria-label="Breadcrumb" class="crumb">
		<ol>
			<li><a href="/blog">All days</a></li>
			<li><a href="/blog/{day.day}">Day {day.index + 1}</a></li>
			<li aria-current="page">Story</li>
		</ol>
	</nav>
	<header>
		<p class="kicker">Day {day.index + 1} · {day.title}</p>
		<h1>{post.title}</h1>
		<p class="meta">
			<time datetime={iso(post.t)}>{longDate(post.t)}, {time(post.t)}</time>{#if place} · near {place}{/if} ·
			{post.minutes} minute read
		</p>
	</header>
	{#if cover}
		<!-- the page's main image: fetched first, never lazy -->
		<Photo class="cover" id={cover.id} size={[cover.w, cover.h]} alt="" sizes="(max-width: 46rem) 100vw, 44rem" priority />
	{/if}
	<div class="prose">
		<!-- the author's own Markdown, rendered at build time (scripts/build-blog.mjs) -->
		{@html post.html}
	</div>
	{#if tourOn}<p><a class="dx" href={mapLink(day.day, post.t, { post: post.slug })}>See this moment in the {TOUR_NAME}<span aria-hidden="true"> ↗</span></a></p>{/if}
	<nav class="pager" aria-label="Other stories">
		{#if prev}<a rel="prev" href="/blog/{prev.day}/{prev.slug}"><span aria-hidden="true">← </span>{prev.title}</a>{:else}<span></span>{/if}
		{#if next}<a rel="next" href="/blog/{next.day}/{next.slug}">{next.title}<span aria-hidden="true"> →</span></a>{/if}
	</nav>
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
		margin: 0;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--b-warm-text);
	}
	h1 {
		margin: 0.3rem 0 0.4rem;
		font-size: clamp(1.8rem, 5vw, 2.6rem);
		line-height: 1.15;
	}
	.meta {
		color: var(--b-muted);
	}
	.post :global(.cover) {
		display: block;
		width: 100%;
		height: auto;
		max-height: 70vh;
		object-fit: cover;
		border-radius: 12px;
		margin-bottom: 1.5rem;
	}
	.prose {
		font-size: 1.125rem;
		line-height: 1.75;
	}
	.prose :global(p) {
		margin: 0 0 1.5em;
	}
	.prose :global(em) {
		color: var(--b-muted);
	}
	.prose :global(figure) {
		margin: 1.5rem 0;
	}
	.prose :global(figure img) {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 10px;
	}
	.prose :global(figcaption) {
		margin-top: 0.4rem;
		font-size: 0.95rem;
		color: var(--b-muted);
	}
	.prose :global(blockquote) {
		margin: 0 0 1.5em;
		padding-left: 1rem;
		border-left: 4px solid var(--b-warm);
		color: var(--b-muted);
	}
	.dx {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 1rem;
		border-radius: 8px;
		background: var(--b-accent);
		color: var(--b-bg) !important;
		font-weight: 600;
		text-decoration: none;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 2.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--b-line);
		font-weight: 600;
	}
	.pager a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}
	.pager a[rel='next'] {
		text-align: right;
	}
</style>
