<!--
  The blog's view settings: filter by kind of event (and by day on the index), group back-to-back
  similar events, fold everything. Settings live in view.svelte.ts and the URL.
-->
<script lang="ts">
	import { afterNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import FoldAll from './FoldAll.svelte';
	import { changed, readUrl, resetView, TYPES, view, withView } from './view.svelte';

	let {
		days,
		shown,
		total
	}: {
		/** offer a day range (the index); leave out on single-day pages */
		days?: { day: string; label: string }[];
		shown: number;
		total: number;
	} = $props();
	const uid = $props.id();

	let panel = $state(false);
	let ready = $state(false);
	const n = $derived(ready ? changed() : 0);

	onMount(() => {
		readUrl(new URLSearchParams(location.search));
		if (changed()) panel = true;
	});
	// the router can't take replaceState until its first navigation (hydration) has finished
	afterNavigate(() => {
		ready = true;
	});
	// keep the address bar in step, so the filtered view can be shared or bookmarked
	$effect(() => {
		if (!ready) return;
		const u = withView(new URL(location.href), !!days);
		if (u.href !== location.href) replaceState(u, page.state);
	});
</script>

<section class="controls" aria-label="View settings">
	<div class="bar">
		<button type="button" class="pc-button toggle" aria-expanded={panel} aria-controls="{uid}-panel" onclick={() => (panel = !panel)}>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" class:shut={!panel}>
				<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			Filter and group{#if n}<span class="pc-badge">{n}<span class="pc-sr-only">{' '}{n === 1 ? 'setting' : 'settings'} changed</span></span>{/if}
		</button>
		<FoldAll />
		<p class="count" role="status">
			{#if shown === total}All {total} events{:else}Showing {shown} of {total} events{/if}
		</p>
	</div>

	<div class="pc-panel panel" id="{uid}-panel" hidden={!panel}>
		<fieldset>
			<legend>Show</legend>
			<div class="pc-checks">
				{#each TYPES as t (t.key)}
					<label class="pc-check">
						<input type="checkbox" value={t.key} bind:group={view.types} />
						<span aria-hidden="true" class="ic">{t.icon}</span>
						{t.label}
					</label>
				{/each}
			</div>
		</fieldset>

		{#if days}
			<fieldset>
				<legend>Days</legend>
				<div class="range">
					<label>
						From
						<select class="pc-select" bind:value={view.from}>
							<option value="">The start</option>
							{#each days as d (d.day)}
								<option value={d.day} disabled={!!view.to && d.day > view.to}>{d.label}</option>
							{/each}
						</select>
					</label>
					<label>
						To
						<select class="pc-select" bind:value={view.to}>
							<option value="">The end</option>
							{#each days as d (d.day)}
								<option value={d.day} disabled={!!view.from && d.day < view.from}>{d.label}</option>
							{/each}
						</select>
					</label>
				</div>
			</fieldset>
		{/if}

		<fieldset>
			<legend>Layout</legend>
			<label class="pc-check">
				<input type="checkbox" bind:checked={view.group} />
				Group back-to-back similar events
			</label>
			<p class="pc-field__hint hint">For example, six photo stops in a row become one item you can open. Stories always show on their own.</p>
		</fieldset>

		{#if n}
			<button type="button" class="pc-button reset" onclick={resetView}>Reset to show everything</button>
		{/if}
	</div>
</section>

<style>
	.controls {
		margin: 1rem 0 0.5rem;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}
	svg {
		transition: transform 0.15s;
	}
	svg.shut {
		transform: rotate(-90deg);
	}
	.bar .count {
		margin: 0;
		color: var(--pc-muted);
	}
	.panel {
		margin-top: 0.6rem;
	}
	fieldset {
		margin: 0;
		padding: 0.4rem 0;
		border: 0;
	}
	legend {
		padding: 0;
		font-weight: 700;
	}
	.ic {
		color: var(--pc-muted);
	}
	.range {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.2rem;
	}
	.range label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.panel .hint {
		margin: 0;
		font-size: 0.95rem;
		color: var(--pc-muted);
	}
	.reset {
		margin-top: 0.6rem;
	}
	@media (prefers-reduced-motion: reduce) {
		svg {
			transition: none;
		}
	}
</style>
