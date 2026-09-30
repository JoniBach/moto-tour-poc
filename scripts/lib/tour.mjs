// Which tour the pipeline is working on (TOUR=<id>, default uk-2026), its config, and where its
// files live. Inputs in tours/<id>/ (public config, titles, pins and stories committed; GPX,
// original photos and privacy zones git-ignored); outputs in static/data/tours/<id>/ and
// static/photos/<id>/ (generated, git-ignored).
import fs from 'node:fs';
import path from 'node:path';

export const TOUR_ID = process.env.TOUR ?? 'uk-2026';
const DIR = path.join('tours', TOUR_ID);
const configFile = path.join(DIR, 'tour.config.json');
if (!fs.existsSync(configFile)) throw new Error(`No tour "${TOUR_ID}": ${configFile} not found (set TOUR=<id>)`);

/** tours/<id>/tour.config.json: name, dates, activity, locale, time zone, units, speed policy */
export const TOUR = JSON.parse(fs.readFileSync(configFile, 'utf8'));

const OUT = path.join('static/data/tours', TOUR_ID);

export const PATHS = {
	dir: DIR,
	/** raw rides, named YYYY-MM-DD…gpx (GPX_DIR overrides) */
	gpx: process.env.GPX_DIR ?? path.join(DIR, 'gpx'),
	dayTitles: path.join(DIR, 'day-titles.json'),
	pins: path.join(DIR, 'pins.json'),
	privacy: path.join(DIR, 'privacy.json'),
	photosSrc: path.join(DIR, 'photos-src/jpg'),
	blogSrc: path.join(DIR, 'blog'),
	out: OUT,
	days: path.join(OUT, 'days'),
	tourJson: path.join(OUT, 'tour.json'),
	photosJson: path.join(OUT, 'photos.json'),
	blogJson: path.join(OUT, 'blog.json'),
	feedJson: path.join(OUT, 'feed.json'),
	parksJson: path.join(OUT, 'parks.json'),
	parksBin: path.join(OUT, 'parks.bin'),
	photos: path.join('static/photos', TOUR_ID),
	/** the region backdrop (shared by tours in it) */
	ukTerrain: 'static/data/uk'
};
