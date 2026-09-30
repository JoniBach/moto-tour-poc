<!--
  The blog: the same tour as the globe and the map (every day and every event) as simple,
  readable pages in the same postcard look. No 3D rendering here. Follows the system's light/dark
  setting, scales with browser zoom, and every moment links back into the tour.
-->
<script lang="ts">
	import { TOUR } from '$lib/tourConfig';
	import { on, tourOn, TOUR_NAME } from '$lib/flags';
	import { page } from '$app/state';

	let { children } = $props();

	// "Open the 3D tour" (or map / globe: the default view) at the day you're reading
	const tourHref = $derived(page.params.day ? `/day/${page.params.day}` : '/');
</script>

<div class="blog">
	<a class="skip" href="#content">Skip to content</a>
	<header class="site">
		<div class="inner">
			<a class="brand" href="/blog">
				<span class="mark" aria-hidden="true">
					<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M4.5 15c3-1 4-5 7.5-5s3.5 3 7.5 2" /></svg>
				</span>
				<span class="display">{TOUR.name} <small>· {TOUR.when}</small></span>
			</a>
			<nav aria-label="Site">
				<a href="/blog" aria-current={page.url.pathname === '/blog' ? 'page' : undefined}>All days</a>
				{#if tourOn}<a class="dx" href={tourHref}>Open the {TOUR_NAME} <span aria-hidden="true">→</span></a>{/if}
			</nav>
		</div>
	</header>

	<main id="content" tabindex="-1">
		{@render children()}
	</main>

	<footer class="site">
		<div class="inner">
			<p>
				Place names and national parks from <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a
				>{#if on('weather')}{' · '}weather by <a href="https://open-meteo.com/">Open-Meteo.com</a>{/if}
			</p>
		</div>
	</footer>
</div>

<style>
	.blog {
		/* the postcard palette; every text colour ≥ 7:1 on bg and card (WCAG AAA) */
		--b-bg: #fbf6ec;
		--b-card: #fffdf8;
		--b-text: #263238;
		--b-muted: #46535a;
		--b-line: #e8dfcd;
		--b-line-strong: #a5998a;
		--b-accent: #7a2e0f;
		--b-link: #7a2e0f;
		--b-warm: #c9a227;
		--b-warm-text: #524008;
		--b-soft: #f9e2d6;
		min-height: 100vh;
		background: var(--b-bg);
		color: var(--b-text);
		font-family: var(--font-ui);
		font-size: 1.0625rem;
		line-height: 1.6;
	}
	@media (prefers-color-scheme: dark) {
		.blog {
			/* night: warm dark paper, the same terracotta lifted to a peach */
			--b-bg: #1d1a16;
			--b-card: #28231d;
			--b-text: #f3ece0;
			--b-muted: #c9bfae;
			--b-line: #3a332a;
			--b-line-strong: #7d7160;
			--b-accent: #f4a98a;
			--b-link: #f4a98a;
			--b-warm: #f0d78c;
			--b-warm-text: #f0d78c;
			--b-soft: #3a2a22;
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
	.blog :global(h1),
	.blog :global(h2),
	.blog :global(h3) {
		font-family: var(--font-display);
		font-variation-settings:
			'SOFT' 100,
			'WONK' 1;
		font-weight: 650;
		letter-spacing: -0.01em;
		line-height: 1.15;
	}
	.blog :global(a) {
		color: var(--b-link);
		text-underline-offset: 0.18em;
	}
	.blog :global(a:focus-visible),
	.blog :global(button:focus-visible) {
		outline: 3px solid var(--b-accent);
		outline-offset: 2px;
		border-radius: 6px;
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
		border-radius: 999px;
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
		gap: 0.6rem;
		font-size: 1.15rem;
		color: var(--b-text) !important;
		text-decoration: none;
	}
	.brand small {
		font-family: var(--font-ui);
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--b-muted);
	}
	.mark {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: #c2562d;
	}
	.mark svg {
		width: 1.3rem;
		height: 1.3rem;
		fill: none;
		stroke: #fff;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.mark circle {
		stroke-opacity: 0.55;
	}
	nav {
		display: flex;
		gap: 0.25rem;
	}
	nav a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 1rem;
		border-radius: 999px;
		text-decoration: none;
		font-weight: 650;
		font-size: 0.95rem;
	}
	nav a[aria-current='page'] {
		background: var(--b-card);
		box-shadow: 0 0 0 1px var(--b-line);
	}
	nav a.dx {
		background: var(--b-accent);
		color: var(--b-bg) !important;
		box-shadow: 0 3px 0 color-mix(in srgb, var(--b-accent) 60%, #000);
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
