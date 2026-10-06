<!--
  Root: every page (the globe, the map and the blog) wears Postcard (@jonibach/postcard): its tokens,
  fonts, components and themes. What's left here is the app's own frame around it: full-height
  pages for the globe and map, and the blog's reading typography. The 3D view's panels use
  Postcard's night theme (pc-theme-night, in the (dx) layout).
-->
<script lang="ts">
	import '@jonibach/postcard/postcard.min.css';
	import SubscribePrompt from '$lib/blog/SubscribePrompt.svelte';
	let { children } = $props();
</script>

{@render children()}
<SubscribePrompt />

<style>
	:global(html, body) {
		height: 100%;
	}
	:global(html.app-surface),
	:global(html.app-surface body) {
		overflow: hidden;
	}
	/* the blog's reading typography (the blog, and the story editor's preview) */
	:global(.blog-palette) {
		font-size: var(--pc-text-read);
		line-height: var(--pc-leading-body);
		color: var(--pc-ink);
	}
	:global(.blog-palette p) {
		margin-block: 0 1.5em;
	}
	:global(.blog-palette h1),
	:global(.blog-palette h2),
	:global(.blog-palette h3) {
		font-family: var(--pc-font-display);
		font-variation-settings: var(--pc-display-axes);
		font-weight: var(--pc-weight-display);
		letter-spacing: -0.01em;
		line-height: var(--pc-leading-tight);
	}
	:global(.blog-palette a) {
		color: var(--pc-accent-ink);
		text-underline-offset: 0.18em;
	}
</style>
