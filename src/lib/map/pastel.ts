// The street map in the tour's postcard colours: OpenFreeMap's "liberty" style recoloured once it
// has loaded (paper land, pale-sky water, sage green spaces, soft peach and butter main roads,
// slate labels), so the map sits with the globe and the blog instead of shouting over them.
// Layers are matched by name; anything unrecognised keeps its own colour.
import type { Map as MlMap } from 'maplibre-gl';

const PAPER = '#f6f0e3';
const WATER = '#cfe3ee';
const WATER_LINE = '#a8c9dd';
const GREEN = '#dcead3';
const WOOD = '#cfe2c6';
const BUILT = '#efe7d6';
const BUILDING = '#e6dcc8';
const INK = '#46535a';
const HALO = '#fbf6ec';

const roadColour = (id: string) =>
	/motorway/.test(id) ? '#f2c4a4' : /trunk_primary/.test(id) ? '#f6d9a8' : /secondary_tertiary/.test(id) ? '#fbecc5' : '#ffffff';

export function pastel(m: MlMap) {
	const set = (id: string, prop: string, value: unknown) => {
		try {
			(m.setPaintProperty as (id: string, prop: string, value: unknown) => void).call(m, id, prop, value);
		} catch {
			// a property this layer doesn't have: leave it
		}
	};
	for (const layer of m.getStyle().layers ?? []) {
		const { id, type } = layer;
		if (type === 'background') set(id, 'background-color', PAPER);
		else if (type === 'raster') {
			// Natural Earth's shaded relief at low zooms: a whisper of it, not the saturated blues
			set(id, 'raster-saturation', -0.7);
			set(id, 'raster-opacity', 0.35);
		} else if (type === 'fill') {
			if (id === 'water') set(id, 'fill-color', WATER);
			else if (id === 'park' || /grass|pitch|cemetery/.test(id)) set(id, 'fill-color', GREEN);
			else if (/wood|wetland/.test(id)) set(id, 'fill-color', WOOD);
			else if (/residential|hospital|school|aeroway/.test(id)) set(id, 'fill-color', BUILT);
			else if (id === 'building') {
				set(id, 'fill-color', BUILDING);
				set(id, 'fill-outline-color', '#dccfb6');
			}
		} else if (type === 'fill-extrusion') set(id, 'fill-extrusion-color', BUILDING);
		else if (type === 'line') {
			if (/^waterway/.test(id)) set(id, 'line-color', WATER_LINE);
			else if (/casing/.test(id)) set(id, 'line-color', '#e0d3bd');
			else if (/rail/.test(id)) set(id, 'line-color', '#cfc6b8');
			else if (/boundary/.test(id)) set(id, 'line-color', '#b9aacb');
			else if (id === 'park_outline') set(id, 'line-color', '#b7d0ae');
			else if (/^(road|bridge|tunnel)_/.test(id) && !/path|pedestrian/.test(id)) set(id, 'line-color', roadColour(id));
		} else if (type === 'symbol') {
			set(id, 'text-color', /water/.test(id) ? '#4a7188' : INK);
			set(id, 'text-halo-color', HALO);
		}
	}
}
