// Settings layers that only make sense when their data is switched on in this release.
import { on } from './flags';
import type { Tour } from './tour.svelte';

const NEEDS: Partial<Record<keyof Tour['layers'], Parameters<typeof on>[0]>> = {
	photos: 'photos',
	blog: 'stories',
	weather: 'weather'
};

/** Should the settings offer this layer's toggle? */
export const layerAvailable = (k: string) => {
	const f = NEEDS[k as keyof Tour['layers']];
	return !f || on(f);
};
