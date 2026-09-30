// Viewer settings shared across the whole tour: they survive moving between days, and the
// globe's "customise" ones live in the page's URL too (only where they differ from the defaults),
// so a refresh or a shared link keeps the viewer's setup:
//   surface=satellite  route=plain  size=3000  relief=1.5  vehicle=1.5  fog=1.40,3.50  halo=0  off=roads,labels
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
	globeRadius = $state(4000);
	/**
	 * The surroundings' fog, in multiples of the globe's radius from the centre: the inner fog
	 * (next to the plinth) has cleared by `fogIn`, and the outer fog has closed in completely by
	 * `fogOut`, which is also how far the surroundings reach.
	 */
	fogIn = $state(1.55);
	fogOut = $state(2.6);
	/** how big the vehicle is drawn (1 = its configured size) */
	vehicleScale = $state(1);
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
		backdropPoints: false,
		labels: true,
		weather: true,
		gpsAltitude: false
	});

	/** The globe's customise settings as URL parameters (only those that differ from the defaults). */
	writeParams(params: URLSearchParams) {
		const d = DEFAULTS;
		if (this.mapStyle !== d.mapStyle) params.set('surface', this.mapStyle);
		if (this.globeColorBy !== d.globeColorBy) params.set('route', this.globeColorBy);
		if (this.globeRadius !== d.globeRadius) params.set('size', String(this.globeRadius));
		if (this.exaggeration !== d.exaggeration) params.set('relief', this.exaggeration.toFixed(1));
		if (this.globeHalo !== d.globeHalo) params.set('halo', this.globeHalo ? '1' : '0');
		if (this.vehicleScale !== d.vehicleScale) params.set('vehicle', this.vehicleScale.toFixed(1));
		if (this.fogIn !== d.fogIn || this.fogOut !== d.fogOut) params.set('fog', `${this.fogIn.toFixed(2)},${this.fogOut.toFixed(2)}`);
		const keys = Object.keys(d.layers) as (keyof Settings['layers'])[];
		const off = keys.filter((k) => d.layers[k] && !this.layers[k]);
		const on = keys.filter((k) => !d.layers[k] && this.layers[k]);
		if (off.length) params.set('off', off.join(','));
		if (on.length) params.set('on', on.join(','));
	}

	/** Take the customise settings from a URL; anything missing or unrecognised stays as it is. */
	readParams(params: URLSearchParams) {
		const surface = params.get('surface');
		if (surface && MAP_STYLES.includes(surface as MapStyle)) this.mapStyle = surface as MapStyle;
		const route = params.get('route');
		if (route && ['plain', 'speed', 'lean', 'gradient'].includes(route) && (route !== 'speed' || speedShade()))
			this.globeColorBy = route as 'plain' | ColorBy;
		const num = (key: string, min: number, max: number) => {
			const v = Number(params.get(key));
			return params.has(key) && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
		};
		const size = num('size', 800, 6000);
		if (size != null) this.globeRadius = Math.round(size / 200) * 200;
		const relief = num('relief', 1, 4);
		if (relief != null) this.exaggeration = Math.round(relief * 10) / 10;
		if (params.has('halo')) this.globeHalo = params.get('halo') !== '0';
		const fog = (params.get('fog') ?? '').split(',').map(Number);
		if (fog.length === 2 && fog.every(Number.isFinite)) {
			this.fogOut = Math.min(FOG_MAX, Math.max(FOG_MIN + FOG_GAP, fog[1]));
			this.fogIn = Math.min(this.fogOut - FOG_GAP, Math.max(FOG_MIN, fog[0]));
		}
		const vehicle = num('vehicle', 0.5, 3);
		if (vehicle != null) this.vehicleScale = Math.round(vehicle * 10) / 10;
		const list = (key: string) => (params.get(key) ?? '').split(',').filter((k) => k in this.layers) as (keyof Settings['layers'])[];
		for (const k of list('off')) this.layers[k] = false;
		for (const k of list('on')) this.layers[k] = true;
	}

	/** Back to how the globe starts: surface, route colour, size, relief, surroundings and layers. */
	resetGlobe() {
		const d = DEFAULTS;
		this.mapStyle = d.mapStyle;
		this.globeColorBy = d.globeColorBy;
		this.globeRadius = d.globeRadius;
		this.exaggeration = d.exaggeration;
		this.globeHalo = d.globeHalo;
		this.vehicleScale = d.vehicleScale;
		this.fogIn = d.fogIn;
		this.fogOut = d.fogOut;
		Object.assign(this.layers, d.layers);
	}

	/** Whether any of the customise settings differ from the defaults. */
	get globeCustomised() {
		const p = new URLSearchParams();
		this.writeParams(p);
		return p.size > 0;
	}
}

const MAP_STYLES: MapStyle[] = ['hologram', 'satellite', 'sentinel', 'topo'];
/** the fog's limits (multiples of the radius): the land's edge, far out, and the least gap */
export const FOG_MIN = 1;
export const FOG_MAX = 5;
export const FOG_GAP = 0.3;
/** The settings as they start (read once: the defaults the URL and reset measure against). */
const DEFAULTS = (() => {
	const s = new Settings();
	return {
		mapStyle: s.mapStyle,
		globeColorBy: s.globeColorBy,
		globeRadius: s.globeRadius,
		exaggeration: s.exaggeration,
		globeHalo: s.globeHalo,
		vehicleScale: s.vehicleScale,
		fogIn: s.fogIn,
		fogOut: s.fogOut,
		layers: { ...s.layers }
	};
})();
