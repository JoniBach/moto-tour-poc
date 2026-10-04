<!-- "You're subscribed": where the mailing list's confirmation link ends up. -->
<script lang="ts">
	import { base } from '$app/paths';
	import { TOUR } from '$lib/tourConfig';

	let { data } = $props();
</script>

<svelte:head>
	<title>You’re subscribed · {TOUR.name} blog</title>
	<!-- only reached from the confirmation email -->
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="done">
	<p class="eyebrow">{TOUR.name} · mailing list</p>
	<h1>You’re subscribed</h1>
	<p class="lede">Thanks for confirming. Each new story will come to your inbox as it goes out, and every email has a link to unsubscribe.</p>
	{#if data.latest.length}
		<h2>The latest {data.latest.length === 1 ? 'story' : 'stories'}</h2>
		<ul>
			{#each data.latest as s (s.slug)}
				<li>
					<a href="{base}/blog/{s.day}/{s.slug}">{s.title}</a>
					<p>{s.excerpt}</p>
				</li>
			{/each}
		</ul>
	{/if}
	<p><a href="{base}/blog">Read the whole trip, day by day</a></p>
</article>

<style>
	.done {
		max-width: 40rem;
		margin: 1rem 0 3rem;
	}
	.eyebrow {
		margin: 0 0 0.4rem;
		font-size: 0.8rem;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--b-muted);
	}
	h1 {
		margin: 0 0 0.75rem;
		font-family: var(--font-display, inherit);
	}
	.lede {
		font-size: 1.15rem;
	}
	h2 {
		margin: 2rem 0 0.5rem;
		font-size: 1.2rem;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0 0 1.5rem;
	}
	li {
		margin: 0 0 1rem;
	}
	li p {
		margin: 0.2rem 0 0;
		color: var(--b-muted);
	}
	a {
		color: var(--b-link);
		font-weight: 600;
	}
</style>
