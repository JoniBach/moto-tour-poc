// Viewer settings shared across the whole tour: they survive moving between days.
import { speedShade } from './config';
import type { MapStyle } from './imagery';

export type CameraMode = 'follow' | 'chase' | 'overview' | 'free';
export type ColorBy = 'speed' | 'lean' | 'gradient';

export class Settings {
	rate = $state(20); // riding-seconds per real second
	exaggeration = $state(2);
	bubble = $state(2200); // metres of detailed terrain around the bike
	horizon = $state(15000); // metres: how far the day's terrain reaches around the rider
	camera = $state<CameraMode>('follow');
	colorBy = $state<ColorBy>(speedShade() ? 'speed' : 'gradient');
	mapStyle = $state<MapStyle>('hologram');
	pointSize = $state(2);
	pointGlow = $state(1.6);
	/** points per area of screen (LOD): higher packs more in before thinning */
	pointDensity = $state(1);
	/** carry on into the next day when a day's playback ends */
	autoAdvance = $state(true);
	/** the globe view: metres of landscape from the bike to the rim */
	globeRadius = $state(1800);
	/** the globe: faint elevation lines and route carrying on beyond the rim */
	globeHalo = $state(true);
	/** the globe's route: terracotta ('plain') or shaded by the ride's data, like the 3D view */
	globeColorBy = $state<'plain' | ColorBy>(speedShade() ? 'speed' : 'gradient');
	/** the events drawer on the right */
	eventsOpen = $state(false);
	layers = $state({
		points: true,
		contours: true,
		terraces: false,
		detail: true,
		route: true,
		pins: true,
		roads: true,
		water: true,
		parks: true,
		photos: true,
		blog: true,
		ukPoints: false,
		labels: true,
		weather: true,
		gpsAltitude: false
	});
}
