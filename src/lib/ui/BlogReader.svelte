<!--
  Blog reader: the open post in a panel on the right — cover photo, which day and when, the
  rendered Markdown, then "Ride here" and previous / next post across the whole tour.
  Photos embedded in the post open the gallery. Esc or × closes it.
-->
<script lang="ts">
	import type { App } from '$lib/app.svelte';
	import { clock } from '$lib/data';
	import { copyLink, momentUrl } from '$lib/moment';

	let linked = $state(false);
	async function share() {
		if (!post) return;
		// the post's own moment, whichever day is on screen
		const url = new URL(momentUrl(app, { post: post.slug, t: post.t }));
		url.pathname = `/day/${post.day}`;
		url.searchParams.delete('photo');
		linked = await copyLink(url.toString());
		setTimeout(() => (linked = false), 1500);
	}

	let { app, onride }: { app: App; onride: (day: string) => void } = $props();

	const post = $derived(app.reading);
	const day = $derived(app.summary(post?.day));
	const k = $derived(post ? app.posts.indexOf(post) : -1);
	const prev = $derived(k > 0 ? app.posts[k - 1] : null);
	const next = $derived(k >= 0 && k < app.posts.length - 1 ? app.posts[k + 1] : null);
	const date = (s: number) =>
		new Date(s * 1000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });

	let body = $state<HTMLElement>();
	$effect(() => {
		void post;
		body?.scrollTo({ top: 0 });
	});

	// embedded tour photos open the gallery (at that photo, among the post's photos)
	function onclick(e: MouseEvent) {
		const img = (e.target as HTMLElement).closest<HTMLImageElement>('img[data-photo]');
		if (!img || !body) return;
		const ids = [...body.querySelectorAll<HTMLImageElement>('img[data-photo]')].map((i) => i.dataset.photo);
		const photos = ids.map((id) => app.photos.find((p) => p.id === id)).filter((p) => !!p);
		const index = photos.findIndex((p) => p.id === img.dataset.photo);
		if (index >= 0) app.gallery = { photos, index };
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && app.reading && !app.gallery) app.reading = null;
	}
</script>

<svelte:window {onkeydown} />

{#if post}
	<article class="reader scroll-y" class:beside-drawer={app.settings.eventsOpen} bind:this={body}>
		<!-- zero-height sticky bar: the close button floats over the cover without taking space -->
		<div class="close-bar"><button class="close" onclick={() => (app.reading = null)} aria-label="Close">×</button></div>
		{#if post.cover}
			<img class="cover" src="/photos/large/{post.cover}.webp" alt="" />
		{/if}
		<p class="kicker">
			✎ Story{#if day} · <b>Day {day.index + 1}</b> · {day.title}{/if}
		</p>
		<h1>{post.title}</h1>
		<p class="when">{date(post.t)} · {clock(post.t)} · {post.minutes} min read</p>

		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="prose" {onclick}>
			<!-- the author's own Markdown, rendered at build time (scripts/build-blog.mjs) -->
			{@html post.html}
		</div>

		<footer>
			<span class="actions">
				<button class="ride" onclick={() => app.rideTo(post, onride)}>▶ Ride here</button>
				<button class="link" onclick={share} title="Copy a link to this post">{linked ? '✓ Copied' : '🔗 Link'}</button>
				<a class="link" href="/blog/{post.day}/{post.slug}">📖 Read in the blog</a>
			</span>
			<nav>
				<button disabled={!prev} onclick={() => (app.reading = prev)} title={prev?.title}>‹ Previous</button>
				<button disabled={!next} onclick={() => (app.reading = next)} title={next?.title}>Next ›</button>
			</nav>
		</footer>
	</article>
{/if}

<style>
	.reader {
		position: absolute;
		z-index: 106;
		top: 84px;
		right: 16px;
		bottom: 216px;
		width: 400px;
		box-sizing: border-box;
		padding: 0 0 16px;
		border: 1px solid #ffd166;
		border-radius: 14px;
		background: rgba(4, 12, 20, 0.9);
		backdrop-filter: blur(12px);
		color: var(--text);
		box-shadow: 0 0 24px rgba(255, 209, 102, 0.18);
		user-select: text;
	}
	.reader.beside-drawer {
		right: 332px;
	}
	.close-bar {
		position: sticky;
		top: 0;
		height: 0;
		z-index: 2;
	}
	.close {
		all: unset;
		cursor: pointer;
		position: absolute;
		top: 8px;
		right: 10px;
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: rgba(4, 12, 20, 0.8);
		color: var(--muted);
		font-size: 20px;
		z-index: 1;
	}
	.cover {
		display: block;
		width: 100%;
		height: 200px;
		object-fit: cover;
		border-radius: 13px 13px 0 0;
	}
	.kicker,
	h1,
	.when,
	.prose,
	footer {
		padding: 0 18px;
	}
	.kicker {
		margin: 14px 0 4px;
		font-size: 11px;
		letter-spacing: 0.06em;
		color: #ffd166;
	}
	.kicker b {
		font-weight: 600;
	}
	h1 {
		margin: 0;
		font-size: 22px;
		line-height: 1.25;
	}
	.when {
		margin: 4px 0 12px;
		font-size: 12px;
		color: var(--muted);
	}
	.prose {
		font-size: 14px;
		line-height: 1.65;
		color: #cfe6ef;
	}
	.prose :global(p) {
		margin: 0 0 12px;
	}
	.prose :global(em) {
		color: var(--muted);
	}
	.prose :global(a) {
		color: var(--accent);
	}
	.prose :global(h2),
	.prose :global(h3) {
		margin: 18px 0 8px;
		color: var(--text);
	}
	.prose :global(blockquote) {
		margin: 0 0 12px;
		padding-left: 12px;
		border-left: 2px solid #ffd166;
		color: var(--muted);
	}
	.prose :global(figure) {
		margin: 14px -18px;
	}
	.prose :global(figure img) {
		display: block;
		width: 100%;
		height: auto;
		cursor: zoom-in;
	}
	.prose :global(figcaption) {
		padding: 6px 18px 0;
		font-size: 12px;
		color: var(--muted);
	}
	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--line);
	}
	footer button {
		all: unset;
		cursor: pointer;
		padding: 5px 10px;
		border-radius: 8px;
		font-size: 12px;
	}
	.ride {
		background: rgba(255, 209, 102, 0.18);
		color: #ffe3a3;
	}
	.actions {
		display: flex;
		gap: 4px;
	}
	.link {
		color: var(--muted);
		text-decoration: none;
	}
	a.link {
		padding: 5px 10px;
		border-radius: 8px;
		font-size: 12px;
	}
	.link:hover {
		color: var(--text);
		background: var(--accent-soft);
	}
	nav {
		display: flex;
		gap: 4px;
	}
	nav button {
		color: var(--muted);
	}
	nav button:hover:not(:disabled) {
		color: var(--text);
		background: var(--accent-soft);
	}
	nav button:disabled {
		opacity: 0.3;
		cursor: default;
	}
	/* phones: a full-width bottom sheet over everything */
	@media (max-width: 900px) {
		.reader,
		.reader.beside-drawer {
			z-index: 160;
			left: 0;
			right: 0;
			top: auto;
			bottom: 0;
			width: auto;
			max-height: 86dvh;
			border-radius: 18px 18px 0 0;
			border-bottom: none;
			padding-bottom: calc(16px + env(safe-area-inset-bottom));
		}
		.close {
			width: 40px;
			height: 40px;
			font-size: 24px;
		}
		.cover {
			height: 170px;
			border-radius: 17px 17px 0 0;
		}
		footer button {
			padding: 10px 12px;
		}
	}
</style>
