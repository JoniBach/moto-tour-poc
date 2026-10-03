// A story's Markdown, as the build (scripts/build-blog.mjs) and the story editor (/wysiwyg) both
// read and render it, so what the editor previews is exactly what gets published. Plain JS: the
// build scripts import it too.
//
//   ---
//   title: Up and over Honister
//   time: 2026-09-16 11:30        # the tour's local time; the story goes where the bike was
//   cover: 20260916_113010        # optional: a photo id for the header image
//   when: before                  # optional: before / after the trip (pinned to its start / end);
//                                 # then time is optional too, a date: 2026-08-20
//   slug: 2026-09-16-honister     # optional: its address (default: the file name)
//   ---
//   Markdown body. Tour photos by id: ![Looking down Borrowdale](photo:20260916_115051)
//   Map snapshots by moment (the tour's local time, optional zoom):
//   ![Over the top](map:2026-09-16T11:40) or ![Over the top](map:2026-09-16T11:40@14);
//   the whole journey: ![The loop](map:tour), or with a day picked out ![Day 8](map:tour~2026-09-16)
//   Places linked to the moment the ride was there (the story editor suggests them):
//   [the Lakes](tour:2026-09-16T10:29), or a stretch of the ride: [Honister](tour:2026-09-16T11:10-11:45)
//   A stretch as a map snapshot (framed to fit, with its facts): ![The Honister Pass](map:2026-09-16T11:10-11:45)
import { Marked } from 'marked';

/** "key: value" lines between --- fences; the rest is the body. @param {string} text */
export function frontmatter(text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
	if (!m) return { data: {}, body: text };
	/** @type {Record<string, string>} */
	const data = {};
	for (const line of m[1].split(/\r?\n/)) {
		const kv = /^([\w-]+)\s*:\s*(.*?)\s*(?:#.*)?$/.exec(line);
		if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
	}
	return { data, body: text.slice(m[0].length) };
}

/**
 * The file for a story: its header (only the fields that are set) and body.
 * @param {{ title?: string, time?: string, cover?: string, slug?: string, when?: string }} head
 * @param {string} body
 */
export function storyFile({ title = '', time = '', cover = '', slug = '', when = '' }, body) {
	const lines = ['---', `title: ${title}`];
	if (when === 'before' || when === 'after') lines.push(`when: ${when}`);
	// a story during the trip always has its moment; one before or after, only if it was given a date
	if (time || !(when === 'before' || when === 'after')) lines.push(`time: ${time}`);
	if (cover) lines.push(`cover: ${cover}`);
	if (slug) lines.push(`slug: ${slug}`);
	lines.push('---', '');
	return `${lines.join('\n')}\n${body.replace(/^\n+/, '')}`;
}

/**
 * "Up and over Honister!" on 2026-09-16 -> "2026-09-16-up-and-over-honister"
 * @param {string} date @param {string} title
 */
export function slugFor(date, title) {
	const words = title
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.split('-')
		.slice(0, 6)
		.join('-');
	return [date, words].filter(Boolean).join('-');
}

/** the zoom a map snapshot has unless it says otherwise */
export const MAP_ZOOM = 12;

/**
 * A map snapshot's reference -> what it shows (null if it isn't one):
 *   "2026-09-16T11:30@13"  a moment of a day's ride: { day, time, zoom }
 *   "2026-09-16T11:10-11:45"  a stretch of a day's ride, framed to fit: { day, time, end }
 *   "tour", "tour~2026-09-16"  the whole journey, optionally with one day picked out: { whole, day }
 * @typedef {{ day: string, time: string, zoom: number, whole?: boolean, end?: string }} MapShot
 * @param {string} ref
 * @returns {MapShot | null}
 */
export function parseMapRef(ref) {
	const t = /^tour(?:~(\d{4}-\d{2}-\d{2}))?$/.exec(ref);
	if (t) return { whole: true, day: t[1] ?? '', time: '', zoom: MAP_ZOOM };
	const s = /^(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(ref);
	if (s) return { day: s[1], time: s[2].padStart(5, '0'), end: s[3].padStart(5, '0'), zoom: MAP_ZOOM };
	const m = /^(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})(?:@(\d{1,2}(?:\.\d+)?))?$/.exec(ref);
	return m ? { day: m[1], time: m[2].padStart(5, '0'), zoom: m[3] ? +m[3] : MAP_ZOOM } : null;
}

/** @param {MapShot} shot */
export const mapRef = (shot) =>
	shot.whole
		? `tour${shot.day ? `~${shot.day}` : ''}`
		: shot.end
			? `${shot.day}T${shot.time}-${shot.end}`
			: `${shot.day}T${shot.time}${shot.zoom !== MAP_ZOOM ? `@${shot.zoom}` : ''}`;

/**
 * Markdown -> the story's HTML. Photo embeds (![caption](photo:ID)) become figures with the
 * gallery-size image; ones not in `photos` (unknown, or withheld for privacy) are dropped and
 * listed in `withheld`. Links to a moment of the ride ([the Lakes](tour:2026-09-16T10:29)), or a
 * stretch of it ([Honister](tour:2026-09-16T11:10-11:45)), go to `moment(day, time, end?)`, or are
 * plain words without it.
 * @param {string} body
 * @param {{ photos: Map<string, { id: string, w: number, h: number }>, src: (id: string) => string, moment?: (day: string, time: string, end?: string) => string }} opts
 */
export function renderStory(body, { photos, src, moment }) {
	/** @type {string[]} */
	const withheld = [];
	const md = new Marked({
		renderer: {
			link({ href, tokens }) {
				if (!href?.startsWith('tour:')) return false; // default rendering for other links
				const inner = this.parser.parseInline(tokens);
				const m = /^(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?$/.exec(href.slice(5));
				return m && moment ? `<a class="moment" href="${moment(m[1], m[2].padStart(5, '0'), m[3]?.padStart(5, '0')).replace(/&/g, '&amp;')}">${inner}</a>` : inner;
			},
			image({ href, text }) {
				// map snapshots: a figure the page draws the map into (src/lib/map/mapShot.ts)
				if (href?.startsWith('map:')) {
					const shot = parseMapRef(href.slice(4));
					if (!shot) {
						withheld.push(href);
						return '';
					}
					const what = shot.whole ? 'Map of the whole journey' : shot.end ? `Map of the stretch from ${shot.time}` : `Map of the ride at ${shot.time}`;
					const label = `${what}${text ? `: ${text}` : ''}`.replace(/"/g, '&quot;');
					return `<figure class="map-shot${shot.whole ? ' whole' : shot.end ? ' stretch' : ''}" data-map="${mapRef(shot)}"><div class="map-frame" role="img" aria-label="${label}"></div>${text ? `<figcaption>${text}</figcaption>` : ''}</figure>`;
				}
				if (!href?.startsWith('photo:')) return false; // default rendering for normal images
				const p = photos.get(href.slice(6));
				if (!p) {
					withheld.push(href.slice(6));
					return '';
				}
				const alt = text.replace(/"/g, '&quot;');
				return `<figure><img src="${src(p.id)}" width="${p.w}" height="${p.h}" alt="${alt}" loading="lazy" data-photo="${p.id}">${text ? `<figcaption>${text}</figcaption>` : ''}</figure>`;
			}
		}
	});
	return { html: /** @type {string} */ (md.parse(body)), withheld };
}

/** The story as plain words: for its excerpt and reading time. @param {string} body */
export function plainText(body) {
	return body
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		// links: just their words
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[#*_>`[\]()-]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}
/** @param {string} text */
export const excerptOf = (text) => (text.length > 160 ? `${text.slice(0, 157).replace(/\s+\S*$/, '')}…` : text);
/** @param {string} text */
export const minutesOf = (text) => Math.max(1, Math.round(text.split(' ').length / 200));
