// Every blog page gets the journey rail's days (built once, at prerender).
import { on } from '$lib/flags';
import { railDays } from '$lib/server/blog-data';

export const load = () => ({ rail: on('blog') ? railDays() : [] });
