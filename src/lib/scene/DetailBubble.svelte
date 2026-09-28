<!--
  Full-resolution solid terrain around the bike. A fixed-size grid mesh is re-sampled from the
  height grid whenever the bike drifts far enough from its centre; the shader fades it out into
  the hologram with a glowing rim. In prod this becomes streamed tiles instead of one big grid.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, ShaderMaterial, Vector2 } from 'three';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();

	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const { terrain } = tour.data;
	const { spacing, x0, n1 } = terrain.meta;
	// svelte-ignore state_referenced_locally
	const imagery = tour.imagery;

	const HALF = 128; // cells each side -> 6.4 km square at 25 m
	const SIDE = HALF * 2 + 1;
	const RECENTRE = 400; // metres of drift before re-sampling

	const positions = new Float32Array(SIDE * SIDE * 3);
	const normals = new Float32Array(SIDE * SIDE * 3);
	const wet = new Float32Array(SIDE * SIDE); // 1 = lake/sea; interpolates to a soft shoreline
	const farUv = new Float32Array(SIDE * SIDE * 2);
	const index: number[] = [];
	for (let r = 0; r < SIDE - 1; r++)
		for (let c = 0; c < SIDE - 1; c++) {
			const a = r * SIDE + c;
			index.push(a, a + SIDE, a + 1, a + 1, a + SIDE, a + SIDE + 1);
		}
	const geometry = new BufferGeometry();
	geometry.setIndex(index);
	geometry.setAttribute('position', new BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new BufferAttribute(normals, 3));
	geometry.setAttribute('aWater', new BufferAttribute(wet, 1));
	geometry.setAttribute('aUvFar', new BufferAttribute(farUv, 2));

	let centre = { x: NaN, n: NaN };

	function resample(bx: number, bn: number) {
		// snap to the grid so vertices sit exactly on DEM samples (no swimming)
		const cx = Math.round((bx - x0) / spacing);
		const cr = Math.round((n1 - bn) / spacing);
		centre = { x: x0 + cx * spacing, n: n1 - cr * spacing };
		const hAt = (c: number, r: number) => terrain.heightAt(x0 + c * spacing, n1 - r * spacing);
		for (let r = 0; r < SIDE; r++)
			for (let c = 0; c < SIDE; c++) {
				const gc = cx - HALF + c;
				const gr = cr - HALF + r;
				const h = Math.max(0, hAt(gc, gr));
				const o = (r * SIDE + c) * 3;
				wet[r * SIDE + c] = terrain.waterAt(gc, gr);
				farUv.set(imagery.farUv(x0 + gc * spacing, n1 - gr * spacing), (r * SIDE + c) * 2);
				positions[o] = x0 + gc * spacing;
				positions[o + 1] = h;
				positions[o + 2] = -(n1 - gr * spacing);
				// central-difference normal in raw metres; normalMatrix applies exaggeration
				const dx = Math.max(0, hAt(gc + 1, gr)) - Math.max(0, hAt(gc - 1, gr));
				const dz = Math.max(0, hAt(gc, gr + 1)) - Math.max(0, hAt(gc, gr - 1));
				const nx = -dx;
				const ny = 2 * spacing;
				const nz = -dz;
				const len = Math.hypot(nx, ny, nz);
				normals[o] = nx / len;
				normals[o + 1] = ny / len;
				normals[o + 2] = nz / len;
			}
		geometry.attributes.position.needsUpdate = true;
		geometry.attributes.normal.needsUpdate = true;
		geometry.attributes.aWater.needsUpdate = true;
		geometry.attributes.aUvFar.needsUpdate = true;
		geometry.computeBoundingSphere();
	}

	const material = new ShaderMaterial({
		transparent: true,
		uniforms: {
			uBike: { value: new Vector2() },
			uBubble: { value: 2000 },
			uTime: { value: 0 },
			uWater: { value: 1 },
			uFar: { value: imagery.far.texture },
			uNear: { value: imagery.near.texture },
			uNearUV: { value: imagery.nearUV },
			uMapMix: { value: 0 }
		},
		vertexShader: /* glsl */ `
			varying float vH;
			varying vec2 vXZ;
			varying vec3 vNormal;
			varying vec3 vLight;
			varying float vWater;
			varying vec2 vUvFar;
			attribute float aWater;
			attribute vec2 aUvFar;
			void main() {
				vWater = aWater;
				vUvFar = aUvFar;
				vH = position.y;
				vXZ = position.xz;
				vNormal = normalize(normalMatrix * normal);
				vLight = normalize((viewMatrix * vec4(normalize(vec3(-0.6, 0.7, -0.4)), 0.0)).xyz);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			uniform vec2 uBike;
			uniform float uBubble;
			uniform float uTime;
			uniform float uWater;
			uniform sampler2D uFar;
			uniform sampler2D uNear;
			uniform vec4 uNearUV;
			uniform float uMapMix;
			varying float vWater;
			varying vec2 vUvFar;
			varying float vH;
			varying vec2 vXZ;
			varying vec3 vNormal;
			varying vec3 vLight;

			vec3 hypso(float h) {
				vec3 c = mix(vec3(0.16, 0.30, 0.20), vec3(0.36, 0.42, 0.24), smoothstep(0.0, 250.0, h));
				c = mix(c, vec3(0.45, 0.38, 0.28), smoothstep(250.0, 550.0, h));
				c = mix(c, vec3(0.72, 0.70, 0.66), smoothstep(550.0, 900.0, h));
				return c;
			}

			void main() {
				float sea = step(vH, 0.5);
				float shade = 0.25 + 1.0 * max(dot(normalize(vNormal), vLight), 0.0);
				vec3 col = mix(hypso(vH) * shade * 0.75, vec3(0.02, 0.07, 0.16), sea);

				// map imagery: sharp near texture where it has loaded, regional texture elsewhere
				vec2 nuv = vec2(vXZ.x * uNearUV.x + uNearUV.y, -vXZ.y * uNearUV.z + uNearUV.w);
				vec4 nearTex = texture2D(uNear, nuv);
				float inNear = step(0.0, nuv.x) * step(nuv.x, 1.0) * step(0.0, nuv.y) * step(nuv.y, 1.0) * nearTex.a;
				vec3 img = mix(texture2D(uFar, vUvFar).rgb, nearTex.rgb, inNear);
				// keep a touch of hillshade so relief still reads through flat imagery
				col = mix(col, img * (0.55 + 0.6 * shade), uMapMix);

				// glowing 20 m contour lines, brighter every 100 m
				float k = vH / 20.0;
				// fwidth is 0 on dead-flat ground (lakes, reservoirs): guard it or the divide gives NaN pixels
				float line = 1.0 - min(abs(fract(k - 0.5) - 0.5) / max(fwidth(k), 1e-4), 1.0);
				float m = vH / 100.0;
				float major = 1.0 - min(abs(fract(m - 0.5) - 0.5) / max(fwidth(m), 1e-4), 1.0);
				col += vec3(0.25, 0.85, 1.0) * (line * 0.18 + major * 0.35) * (1.0 - sea) * (1.0 - 0.75 * uMapMix);

				// lakes / sea: dark glassy surface with drifting glints and a glowing shoreline
				// imagery already shows water, so only tint it lightly when a map style is on
				float w = smoothstep(0.42, 0.58, vWater) * uWater * (1.0 - 0.65 * uMapMix);
				// sum of travelling waves in different directions: reads as ripples, not a dot lattice
				float rip = sin(dot(vXZ, vec2(0.061, 0.023)) + uTime * 1.3)
					+ sin(dot(vXZ, vec2(-0.017, 0.047)) - uTime * 0.9)
					+ 0.6 * sin(dot(vXZ, vec2(0.11, -0.083)) + uTime * 2.1);
				vec3 waterCol = vec3(0.03, 0.12, 0.26) + vec3(0.35, 0.75, 1.0) * smoothstep(1.6, 2.4, rip) * 0.3
					// slow large-scale swell breaks up any visible regularity
					* smoothstep(-0.3, 1.0, sin(dot(vXZ, vec2(0.0043, 0.0061)) + uTime * 0.25));
				col = mix(col, waterCol, w);
				float shore = 1.0 - smoothstep(0.0, 0.25, abs(vWater - 0.5));
				col += vec3(0.3, 0.9, 1.0) * shore * 0.45 * uWater;

				float d = distance(vXZ, uBike) / uBubble;
				float fade = 1.0 - smoothstep(0.6, 1.0, d);
				vec3 holo = vec3(0.3, 0.95, 1.0);
				col = mix(col, holo * 0.6, smoothstep(0.55, 0.95, d));
				col += holo * smoothstep(0.035, 0.0, abs(d - 0.93)) * 0.8;
				if (fade <= 0.001) discard;
				gl_FragColor = vec4(col, fade);
			}
		`
	});

	useTask((dt) => {
		material.uniforms.uTime.value += dt;
		material.uniforms.uWater.value = tour.layers.water ? 1 : 0;
		material.uniforms.uMapMix.value = imagery.mix;
		const { x, n } = tour.bike;
		if (!(Math.hypot(x - centre.x, n - centre.n) < RECENTRE)) resample(x, n);
		material.uniforms.uBike.value.set(x, -n);
		material.uniforms.uBubble.value = Math.min(tour.bubble, HALF * spacing - RECENTRE);
	});

	$effect(() => () => {
		geometry.dispose();
		material.dispose();
	});
</script>

<T.Mesh {geometry} {material} frustumCulled={false} renderOrder={-1} />
