<!--
  A tour photo for the blog: responsive sources (320 / 800 / 1600 px WebP), intrinsic
  width/height so the page never jumps as images load, async decoding, and lazy loading
  unless it's the page's main image (then it's fetched first).
-->
<script lang="ts">
	let {
		id,
		alt,
		size,
		sizes = '100vw',
		priority = false,
		class: cls = ''
	}: {
		id: string;
		alt: string;
		size?: [number, number];
		sizes?: string;
		priority?: boolean;
		class?: string;
	} = $props();

	const srcset = $derived(`/photos/thumb/${id}.webp 320w, /photos/medium/${id}.webp 800w, /photos/large/${id}.webp 1600w`);
	// the stored size is the 1600 px image's; its ratio is all the browser needs
	const [w, h] = $derived(size ?? [4, 3]);
</script>

<img
	class={cls}
	src="/photos/medium/{id}.webp"
	{srcset}
	{sizes}
	width={w}
	height={h}
	{alt}
	loading={priority ? 'eager' : 'lazy'}
	decoding="async"
	fetchpriority={priority ? 'high' : 'auto'}
/>
