<!--
  Root: shared theme, fonts, scrollbars and favicon for both experiences —
  the 3D tour (routes in (dx)) and the plain blog (routes in blog/).
-->
<script lang="ts">
	let { children } = $props();
</script>

{@render children()}

<style>
	:global(:root) {
		--text: #dff6ff;
		--muted: #7b98a8;
		--accent: #7cf7ff;
		--accent-soft: rgba(124, 247, 255, 0.18);
		--line: rgba(124, 247, 255, 0.18);
		--glass: rgba(4, 12, 20, 0.72);
	}
	/*
	  Themed, "safe" scrolling for the glass panels. Add class="scroll-y" / "scroll-x".
	  - the bar gets its own gutter (never drawn over content) and sits inset from rounded corners
	  - overscroll-behavior stops a panel's wheel scroll leaking into the 3D scene's zoom
	  Chrome ignores ::-webkit-scrollbar styling once the standard scrollbar-* properties are set,
	  so those are applied to Firefox only.
	*/
	:global(.scroll-y) {
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
	}
	:global(.scroll-x) {
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior: contain;
		padding-bottom: 6px; /* room for the bar under the content */
	}
	:global(.scroll-y::-webkit-scrollbar),
	:global(.scroll-x::-webkit-scrollbar) {
		width: 6px;
		height: 5px;
	}
	:global(.scroll-y::-webkit-scrollbar-track),
	:global(.scroll-x::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(.scroll-y::-webkit-scrollbar-track) {
		margin: 14px 0; /* clear of the panel's rounded corners */
	}
	:global(.scroll-x::-webkit-scrollbar-track) {
		margin: 0 10px;
	}
	:global(.scroll-y::-webkit-scrollbar-thumb),
	:global(.scroll-x::-webkit-scrollbar-thumb) {
		border-radius: 6px;
		background: linear-gradient(rgba(124, 247, 255, 0.45), rgba(124, 247, 255, 0.25));
		box-shadow: 0 0 6px rgba(124, 247, 255, 0.35);
	}
	:global(.scroll-y::-webkit-scrollbar-thumb:hover),
	:global(.scroll-x::-webkit-scrollbar-thumb:hover) {
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
	}
	:global(.scroll-y::-webkit-scrollbar-corner),
	:global(.scroll-x::-webkit-scrollbar-corner) {
		background: transparent;
	}
	@supports (-moz-appearance: none) {
		:global(.scroll-y),
		:global(.scroll-x) {
			scrollbar-width: thin;
			scrollbar-color: rgba(124, 247, 255, 0.4) transparent;
		}
	}
	:global(html, body) {
		margin: 0;
		height: 100%;
		background: #03070c;
		color: var(--text);
		font-family: 'Inter', system-ui, sans-serif;
	}
	:global(html.app-surface),
	:global(html.app-surface body) {
		overflow: hidden;
	}
</style>
