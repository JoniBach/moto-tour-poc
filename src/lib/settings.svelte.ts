// Viewer settings shared across the whole tour: they survive moving between days.
import { FEATURES } from './config';
import type { MapStyle } from './imagery';

export type CameraMode = 'follow' | 'chase' | 'overview' | 'free';
export type ColorBy = 'speed' | 'lean' | 'gradient';

export class Settings {
	rate = $state(20); // riding-seconds per real second
	exaggeration = $state(2);
	bubble = $state(2200); // metres of detailed terrain around the bike
	camera = $state<CameraMode>('follow');
	colorBy = $state<ColorBy>(FEATURES.showSpeed ? 'speed' : 'gradient');
	mapStyle = $state<MapStyle>('hologram');
	pointSize = $state(2);
	pointGlow = $state(1.6);
	/** carry on into the next day when a day's playback ends */
	autoAdvance = $state(true);
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
}
