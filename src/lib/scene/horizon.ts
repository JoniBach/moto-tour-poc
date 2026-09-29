// The day's terrain (hologram points, contour rings, terraces) is scoped to a wide circle around
// the rider rather than drawn as the day's whole rectangle: full strength inside, fading out over
// the outer quarter. Shaders include HORIZON_GLSL and call horizonFade(worldXZ).
import { Vector2 } from 'three';

export const horizonUniforms = () => ({
	uRider: { value: new Vector2() }, // rider position, world xz
	uHorizon: { value: 15000 } // metres
});

export const HORIZON_GLSL = /* glsl */ `
	uniform vec2 uRider;
	uniform float uHorizon;
	float horizonFade(vec2 xz) {
		return 1.0 - smoothstep(uHorizon * 0.7, uHorizon, distance(xz, uRider));
	}
`;
