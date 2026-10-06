<!--
  The blog: the same tour as the globe and the map (every day and every event) as simple,
  readable pages, and one of the tour's views: the same sky, the same floating pill bar (brand,
  then Globe · Map · Blog), the same postcard palette. No 3D rendering here; scales with browser
  zoom, and every moment links back into the tour.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { TOUR } from '$lib/tourConfig';
	import { on, VIEWS_ON } from '$lib/flags';
	import { page } from '$app/state';
	import JourneyRail from '$lib/blog/JourneyRail.svelte';
	import Subscribe from '$lib/blog/Subscribe.svelte';
	import Icon from '$lib/ui/Icon.svelte';

	let { data, children } = $props();

	const withForm = $derived(page.route.id === '/blog' || page.route.id === '/blog/[day]/[slug]');
	// the other views open at the day you're reading
	const at = $derived(page.params.day ? `${base}/day/${page.params.day}` : `${base}/`);
	const views = (
		[
			{ id: 'globe', label: 'Globe', icon: 'globe' },
			{ id: '2d', label: 'Map', icon: 'map' }
		] as const
	).filter((v) => VIEWS_ON.includes(v.id));
</script>

<div class="blog blog-palette pc-sky">
	<a class="pc-skip-link" href="#content">Skip to content</a>
	<header class="pc-topbar">
		<a class="pc-pill pc-brand" href="{base}/" title="The tour">
			<span class="pc-mark" aria-hidden="true">
				<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M4.5 15c3-1 4-5 7.5-5s3.5 3 7.5 2" /></svg>
			</span>
			<span class="pc-brand__name pc-display">{TOUR.name}</span>
		</a>
		<nav class="pc-segmented" aria-label="Views">
			{#each views as v (v.id)}
				<a href="{at}?view={v.id}"><Icon name={v.icon} /> {v.label}</a>
			{/each}
			<a href="{base}/blog" aria-current={page.url.pathname === `${base}/blog` ? 'page' : 'true'}><Icon name="pen" /> Blog</a>
		</nav>
	</header>

	<div class="shell">
		{#if data.rail?.length}<JourneyRail days={data.rail} />{/if}
		<main id="content" tabindex="-1">
			{@render children()}
		</main>
	</div>

	<footer class="site">
		<!-- the front page and stories have the sign-up in the page; elsewhere it's here -->
		{#if on('stories') && TOUR.newsletter && on('newsletter') && !withForm}
			<Subscribe variant="line" />
		{:else if on('stories')}
			<p class="follow">
				<a href="{base}/blog/feed.xml" type="application/rss+xml"><Icon name="rss" /> Follow new stories by RSS</a>
			</p>
		{/if}
		<p>
			Place names and national parks from <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a
			>{#if on('weather')}{' · '}weather by <a href="https://open-meteo.com/">Open-Meteo.com</a>{/if}
		</p>
	</footer>
</div>

<style>
	/* the blog's frame: Postcard's sky, top bar, brand and view switch, with the journey rail beside the page */
	.blog {
		color-scheme: light;
		min-height: 100vh;
		color: var(--pc-ink);
		font-family: var(--pc-font-ui);
		font-size: var(--pc-text-read);
		line-height: var(--pc-leading-body);
	}
	.pc-topbar {
		padding-inline: 1rem;
	}
	.pc-brand {
		color: var(--pc-ink) !important;
		text-decoration: none;
	}
	.pc-segmented a {
		color: var(--pc-muted);
		text-decoration: none;
	}
	.pc-segmented a[aria-current]:not([aria-current='false']) {
		color: var(--pc-paper);
	}
	footer.site {
		max-width: var(--pc-page);
		margin: 0 auto;
		padding: 1.5rem 1rem calc(1.5rem + env(safe-area-inset-bottom));
		font-size: 0.85rem;
		color: var(--pc-muted);
	}
	footer.site p {
		margin: 0;
	}
	.follow {
		margin-bottom: 0.6rem !important;
		font-size: 0.95rem;
	}
	.follow a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--pc-ink);
	}
	@media (max-width: 30rem) {
		.pc-segmented a {
			padding: 0 0.75rem;
		}
	}
	/* keep focused / jumped-to content clear of the sticky header (WCAG 2.4.12) */
	:global(html:has(.blog)) {
		scroll-padding-top: 5rem;
		scroll-padding-bottom: 1.5rem;
	}
	.blog :global(a:focus-visible),
	.blog :global(button:focus-visible) {
		outline: 3px solid var(--pc-accent-ink);
		outline-offset: 2px;
		border-radius: 6px;
	}
	.shell {
		display: grid;
		grid-template-columns: 17rem minmax(0, 46rem);
		justify-content: center;
		gap: 3rem;
		max-width: var(--pc-page);
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
	}
	main {
		min-width: 0;
		outline: none;
	}
	@media (max-width: 68rem) {
		.shell {
			display: block;
			max-width: 46rem;
			padding-top: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.blog :global(*) {
			scroll-behavior: auto !important;
		}
	}
</style>
