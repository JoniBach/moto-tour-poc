import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import fs from 'node:fs';
import { defineConfig } from 'vite';

/** The tour this build is for (TOUR=<id>): its config is baked into the code (src/lib/tourConfig.ts). */
const TOUR_ID = process.env.TOUR ?? 'uk-2026';
const TOUR_FILE = `tours/${TOUR_ID}/tour.config.json`;
if (!fs.existsSync(TOUR_FILE)) throw new Error(`No tour "${TOUR_ID}": ${TOUR_FILE} not found (set TOUR=<id>)`);
const TOUR = JSON.parse(fs.readFileSync(TOUR_FILE, 'utf8'));

/**
 * Everything the views load from elsewhere: OpenFreeMap (the 2D map), the imagery styles (Esri,
 * EOX, OpenTopoMap) and the Terrarium elevation tiles (3D and globe). The vercel.live entries are
 * Vercel's preview toolbar (previews only).
 */
const TILE_HOSTS = [
	'https://tiles.openfreemap.org',
	'https://server.arcgisonline.com',
	'https://tiles.maps.eox.at',
	'https://a.tile.opentopomap.org',
	'https://b.tile.opentopomap.org',
	'https://c.tile.opentopomap.org',
	'https://s3.amazonaws.com'
] as const;

export default defineConfig({
	// release flags (src/lib/flags.ts): which set, and any one-off overrides
	define: {
		__RELEASE__: JSON.stringify(process.env.RELEASE ?? 'preview'),
		__FEATURES__: JSON.stringify(process.env.FEATURES ?? ''),
		__TOUR__: JSON.stringify(TOUR)
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter(),

			// a tour without photos (or stories) has no pages under those routes: that's fine
			prerender: {
				handleUnseenRoutes: ({ routes }) => console.warn(`Nothing to prerender for ${routes.join(', ')} in this tour`)
			},

			// Content Security Policy, as a <meta> in every (prerendered) page. Scripts: our own files,
			// plus SvelteKit's inline start-up script by hash, nothing else. Other content only from
			// the services the views use. frame-ancestors can't go in a <meta>: see vercel.json.
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					// wasm-unsafe-eval: WebAssembly may compile (a library uses it); JavaScript eval stays off
					'script-src': ['self', 'wasm-unsafe-eval', 'https://vercel.live'],
					// Svelte transitions and the map/3D libraries set styles at run time
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:', ...TILE_HOSTS, 'https://vercel.live', 'https://vercel.com'],
					'connect-src': ['self', ...TILE_HOSTS, 'https://vercel.live', 'wss://ws-us3.pusher.com'],
					'worker-src': ['self', 'blob:'],
					'font-src': ['self', 'data:'],
					'frame-src': ['https://vercel.live'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self']
				}
			}
		})
	]
});
