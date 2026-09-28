<!--
  Rain streaks around the bike, driven by the historical weather at the current moment:
  density from precipitation (drizzle codes get a light floor), slant from the recorded wind.
  Streaks live in a soft-edged bubble centred on the bike, sized to the camera distance;
  all motion happens in the vertex shader.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, ShaderMaterial, Vector3 } from 'three';
	import { weatherAt } from '$lib/data';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();
	const { camera } = useThrelte();

	const COUNT = 6000;
	const seeds = new Float32Array(COUNT * 2 * 3);
	const ends = new Float32Array(COUNT * 2);
	for (let i = 0; i < COUNT; i++) {
		const s = [Math.random(), Math.random(), Math.random()];
		seeds.set(s, i * 6);
		seeds.set(s, i * 6 + 3);
		ends[i * 2 + 1] = 1;
	}
	const geometry = new BufferGeometry();
	// position is unused by the shader but three needs it for the draw range
	geometry.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 2 * 3), 3));
	geometry.setAttribute('aSeed', new BufferAttribute(seeds, 3));
	geometry.setAttribute('aEnd', new BufferAttribute(ends, 1));

	const material = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		uniforms: {
			uCentre: { value: new Vector3() },
			uBox: { value: 400 },
			uTime: { value: 0 },
			uWind: { value: new Vector3() },
			uIntensity: { value: 0 }
		},
		vertexShader: /* glsl */ `
			uniform vec3 uCentre;
			uniform float uBox; // bubble radius, metres
			uniform float uTime;
			uniform vec3 uWind; // metres/second, world space
			uniform float uIntensity;
			attribute vec3 aSeed;
			attribute float aEnd;
			varying float vAlpha;
			void main() {
				float r = uBox;
				// visual fall speed scales with the bubble so rain reads as falling at any zoom
				float fall = max(9.0, r * 0.5);
				vec3 vel = vec3(uWind.x * fall / 9.0, -fall, uWind.z * fall / 9.0);
				// uniform over a disc around the bike (sqrt keeps density even towards the rim)
				float ang = aSeed.x * 6.2831853;
				vec2 disc = vec2(cos(ang), sin(ang)) * sqrt(aSeed.z) * r;
				// cycle through a band from 0.4r below to 0.8r above the bike
				float h = 1.2 * r;
				float y = mod(aSeed.y * h - uTime * fall * (0.8 + 0.4 * fract(aSeed.x * 7.13)), h) - 0.4 * r;
				vec3 off = vec3(disc.x, y, disc.y);
				// wind slant, centred on the bubble's mid-height so it never drifts off the rider
				off.xz += vel.xz / fall * (0.2 * r - y) * 0.5;
				vec3 p = uCentre + off + normalize(vel) * aEnd * r * 0.05;
				// soft spherical edge: a bubble of rain around the rider, not a box
				float d = length(vec3(off.x, (off.y - 0.2 * r) * 1.3, off.z)) / r;
				float edge = 1.0 - smoothstep(0.5, 1.0, d);
				// only a fraction of drops are live, so density follows intensity
				float live = step(fract(aSeed.x * 3.7 + aSeed.y * 1.3), uIntensity);
				vAlpha = live * edge * 0.6 * (1.0 - aEnd * 0.8);
				gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			varying float vAlpha;
			void main() {
				if (vAlpha <= 0.0) discard;
				gl_FragColor = vec4(0.75, 0.88, 1.0, vAlpha);
			}
		`
	});

	const cam = new Vector3();
	useTask((dt) => {
		const u = material.uniforms;
		u.uTime.value += dt;
		const w = weatherAt(tour.data.weather, tour.rt);
		// drizzle codes (51-57) get a visible floor even when the hourly total rounds to ~0
		const drizzle = w && w.code >= 51 && w.code <= 57 ? 0.25 : 0;
		u.uIntensity.value = tour.layers.weather && w ? Math.min(1, Math.max(drizzle, (w.precip ?? 0) / 1.5)) : 0;
		const b = tour.bike;
		u.uCentre.value.set(b.x, b.h * tour.exaggeration, -b.n);
		const dist = camera.current.getWorldPosition(cam).distanceTo(u.uCentre.value);
		u.uBox.value = Math.min(700, Math.max(25, dist * 0.3));
		if (w?.wind != null) {
			// windDir is where it blows FROM (clockwise from north); world north is -z
			const to = ((w.windDir + 180) * Math.PI) / 180;
			const ms = w.wind * 0.447;
			u.uWind.value.set(Math.sin(to) * ms, 0, -Math.cos(to) * ms);
		}
	});

	$effect(() => () => {
		geometry.dispose();
		material.dispose();
	});
</script>

<T.LineSegments {geometry} {material} frustumCulled={false} renderOrder={20} />
