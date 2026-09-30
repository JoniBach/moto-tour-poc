<!--
  The top bar: the tour's name (home: every day as postcards), then, inside a day, a day stepper
  (previous / this day / next) whose middle opens a menu of all the days, and on the right the
  view switch and the blog. Days are pages (/day/<date>), so these are links; the app animates the
  move. While the next day loads, the stepper says so.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { A } from '$lib/activity';
	import { TOUR } from '$lib/tourConfig';
	import { on, VIEWS_ON } from '$lib/flags';
	import type { App } from '$lib/app.svelte';
	import { dayColor } from '$lib/colors';
	import { ui } from '$lib/ui.svelte';

	let { app }: { app: App } = $props();

	// only the views switched on in this release (src/lib/flags.ts)
	const VIEWS = (
		[
			{ id: 'globe', label: 'Globe', icon: '◍', title: `The ${A.leg} as a little globe: the landscape turns under ${A.mover}` },
			{ id: '2d', label: 'Map', icon: '⌖', title: 'The tour on a street map' },
			{ id: '3d', label: '3D', icon: '▲', title: 'The tour in 3D' }
		] as const
	).filter((v) => VIEWS_ON.includes(v.id));

	const days = $derived(app.index?.days ?? []);
	const activeDay = $derived(app.currentDay);
	const active = $derived(app.pending ?? app.summary(activeDay ?? undefined));
	const prev = $derived(activeDay ? app.neighbour(-1) : undefined);
	const next = $derived(activeDay ? app.neighbour(1) : days[0]);
	const date = (s: number) =>
		new Date(s * 1000).toLocaleDateString(TOUR.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TOUR.timeZone });

	// the day menu: a list under the stepper; Esc, a click elsewhere or picking a day closes it
	let menuOpen = $state(false);
	let menu = $state<HTMLDivElement>();
	$effect(() => {
		if (!menuOpen) return;
		menu?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'center' });
		const close = (e: Event) => {
			if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element).closest('.stepper')) menuOpen = false;
		};
		window.addEventListener('pointerdown', close);
		window.addEventListener('keydown', close);
		return () => {
			window.removeEventListener('pointerdown', close);
			window.removeEventListener('keydown', close);
		};
	});
	$effect(() => {
		void activeDay;
		menuOpen = false;
	});
</script>

<header class="top">
	<a class="brand display" class:on={!activeDay && !app.pending} href="{base}/" title="Every day of the tour">
		<span class="mark" aria-hidden="true">
			<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M4.5 15c3-1 4-5 7.5-5s3.5 3 7.5 2" /></svg>
		</span><span class="name">{TOUR.name}</span>
	</a>

	{#if active}
		<nav class="stepper" aria-label="Days" style:--c={dayColor(active.index, days.length)}>
			<a class="step" class:disabled={!prev} href={prev ? `${base}/day/${prev.day}` : undefined} aria-label="Previous day">‹</a>
			<button type="button" class="today" aria-expanded={menuOpen} aria-haspopup="true" onclick={() => (menuOpen = !menuOpen)}>
				<span class="stamp" aria-hidden="true">{active.index + 1}</span>
				<span class="what">
					<span class="t">{app.pending ? `Heading to day ${active.index + 1}…` : `Day ${active.index + 1} of ${days.length}`}</span>
					<span class="d">{date(active.start)}</span>
				</span>
				<span class="caret" aria-hidden="true">▾</span>
			</button>
			<a class="step" class:disabled={!next} href={next ? `${base}/day/${next.day}` : undefined} aria-label="Next day">›</a>
			{#if menuOpen}
				<div class="menu scroll-y" bind:this={menu}>
					<a class="all" href="{base}/">All days as postcards</a>
					<ol>
						{#each days as d (d.day)}
							<li>
								<a href="{base}/day/{d.day}" aria-current={d.day === activeDay ? 'page' : undefined} style:--c={dayColor(d.index, days.length)}>
									<span class="stamp" aria-hidden="true">{d.index + 1}</span>
									<span class="what">
										<span class="t">{d.title}</span>
										<span class="d">{date(d.start)}</span>
									</span>
								</a>
							</li>
						{/each}
					</ol>
				</div>
			{/if}
		</nav>
	{/if}

	{#if !ui.mobile}
		<div class="end">
			{#if VIEWS.length > 1}
				<div class="views" role="group" aria-label="View">
					{#each VIEWS as v (v.id)}
						<button type="button" aria-pressed={app.view === v.id} title={v.title} onclick={() => app.setView(v.id)}>
							<span aria-hidden="true">{v.icon}</span>
							{v.label}
						</button>
					{/each}
				</div>
			{/if}
			{#if on('blog')}<a class="blog" href={activeDay ? `${base}/blog/${activeDay}` : `${base}/blog`} title="Read the tour as a blog">Blog</a>{/if}
		</div>
	{/if}
</header>

<style>
	.top {
		position: absolute;
		z-index: 110;
		top: 16px;
		left: 16px;
		right: 16px;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		pointer-events: none;
		color: var(--text);
		font-size: 14px;
	}
	.top > * {
		pointer-events: auto;
	}
	a {
		color: inherit;
		text-decoration: none;
	}

	.brand,
	.stepper,
	.views,
	.blog {
		background: var(--glass);
		backdrop-filter: blur(12px);
		box-shadow:
			var(--press),
			0 0 0 1px var(--line);
		border-radius: 999px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		padding: 0 18px 0 8px;
		font-size: 17px;
		white-space: nowrap;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--accent);
		color: var(--on-accent);
	}
	.mark svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: #fff;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.mark circle {
		stroke-opacity: 0.55;
	}
	.brand:hover .mark {
		transform: rotate(-12deg);
	}
	.mark {
		transition: transform 0.2s ease;
	}
	.stepper {
		position: relative;
		display: flex;
		align-items: center;
		min-height: 48px;
		margin: 0 auto;
		padding: 0 4px;
	}
	.step {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		font-size: 24px;
		line-height: 1;
	}
	.step:hover {
		background: var(--accent-soft);
	}
	.step.disabled {
		opacity: 0.3;
		pointer-events: none;
	}
	.today {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		max-width: 340px;
		padding: 0 12px 0 4px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.today:hover {
		background: color-mix(in srgb, var(--c) 14%, transparent);
	}
	.stamp {
		flex: none;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		background: var(--c);
		color: #fff;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 16px;
		transform: rotate(-4deg);
		text-shadow: 0 1px 1px rgb(0 0 0 / 0.25);
	}
	.what {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.2;
	}
	.t {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-family: var(--font-display);
		font-variation-settings: 'SOFT' 100;
		font-weight: 600;
		font-size: 16px;
	}
	.d {
		font-size: 12px;
		color: var(--muted);
	}
	.caret {
		color: var(--muted);
		font-size: 12px;
	}
	.menu {
		position: absolute;
		top: calc(100% + 10px);
		left: 50%;
		width: 340px;
		max-height: min(62vh, 560px);
		transform: translateX(-50%);
		padding: 10px 6px 10px 10px;
		border-radius: var(--radius);
		background: var(--card);
		box-shadow:
			var(--shadow),
			0 0 0 1px var(--line);
	}
	.menu ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.menu li a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 7px 8px;
		border-radius: 14px;
	}
	.menu li a:hover {
		background: color-mix(in srgb, var(--c) 14%, transparent);
	}
	.menu li a[aria-current='page'] {
		background: color-mix(in srgb, var(--c) 22%, transparent);
	}
	.menu .all {
		display: block;
		margin: 0 4px 8px 0;
		padding: 8px 12px;
		border-radius: 12px;
		background: var(--sky);
		color: var(--sky-ink);
		font-weight: 700;
		text-align: center;
	}
	.end {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}
	.stepper + .end {
		margin-left: 0;
	}
	.views {
		display: flex;
		padding: 4px;
		gap: 2px;
	}
	.views button {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--muted);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
	}
	.views button:hover {
		color: var(--text);
	}
	.views button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--paper);
	}
	.blog {
		display: grid;
		place-items: center;
		min-height: 48px;
		padding: 0 18px;
		font-weight: 650;
	}
	.blog:hover {
		background: var(--card);
	}
	@media (max-width: 1100px) {
		.name {
			display: none;
		}
		.brand {
			padding: 0 7px;
		}
	}
	/* phones: the brand and the stepper; views and panels are in the side buttons */
	@media (max-width: 900px) {
		.top {
			top: calc(env(safe-area-inset-top) + 8px);
			left: 8px;
			right: 8px;
			gap: 8px;
		}
		.stepper {
			flex: 1;
			min-width: 0;
			margin: 0;
		}
		.today {
			flex: 1;
			min-width: 0;
		}
		.caret {
			display: none;
		}
		.menu {
			position: fixed;
			top: calc(env(safe-area-inset-top) + 66px);
			left: 8px;
			right: 8px;
			width: auto;
			transform: none;
		}
	}
</style>
