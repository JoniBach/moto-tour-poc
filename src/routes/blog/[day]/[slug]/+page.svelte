<!-- A story, as an article pinned to its moment of the journey (StoryArticle). -->
<script lang="ts">
	import { TOUR } from '$lib/tourConfig';
	import StoryArticle from '$lib/blog/StoryArticle.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.post.title} · {TOUR.name} blog</title>
	<meta name="description" content={data.post.excerpt} />
</svelte:head>

<StoryArticle
	post={data.post}
	cover={data.cover}
	day={data.day}
	dayCount={data.dayCount}
	where={data.where}
	place={data.place}
	prev={data.prev}
	next={data.next}
/>
