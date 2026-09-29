<!--
  The plain blog: the same tour as the 3D experience — every day and every event — as simple,
  readable pages. No 3D rendering here. Follows the system's light/dark setting, scales with
  browser zoom, and every moment links back into the 3D view.
-->
<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();

	// "Open the 3D tour" at the day you're reading (or the whole tour)
	const tourHref = $derived(page.params.day ? `/day/${page.params.day}` : '/');
</script>

<div class="blog">
	<a class="skip" href="#content">Skip to content</a>
	<header class="site">
		<div class="inner">
			<a class="brand" href="/blog">
				<span class="mark" aria-hidden="true">◉</span>
				<span>UK Tour <small>· September 2026</small></span>
			</a>
			<nav aria-label="Site">
				<a href="/blog" aria-current={page.url.pathname === '/blog' ? 'page' : undefined}>All days</a>
				<a class="dx" href={tourHref}>Open the 3D tour ↗</a>
			</nav>
		</div>
	</header>

	<main id="content" tabindex="-1">
		{@render children()}
	</main>

	<footer class="site">
		<div class="inner">
			<p>
				Place names from <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a> ·
				weather by <a href="https://open-meteo.com/">Open-Meteo.com</a>
			</p>
		</div>
	</footer>
</div>

<style>
	.blog {
		/* every text colour ≥ 7:1 on bg and card (WCAG AAA) */
		--b-bg: #f6f8f9;
		--b-card: #ffffff;
		--b-text: #13202a;
		--b-muted: #3c4b55;
		--b-line: #d7e0e5;
		--b-line-strong: #7d8f99;
		--b-accent: #054e5a;
		--b-link: #054e5a;
		--b-warm: #9a6614;
		--b-warm-text: #6b4510;
		min-height: 100vh;
		background: var(--b-bg);
		color: var(--b-text);
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 1.0625rem;
		line-height: 1.6;
	}
	@media (prefers-color-scheme: dark) {
		.blog {
			--b-bg: #081016;
			--b-card: #0e1a21;
			--b-text: #e4eff4;
			--b-muted: #a9bcc6;
			--b-line: #1e2f39;
			--b-line-strong: #5d7684;
			--b-accent: #7cf7ff;
			--b-link: #8ee9f5;
			--b-warm: #ffd166;
			--b-warm-text: #ffd98a;
		}
	}
	/* keep focused / jumped-to content clear of the sticky header (WCAG 2.4.12) */
	:global(html:has(.blog)) {
		scroll-padding-top: 5rem;
		scroll-padding-bottom: 1.5rem;
	}
	.blog :global(p) {
		margin-block: 0 1.5em;
	}
	.blog :global(a) {
		color: var(--b-link);
		text-underline-offset: 0.18em;
	}
	.blog :global(a:focus-visible),
	.blog :global(button:focus-visible) {
		outline: 3px solid var(--b-accent);
		outline-offset: 2px;
		border-radius: 4px;
	}
	.brand {
		min-height: 2.75rem;
	}
	.skip {
		position: absolute;
		left: 0.5rem;
		top: -3rem;
		padding: 0.5rem 0.8rem;
		background: var(--b-card);
		border-radius: 6px;
		z-index: 10;
	}
	.skip:focus {
		top: 0.5rem;
	}
	.inner {
		max-width: 46rem;
		margin: 0 auto;
		padding: 0 1rem;
	}
	header.site {
		position: sticky;
		top: 0;
		z-index: 5;
		background: color-mix(in srgb, var(--b-bg) 88%, transparent);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--b-line);
		padding-top: env(safe-area-inset-top);
	}
	header .inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 3.5rem;
		flex-wrap: wrap;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 700;
		color: var(--b-text) !important;
		text-decoration: none;
	}
	.brand small {
		font-weight: 400;
		color: var(--b-muted);
	}
	.mark {
		color: var(--b-accent);
	}
	nav {
		display: flex;
		gap: 0.25rem;
	}
	nav a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 0.85rem;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.95rem;
	}
	nav a[aria-current='page'] {
		background: var(--b-card);
		border: 1px solid var(--b-line);
	}
	nav a.dx {
		background: var(--b-accent);
		color: var(--b-bg) !important;
	}
	main {
		max-width: 46rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		outline: none;
	}
	footer.site {
		border-top: 1px solid var(--b-line);
		padding: 1rem 0 calc(1rem + env(safe-area-inset-bottom));
		font-size: 0.85rem;
		color: var(--b-muted);
	}
	@media (prefers-reduced-motion: reduce) {
		.blog :global(*) {
			scroll-behavior: auto !important;
		}
	}
</style>
