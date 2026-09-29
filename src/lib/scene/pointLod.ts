// Screen-density level of detail for point clouds on a regular grid.
//
// Each grid point gets a *level*: 0 for every point, 1 if it's on every 2nd row and column,
// 2 on every 4th, … (like mipmaps). The shader works out how far apart neighbouring grid points
// land on screen and keeps only levels coarse enough to stay at least a set gap apart, so the
// number of points per area of screen stays roughly constant at any zoom: zoom out and the
// cloud thins to a sparser regular grid instead of piling glow into the same pixels.
// A per-point random offset (0..1) spreads each level's fade so levels don't pop in at once.

const MAX_LEVEL = 12;

/** Trailing zero bits: how many times n halves evenly. */
const tz = (n: number) => {
	if (n === 0) return MAX_LEVEL;
	let k = 0;
	while (k < MAX_LEVEL && (n & 1) === 0) (n >>= 1), k++;
	return k;
};

/** LOD level of grid cell (c, r). */
export const gridLevel = (c: number, r: number) => Math.min(tz(c), tz(r));

/** Deterministic 0..1 per index. */
export const hash01 = (i: number) => {
	const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
	return s - Math.floor(s);
};

/**
 * GLSL: returns 0..1 visibility for a point. cellMetres = base grid spacing, level/hash from the
 * attributes, gapPx = minimum on-screen gap between visible points (device px), proj = device px
 * per metre at 1 m. Points with visibility 0 should get gl_PointSize = 0.
 */
export const LOD_GLSL = /* glsl */ `
	float lodKeep(float cellMetres, float depth, float level, float hash, float gapPx, float proj) {
		float cellPx = cellMetres * proj / depth;            // on-screen gap between neighbouring grid points
		float need = log2(max(gapPx / cellPx, 1.0));          // levels to skip to keep that gap
		return smoothstep(need, need + 0.5, level + hash);
	}
`;
