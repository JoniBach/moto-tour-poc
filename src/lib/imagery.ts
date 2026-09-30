// Map imagery (satellite / Sentinel-2 / topo) stitched from XYZ tiles into canvas textures:
//  - "far": the whole terrain area at a low zoom, sampled by the point cloud, terraces and the
//    detail mesh outside the near texture. Its UVs are exact per vertex (static geometry).
//  - "near": a sharper square that follows the bike. The detail mesh maps into it with a linear
//    transform (uniform), accurate to ~1 px at this size since Mercator is near-linear over a few km.
import { CanvasTexture, LinearFilter, SRGBColorSpace, Vector3 } from 'three';
import { makeProjection } from './projection';
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
		// the 2018+ editions are CC BY-NC-SA 4.0: non-commercial use, licence named
		attribution: 'Sentinel-2 cloudless 2023 by EOX IT Services GmbH (modified Copernicus Sentinel data), CC BY-NC-SA 4.0'
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

/** Largest zoom at which `tiles` tiles span `metres` at this latitude (Web Mercator tiles shrink with cos(lat)). */
function zoomToCover(metres: number, lat: number, tiles: number) {
	for (let z = 12; z > 6; z--) {
		const tileWidth = (2 * Math.PI * R * Math.cos(lat * RAD)) / 2 ** z;
		if (tileWidth * (tiles - 1) >= metres) return z;
	}
	return 6;
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
// 9 tiles, at whatever zoom lets them span the day's grid (z12 for a Lakes-sized day, lower for long ones)
const FAR_TILES = 9;
const LUT_STEP = 2000; // metres between far-UV lookup samples

export class Imagery {
	style: MapStyle = 'hologram';
	readonly far = new TileCanvas(FAR_TILES);
	readonly near = new TileCanvas(8);
	/**
	 * Near-texture UVs as an affine map of local metres: u = dot(nearU, (x, n, 1)), v = dot(nearV, …).
	 * Full affine (not just scale + offset) because grid north in BNG is rotated from true north.
	 */
	readonly nearU = new Vector3(0, 0, -10);
	readonly nearV = new Vector3(0, 0, -10);
	private nearCentre = { x: NaN, n: NaN };
	private proj: ReturnType<typeof makeProjection>;
	private farCentre: [number, number];
	private farZoom: number;
	private meta: TerrainMeta;

	constructor(meta: TerrainMeta) {
		this.meta = meta;
		this.proj = makeProjection(meta.originE, meta.originN);
		const { x0, n1, cols, rows, spacing } = meta;
		this.farCentre = this.proj.toLonLat(x0 + ((cols - 1) * spacing) / 2, n1 - ((rows - 1) * spacing) / 2);
		// the Mercator box must contain the BNG box even though they're slightly rotated
		const span = Math.max(cols, rows) * spacing * 1.08;
		this.farZoom = zoomToCover(span, this.farCentre[1], FAR_TILES);
	}

	get mix() {
		return this.style === 'hologram' ? 0 : 1;
	}

	get attribution() {
		return this.style === 'hologram' ? null : MAP_SOURCES[this.style].attribution;
	}

	/**
	 * Far-texture UV for local metres; stable for every style (same zoom + centre).
	 * Point clouds call this hundreds of thousands of times, so rather than a BNG -> lon/lat ->
	 * Mercator conversion per call it interpolates a 2 km lookup table (error well under a metre).
	 */
	farUv(x: number, n: number): [number, number] {
		const lut = (this.lut ??= this.buildLut());
		const fc = Math.max(0, Math.min(lut.cols - 1.001, (x - lut.x0) / LUT_STEP));
		const fr = Math.max(0, Math.min(lut.rows - 1.001, (n - lut.n0) / LUT_STEP));
		const c = Math.floor(fc);
		const r = Math.floor(fr);
		const a = fc - c;
		const b = fr - r;
		const i = (r * lut.cols + c) * 2;
		const j = i + lut.cols * 2;
		const d = lut.uv;
		return [
			(d[i] * (1 - a) + d[i + 2] * a) * (1 - b) + (d[j] * (1 - a) + d[j + 2] * a) * b,
			(d[i + 1] * (1 - a) + d[i + 3] * a) * (1 - b) + (d[j + 1] * (1 - a) + d[j + 3] * a) * b
		];
	}

	private lut: { x0: number; n0: number; cols: number; rows: number; uv: Float32Array } | null = null;

	private buildLut() {
		// far canvas geometry is style-independent, so it can be set up before any tiles load
		if (!this.far.tiles) this.primeFar();
		const { x0, n1, cols, rows, spacing } = this.meta;
		const lx0 = x0 - LUT_STEP;
		const ln0 = n1 - (rows - 1) * spacing - LUT_STEP;
		const lc = Math.ceil(((cols - 1) * spacing) / LUT_STEP) + 3;
		const lr = Math.ceil(((rows - 1) * spacing) / LUT_STEP) + 3;
		const uv = new Float32Array(lc * lr * 2);
		for (let r = 0; r < lr; r++)
			for (let c = 0; c < lc; c++) uv.set(this.far.uv(...this.proj.toLonLat(lx0 + c * LUT_STEP, ln0 + r * LUT_STEP)), (r * lc + c) * 2);
		return { x0: lx0, n0: ln0, cols: lc, rows: lr, uv };
	}

	private primeFar() {
		const z = this.farZoom;
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
		this.far.load(src, this.farZoom, ...this.farCentre, FAR_TILES);
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
		// linearise the near texture's UV mapping around the bike (affine: BNG is rotated vs Mercator)
		const [u0, v0] = this.near.uv(lon, lat);
		const [ue, ve] = this.near.uv(...this.proj.toLonLat(x + 100, n));
		const [un, vn] = this.near.uv(...this.proj.toLonLat(x, n + 100));
		const [uex, vex, unx, vnx] = [(ue - u0) / 100, (ve - v0) / 100, (un - u0) / 100, (vn - v0) / 100];
		this.nearU.set(uex, unx, u0 - uex * x - unx * n);
		this.nearV.set(vex, vnx, v0 - vex * x - vnx * n);
	}
}
