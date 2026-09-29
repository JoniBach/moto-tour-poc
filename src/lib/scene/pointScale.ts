import type { PerspectiveCamera, ShaderMaterial } from 'three';

/**
 * Feed a point shader what it needs to size points by their ground footprint:
 * uProj = device pixels per metre at 1 m from the camera, uPixelRatio = device pixels per CSS px.
 */
export function pointScale(material: ShaderMaterial, camera: PerspectiveCamera, cssHeight: number, pixelRatio: number) {
	const fov = ((camera.fov ?? 45) * Math.PI) / 180;
	material.uniforms.uProj.value = (cssHeight * pixelRatio) / (2 * Math.tan(fov / 2));
	material.uniforms.uPixelRatio.value = pixelRatio;
}
