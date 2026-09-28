// Map imagery (satellite / Sentinel-2 / topo) stitched from XYZ tiles into canvas textures:
//  - "far": the whole terrain area at a low zoom, sampled by the point cloud, terraces and the
//    detail mesh outside the near texture. Its UVs are exact per vertex (static geometry).
//  - "near": a sharper square that follows the bike. The detail mesh maps into it with a linear
//    transform (uniform), accurate to ~1 px at this size since Mercator is near-linear over a few km.
import { CanvasTexture, LinearFilter, SRGBColorSpace, Vector4 } from 'three';
import type { TerrainMeta } from './data';

export type MapStyle = 'hologram' | 'satellite' | 'sentinel' | 'topo';

interface TileSource {
	label: string;
	url: (z: number, x: number, y: number) => string;
	nearZoom: number;
	attribution: string;
}

export const MAP_SOURCES: Record<Exclude<MapStyle, 'hologram'>, TileSource> = {
	satellite: {
		label: 'Satellite',
		url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
		nearZoom: 15,
		attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
	},
	sentinel: {
		label: 'Sentinel-2',
		url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/${z}/${y}/${x}.jpg`,
		nearZoom: 14, // 10 m native resolution; no point going deeper
		attribution: 'Sentinel-2 cloudless 2023 by EOX IT Services GmbH (modified Copernicus Sentinel data)'
	},
	topo: {
		label: 'Topo',
		url: (z, x, y) => `https://${'abc'[(x + y) % 3]}.tile.opentopomap.org/${z}/${x}/${y}.png`,
		nearZoom: 15,
		attribution: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors, SRTM'
	}
};

const RAD = Math.PI / 180;
const R = 6371008.8;
const mercX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const mercY = (lat: number, z: number) => {
	const s = Math.sin(lat * RAD);
	return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z;
};

/** Local metres <-> lon/lat, matching scripts/lib/geo.mjs makeProjection. */
export function makeProjection(meta: TerrainMeta) {
	const kx = R * Math.cos(meta.lat0 * RAD) * RAD;
	const ky = R * RAD;
	return {
		toLonLat: (x: number, n: number): [number, number] => [meta.lon0 + x / kx, meta.lat0 + n / ky],
		kx,
		ky
	};
}

// small in-memory tile cache shared by all textures (the browser HTTP cache sits behind it)
const tileCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadTile(url: string): Promise<HTMLImageElement | null> {
	let p = tileCache.get(url);
	if (!p) {
		p = new Promise((resolve) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => resolve(img);
			img.onerror = () => resolve(null);
			img.src = url;
		});
		tileCache.set(url, p);
		if (tileCache.size > 800) tileCache.delete(tileCache.keys().next().value!);
	}
	return p;
}

/** A tile-aligned canvas texture covering a lon/lat box at one zoom. Tiles paint in as they arrive. */
export class TileCanvas {
	readonly texture: CanvasTexture;
	readonly canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private generation = 0;
	/** tile-space bounds of the canvas (fractional tile coords at `zoom`) */
	tx0 = 0;
	ty0 = 0;
	tiles = 0;
	zoom = 0;

	constructor(maxTiles: number) {
		this.canvas = document.createElement('canvas');
		this.canvas.width = this.canvas.height = maxTiles * 256;
		this.ctx = this.canvas.getContext('2d')!;
		this.texture = new CanvasTexture(this.canvas);
		this.texture.colorSpace = SRGBColorSpace;
		this.texture.minFilter = LinearFilter; // no mipmaps: the canvas is repainted progressively
		this.texture.generateMipmaps = false;
	}

	/** Fill with the tiles covering the box centred on (lon, lat), `tiles` x `tiles` at zoom z. */
	load(src: TileSource, z: number, lon: number, lat: number, tiles: number) {
		const gen = ++this.generation;
		this.zoom = z;
		this.tiles = tiles;
		this.tx0 = Math.floor(mercX(lon, z) - tiles / 2);
		this.ty0 = Math.floor(mercY(lat, z) - tiles / 2);
		this.canvas.width = this.canvas.height = tiles * 256; // also clears it
		this.texture.needsUpdate = true;
		let pending = 0;
		for (let j = 0; j < tiles; j++)
			for (let i = 0; i < tiles; i++) {
				const x = this.tx0 + i;
				const y = this.ty0 + j;
				pending++;
				loadTile(src.url(z, x, y)).then((img) => {
					if (gen !== this.generation) return; // superseded by a newer load
					if (img) this.ctx.drawImage(img, i * 256, j * 256);
					// batch uploads: every few tiles and when the last one lands
					if (--pending % 6 === 0 || pending === 0) this.texture.needsUpdate = true;
				});
			}
	}

	/** Exact UV for a lon/lat (canvas is flipped on upload, so v runs south -> north). */
	uv(lon: number, lat: number): [number, number] {
		return [(mercX(lon, this.zoom) - this.tx0) / this.tiles, 1 - (mercY(lat, this.zoom) - this.ty0) / this.tiles];
	}
}

/**
 * Owns the far + near textures for the active style and keeps the near one centred on the bike.
 * Components read `far.texture`, `near.texture`, `nearUV` and `mix` each frame.
 */
// 9 tiles at z12 is ~51 km at UK latitudes: covers the 45 km terrain square after tile snapping
const FAR_TILES = 9;

export class Imagery {
	style: MapStyle = 'hologram';
	readonly far = new TileCanvas(FAR_TILES);
	readonly near = new TileCanvas(8);
	/** u = x*nearUV.x + nearUV.y, v = n*nearUV.z + nearUV.w (local metres) */
	readonly nearUV = new Vector4(0, -10, 0, -10);
	private nearCentre = { x: NaN, n: NaN };
	private proj: ReturnType<typeof makeProjection>;
	private farCentre: [number, number];

	constructor(meta: TerrainMeta) {
		this.proj = makeProjection(meta);
		const { x0, n1, cols, rows, spacing } = meta;
		this.farCentre = this.proj.toLonLat(x0 + ((cols - 1) * spacing) / 2, n1 - ((rows - 1) * spacing) / 2);
	}

	get mix() {
		return this.style === 'hologram' ? 0 : 1;
	}

	get attribution() {
		return this.style === 'hologram' ? null : MAP_SOURCES[this.style].attribution;
	}

	/** Far-texture UV for local metres; stable for every style (same zoom + centre). */
	farUv(x: number, n: number): [number, number] {
		// far canvas geometry is style-independent, so set it up once for UV maths
		if (!this.far.tiles) this.primeFar();
		return this.far.uv(...this.proj.toLonLat(x, n));
	}

	private primeFar() {
		const z = 12;
		const [lon, lat] = this.farCentre;
		this.far.zoom = z;
		this.far.tiles = FAR_TILES;
		this.far.tx0 = Math.floor(mercX(lon, z) - FAR_TILES / 2);
		this.far.ty0 = Math.floor(mercY(lat, z) - FAR_TILES / 2);
	}

	setStyle(style: MapStyle) {
		if (style === this.style) return;
		this.style = style;
		this.nearCentre = { x: NaN, n: NaN };
		if (style === 'hologram') return;
		const src = MAP_SOURCES[style];
		this.far.load(src, 12, ...this.farCentre, FAR_TILES);
	}

	/** Call every frame with the bike position; re-centres the sharp texture when the bike drifts. */
	update(x: number, n: number) {
		if (this.style === 'hologram') return;
		if (Math.hypot(x - this.nearCentre.x, n - this.nearCentre.n) < 900) return;
		this.nearCentre = { x, n };
		const src = MAP_SOURCES[this.style];
		const [lon, lat] = this.proj.toLonLat(x, n);
		// ~5-6 km square: 8 tiles at z15 (~0.7 km each at UK latitudes), 4 at z14
		const tiles = src.nearZoom >= 15 ? 8 : 4;
		this.near.load(src, src.nearZoom, lon, lat, tiles);
		// linearise the near texture's UV mapping around the bike
		const [u0, v0] = this.near.uv(lon, lat);
		const [u1] = this.near.uv(...this.proj.toLonLat(x + 100, n));
		const [, v1] = this.near.uv(...this.proj.toLonLat(x, n + 100));
		const du = (u1 - u0) / 100;
		const dv = (v1 - v0) / 100;
		this.nearUV.set(du, u0 - du * x, dv, v0 - dv * n);
	}
}
