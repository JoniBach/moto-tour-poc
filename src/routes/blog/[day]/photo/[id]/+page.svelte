<!-- One photo as a page: the picture, when and where, previous / next within the day. -->
<script lang="ts">
	import { TOUR } from '$lib/tourConfig';
	import { tourOn, TOUR_NAME } from '$lib/flags';
	import { goto } from '$app/navigation';
	import { iso, longDate, mapLink, time } from '$lib/blog';
	import Photo from '$lib/blog/Photo.svelte';

	let { data } = $props();
	const { photo, position, count, prev, next, day, place } = $derived(data);
	const caption = $derived(`Taken at ${time(photo.t)}${place ? ` near ${place}` : ''}`);

	// ← / → between photos
	function onkeydown(e: KeyboardEvent) {
		if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, textarea')) return;
		const to = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : null;
		if (to) goto(`/blog/${day.day}/photo/${to}`, { noScroll: true });
	}
</script>

<svelte:head>
	<title>Photo {position} of {count} · Day {day.index + 1} · {TOUR.name} blog</title>
	<meta name="description" content="Photo from Day {day.index + 1}, {day.title}: {caption}." />
</svelte:head>
<svelte:window {onkeydown} />

<nav aria-label="Breadcrumb" class="crumb">
	<ol>
		<li><a href="/blog">All days</a></li>
		<li><a href="/blog/{day.day}">Day {day.index + 1}</a></li>
		<li aria-current="page">Photo {position} of {count}</li>
	</ol>
</nav>
<h1>Day {day.index + 1} · {day.title} <span class="sub">Photo {position} of {count}</span></h1>
<figure>
	<!-- the page's main image: fetched first -->
	<Photo id={photo.id} size={[photo.w, photo.h]} alt="Photo from Day {day.index + 1}: {caption}" sizes="(max-width: 46rem) 100vw, 44rem" priority />
	<figcaption>
		<time datetime={iso(photo.t)}>{longDate(photo.t)}</time> · {caption}
	</figcaption>
</figure>
<nav class="pager" aria-label="Other photos">
	{#if prev}<a rel="prev" href="/blog/{day.day}/photo/{prev}"><span aria-hidden="true">← </span>Previous photo</a>{:else}<span></span>{/if}
	{#if next}<a rel="next" href="/blog/{day.day}/photo/{next}">Next photo<span aria-hidden="true"> →</span></a>{/if}
</nav>
<p class="hint">Tip: the left and right arrow keys move between photos.</p>
<p class="links">
	<a href="/blog/{day.day}">Back to Day {day.index + 1}</a>
	{#if tourOn}<a class="dx" href={mapLink(day.day, photo.t, { photo: photo.id })}>See where it was taken in the {TOUR_NAME}<span aria-hidden="true"> ↗</span></a>{/if}
</p>

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
	figure {
		margin: 0;
	}
	figure :global(img) {
		display: block;
		width: 100%;
		height: auto;
		max-height: 78vh;
		object-fit: contain;
		border-radius: 10px;
		background: var(--b-card);
	}
	figcaption {
		margin-top: 0.7rem;
		color: var(--b-muted);
	}
	h1 {
		margin: 0 0 0.8rem;
		font-size: clamp(1.4rem, 3.5vw, 1.9rem);
		line-height: 1.25;
	}
	.sub {
		display: block;
		font-size: 1rem;
		font-weight: 400;
		color: var(--b-muted);
	}
	.pager {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.2rem;
		font-weight: 600;
	}
	.pager a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 0.2rem;
	}
	.hint {
		font-size: 0.95rem;
		color: var(--b-muted);
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		padding-top: 1rem;
		border-top: 1px solid var(--b-line);
	}
	.links a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}
	.dx {
		padding: 0 1rem;
		border-radius: 8px;
		background: var(--b-accent);
		color: var(--b-bg) !important;
		font-weight: 600;
		text-decoration: none;
	}
</style>
