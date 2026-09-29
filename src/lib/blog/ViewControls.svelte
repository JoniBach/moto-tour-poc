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
		<button type="button" class="toggle" aria-expanded={panel} aria-controls="{uid}-panel" onclick={() => (panel = !panel)}>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" class:shut={!panel}>
				<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			Filter and group{#if n}<span class="badge">{n}<span class="sr">{' '}{n === 1 ? 'setting' : 'settings'} changed</span></span>{/if}
		</button>
		<FoldAll />
		<p class="count" role="status">
			{#if shown === total}All {total} events{:else}Showing {shown} of {total} events{/if}
		</p>
	</div>

	<div class="panel" id="{uid}-panel" hidden={!panel}>
		<fieldset>
			<legend>Show</legend>
			<div class="checks">
				{#each TYPES as t (t.key)}
					<label class="check">
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
						<select bind:value={view.from}>
							<option value="">The start</option>
							{#each days as d (d.day)}
								<option value={d.day} disabled={!!view.to && d.day > view.to}>{d.label}</option>
							{/each}
						</select>
					</label>
					<label>
						To
						<select bind:value={view.to}>
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
			<label class="check">
				<input type="checkbox" bind:checked={view.group} />
				Group back-to-back similar events
			</label>
			<p class="hint">For example, six photo stops in a row become one item you can open. Stories always show on their own.</p>
		</fieldset>

		{#if n}
			<button type="button" class="reset" onclick={resetView}>Reset to show everything</button>
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
	.toggle,
	.reset {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.75rem;
		padding: 0 1rem;
		border: 1px solid var(--b-line-strong);
		border-radius: 8px;
		background: var(--b-card);
		color: var(--b-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.toggle:hover,
	.reset:hover {
		border-color: var(--b-accent);
	}
	svg {
		transition: transform 0.15s;
	}
	svg.shut {
		transform: rotate(-90deg);
	}
	.badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.5rem;
		height: 1.5rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--b-accent);
		color: var(--b-bg);
		font-size: 0.85rem;
	}
	.bar .count {
		margin: 0;
		color: var(--b-muted);
	}
	.panel {
		margin-top: 0.6rem;
		padding: 0.6rem 1rem 1rem;
		border: 1px solid var(--b-line);
		border-radius: 12px;
		background: var(--b-card);
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
	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1.2rem;
	}
	/* the whole label is the 44 px target */
	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		cursor: pointer;
	}
	.check input {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
		accent-color: var(--b-accent);
	}
	.ic {
		color: var(--b-muted);
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
	select {
		min-height: 2.75rem;
		padding: 0 0.6rem;
		border: 1px solid var(--b-line-strong);
		border-radius: 8px;
		background: var(--b-bg);
		color: var(--b-text);
		font: inherit;
	}
	.panel .hint {
		margin: 0;
		font-size: 0.95rem;
		color: var(--b-muted);
	}
	.reset {
		margin-top: 0.6rem;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	@media (prefers-reduced-motion: reduce) {
		svg {
			transition: none;
		}
	}
</style>
