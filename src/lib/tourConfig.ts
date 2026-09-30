// The tour this build is for (tours/<id>/tour.config.json, chosen with TOUR=<id> at build time
// and baked in by vite.config.ts): its name and wording, activity, locale, time zone, units and
// speed policy. Everything tour- or country-specific in the site reads from here.
export interface TourConfig {
	id: string;
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
	/** what the protected areas are called: { one: "National Park", many: "national parks" } */
	protectedAreas: { one: string; many: string };
}

declare const __TOUR__: TourConfig;

export const TOUR: TourConfig = __TOUR__;

/** "UK Tour · September 2026" */
export const SITE_NAME = `${TOUR.name} · ${TOUR.when}`;

/** Where this tour's data is served from (the pipeline writes static/data/tours/<id>/). */
export const DATA = `/data/tours/${TOUR.id}`;
/** …and where it sits on disk at build time (for the prerendered blog). */
export const DATA_DIR = `static/data/tours/${TOUR.id}`;
/** A photo in one of its sizes: /photos/<tour>/<size>/<id>.webp */
export const photoSrc = (size: 'thumb' | 'medium' | 'large', id: string) => `/photos/${TOUR.id}/${size}/${id}.webp`;
