import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// release flags (src/lib/flags.ts): which set, and any one-off overrides
	define: {
		__RELEASE__: JSON.stringify(process.env.RELEASE ?? 'preview'),
		__FEATURES__: JSON.stringify(process.env.FEATURES ?? '')
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter()
		})
	]
});
