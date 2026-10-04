// Release flags: which parts of the tour are switched on in a build. Decided at build time, so a
// switched-off feature's pages aren't built and nothing links to it (its code may still ship in a
// shared bundle: these hide features, they don't keep them secret; the repo is public anyway).
//
// Two sets: `preview` (dev and preview deploys: everything, for testing) and `production` (what's
// released: flip a flag here, deploy with --prod). scripts/deploy.mjs picks the set via RELEASE;
// FEATURES overrides individual flags for a one-off build, e.g.
//   FEATURES="globe=off,photos=on" npm run deploy
// Speed figures have their own levels in config.ts.

export const FLAG_INFO = {
	blog: 'The blog: /blog pages and the links to them',
	map: 'The 2D street map view',
	dx3d: 'The 3D view',
	globe: 'The globe (diorama) view',
	photos: 'Photos everywhere: pins, gallery, pop-ups, the blog’s photo pages',
	stories: 'Blog posts everywhere: pins, reader, story pages',
	weather: 'Recorded weather: readouts, rain, clouds, the blog’s temperatures',
	blogFilters: 'The blog’s filter and group panel',
	newsletter: 'The mailing list: sign-up forms on the blog (needs the tour config’s newsletter)',
	music: 'Now playing: the track that was on as the ride passes, from the listening history (names only)',
	spotify: 'Spotify on the now-playing card: album art, the link to the track and the in-page player. Off (or Spotify not answering): track names only'
} as const;

export type Flag = keyof typeof FLAG_INFO;
type FlagSet = Record<Flag, boolean>;

const SETS: Record<'preview' | 'production', FlagSet> = {
	preview: { blog: true, map: true, dx3d: false, globe: true, photos: true, stories: true, weather: true, blogFilters: true, newsletter: true, music: true, spotify: true },
	// the release plan: switch features on here as they launch
	production: { blog: true, map: true, dx3d: false, globe: true, photos: true, stories: true, weather: true, blogFilters: true, newsletter: true, music: true, spotify: true }
};

// injected by vite.config.ts from the build's environment
declare const __RELEASE__: string;
declare const __FEATURES__: string;

/** "globe=off, photos=on" / "-globe,+photos" → overrides; unknown names fail the build loudly. */
export function parseOverrides(spec: string): Partial<FlagSet> {
	const out: Partial<FlagSet> = {};
	for (const raw of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
		const m = /^([+-]?)(\w+)(?:\s*=\s*(on|off|true|false|1|0))?$/i.exec(raw);
		if (!m || !(m[2] in FLAG_INFO)) throw new Error(`FEATURES: don't know "${raw}" (flags: ${Object.keys(FLAG_INFO).join(', ')})`);
		out[m[2] as Flag] = m[3] ? /^(on|true|1)$/i.test(m[3]) : m[1] !== '-';
	}
	return out;
}

const release = typeof __RELEASE__ === 'string' && __RELEASE__ === 'production' ? 'production' : 'preview';
export const flags: Readonly<FlagSet> = Object.freeze({
	...SETS[release],
	...parseOverrides(typeof __FEATURES__ === 'string' ? __FEATURES__ : '')
});

export const on = (f: Flag) => flags[f];

/** The tour's views that are switched on, in switcher order. */
export const VIEWS_ON = (
	[
		['3d', 'dx3d'],
		['2d', 'map'],
		['globe', 'globe']
	] as const
)
	.filter(([, f]) => flags[f])
	.map(([v]) => v);

/** Is any view of the tour itself (3D, map, globe) on? If not, the blog is the whole site. */
export const tourOn = VIEWS_ON.length > 0;

/**
 * The view new visitors land on (the switcher keeps its own order): the first of this preference
 * that's switched on. A viewer's own last choice, or a link's ?view=, still wins.
 */
const DEFAULT_ORDER = ['globe', '3d', '2d'] as const;
export const DEFAULT_VIEW = DEFAULT_ORDER.find((v) => VIEWS_ON.includes(v)) ?? VIEWS_ON[0];

/** How the blog names the tour's default view in its links ("See this moment in the globe"). */
export const TOUR_NAME = ({ '3d': '3D tour', '2d': 'map', globe: 'globe' } as const)[DEFAULT_VIEW ?? '3d'];
