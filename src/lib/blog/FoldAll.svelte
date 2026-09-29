<!-- Collapses every event down to its one-line summary, or opens them all again. -->
<script lang="ts">
	import { fold, foldAll } from './fold.svelte';
</script>

<button type="button" class="foldall" onclick={() => foldAll(!fold.open)}>
	<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" class:shut={!fold.open}>
		<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
	{fold.open ? 'Collapse all events' : 'Expand all events'}
</button>

<style>
	.foldall {
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
	.foldall:hover {
		border-color: var(--b-accent);
	}
	svg {
		transition: transform 0.15s;
	}
	svg.shut {
		transform: rotate(-90deg);
	}
	@media (prefers-reduced-motion: reduce) {
		svg {
			transition: none;
		}
	}
</style>
