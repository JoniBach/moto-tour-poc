<!-- One day of the tour, e.g. /day/2026-09-16. The scene and UI live in the layout. -->
<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { app } from '$lib/app.svelte';

	// re-run when the index arrives or the URL's day changes; show() handles the animation
	$effect(() => {
		const day = page.params.day ?? null;
		if (app.index) untrack(() => app.show(day));
	});
</script>
