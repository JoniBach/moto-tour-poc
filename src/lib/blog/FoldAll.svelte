<!-- Collapses every event down to its one-line summary, or opens them all again. -->
<script lang="ts">
	import { fold, foldAll } from './fold.svelte';
</script>

<button type="button" class="pc-button foldall" onclick={() => foldAll(!fold.open)}>
	<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" class:shut={!fold.open}>
		<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
	{fold.open ? 'Collapse all events' : 'Expand all events'}
</button>

<style>
	/* a Postcard button; the chevron turns when the events are shut */
	svg {
		transition: transform var(--pc-dur-quick) var(--pc-ease);
	}
	svg.shut {
		transform: rotate(-90deg);
	}
</style>
