<!--
  The day's route on the globe: a flat ribbon laid on the landscape, bold where the bike has been
  and pale ahead. Only the stretch inside the landscape's reach is built, re-draped on the exact
  heights the land is drawn with each time it re-samples; the shader trims it to the circle.
  Lives inside the group scaled on Y by the exaggeration.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, DoubleSide, ShaderMaterial, Vector2 } from 'three';
	import type { Tour } from '$lib/tour.svelte';
	import type { GlobeState } from './state';

	let { tour, globe, radius }: { tour: Tour; globe: GlobeState; radius: number } = $props();

	// svelte-ignore state_referenced_locally — fixed for the component's lifetime
	const tr = tour.data.track;
	// svelte-ignore state_referenced_locally — a new radius remounts this component
	const HALF_WIDTH = radius * 0.005;
	// svelte-ignore state_referenced_locally
	const LIFT = Math.max(2, radius / 900);
	const breaks = new Set(tr.breaks ?? []);

	const geometry = new BufferGeometry();
	let built = -1;

	function build() {
		const { x: cx, n: cn, reach } = globe.patch;
		const inside = (i: number) => Math.hypot(tr.x[i] - cx, tr.n[i] - cn) < reach;
		const pos: number[] = [];
		const fix: number[] = [];
		const idx: number[] = [];
		let run: number[] = [];
		const flush = () => {
			if (run.length > 1) {
				const start = pos.length / 3;
				run.forEach((i, k) => {
					// direction along the route from neighbours; the ribbon runs across it
					const a = run[Math.max(0, k - 1)];
					const b = run[Math.min(run.length - 1, k + 1)];
					let dx = tr.x[b] - tr.x[a];
					let dn = tr.n[b] - tr.n[a];
					const len = Math.hypot(dx, dn) || 1;
					dx /= len;
					dn /= len;
					const h = globe.ground(tr.x[i], tr.n[i]) + LIFT;
					// left and right of the line (east-north frame; scene z is -north)
					pos.push(tr.x[i] - dn * HALF_WIDTH, h, -(tr.n[i] + dx * HALF_WIDTH));
					pos.push(tr.x[i] + dn * HALF_WIDTH, h, -(tr.n[i] - dx * HALF_WIDTH));
					fix.push(i, i);
					if (k > 0) {
						const p = start + (k - 1) * 2;
						idx.push(p, p + 1, p + 2, p + 2, p + 1, p + 3);
					}
				});
			}
			run = [];
		};
		for (let i = 0; i < tr.count; i++) {
			if (breaks.has(i) || !inside(i)) flush();
			if (inside(i)) run.push(i);
		}
		flush();
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
		geometry.setAttribute('aFix', new BufferAttribute(new Float32Array(fix), 1));
		geometry.setIndex(idx);
		geometry.computeBoundingSphere();
	}

	const material = new ShaderMaterial({
		side: DoubleSide, // winding varies with direction of travel
		transparent: true,
		polygonOffset: true,
		polygonOffsetFactor: -2,
		polygonOffsetUnits: -4,
		uniforms: { uBike: { value: new Vector2() }, uR: { value: 0 }, uFix: { value: 0 } },
		vertexShader: /* glsl */ `
			attribute float aFix;
			varying float vFix;
			varying vec2 vXZ;
			void main() {
				vFix = aFix;
				vXZ = position.xz;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			uniform vec2 uBike;
			uniform float uR;
			uniform float uFix;
			varying float vFix;
			varying vec2 vXZ;
			void main() {
				if (distance(vXZ, uBike) > uR - 2.0) discard;
				// ridden: a warm terracotta; ahead: a pale chalk line
				bool done = vFix <= uFix;
				vec3 col = done ? vec3(0.85, 0.36, 0.20) : vec3(0.98, 0.97, 0.94);
				gl_FragColor = vec4(col, done ? 1.0 : 0.85);
			}
		`
	});

	useTask(() => {
		if (globe.version !== built && Number.isFinite(globe.patch.x)) {
			built = globe.version;
			build();
		}
		const b = tour.bike;
		material.uniforms.uBike.value.set(b.x, -b.n);
		material.uniforms.uR.value = radius;
		material.uniforms.uFix.value = b.i + b.f;
	});

	$effect(() => () => {
		geometry.dispose();
		material.dispose();
	});
</script>

<T.Mesh {geometry} {material} frustumCulled={false} renderOrder={2} />
