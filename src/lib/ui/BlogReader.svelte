<!--
  Blog reader: the open post in a panel on the right — cover photo, which day and when, the
  rendered Markdown, then "Ride here" and previous / next post across the whole tour.
  Photos embedded in the post open the gallery. Esc or × closes it.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { A } from '$lib/activity';
	import { TOUR } from '$lib/tourConfig';
	import { photoSrc } from '$lib/tourConfig';
	import { on } from '$lib/flags';
	import type { App } from '$lib/app.svelte';
	import { clock } from '$lib/data';
	import { copyLink, momentUrl } from '$lib/moment';

	let linked = $state(false);
	async function share() {
		if (!post) return;
		// the post's own moment, whichever day is on screen
		const url = new URL(momentUrl(app, { post: post.slug, t: post.t }));
		url.pathname = `${base}/day/${post.day}`;
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
		new Date(s * 1000).toLocaleDateString(TOUR.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TOUR.timeZone });

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
			<img class="cover" src={photoSrc('large', post.cover)} alt="" />
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
				<button class="ride" onclick={() => app.rideTo(post, onride)}>▶ {A.go} here</button>
				<button class="link" onclick={share} title="Copy a link to this post">{linked ? '✓ Copied' : '🔗 Link'}</button>
				{#if on('blog')}<a class="link" href="{base}/blog/{post.day}/{post.slug}">📖 Read in the blog</a>{/if}
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
		border: 0;
		border-radius: 24px;
		background: var(--card);
		color: var(--text);
		box-shadow:
			var(--shadow),
			0 0 0 1px var(--line);
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
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--card);
		box-shadow:
			var(--press),
			0 0 0 1px var(--line);
		color: var(--text);
		font-size: 20px;
		z-index: 1;
	}
	.cover {
		display: block;
		width: 100%;
		height: 200px;
		object-fit: cover;
		border-radius: 24px 24px 0 0;
	}
	.kicker,
	h1,
	.when,
	.prose,
	footer {
		padding: 0 18px;
	}
	.kicker {
		margin: 16px 0 4px;
		font-size: 11px;
		font-weight: 750;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent-ink);
	}
	.kicker b {
		font-weight: 600;
	}
	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-variation-settings:
			'SOFT' 100,
			'WONK' 1;
		font-weight: 650;
		font-size: 26px;
		line-height: 1.15;
	}
	.when {
		margin: 4px 0 12px;
		font-size: 12px;
		color: var(--muted);
	}
	.prose {
		font-size: 15px;
		line-height: 1.7;
		color: var(--text);
	}
	.prose :global(p) {
		margin: 0 0 12px;
	}
	.prose :global(em) {
		color: var(--muted);
	}
	.prose :global(a) {
		color: var(--accent-ink);
	}
	.prose :global(h2),
	.prose :global(h3) {
		margin: 18px 0 8px;
		color: var(--text);
	}
	.prose :global(blockquote) {
		margin: 0 0 12px;
		padding-left: 12px;
		border-left: 4px solid var(--accent);
		font-family: var(--font-display);
		color: var(--text);
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
		padding: 7px 14px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 650;
	}
	.ride {
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 3px 0 color-mix(in srgb, var(--accent) 55%, #000);
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
		padding: 7px 12px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 650;
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
			border-radius: 24px 24px 0 0;
			padding-bottom: calc(16px + env(safe-area-inset-bottom));
		}
		.close {
			width: 40px;
			height: 40px;
			font-size: 24px;
		}
		.cover {
			height: 170px;
			border-radius: 24px 24px 0 0;
		}
		footer button {
			padding: 10px 12px;
		}
	}
</style>
