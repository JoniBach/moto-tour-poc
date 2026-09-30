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

<main class="err">
	<p class="stamp" aria-hidden="true">{page.status}</p>
	<h1 class="display">{missing ? "This page isn't here" : 'Something went wrong'}</h1>
	<p class="lede">
		{#if missing}
			It may have moved, or the link may be mistyped.
		{:else}
			Sorry, that didn't load. Trying again in a moment usually works.
		{/if}
	</p>
	<ul>
		{#if tourOn}<li><a class="go" href="{base}/">Open the {TOUR_NAME} <span aria-hidden="true">→</span></a></li>{/if}
		{#if on('blog')}<li><a class="read" href="{base}/blog">Read the tour as a blog</a></li>{/if}
	</ul>
	<span class="sr">Error {page.status}</span>
</main>

<style>
	/* the tour's sky, fading into paper, like the blog */
	.err {
		min-height: 100vh;
		box-sizing: border-box;
		padding: 18vh 1.5rem 3rem;
		background: linear-gradient(to bottom, #cfe6f5 0, #e6f1f6 16rem, #fbf6ec 34rem);
		color: var(--text);
		font-size: 1.1rem;
		line-height: 1.6;
	}
	.err > * {
		max-width: 34rem;
		margin-left: auto;
		margin-right: auto;
	}
	.stamp {
		display: grid;
		place-items: center;
		width: 4.4rem;
		height: 4.8rem;
		margin-bottom: 1.2rem;
		border: 3px dotted var(--accent);
		border-radius: 8px;
		background: var(--accent-soft);
		color: var(--text);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.6rem;
		transform: rotate(-4deg);
	}
	/* sits at the start of the column, not centred in it */
	.err > .stamp {
		margin-left: max(0px, calc((100% - 34rem) / 2));
	}
	h1 {
		margin-top: 0;
		margin-bottom: 0.5rem;
		font-size: 2.2rem;
		line-height: 1.1;
	}
	.lede {
		color: var(--muted);
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		margin-top: 1.5rem;
		padding: 0;
		list-style: none;
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.9rem;
		padding: 0 1.2rem;
		border-radius: 999px;
		font-weight: 700;
		text-decoration: none;
	}
	.go {
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--accent) 55%, #000);
	}
	.read {
		background: var(--card);
		color: var(--text);
		box-shadow:
			var(--press),
			0 0 0 1px var(--line);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
