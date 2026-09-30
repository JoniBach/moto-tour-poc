// The tour's flat world in metres (tourConfig PROJECTION: British National Grid for the UK,
// a transverse Mercator on the tour's centre otherwise), matching scripts/lib/geo.mjs. All days
// share this world; each day's data is stored relative to its own origin (originE, originN).
import proj4 from 'proj4';
import { PROJECTION } from './tourConfig';

const grid = proj4('EPSG:4326', PROJECTION);

/** lon/lat -> projected metres [east, north] */
export const toGrid = (lon: number, lat: number) => grid.forward([lon, lat]) as [number, number];
/** projected metres -> [lon, lat] */
export const fromGrid = (e: number, n: number) => grid.inverse([e, n]) as [number, number];

/** Local metres (relative to a day origin) <-> lon/lat. */
export function makeProjection(originE: number, originN: number) {
	return {
		toLonLat: (x: number, n: number) => fromGrid(x + originE, n + originN),
		fromLonLat: (lon: number, lat: number): [number, number] => {
			const [e, n] = toGrid(lon, lat);
			return [e - originE, n - originN];
		}
	};
}
