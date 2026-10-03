<!--
  Step 1 of the WYSIWYG story editor, the in-site half: the same bare Tiptap editor as
  static/tiptap-test.html, but inside the site (its root layout, fonts and global styles) and set in
  the blog's reading type, with the same keystroke timing. Compared on an iPad, the two say whether
  typing is smooth in Tiptap, and whether anything in the site slows it. Temporary.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { mountSpike } from '$lib/spike/tiptapSpike.js';

	let doc: HTMLElement;
	let out: HTMLElement;
	let spike: ReturnType<typeof mountSpike> | null = null;
	let md = $state('');
	onMount(() => {
		spike = mountSpike(doc, out);
		return () => spike?.destroy();
	});
</script>

<svelte:head>
	<title>Tiptap test (in the site)</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
	<div class="stats">
		<b>In the site</b> · <span bind:this={out}>loading…</span>
		<button type="button" onclick={() => spike?.reset()}>Reset</button>
		<button type="button" onclick={() => (md = spike?.markdown() ?? '')}>Show Markdown</button>
	</div>
	<article class="blog-palette">
		<div class="prose" bind:this={doc}></div>
	</article>
	{#if md}<pre>{md}</pre>{/if}
</div>

<style>
	.page {
		min-height: 100vh;
		box-sizing: border-box;
		padding: 16px;
		background: var(--paper);
	}
	.stats {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 8px 10px;
		border-radius: 10px;
		background: #263238;
		color: #fff;
		font: 13px/1.4 var(--font-ui);
	}
	article {
		max-width: 40rem;
		margin: 16px auto;
		padding: 24px;
		border-radius: 24px;
		background: var(--card);
		box-shadow: var(--shadow);
	}
	.prose :global(.ProseMirror) {
		outline: none;
		min-height: 50vh;
	}
	pre {
		max-width: 40rem;
		margin: 0 auto;
		white-space: pre-wrap;
		font-size: 12px;
	}
</style>
