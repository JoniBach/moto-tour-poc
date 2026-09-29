<!-- The 3D view: its own chunk, loaded only when someone opens the 3D view (the 2D map never needs it). -->
<script lang="ts">
	import { Canvas } from '@threlte/core';
	import type { App } from '$lib/app.svelte';
	import WorldScene from './WorldScene.svelte';

	let { app, dpr, onselect }: { app: App; dpr: number; onselect: (day: string) => void } = $props();
</script>

<Canvas {dpr}>
	<WorldScene {app} {onselect} />
</Canvas>
