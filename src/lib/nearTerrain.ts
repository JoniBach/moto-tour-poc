// L2: full-resolution terrain around the bike, streamed in the browser from the same Terrarium
// tiles the pipeline uses (AWS open data, CORS enabled). Day grids can be coarse (75 m on long
// days); this gives the detail bubble ~22 m data everywhere without shipping it per day.
import { makeProjection } from './bng';
import { despike, type TerrainMeta } from './data';

const Z = 12; // ~22 m/px at UK latitudes
const URL_OF = (x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;

const RAD = Math.PI / 180;
const pxX = (lon: number) => ((lon + 180) / 360) * 2 ** Z * 256;
const pxY = (lat: number) => {
	const s = Math.sin(lat * RAD);
	return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** Z * 256;
};

type Tile = Float32Array | null; // null = failed, so we don't retry forever
const tiles = new Map<string, Tile | Promise<Tile>>();
/** decoded tiles kept (256 KB each): a patch needs a handful, a whole tour would need thousands */
const MAX_TILES = 64;

/** Drop the oldest landed tiles beyond the cap (Map keeps insertion order); ensure() refetches. */
function trim() {
	for (const [key, t] of tiles) {
		if (tiles.size <= MAX_TILES) break;
		if (!(t instanceof Promise)) tiles.delete(key);
	}
}

/**
 * The exact pixel values of an 8-bit RGB/RGBA PNG (non-interlaced, as Terrarium tiles are).
 * Decoded here rather than through an <img> and a canvas: browsers may colour-manage images on
 * their way into a canvas (Safari, wide-gamut screens), and one step off in the red channel is
 * 256 m, which the 3D views drew as needles and pits dotted over the landscape.
 */
async function pngPixels(buf: ArrayBuffer): Promise<{ width: number; height: number; channels: number; data: Uint8Array }> {
	const bytes = new Uint8Array(buf);
	const view = new DataView(buf);
	let width = 0;
	let height = 0;
	let channels = 0;
	const idat: Uint8Array[] = [];
	for (let p = 8; p < bytes.length; ) {
		const len = view.getUint32(p);
		const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
		if (type === 'IHDR') {
			width = view.getUint32(p + 8);
			height = view.getUint32(p + 12);
			const depth = bytes[p + 16];
			const colour = bytes[p + 17];
			const interlace = bytes[p + 20];
			channels = colour === 2 ? 3 : colour === 6 ? 4 : 0;
			if (depth !== 8 || !channels || interlace) throw new Error('unsupported PNG');
		} else if (type === 'IDAT') idat.push(bytes.subarray(p + 8, p + 8 + len));
		else if (type === 'IEND') break;
		p += 12 + len;
	}
	// zlib stream across the IDAT chunks
	const raw = new Uint8Array(await new Response(new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
	// undo the per-row filters (PNG spec: None, Sub, Up, Average, Paeth)
	const stride = width * channels;
	const out = new Uint8Array(height * stride);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const src = y * (stride + 1) + 1;
		const row = y * stride;
		for (let x = 0; x < stride; x++) {
			const a = x >= channels ? out[row + x - channels] : 0;
			const b = y ? out[row - stride + x] : 0;
			const c = x >= channels && y ? out[row - stride + x - channels] : 0;
			let v = raw[src + x];
			if (filter === 1) v += a;
			else if (filter === 2) v += b;
			else if (filter === 3) v += (a + b) >> 1;
			else if (filter === 4) {
				const p = a + b - c;
				const pa = Math.abs(p - a);
				const pb = Math.abs(p - b);
				const pc = Math.abs(p - c);
				v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			out[row + x] = v & 255;
		}
	}
	return { width, height, channels, data: out };
}

async function decode(tx: number, ty: number): Promise<Tile> {
	try {
		const r = await fetch(URL_OF(tx, ty));
		if (!r.ok) return null;
		const { width, height, channels, data } = await pngPixels(await r.arrayBuffer());
		if (width !== 256 || height !== 256) return null;
		const h = new Float32Array(256 * 256);
		for (let i = 0; i < h.length; i++) {
			const o = i * channels;
			h[i] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
		}
		// belt and braces: a pixel 50 m above or below all its neighbours (~22-38 m apart in the
		// UK) is a bad sample in the source itself
		despike(h, 256, 256, 50);
		return h;
	} catch {
		return null;
	}
}

/**
 * Heights around a point in a day's local metres. `patch(cx, cn, half)` returns a sampler for a
 * square around (cx, cn); local -> tile pixel is linearised per patch (sub-pixel accurate over a
 * few km), so sampling costs a multiply-add plus a bilinear lookup.
 */
export class NearTerrain {
	private proj: ReturnType<typeof makeProjection>;

	constructor(meta: TerrainMeta) {
		this.proj = makeProjection(meta.originE, meta.originN);
	}

	/** Start loading every tile covering the square; resolves when they've all landed. */
	async ensure(cx: number, cn: number, half: number) {
		const keys = new Set<string>();
		for (const [dx, dn] of [
			[-half, -half],
			[half, -half],
			[-half, half],
			[half, half]
		]) {
			const [lon, lat] = this.proj.toLonLat(cx + dx, cn + dn);
			keys.add(`${Math.floor(pxX(lon) / 256)}/${Math.floor(pxY(lat) / 256)}`);
		}
		// fill the box between the corner tiles
		const xs = [...keys].map((k) => +k.split('/')[0]);
		const ys = [...keys].map((k) => +k.split('/')[1]);
		const jobs: Promise<Tile>[] = [];
		for (let tx = Math.min(...xs); tx <= Math.max(...xs); tx++)
			for (let ty = Math.min(...ys); ty <= Math.max(...ys); ty++) {
				const key = `${tx}/${ty}`;
				let t = tiles.get(key);
				if (t === undefined) {
					t = decode(tx, ty).then((h) => {
						tiles.delete(key); // re-insert: newest last
						tiles.set(key, h);
						trim();
						return h;
					});
					tiles.set(key, t);
				}
				if (t instanceof Promise) jobs.push(t);
			}
		await Promise.all(jobs);
	}

	/** Sampler for local metres around (cx, cn); returns NaN where tiles aren't loaded. */
	patch(cx: number, cn: number) {
		const at = (x: number, n: number) => {
			const [lon, lat] = this.proj.toLonLat(x, n);
			return [pxX(lon), pxY(lat)];
		};
		const [p0x, p0y] = at(cx, cn);
		const [pex, pey] = at(cx + 1000, cn);
		const [pnx, pny] = at(cx, cn + 1000);
		const [ax, ay, bx, by] = [(pex - p0x) / 1000, (pey - p0y) / 1000, (pnx - p0x) / 1000, (pny - p0y) / 1000];
		return (x: number, n: number): number => {
			const dx = x - cx;
			const dn = n - cn;
			const fx = p0x + ax * dx + bx * dn - 0.5;
			const fy = p0y + ay * dx + by * dn - 0.5;
			const ix = Math.floor(fx);
			const iy = Math.floor(fy);
			const px = (xx: number, yy: number) => {
				const t = tiles.get(`${Math.floor(xx / 256)}/${Math.floor(yy / 256)}`);
				if (!(t instanceof Float32Array)) return NaN;
				return t[(yy & 255) * 256 + (xx & 255)];
			};
			const u = fx - ix;
			const v = fy - iy;
			return (px(ix, iy) * (1 - u) + px(ix + 1, iy) * u) * (1 - v) + (px(ix, iy + 1) * (1 - u) + px(ix + 1, iy + 1) * u) * v;
		};
	}
}
