<!-- The whole tour over Great Britain. The scene and UI live in the layout. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { app } from '$lib/app.svelte';

	// only re-run when the index arrives; show() reads app state we don't want to track
	$effect(() => {
		if (app.index) untrack(() => app.show(null));
	});
</script>
