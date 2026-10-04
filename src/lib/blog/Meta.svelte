<!--
  A blog page's title and share card: what a link to it shows in messages and social posts (Open
  Graph, Twitter), and its canonical address. The site name and og:type come from src/app.html.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { ORIGIN } from '$lib/tourConfig';

	let {
		title,
		description,
		image = null,
		published = null
	}: {
		title: string;
		description: string;
		/** a full address (blog-data shareImage) */
		image?: string | null;
		/** a story's "published" (epoch seconds) */
		published?: number | null;
	} = $props();

	const url = $derived(ORIGIN + page.url.pathname);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	{#if image}
		<meta property="og:image" content={image} />
		<meta name="twitter:card" content="summary_large_image" />
	{:else}
		<meta name="twitter:card" content="summary" />
	{/if}
	{#if published}<meta property="article:published_time" content={new Date(published * 1000).toISOString()} />{/if}
</svelte:head>
