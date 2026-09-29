<!-- The whole tour over Great Britain. The scene and UI live in the layout. -->
<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { app } from '$lib/app.svelte';
	import { applyMoment } from '$lib/moment';

	// only re-run when the index arrives; show() reads app state we don't want to track
	$effect(() => {
		if (!app.index) return;
		untrack(async () => {
			await app.show(null);
			// shared links: /?post=… or /?photo=… open it over the overview
			applyMoment(app, null, page.url.searchParams);
			app.momentReady = true;
		});
	});
</script>
