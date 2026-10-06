<!-- Any page that isn't there (or fails): say so plainly and offer the ways back in. -->
<script lang="ts">
	import { base } from '$app/paths';
	import { TOUR } from '$lib/tourConfig';
	import { page } from '$app/state';
	import { on, tourOn, TOUR_NAME } from '$lib/flags';

	const missing = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Something went wrong'} · {TOUR.name}</title>
</svelte:head>

<main class="err pc-sky">
	<p class="pc-stamp pc-stamp--lg stamp" aria-hidden="true">{page.status}</p>
	<h1 class="pc-h1">{missing ? "This page isn't here" : 'Something went wrong'}</h1>
	<p class="pc-lede">
		{#if missing}
			It may have moved, or the link may be mistyped.
		{:else}
			Sorry, that didn't load. Trying again in a moment usually works.
		{/if}
	</p>
	<ul>
		{#if tourOn}<li><a class="pc-button pc-button--primary pc-button--lg" href="{base}/">Open the {TOUR_NAME} <span aria-hidden="true">→</span></a></li>{/if}
		{#if on('blog')}<li><a class="pc-button pc-button--lg" href="{base}/blog">Read the tour as a blog</a></li>{/if}
	</ul>
	<span class="pc-sr-only">Error {page.status}</span>
</main>

<style>
	/* Postcard's sky, stamp, heading and buttons; this is the page's column */
	.err {
		min-height: 100vh;
		box-sizing: border-box;
		padding: 18vh 1.5rem 3rem;
		color: var(--pc-ink);
		font-size: 1.1rem;
		line-height: 1.6;
	}
	.err > * {
		max-width: 34rem;
		margin-left: auto;
		margin-right: auto;
	}
	.stamp {
		--pc-c: var(--pc-accent);
		margin-bottom: 1.2rem;
		/* three digits on the large stamp */
		font-size: 1.6rem;
	}
	/* sits at the start of the column, not centred in it */
	.err > .stamp {
		display: grid;
		margin-left: max(0px, calc((100% - 34rem) / 2));
	}
	h1 {
		margin-top: 0;
		margin-bottom: 0.5rem;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		margin-top: 1.5rem;
		padding: 0;
		list-style: none;
	}
</style>
