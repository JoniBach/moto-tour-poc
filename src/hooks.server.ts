// The page shell (src/app.html) names the tour and its language, and points feed readers at the
// blog's RSS feed: filled in here from the tour this build is for, as every page (prerendered or
// not) is rendered.
import type { Handle } from '@sveltejs/kit';
import { on } from '$lib/flags';
import { SITE_NAME, SITE_URL, TOUR } from '$lib/tourConfig';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// on every page, so pasting the tour's address into a feed reader finds it
const FEED_LINK =
	on('blog') && on('stories') ? `<link rel="alternate" type="application/rss+xml" title="${esc(SITE_NAME)}" href="${SITE_URL}/blog/feed.xml" />` : '';

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replaceAll('%tour.site%', SITE_NAME).replaceAll('%tour.lang%', TOUR.locale).replace('%tour.feed%', FEED_LINK)
	});
