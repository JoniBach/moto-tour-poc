<!--
  L0: Great Britain at 1 km as a hologram point cloud (land only) with a glowing coastline.
  Positions are absolute BNG metres; the parent group applies the world origin offset.
  Points fade out inside the active day's grid so they don't double up with its own terrain.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { contours } from 'd3';
	import {
		AdditiveBlending,
		BufferAttribute,
		BufferGeometry,
		LineBasicMaterial,
		ShaderMaterial,
		Vector4
	} from 'three';
	import type { DaySummary, Terrain } from '$lib/data';
	import type { Settings } from '$lib/settings.svelte';

	let { uk, active, settings }: { uk: Terrain; active: DaySummary | undefined; settings: Settings } = $props();

	// svelte-ignore state_referenced_locally — the UK grid never changes
	const { cols, rows, spacing, x0, n1, maxH } = uk.meta;

	// deterministic per-cell jitter in [-0.5, 0.5): breaks up the moiré a perfectly regular grid
	// of small points makes when seen from far away
	const jitter = (i: number, salt: number) => {
		const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
		return s - Math.floor(s) - 0.5;
	};

	function buildPoints() {
		const pos: number[] = [];
		for (let r = 0; r < rows; r++)
			for (let c = 0; c < cols; c++) {
				const i = r * cols + c;
				const h = uk.heights[i];
				if (h <= 0.5) continue; // sea: the coastline carries it
				pos.push(x0 + (c + jitter(i, 1) * 0.8) * spacing, h, -(n1 - (r + jitter(i, 2) * 0.8) * spacing));
			}
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
		return g;
	}

	function buildCoast() {
		const [coast] = contours()
			.size([cols, rows])
			.thresholds([0.5])(Array.from(uk.heights));
		const pos: number[] = [];
		// d3 grid coords (cell centres at +0.5) -> BNG metres
		const gx = (c: number) => x0 + (c - 0.5) * spacing;
		const gz = (r: number) => -(n1 - (r - 0.5) * spacing);
		for (const poly of coast.coordinates)
			for (const ring of poly)
				for (let i = 1; i < ring.length; i++)
					pos.push(gx(ring[i - 1][0]), 1, gz(ring[i - 1][1]), gx(ring[i][0]), 1, gz(ring[i][1]));
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
		return g;
	}

	const points = buildPoints();
	const coast = buildCoast();

	const material = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending,
		uniforms: {
			uMaxH: { value: maxH },
			uSize: { value: 2 },
			uGlow: { value: 1.6 },
			uDay: { value: new Vector4(1, -1, 1, -1) }, // minX, maxX, minZ, maxZ (empty when no day)
			uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
		},
		vertexShader: /* glsl */ `
			uniform float uMaxH;
			uniform float uSize;
			uniform float uGlow;
			uniform vec4 uDay;
			uniform float uPixelRatio;
			varying vec3 vColor;
			varying float vAlpha;
			void main() {
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				gl_Position = projectionMatrix * mv;
				float h = clamp(position.y / uMaxH, 0.0, 1.0);
				vColor = mix(vec3(0.0, 0.5, 0.75), vec3(0.75, 1.0, 1.0), pow(h, 0.6)) * uGlow;
				// fade inside the active day's grid (3 km soft edge)
				float inX = smoothstep(uDay.x, uDay.x + 3000.0, position.x) * (1.0 - smoothstep(uDay.y - 3000.0, uDay.y, position.x));
				float inZ = smoothstep(uDay.z, uDay.z + 3000.0, position.z) * (1.0 - smoothstep(uDay.w - 3000.0, uDay.w, position.z));
				// from very far out every point overlaps, so dim them there too
				float range = mix(1.0, 0.35, smoothstep(200000.0, 900000.0, -mv.z));
				vAlpha = 0.55 * (1.0 - inX * inZ) * range;
				gl_PointSize = clamp(260000.0 / -mv.z, 1.2, 5.0) * uSize * 0.8 * uPixelRatio;
			}
		`,
		fragmentShader: /* glsl */ `
			varying vec3 vColor;
			varying float vAlpha;
			void main() {
				vec2 c = gl_PointCoord - 0.5;
				float d = dot(c, c);
				if (d > 0.25 || vAlpha <= 0.0) discard;
				gl_FragColor = vec4(vColor, vAlpha * mix(1.0, 0.35, smoothstep(0.02, 0.25, d)));
			}
		`
	});
	const coastMat = new LineBasicMaterial({
		color: '#5fd4ff',
		transparent: true,
		opacity: 0.7,
		blending: AdditiveBlending,
		depthWrite: false
	});

	useTask(() => {
		const u = material.uniforms;
		u.uSize.value = settings.pointSize;
		u.uGlow.value = settings.pointGlow;
		if (active) {
			const { minE, maxE, minN, maxN } = active.extent;
			u.uDay.value.set(minE, maxE, -maxN, -minN);
		} else u.uDay.value.set(1, -1, 1, -1);
	});

	$effect(() => () => {
		points.dispose();
		coast.dispose();
		material.dispose();
		coastMat.dispose();
	});
</script>

<T.Points geometry={points} {material} frustumCulled={false} />
<T.LineSegments geometry={coast} material={coastMat} frustumCulled={false} />
