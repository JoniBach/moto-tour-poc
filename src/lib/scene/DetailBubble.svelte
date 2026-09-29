<!--
  Solid terrain around the bike (L2). A fixed 25 m grid mesh is re-sampled whenever the bike
  drifts far enough from its centre: first from the day grid (instant, maybe coarse), then again
  from full-resolution Terrarium tiles streamed in the browser once they land. The shader fades
  it into the hologram with a glowing rim.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, ShaderMaterial, Vector2 } from 'three';
	import { NearTerrain } from '$lib/nearTerrain';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();

	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const { terrain } = tour.data;
	const { spacing, x0, n1 } = terrain.meta;
	// svelte-ignore state_referenced_locally
	const imagery = tour.imagery;
	const near = new NearTerrain(terrain.meta);

	const CELL = 25; // metres, whatever the day grid's spacing
	const HALF = 128; // cells each side -> 6.4 km square
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
		// snap to a 25 m lattice so vertices don't swim as the patch moves
		const cx = Math.round(bx / CELL) * CELL;
		const cn = Math.round(bn / CELL) * CELL;
		centre = { x: cx, n: cn };
		fill(cx, cn);
		// sharpen once the full-res tiles for this patch have arrived (if we haven't moved on)
		near.ensure(cx, cn, (HALF + 1) * CELL).then(() => {
			if (centre.x === cx && centre.n === cn) fill(cx, cn);
		});
	}

	function fill(cx: number, cn: number) {
		const sample = near.patch(cx, cn);
		// heights on a 1-cell-padded lattice so normals can use neighbours without extra lookups
		const W = SIDE + 2;
		const hs = new Float32Array(W * W);
		for (let r = 0; r < W; r++)
			for (let c = 0; c < W; c++) {
				const x = cx + (c - 1 - HALF) * CELL;
				const n = cn - (r - 1 - HALF) * CELL;
				let h = sample(x, n);
				if (!Number.isFinite(h)) h = terrain.heightAt(x, n); // tile not loaded yet
				hs[r * W + c] = Math.max(0, h);
			}
		for (let r = 0; r < SIDE; r++)
			for (let c = 0; c < SIDE; c++) {
				const x = cx + (c - HALF) * CELL;
				const n = cn - (r - HALF) * CELL;
				const k = (r + 1) * W + (c + 1);
				const o = (r * SIDE + c) * 3;
				positions[o] = x;
				positions[o + 1] = hs[k];
				positions[o + 2] = -n;
				wet[r * SIDE + c] = terrain.waterAtXY(x, n);
				farUv.set(imagery.farUv(x, n), (r * SIDE + c) * 2);
				// central-difference normal in raw metres; normalMatrix applies exaggeration
				const nx = -(hs[k + 1] - hs[k - 1]);
				const ny = 2 * CELL;
				const nz = -(hs[k + W] - hs[k - W]);
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
			uNearU: { value: imagery.nearU },
			uNearV: { value: imagery.nearV },
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
			uniform vec3 uNearU;
			uniform vec3 uNearV;
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
				vec3 xn1 = vec3(vXZ.x, -vXZ.y, 1.0); // local (x, n, 1)
				vec2 nuv = vec2(dot(uNearU, xn1), dot(uNearV, xn1));
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
		material.uniforms.uBubble.value = Math.min(tour.bubble, HALF * CELL - RECENTRE);
	});

	$effect(() => () => {
		geometry.dispose();
		material.dispose();
	});
</script>

<T.Mesh {geometry} {material} frustumCulled={false} renderOrder={-1} />
