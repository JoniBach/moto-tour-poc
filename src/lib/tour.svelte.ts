// One day's playback state. Viewer settings live in the shared Settings object and are
// forwarded here so scene components can keep reading `tour.layers`, `tour.exaggeration`, etc.
import { sampleTrack, type BikeState, type BlogPost, type Photo, type TourData } from './data';
import { Imagery } from './imagery';
import type { Settings } from './settings.svelte';

export type { CameraMode, ColorBy } from './settings.svelte';

export class Tour {
	rt = $state(0);
	playing = $state(false);
	selectedPin = $state<number | null>(null);
	/** this day's photos placed on the ride timeline (set by the app), in time order */
	photos: Photo[] = [];
	/** this day's blog posts (set by the app), in time order */
	posts: BlogPost[] = [];
	/**
	 * The one pop-up on screen: the latest moment the bike rode past. A story wins over photos
	 * taken at the same moment; several photos taken together share one card.
	 */
	popup = $state.raw<{ kind: 'photos'; photos: Photo[]; until: number } | { kind: 'post'; post: BlogPost; until: number } | null>(null);

	readonly data: TourData;
	readonly settings: Settings;
	readonly duration: number;
	/** tile textures for the map styles; plain object, not reactive */
	readonly imagery: Imagery;
	/** called once when playback reaches the end of the day */
	onEnded: (() => void) | null = null;
	bike: BikeState = $derived.by(() => sampleTrack(this.data.track, this.rt));

	constructor(data: TourData, settings: Settings) {
		this.data = data;
		this.settings = settings;
		this.duration = data.track.rt[data.track.count - 1];
		this.imagery = new Imagery(data.terrain.meta);
	}

	// ---- shared settings, forwarded ----
	get rate() { return this.settings.rate; }
	set rate(v) { this.settings.rate = v; }
	get exaggeration() { return this.settings.exaggeration; }
	set exaggeration(v) { this.settings.exaggeration = v; }
	get bubble() { return this.settings.bubble; }
	get horizon() { return this.settings.horizon; }
	set horizon(v) { this.settings.horizon = v; }
	set bubble(v) { this.settings.bubble = v; }
	get camera() { return this.settings.camera; }
	set camera(v) { this.settings.camera = v; }
	get colorBy() { return this.settings.colorBy; }
	set colorBy(v) { this.settings.colorBy = v; }
	get mapStyle() { return this.settings.mapStyle; }
	set mapStyle(v) { this.settings.mapStyle = v; }
	get pointSize() { return this.settings.pointSize; }
	set pointSize(v) { this.settings.pointSize = v; }
	get pointGlow() { return this.settings.pointGlow; }
	get pointDensity() { return this.settings.pointDensity; }
	set pointDensity(v) { this.settings.pointDensity = v; }
	set pointGlow(v) { this.settings.pointGlow = v; }
	get layers() { return this.settings.layers; }

	advance(dt: number) {
		if (!this.playing) return;
		const prev = this.rt;
		this.rt = Math.min(this.duration, this.rt + dt * this.rate);
		// surface pins as the bike rides past them
		const crossed = this.data.pins.find((p) => p.rt > prev && p.rt <= this.rt);
		if (crossed) this.selectedPin = crossed.id;
		// pop-up: replaces whatever is showing; posts stay up longer (there's something to read)
		const now = performance.now();
		const post = this.posts.findLast((po) => po.rt > prev && po.rt <= this.rt);
		const photos = this.photos.filter((ph) => ph.rt! > prev && ph.rt! <= this.rt);
		if (post) this.popup = { kind: 'post', post, until: now + 9000 };
		else if (photos.length) this.popup = { kind: 'photos', photos, until: now + 5000 };
		if (this.rt >= this.duration) {
			this.playing = false;
			this.onEnded?.();
		}
	}

	seek(rt: number) {
		this.rt = Math.max(0, Math.min(this.duration, rt));
	}

	togglePlay() {
		if (this.rt >= this.duration) this.rt = 0;
		this.playing = !this.playing;
	}
}
