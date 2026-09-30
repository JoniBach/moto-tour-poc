<!--
  The blog: the same tour as the globe and the map (every day and every event) as simple,
  readable pages, and one of the tour's views: the same sky, the same floating pill bar (brand,
  then Globe · Map · Blog), the same postcard palette. No 3D rendering here; scales with browser
  zoom, and every moment links back into the tour.
-->
<script lang="ts">
	import { TOUR } from '$lib/tourConfig';
	import { on, VIEWS_ON } from '$lib/flags';
	import { page } from '$app/state';
	import JourneyRail from '$lib/blog/JourneyRail.svelte';

	let { data, children } = $props();

	// the other views open at the day you're reading
	const at = $derived(page.params.day ? `/day/${page.params.day}` : '/');
	const views = (
		[
			{ id: 'globe', label: 'Globe', icon: '◍' },
			{ id: '2d', label: 'Map', icon: '⌖' }
		] as const
	).filter((v) => VIEWS_ON.includes(v.id));
</script>

<div class="blog">
	<a class="skip" href="#content">Skip to content</a>
	<header class="site">
		<a class="pill brand" href="/" title="The tour">
			<span class="mark" aria-hidden="true">
				<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M4.5 15c3-1 4-5 7.5-5s3.5 3 7.5 2" /></svg>
			</span>
			<span class="display">{TOUR.name}</span>
		</a>
		<nav class="pill views" aria-label="Views">
			{#each views as v (v.id)}
				<a href="{at}?view={v.id}"><span aria-hidden="true">{v.icon}</span> {v.label}</a>
			{/each}
			<a href="/blog" class="on" aria-current={page.url.pathname === '/blog' ? 'page' : 'true'}><span aria-hidden="true">✎</span> Blog</a>
		</nav>
	</header>

	<div class="shell">
		{#if data.rail?.length}<JourneyRail days={data.rail} />{/if}
		<main id="content" tabindex="-1">
			{@render children()}
		</main>
	</div>

	<footer class="site">
		<p>
			Place names and national parks from <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a
			>{#if on('weather')}{' · '}weather by <a href="https://open-meteo.com/">Open-Meteo.com</a>{/if}
		</p>
	</footer>
</div>

<style>
	.blog {
		/* the tour's postcard palette (light, like the globe); every text colour ≥ 7:1 (WCAG AAA) */
		--b-bg: #fbf6ec;
		--b-card: #fffdf8;
		--b-text: #263238;
		--b-muted: #3d494f;
		--b-line: #e8dfcd;
		--b-line-strong: #a5998a;
		--b-accent: #7a2e0f;
		--b-link: #7a2e0f;
		--b-warm: #c9a227;
		--b-warm-text: #524008;
		--b-soft: #f9e2d6;
		--b-tint: 30%;
		color-scheme: light;
		min-height: 100vh;
		/* the globe's sky at the top, settling into paper */
		background:
			linear-gradient(to bottom, #cfe6f5 0, #e6f1f6 18rem, #fbf6ec 38rem) no-repeat,
			#fbf6ec;
		color: var(--b-text);
		font-family: var(--font-ui);
		font-size: 1.0625rem;
		line-height: 1.6;
	}
	/* the app's floating pill bar */
	header.site {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		max-width: 74rem;
		margin: 0 auto;
		padding: calc(0.9rem + env(safe-area-inset-top)) 1rem 0.5rem;
		pointer-events: none;
	}
	.pill {
		pointer-events: auto;
		display: flex;
		align-items: center;
		border-radius: 999px;
		background: rgb(255 253 248 / 0.9);
		backdrop-filter: blur(12px);
		box-shadow:
			0 3px 0 rgb(38 50 56 / 0.18),
			0 0 0 1px rgb(38 50 56 / 0.14);
	}
	.brand {
		gap: 0.55rem;
		min-height: 3rem;
		padding: 0 1.1rem 0 0.45rem;
		font-size: 1.1rem;
		color: var(--b-text) !important;
		text-decoration: none;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 2.15rem;
		height: 2.15rem;
		border-radius: 50%;
		background: #c2562d;
	}
	.mark svg {
		width: 1.35rem;
		height: 1.35rem;
		fill: none;
		stroke: #fff;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.mark circle {
		stroke-opacity: 0.55;
	}
	.views {
		gap: 0.15rem;
		padding: 0.25rem;
	}
	.views a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.5rem;
		padding: 0 1rem;
		border-radius: 999px;
		color: var(--b-muted) !important;
		font-weight: 650;
		font-size: 0.95rem;
		text-decoration: none;
	}
	.views a:hover {
		color: var(--b-text) !important;
	}
	.views a.on {
		background: #263238;
		color: #fbf6ec !important;
	}
	footer.site {
		max-width: 74rem;
		margin: 0 auto;
		padding: 1.5rem 1rem calc(1.5rem + env(safe-area-inset-bottom));
		font-size: 0.85rem;
		color: var(--b-muted);
	}
	footer.site p {
		margin: 0;
	}
	/* phones: the brand as its mark alone, like the app */
	@media (max-width: 30rem) {
		.brand {
			padding: 0 0.45rem;
		}
		.brand .display {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		.views a {
			padding: 0 0.75rem;
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
	.shell {
		display: grid;
		grid-template-columns: 17rem minmax(0, 46rem);
		justify-content: center;
		gap: 3rem;
		max-width: 74rem;
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
