// The tour this build is for (tours/<id>/tour.config.json, chosen with TOUR=<id> at build time
// and baked in by vite.config.ts): its name and wording, activity, locale, time zone, units and
// speed policy. Everything tour- or country-specific in the site reads from here.
export interface TourConfig {
	id: string;
	/** false: npm run deploy refuses it (test tours) */
	deploy?: boolean;
	/** short name: "UK Tour" */
	name: string;
	/** when, as people say it: "September 2026" */
	when: string;
	/** the headline: "A motorcycle tour of Britain's national parks" */
	title: string;
	/** where it goes, to end a sentence: "from Pembrokeshire to the Cairngorms and back" */
	summary: string;
	activity: 'motorcycle' | 'bicycle' | 'car' | 'walk';
	/** BCP 47 locale for dates, numbers and text: "en-GB" */
	locale: string;
	/** IANA time zone the tour is told in: "Europe/London" */
	timeZone: string;
	units: { distance: 'mi' | 'km'; temperature: 'C' | 'F' };
	/** 0 no speed at all, 1 relative shade only, 2 figures */
	speed: 0 | 1 | 2;
	/** where it is: see Region */
	region: Region;
	/** the protected areas the tour visits and what they're called */
	protectedAreas: ProtectedAreas;
	/** the vehicle as a 3D model (a GLB under static/); without one, a figure built from primitives */
	model?: {
		src: string;
		/** metres nose to tail. Default 2 */
		length?: number;
		/** which way the model faces in its file. Default "+x" */
		forward?: '+x' | '-x' | '+z' | '-z';
		/** its paint. Default the tour's accent */
		color?: string;
		/** a simple seated rider on top. Default false */
		rider?: boolean;
	};
}

export interface Region {
	/** short name for "the whole tour" (the home chip): "UK", "Alps" */
	name: string;
	/** [lon, lat] the tour is centred on: the overview's origin and the default projection's centre */
	centre: [number, number];
	/** proj4 definition of the flat world every day shares, in metres. Default: transverse
	 *  Mercator on the centre (good to ~1,000 km either side); the UK uses British National Grid. */
	projection?: string;
	/** the always-on backdrop terrain (scripts/build-region.mjs) */
	backdrop?: {
		/** [e0, n0, e1, n1] in projected metres. Default: the rides' extent plus 100 km */
		extent?: [number, number, number, number];
		/** metres between samples. Default: whatever keeps it under a million points */
		spacing?: number;
		/** [lon0, lat0, lon1, lat1] boxes treated as sea (land that wasn't part of the tour) */
		sea?: [number, number, number, number][];
	};
}

export interface ProtectedAreas {
	/** "National Park" */
	one: string;
	/** "national parks" */
	many: string;
	/** OpenMapTiles park classes to include. Default ["national_park"] */
	classes?: string[];
	/** map name -> display name; when given, only these are included */
	names?: Record<string, string>;
}

declare const __TOUR__: TourConfig;

export const TOUR: TourConfig = __TOUR__;

/** proj4 definition of the tour's projection. Keep in sync with scripts/lib/geo.mjs. */
export const PROJECTION =
	TOUR.region.projection ??
	`+proj=tmerc +lat_0=${TOUR.region.centre[1]} +lon_0=${TOUR.region.centre[0]} +k=1 +x_0=500000 +y_0=500000 +ellps=WGS84 +units=m +no_defs`;

/** "UK Tour · September 2026" */
export const SITE_NAME = `${TOUR.name} · ${TOUR.when}`;

/** Where this tour's data is served from (the pipeline writes static/data/tours/<id>/). */
export const DATA = `/data/tours/${TOUR.id}`;
/** …and where it sits on disk at build time (for the prerendered blog). */
export const DATA_DIR = `static/data/tours/${TOUR.id}`;
/** A photo in one of its sizes: /photos/<tour>/<size>/<id>.webp */
export const photoSrc = (size: 'thumb' | 'medium' | 'large', id: string) => `/photos/${TOUR.id}/${size}/${id}.webp`;
