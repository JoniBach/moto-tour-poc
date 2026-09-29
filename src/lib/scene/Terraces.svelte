<!--
  "Laser-cut" terraces. Rather than triangulating contour polygons (minutes of work for
  coastlines with hundreds of lochs as holes), a 50 m height mesh is quantised to the contour
  interval in the vertex shader: flat tops, short risers, instant to build, and the interval
  can change live. Lighting uses screen-space derivatives so tops and risers shade correctly.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, ShaderMaterial } from 'three';
	import type { Tour } from '$lib/tour.svelte';
	import { HORIZON_GLSL, horizonUniforms } from './horizon';

	let { tour, interval = 50 }: { tour: Tour; interval?: number } = $props();

	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const { terrain } = tour.data;
	const { cols, rows, spacing, x0, n1, maxH } = terrain.meta;
	// svelte-ignore state_referenced_locally
	const imagery = tour.imagery;

	const STEP = 2;
	const gc = Math.floor((cols - 1) / STEP) + 1;
	const gr = Math.floor((rows - 1) / STEP) + 1;
	const pos = new Float32Array(gc * gr * 3);
	const wet = new Float32Array(gc * gr);
	const uvs = new Float32Array(gc * gr * 2);
	for (let r = 0; r < gr; r++)
		for (let c = 0; c < gc; c++) {
			const o = (r * gc + c) * 3;
			pos[o] = x0 + c * STEP * spacing;
			pos[o + 1] = terrain.heights[r * STEP * cols + c * STEP];
			pos[o + 2] = -(n1 - r * STEP * spacing);
			wet[r * gc + c] = terrain.waterAt(c * STEP, r * STEP);
			uvs.set(imagery.farUv(pos[o], -pos[o + 2]), (r * gc + c) * 2);
		}
	const index = new Uint32Array((gc - 1) * (gr - 1) * 6);
	let k = 0;
	for (let r = 0; r < gr - 1; r++)
		for (let c = 0; c < gc - 1; c++) {
			const a = r * gc + c;
			index.set([a, a + gc, a + 1, a + 1, a + gc, a + gc + 1], k);
			k += 6;
		}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(pos, 3));
	geometry.setAttribute('aWater', new BufferAttribute(wet, 1));
	geometry.setAttribute('aUv', new BufferAttribute(uvs, 2));
	geometry.setIndex(new BufferAttribute(index, 1));

	const material = new ShaderMaterial({
		transparent: true,
		// svelte-ignore state_referenced_locally
		uniforms: { uInterval: { value: interval }, uMaxH: { value: maxH }, uWater: { value: 1 }, uMap: { value: imagery.far.texture }, uMapMix: { value: 0 }, ...horizonUniforms() },
		vertexShader: /* glsl */ `
			uniform float uInterval;
			varying float vLevel;
			varying float vSea;
			varying vec3 vWorld;
			varying float vWater;
			varying vec2 vUv;
			attribute float aWater;
			attribute vec2 aUv;
			void main() {
				vWater = aWater;
				vUv = aUv;
				float h = max(position.y, 0.0);
				vSea = step(position.y, 0.5);
				vLevel = floor(h / uInterval);
				vec4 world = modelMatrix * vec4(position.x, vLevel * uInterval, position.z, 1.0);
				vWorld = world.xyz;
				gl_Position = projectionMatrix * viewMatrix * world;
			}
		`,
		fragmentShader: /* glsl */ `
			uniform float uInterval;
			uniform float uMaxH;
			uniform float uWater;
			uniform sampler2D uMap;
			uniform float uMapMix;
			${HORIZON_GLSL}
			varying float vWater;
			varying vec2 vUv;
			varying float vLevel;
			varying float vSea;
			varying vec3 vWorld;
			void main() {
				vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
				float riser = 1.0 - smoothstep(0.97, 0.995, abs(n.y));
				float t = clamp(vLevel * uInterval / uMaxH, 0.0, 1.0);
				// alternating bands like stacked sheets, teal -> ice with height
				vec3 top = mix(vec3(0.05, 0.22, 0.28), vec3(0.55, 0.85, 0.92), t) * (mod(vLevel, 2.0) < 1.0 ? 1.0 : 0.8);
				vec3 side = vec3(0.3, 0.9, 1.0) * (0.25 + 0.35 * abs(dot(n, normalize(vec3(-0.6, 0.0, 0.8)))));
				// with imagery: tops take the map colour, risers stay as glowing edges
				vec3 img = texture2D(uMap, vUv).rgb;
				top = mix(top, img * (mod(vLevel, 2.0) < 1.0 ? 1.0 : 0.85), uMapMix);
				vec3 col = mix(top, side, riser);
				// lakes read as flat blue sheets set into their terrace
				float w = max(vSea, smoothstep(0.4, 0.6, vWater) * uWater) * (1.0 - 0.7 * uMapMix);
				col = mix(col, mix(vec3(0.05, 0.2, 0.5), vec3(0.02, 0.06, 0.14), vSea), w);
				float fade = horizonFade(vWorld.xz);
				if (fade <= 0.001) discard;
				gl_FragColor = vec4(col, mix(0.92, 0.75, w) * fade);
			}
		`
	});

	$effect(() => {
		material.uniforms.uInterval.value = interval;
		material.uniforms.uWater.value = tour.layers.water ? 1 : 0;
	});

	useTask(() => {
		material.uniforms.uMapMix.value = imagery.mix;
		material.uniforms.uRider.value.set(tour.bike.x, -tour.bike.n);
		material.uniforms.uHorizon.value = tour.horizon;
	});

	$effect(() => () => {
		geometry.dispose();
		material.dispose();
	});
</script>

<T.Mesh {geometry} {material} />
