// British National Grid (EPSG:27700), matching scripts/lib/geo.mjs. All days share this world;
// each day's data is stored relative to its own origin (originE, originN).
import proj4 from 'proj4';

const BNG_DEF =
	'+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy ' +
	'+towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs';
const bng = proj4('EPSG:4326', BNG_DEF);

export const toBng = (lon: number, lat: number) => bng.forward([lon, lat]) as [number, number];
export const fromBng = (e: number, n: number) => bng.inverse([e, n]) as [number, number];

/** Local metres (relative to a day origin) <-> lon/lat. */
export function makeProjection(originE: number, originN: number) {
	return {
		toLonLat: (x: number, n: number) => fromBng(x + originE, n + originN),
		fromLonLat: (lon: number, lat: number): [number, number] => {
			const [e, n] = toBng(lon, lat);
			return [e - originE, n - originN];
		}
	};
}
