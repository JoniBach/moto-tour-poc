// Is Spotify usable right now? The now-playing card's Spotify parts (album art, the link to the
// track, the in-page player) depend on Spotify's servers; the track names don't (they're in our
// own data). Three things hide those parts, leaving the names:
//  - the `spotify` release flag (src/lib/flags.ts): off for a build, e.g. during a long outage or
//    if Spotify's terms change:  FEATURES="spotify=off" npm run deploy -- --prod
//  - no connection (the browser's offline event)
//  - this page's own check: when a cover won't load, and before opening the player, it asks
//    Spotify's oEmbed endpoint about the track; no good answer in time and Spotify counts as down
//    for the rest of the visit
import { on } from './flags';

/** how long Spotify may take to answer the check */
const CHECK_TIMEOUT_MS = 6000;

class SpotifyStatus {
	down = $state(false);
	/** offline, nothing from Spotify can load: names only until the connection is back */
	private online = $state(typeof navigator === 'undefined' || navigator.onLine !== false);
	private checking: Promise<boolean> | null = null;

	constructor() {
		if (typeof window === 'undefined') return;
		window.addEventListener('online', () => (this.online = true));
		window.addEventListener('offline', () => (this.online = false));
	}

	/** Show anything that comes from Spotify? */
	get ok() {
		return on('spotify') && !this.down && this.online;
	}

	/**
	 * Ask Spotify about a track: true if it's there to play. No answer in time, or a server error,
	 * and Spotify is down from now on; a track it no longer has (404) is just that track.
	 */
	check(id: string): Promise<boolean> {
		if (!this.ok) return Promise.resolve(false);
		this.checking ??= fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl(id))}`, {
			signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
			credentials: 'omit',
			referrerPolicy: 'no-referrer'
		})
			.then((r) => {
				if (r.status >= 500) this.down = true;
				return r.ok;
			})
			.catch(() => ((this.down = true), false))
			.finally(() => (this.checking = null));
		return this.checking;
	}
}

export const spotify = new SpotifyStatus();

export const trackUrl = (id: string) => `https://open.spotify.com/track/${id}`;
export const embedUrl = (id: string) => `https://open.spotify.com/embed/track/${id}?utm_source=generator`;

/**
 * The in-page player, one for the page whichever card opened it: the viewer's choice, loaded only
 * when asked and staying on the track they picked (the music isn't synced to the ride).
 */
class Player {
	private track = $state<string | null>(null);
	/** asking Spotify before opening */
	opening = $state(false);
	/** covers that didn't load (a note shows instead) */
	broken = $state<Record<string, true>>({});

	/** the track in the player; none once Spotify isn't usable */
	get id() {
		return spotify.ok ? this.track : null;
	}

	async listen(id: string) {
		if (this.opening) return;
		this.opening = true;
		// Spotify not answering: no player, and the Spotify parts go (the names stay)
		if (await spotify.check(id)) this.track = id;
		this.opening = false;
	}

	close() {
		this.track = null;
	}

	coverFailed(id: string) {
		this.broken[id] = true;
		spotify.check(id); // one missing cover, or Spotify down?
	}
}

export const player = new Player();
