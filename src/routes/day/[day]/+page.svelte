<!-- One day of the tour, e.g. /day/2026-09-16?t=10:40. The scene and UI live in the layout. -->
<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { app } from '$lib/app.svelte';
	import { applyMoment } from '$lib/moment';

	// re-run when the index arrives or the URL's day changes; show() handles the animation
	$effect(() => {
		const day = page.params.day ?? null;
		if (app.index) untrack(() => app.show(day));
	});

	// once this day is on screen, apply the moment in the URL (?t, ?post, ?photo) — once per day
	let appliedFor: string | null = null;
	$effect(() => {
		const day = page.params.day ?? null;
		const tour = app.tour;
		if (!tour || tour.data.track.day !== day || appliedFor === day) return;
		appliedFor = day;
		untrack(() => {
			applyMoment(app, tour, page.url.searchParams);
			app.momentReady = true;
		});
	});
</script>
