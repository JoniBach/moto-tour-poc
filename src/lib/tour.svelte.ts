// Shared UI + playback state. One instance, created by the page and passed down.
import { sampleTrack, type BikeState, type TourData } from './data';
import { FEATURES } from './config';
import { Imagery, type MapStyle } from './imagery';

export type CameraMode = 'follow' | 'chase' | 'overview' | 'free';
export type ColorBy = 'speed' | 'lean' | 'gradient';

export class Tour {
	rt = $state(0);
	playing = $state(false);
	rate = $state(20); // riding-seconds per real second
	exaggeration = $state(2);
	bubble = $state(2200); // metres of detailed terrain around the bike
	camera = $state<CameraMode>('follow');
	colorBy = $state<ColorBy>(FEATURES.showSpeed ? 'speed' : 'gradient');
	selectedPin = $state<number | null>(null);
	mapStyle = $state<MapStyle>('hologram');
	pointSize = $state(2);
	pointGlow = $state(1.6);
	layers = $state({
		points: true,
		contours: true,
		terraces: false,
		detail: true,
		route: true,
		pins: true,
		roads: true,
		water: true,
		labels: true,
		weather: true,
		gpsAltitude: false
	});

	readonly data: TourData;
	readonly duration: number;
	/** tile textures for the map styles; plain object, not reactive */
	readonly imagery: Imagery;
	bike: BikeState = $derived.by(() => sampleTrack(this.data.track, this.rt));

	constructor(data: TourData) {
		this.data = data;
		this.imagery = new Imagery(data.terrain.meta);
		this.duration = data.track.rt[data.track.count - 1];
	}

	advance(dt: number) {
		if (!this.playing) return;
		const prev = this.rt;
		this.rt = Math.min(this.duration, this.rt + dt * this.rate);
		// surface pins as the bike rides past them
		const crossed = this.data.pins.find((p) => p.rt > prev && p.rt <= this.rt);
		if (crossed) this.selectedPin = crossed.id;
		if (this.rt >= this.duration) this.playing = false;
	}

	seek(rt: number) {
		this.rt = Math.max(0, Math.min(this.duration, rt));
	}

	togglePlay() {
		if (this.rt >= this.duration) this.rt = 0;
		this.playing = !this.playing;
	}
}
