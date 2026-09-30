<!-- Any page that isn't there (or fails): say so plainly and offer the ways back in. -->
<script lang="ts">
	import { TOUR } from '$lib/tourConfig';
	import { page } from '$app/state';
	import { on, tourOn, TOUR_NAME } from '$lib/flags';

	const missing = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Something went wrong'} · {TOUR.name}</title>
</svelte:head>

<main class="err">
	<p class="code">{page.status}</p>
	<h1>{missing ? "This page isn't here" : 'Something went wrong'}</h1>
	<p>
		{#if missing}
			It may have moved, or the link may be mistyped.
		{:else}
			Sorry, that didn't load. Trying again in a moment usually works.
		{/if}
	</p>
	<ul>
		{#if tourOn}<li><a href="/">Open the {TOUR_NAME}</a></li>{/if}
		{#if on('blog')}<li><a href="/blog">Read the tour as a blog</a></li>{/if}
	</ul>
</main>

<style>
	.err {
		max-width: 36rem;
		margin: 0 auto;
		padding: 18vh 1.5rem 3rem;
		color: var(--text);
		font-size: 1.1rem;
		line-height: 1.6;
	}
	.code {
		margin: 0;
		color: var(--muted);
		letter-spacing: 0.2em;
	}
	h1 {
		margin: 0.2rem 0 0.6rem;
		font-size: 1.8rem;
		line-height: 1.2;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 1rem;
		border: 1px solid var(--line);
		border-radius: 8px;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}
	a:hover {
		background: var(--accent-soft);
	}
</style>
