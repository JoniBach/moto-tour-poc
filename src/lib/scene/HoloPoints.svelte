<!--
  Hologram point cloud. Density is tiered by distance to the route (from corridor.bin):
  every cell near the road, every 2nd cell further out, every 4th cell for the backdrop.
  Points inside the detail bubble fade out so the solid mesh can take over.
  With a map style active, each point takes its colour from the imagery (sampled in the
  vertex shader), so the cloud becomes a satellite / topo point cloud.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, Vector2 } from 'three';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();

	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const { terrain } = tour.data;
	// svelte-ignore state_referenced_locally
	const imagery = tour.imagery;
	const { cols, rows, spacing, x0, n1, maxH } = terrain.meta;

	const TIERS = [
		{ maxCells: 16, step: 1 }, // <= 400 m from route: 25 m
		{ maxCells: 48, step: 2 }, // <= 1.2 km: 50 m
		{ maxCells: 256, step: 4 } // backdrop: 100 m
	];

	function build() {
		const pos: number[] = [];
		const near: number[] = [];
		const wet: number[] = [];
		const uv: number[] = [];
		const steps: number[] = [];
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const i = r * cols + c;
				const d = terrain.corridor[i];
				const lake = (terrain.water?.[i] ?? 0) > 127 ? 1 : 0;
				// lakes get at least 50 m density so they read as a sheet from the overview
				const step = Math.min(TIERS.find((t) => d <= t.maxCells)!.step, lake ? 2 : 4);
				if (r % step || c % step) continue;
				const x = x0 + c * spacing;
				const n = n1 - r * spacing;
				pos.push(x, terrain.heights[i], -n);
				near.push(d * spacing);
				wet.push(lake);
				steps.push(step);
				uv.push(...imagery.farUv(x, n));
			}
		}
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
		g.setAttribute('aRoute', new BufferAttribute(new Float32Array(near), 1));
		g.setAttribute('aLake', new BufferAttribute(new Float32Array(wet), 1));
		g.setAttribute('aUv', new BufferAttribute(new Float32Array(uv), 2));
		g.setAttribute('aStep', new BufferAttribute(new Float32Array(steps), 1));
		return g;
	}

	const geometry = build();
	const material = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending,
		uniforms: {
			uBike: { value: new Vector2() },
			uBubble: { value: 2000 },
			uTime: { value: 0 },
			uMaxH: { value: maxH },
			uWater: { value: 1 },
			uSize: { value: 1.6 },
			uGlow: { value: 1.4 },
			uMap: { value: imagery.far.texture },
			uMapMix: { value: 0 },
			uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
		},
		vertexShader: /* glsl */ `
			uniform vec2 uBike;
			uniform float uBubble;
			uniform float uTime;
			uniform float uMaxH;
			uniform float uPixelRatio;
			uniform float uWater;
			uniform float uSize;
			uniform float uGlow;
			uniform sampler2D uMap;
			uniform float uMapMix;
			attribute float aRoute;
			attribute float aLake;
			attribute vec2 aUv;
			attribute float aStep; // sampling step: 1 = densest (next to the route) … 4 = backdrop
			varying vec3 vColor;
			varying float vAlpha;

			void main() {
				vec3 p = position;
				float sea = step(p.y, 0.5);
				float lake = aLake * uWater;
				float wet = max(sea, lake);
				p.y = max(p.y, 0.0);
				vec4 mv = modelViewMatrix * vec4(p, 1.0);
				gl_Position = projectionMatrix * mv;

				float h = clamp(p.y / uMaxH, 0.0, 1.0);
				vec3 land = mix(vec3(0.0, 0.62, 0.85), vec3(0.8, 1.0, 1.0), pow(h, 0.7));
				// water: deep blue with a slow travelling shimmer
				float shimmer = 0.55 + 0.45 * sin(uTime * 1.3 + p.x * 0.011 + p.z * 0.017) * sin(uTime * 0.7 - p.x * 0.007 + p.z * 0.005);
				vec3 water = mix(vec3(0.06, 0.2, 0.6), vec3(0.3, 0.6, 1.0), shimmer * uWater);
				float nearRoute = 1.0 - smoothstep(0.0, 1500.0, aRoute);
				vec3 holo = mix(land * (0.7 + 0.3 * nearRoute), water, wet);

				// imagery colour, lifted so dark satellite greens still read on black
				vec3 img = texture2D(uMap, aUv).rgb;
				img = pow(img, vec3(0.75)) * 1.35;
				vColor = mix(holo, mix(img, water, lake * 0.5), uMapMix) * uGlow;

				// slow diagonal scan sweep
				float sweep = fract((p.x + p.z) / 12000.0 - uTime * 0.04);
				vColor += vec3(0.2, 0.6, 0.7) * smoothstep(0.985, 1.0, sweep) * (1.0 - wet) * (1.0 - 0.6 * uMapMix);

				float dBike = distance(p.xz, uBike);
				float inBubble = smoothstep(uBubble * 0.55, uBubble * 0.95, dBike);
				// additive blending piles up where points are dense: scale alpha by sampling density
				// (1/16 the area per point at step 1) so the corridor glows without blowing out
				float density = aStep == 1.0 ? 0.3 : aStep == 2.0 ? 0.6 : 1.0;
				// from far out (overview) points overlap on screen and additive blending saturates,
				// so fade them with distance; mid-range (follow view's far field) stays at full strength
				float range = mix(1.0, 0.45, smoothstep(12000.0, 45000.0, -mv.z));
				vAlpha = mix(0.6 + 0.3 * nearRoute, 0.3 + 0.35 * shimmer * uWater, wet) * inBubble * density * range;

				gl_PointSize = clamp(6500.0 / -mv.z, 1.4, 4.5) * uSize * uPixelRatio * (1.0 + nearRoute * 0.3);
			}
		`,
		fragmentShader: /* glsl */ `
			varying vec3 vColor;
			varying float vAlpha;
			void main() {
				vec2 c = gl_PointCoord - 0.5;
				float d = dot(c, c);
				if (d > 0.25) discard;
				// bright core with a soft halo
				float a = mix(1.0, 0.35, smoothstep(0.02, 0.25, d));
				gl_FragColor = vec4(vColor, vAlpha * a);
			}
		`
	});

	useTask((dt) => {
		const u = material.uniforms;
		u.uTime.value += dt;
		u.uBike.value.set(tour.bike.x, -tour.bike.n);
		u.uBubble.value = tour.layers.detail ? tour.bubble : 0;
		u.uWater.value = tour.layers.water ? 1 : 0;
		u.uSize.value = tour.pointSize;
		u.uGlow.value = tour.pointGlow;
		u.uMapMix.value = imagery.mix;
	});

	$effect(() => () => {
		geometry.dispose();
		material.dispose();
	});
</script>

<T.Points {geometry} {material} frustumCulled={false} />
