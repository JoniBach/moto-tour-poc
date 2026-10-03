<!--
  The globe's landscape: a disc of terrain centred on the bike, cut cleanly at radius R, with a
  wall of layered earth around its edge down to the plinth. Like the 3D view's detail bubble it's a
  fixed grid re-sampled as the bike drifts (day grid first, then full-resolution tiles), but the
  circle itself follows the bike exactly, so the land slides past under a rider who never moves.
  Lives inside a group scaled on Y by the vertical exaggeration.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, DoubleSide, ShaderMaterial, Vector2, Vector3, Color } from 'three';
	import { NearTerrain } from '$lib/nearTerrain';
	import type { Tour } from '$lib/tour.svelte';
	import type { GlobeState } from './state';

	/** radius: metres of landscape from the bike to the rim */
	let {
		tour,
		globe,
		radius,
		fade
	}: {
		tour: Tour;
		globe: GlobeState;
		radius: number;
		/** 1 the land shows, 0 it has faded away (the stage's transitions) */
		fade?: () => number;
	} = $props();

	// svelte-ignore state_referenced_locally — both are fixed for the component's lifetime
	const { terrain } = tour.data;
	// svelte-ignore state_referenced_locally
	const imagery = tour.imagery;
	// svelte-ignore state_referenced_locally — a new radius remounts this component
	const R = radius;
	const near = new NearTerrain(terrain.meta);

	// ~20 m where the tiles are that sharp; coarser on big globes, so the grid stays ~200 × 200
	const CELL = Math.max(20, Math.round(R / 90));
	const RECENTRE = Math.max(300, R * 0.15);
	const HALF = Math.ceil((R + RECENTRE) / CELL) + 2;
	const SIDE = HALF * 2 + 1;
	/** earth below the lowest ground in the disc, as a share of the radius (before exaggeration) */
	const DEPTH = 0.05;

	// ---- the disc -----------------------------------------------------------------------------
	const positions = new Float32Array(SIDE * SIDE * 3);
	const normals = new Float32Array(SIDE * SIDE * 3);
	const wet = new Float32Array(SIDE * SIDE);
	const farUv = new Float32Array(SIDE * SIDE * 2);
	const grid = new Float32Array(SIDE * SIDE); // heights, for the rim and for pins
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

	/** Height from the current grid, interpolated as the mesh draws it (near enough). */
	function gridHeight(x: number, n: number): number {
		const fc = Math.max(0, Math.min(SIDE - 1.001, (x - centre.x) / CELL + HALF));
		const fr = Math.max(0, Math.min(SIDE - 1.001, (centre.n - n) / CELL + HALF));
		const c = Math.floor(fc);
		const r = Math.floor(fr);
		const a = fc - c;
		const b = fr - r;
		const i = r * SIDE + c;
		return (grid[i] * (1 - a) + grid[i + 1] * a) * (1 - b) + (grid[i + SIDE] * (1 - a) + grid[i + SIDE + 1] * a) * b;
	}

	function resample(bx: number, bn: number) {
		const cx = Math.round(bx / CELL) * CELL;
		const cn = Math.round(bn / CELL) * CELL;
		centre = { x: cx, n: cn };
		fill(cx, cn);
		near.ensure(cx, cn, (HALF + 1) * CELL).then(() => {
			if (centre.x === cx && centre.n === cn) fill(cx, cn);
		});
	}

	function fill(cx: number, cn: number) {
		const sample = near.patch(cx, cn);
		const W = SIDE + 2;
		const hs = new Float32Array(W * W);
		for (let r = 0; r < W; r++)
			for (let c = 0; c < W; c++) {
				const x = cx + (c - 1 - HALF) * CELL;
				const n = cn - (r - 1 - HALF) * CELL;
				let h = sample(x, n);
				if (!Number.isFinite(h)) h = terrain.heightAt(x, n);
				hs[r * W + c] = Math.max(0, h);
			}
		let low = Infinity;
		for (let r = 0; r < SIDE; r++)
			for (let c = 0; c < SIDE; c++) {
				const x = cx + (c - HALF) * CELL;
				const n = cn - (r - HALF) * CELL;
				const k = (r + 1) * W + (c + 1);
				const o = (r * SIDE + c) * 3;
				positions[o] = x;
				positions[o + 1] = hs[k];
				positions[o + 2] = -n;
				grid[r * SIDE + c] = hs[k];
				// anywhere the disc can reach before the next re-sample
				if (Math.hypot(c - HALF, r - HALF) * CELL < R + RECENTRE) low = Math.min(low, hs[k]);
				wet[r * SIDE + c] = terrain.waterAtXY(x, n);
				farUv.set(imagery.farUv(x, n), (r * SIDE + c) * 2);
				const nx = -(hs[k + 1] - hs[k - 1]);
				const ny = 2 * CELL;
				const nz = -(hs[k + W] - hs[k - W]);
				const len = Math.hypot(nx, ny, nz);
				normals[o] = nx / len;
				normals[o + 1] = ny / len;
				normals[o + 2] = nz / len;
			}
		for (const name of ['position', 'normal', 'aWater', 'aUvFar']) geometry.attributes[name].needsUpdate = true;
		geometry.computeBoundingSphere();
		globe.baseGoal = low - DEPTH * R;
		if (!Number.isFinite(globe.base)) globe.base = globe.baseGoal;
		globe.ground = gridHeight;
		globe.patch = { x: cx, n: cn, reach: R + RECENTRE };
		globe.version++;
	}

	// shared lighting: hillshade from the sun (or moon), a soft sky fill, tinted by the light
	const LIGHT_GLSL = /* glsl */ `
		uniform vec3 uLightDir;
		uniform vec3 uLight;
		uniform float uStrength;
		uniform float uDay;
		uniform float uFade;
		/** how much light falls on a surface facing n (about 0.35 in shade at night .. 0.95 in full sun) */
		vec3 lightAt(vec3 n) {
			float diff = max(dot(n, uLightDir), 0.0);
			vec3 sky = mix(vec3(0.34, 0.38, 0.52), vec3(0.62, 0.66, 0.70), uDay);
			vec3 k = sky + uLight * diff * uStrength;
			// soft ceiling: passes through up to 0.9, then eases off, so a clear midday sun (full
			// strength, no cloud to soften it) can't wash the pastel land out, while overcast
			// days look as before
			vec3 over = max(k - 0.9, 0.0);
			return min(k, vec3(0.9)) + over / (1.0 + over * 3.0);
		}
		vec3 lit(vec3 base, vec3 n) {
			return base * lightAt(n);
		}
	`;

	const lightUniforms = () => ({
		uLightDir: { value: new Vector3(0, 1, 0) },
		uLight: { value: new Color('#ffffff') },
		uStrength: { value: 1 },
		uDay: { value: 1 },
		uExag: { value: 2 },
		uFade: { value: 1 }
	});

	const material = new ShaderMaterial({
		uniforms: {
			...lightUniforms(),
			uBike: { value: new Vector2() },
			uR: { value: R },
			uTime: { value: 0 },
			uWater: { value: 1 },
			uContours: { value: 1 },
			uFar: { value: imagery.far.texture },
			uNear: { value: imagery.near.texture },
			uNearU: { value: imagery.nearU },
			uNearV: { value: imagery.nearV },
			uMapMix: { value: 0 },
			uPhoto: { value: 0 }
		},
		vertexShader: /* glsl */ `
			uniform float uExag;
			attribute float aWater;
			attribute vec2 aUvFar;
			varying float vH;
			varying vec2 vXZ;
			varying vec3 vN;
			varying float vWater;
			varying vec2 vUvFar;
			void main() {
				vWater = aWater;
				vUvFar = aUvFar;
				vH = position.y;
				vXZ = position.xz;
				// the group is scaled by uExag on y: normals scale by the inverse
				vN = normalize(vec3(normal.x, normal.y / uExag, normal.z));
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			${LIGHT_GLSL}
			uniform vec2 uBike;
			uniform float uR;
			uniform float uTime;
			uniform float uWater;
			uniform float uContours;
			uniform sampler2D uFar;
			uniform sampler2D uNear;
			uniform vec3 uNearU;
			uniform vec3 uNearV;
			uniform float uMapMix;
			uniform float uPhoto;
			const float PHOTO_EXPOSURE = 4.0;
			varying float vH;
			varying vec2 vXZ;
			varying vec3 vN;
			varying float vWater;
			varying vec2 vUvFar;

			// soft pastel land by height: meadow, heath, bracken, pale stone
			vec3 pastel(float h) {
				vec3 c = mix(vec3(0.72, 0.84, 0.60), vec3(0.80, 0.84, 0.58), smoothstep(0.0, 200.0, h));
				c = mix(c, vec3(0.86, 0.78, 0.60), smoothstep(200.0, 450.0, h));
				c = mix(c, vec3(0.80, 0.74, 0.68), smoothstep(450.0, 700.0, h));
				c = mix(c, vec3(0.93, 0.92, 0.90), smoothstep(700.0, 950.0, h));
				return c;
			}

			void main() {
				float d = distance(vXZ, uBike);
				if (d > uR) discard;
				vec3 n = normalize(vN);
				vec3 col = pastel(vH);

				vec3 xn1 = vec3(vXZ.x, -vXZ.y, 1.0);
				vec2 nuv = vec2(dot(uNearU, xn1), dot(uNearV, xn1));
				vec4 nearTex = texture2D(uNear, nuv);
				float inNear = step(0.0, nuv.x) * step(nuv.x, 1.0) * step(0.0, nuv.y) * step(nuv.y, 1.0) * nearTex.a;
				vec4 farTex = texture2D(uFar, vUvFar);
				vec3 img = mix(farTex.rgb, nearTex.rgb, inNear);
				// tiles still loading (or missing): the pastel land, not black
				float have = max(farTex.a, inNear);
				// photographs (satellite, Sentinel-2) are far darker than the pastel land (British hills
				// photograph at 10-15% brightness): an exposure curve lifts the shadows and mid-tones to sit
				// in the airy palette and rolls the highlights off towards white, so nothing clips. Done on
				// the brightness (colours keep their hue), with a little saturation back that the lift
				// takes out. A printed map (topo) is already light: as it is.
				float l = dot(img, vec3(0.2126, 0.7152, 0.0722));
				float lifted = (1.0 - exp(-PHOTO_EXPOSURE * l)) / (1.0 - exp(-PHOTO_EXPOSURE));
				vec3 photo = img * (lifted / max(l, 1e-3));
				photo = mix(vec3(lifted), photo, 1.08);
				img = mix(img, clamp(photo, 0.0, 1.0), uPhoto);

				// water: pale, with a slow soft shimmer (broad waves, no glints: they read as a dot grid)
				float w = smoothstep(0.42, 0.58, vWater) * uWater * (1.0 - 0.6 * uMapMix);
				float sea = step(vH, 0.5);
				float shimmer = sin(dot(vXZ, vec2(0.009, 0.004)) + uTime * 0.5) * sin(dot(vXZ, vec2(-0.003, 0.007)) - uTime * 0.3);
				vec3 water = vec3(0.62, 0.80, 0.90) + vec3(0.05) * shimmer;
				float wet = max(w, sea);
				n = normalize(mix(n, vec3(0.0, 1.0, 0.0), wet));
				vec3 sun = lightAt(n);
				// the pastel land takes the full hillshade; imagery already has the real sun and shade in
				// it, so it only takes a gentle share of the relief (and the dusk-to-night dimming),
				// at full brightness on ground facing the sun: lit like that it reads clearly without
				// going dark in the hollows or washing out on the tops
				vec3 relief = clamp(sun / 0.9, 0.45, 1.05);
				vec3 kImg = mix(0.55, 1.0, uDay) * mix(vec3(1.0), relief, 0.4);
				vec3 land = mix(col * sun, img * kImg, uMapMix * have);
				col = mix(land, water * sun, wet);

				// elevation lines: fine every 20 m, stronger every 100 m, drawn like an engraving
				float k = vH / 20.0;
				float line = 1.0 - min(abs(fract(k - 0.5) - 0.5) / max(fwidth(k), 1e-4), 1.0);
				float m = vH / 100.0;
				float major = 1.0 - min(abs(fract(m - 0.5) - 0.5) / max(fwidth(m), 1e-4), 1.0);
				float ink = (line * 0.22 + major * 0.45) * uContours * (1.0 - max(w, sea));
				col = mix(col, vec3(0.30, 0.26, 0.22), ink);

				// a hairline where the land meets the rim
				col *= 1.0 - 0.25 * smoothstep(uR - 12.0, uR, d);
				gl_FragColor = vec4(col, uFade);
			}
		`
	});

	// ---- the rim: a wall of layered earth down to the plinth -----------------------------------
	const SEG = 256;
	const wallPos = new Float32Array((SEG + 1) * 2 * 3);
	const wallNorm = new Float32Array((SEG + 1) * 2 * 3);
	const wallTop = new Float32Array((SEG + 1) * 2);
	const wallAng = new Float32Array((SEG + 1) * 2); // angle around the rim: the strata's waves
	const wallIndex: number[] = [];
	for (let k = 0; k < SEG; k++) {
		const a = k * 2;
		wallIndex.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
	}
	for (let k = 0; k <= SEG; k++) {
		const t = (k / SEG) * Math.PI * 2;
		for (const j of [0, 1]) {
			wallNorm.set([Math.cos(t), 0, -Math.sin(t)], (k * 2 + j) * 3);
			wallAng[k * 2 + j] = t;
		}
	}
	const wall = new BufferGeometry();
	wall.setIndex(wallIndex);
	wall.setAttribute('position', new BufferAttribute(wallPos, 3));
	wall.setAttribute('normal', new BufferAttribute(wallNorm, 3));
	wall.setAttribute('aTop', new BufferAttribute(wallTop, 1));
	wall.setAttribute('aAng', new BufferAttribute(wallAng, 1));

	const wallMat = new ShaderMaterial({
		side: DoubleSide,
		uniforms: { ...lightUniforms() },
		vertexShader: /* glsl */ `
			uniform float uExag;
			attribute float aTop;
			attribute float aAng;
			varying float vDepth;
			varying float vAng;
			varying vec3 vN;
			void main() {
				vDepth = (aTop - position.y) * uExag; // metres below the ground, as seen
				vAng = aAng;
				vN = normal;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			${LIGHT_GLSL}
			varying float vDepth;
			varying float vAng;
			varying vec3 vN;
			void main() {
				// turf, topsoil, then gently wavy bands of clay and stone
				float wave = sin(vAng * 23.0) * 6.0 + sin(vAng * 7.0) * 10.0;
				float z = vDepth + wave;
				vec3 col = vec3(0.55, 0.68, 0.42);
				col = mix(col, vec3(0.55, 0.42, 0.32), smoothstep(6.0, 14.0, vDepth));
				float bands = 0.5 + 0.5 * sin(z * 0.045);
				vec3 clay = mix(vec3(0.78, 0.66, 0.52), vec3(0.70, 0.60, 0.50), bands);
				col = mix(col, clay, smoothstep(40.0, 70.0, vDepth));
				col = mix(col, vec3(0.84, 0.80, 0.74), smoothstep(0.62, 0.7, sin(z * 0.013)) * smoothstep(90.0, 140.0, vDepth));
				gl_FragColor = vec4(lit(col, normalize(vN)), uFade);
			}
		`
	});

	useTask((dt) => {
		const { x, n } = tour.bike;
		if (!(Math.hypot(x - centre.x, n - centre.n) < RECENTRE)) resample(x, n);
		// ease the floor, so the diorama doesn't jump when a re-sample finds lower ground
		globe.base += (globe.baseGoal - globe.base) * Math.min(1, dt * 1.5);

		for (let k = 0; k <= SEG; k++) {
			const t = (k / SEG) * Math.PI * 2;
			const px = x + R * Math.cos(t);
			const pn = n + R * Math.sin(t);
			// a touch above the mesh so no sky shows between land and rim
			const h = gridHeight(px, pn) + 1.5;
			wallPos.set([px, h, -pn, px, globe.base, -pn], k * 6);
			wallTop[k * 2] = wallTop[k * 2 + 1] = h;
		}
		wall.attributes.position.needsUpdate = true;
		wall.attributes.aTop.needsUpdate = true;
		wall.computeBoundingSphere();

		const exag = tour.exaggeration;
		for (const u of [material.uniforms, wallMat.uniforms]) {
			u.uLightDir.value.copy(globe.lightDir);
			u.uLight.value.copy(globe.light);
			u.uStrength.value = globe.lightStrength;
			u.uDay.value = globe.daylight;
			u.uExag.value = exag;
			u.uFade.value = fade?.() ?? 1;
		}
		// see-through only while fading: solid (and drawn with the solid things) the rest of the time
		const f = fade?.() ?? 1;
		material.transparent = wallMat.transparent = f < 0.999;
		const m = material.uniforms;
		m.uBike.value.set(x, -n);
		m.uTime.value += dt;
		m.uWater.value = tour.layers.water ? 1 : 0;
		m.uContours.value = tour.layers.contours ? 1 : 0;
		m.uMapMix.value = imagery.mix;
		m.uPhoto.value = imagery.style === 'satellite' || imagery.style === 'sentinel' ? 1 : 0;
	});

	$effect(() => () => {
		geometry.dispose();
		material.dispose();
		wall.dispose();
		wallMat.dispose();
	});
</script>

<T.Mesh {geometry} {material} frustumCulled={false} />
<T.Mesh geometry={wall} material={wallMat} frustumCulled={false} />
