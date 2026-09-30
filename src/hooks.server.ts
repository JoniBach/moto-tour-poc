// The page shell (src/app.html) names the tour and its language: filled in here from the tour
// this build is for, as every page (prerendered or not) is rendered.
import type { Handle } from '@sveltejs/kit';
import { SITE_NAME, TOUR } from '$lib/tourConfig';

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, { transformPageChunk: ({ html }) => html.replaceAll('%tour.site%', SITE_NAME).replaceAll('%tour.lang%', TOUR.locale) });
