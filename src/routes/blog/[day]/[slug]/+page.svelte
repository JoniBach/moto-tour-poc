<!-- A story, as an article pinned to its moment of the journey (StoryArticle). -->
<script lang="ts">
	import { TOUR } from '$lib/tourConfig';
	import StoryArticle from '$lib/blog/StoryArticle.svelte';
	import Meta from '$lib/blog/Meta.svelte';

	let { data } = $props();
</script>

<Meta title="{data.post.title} · {TOUR.name} blog" description={data.post.excerpt} image={data.share} published={data.post.published} />

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
