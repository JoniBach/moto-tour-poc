<!--
  L0: the region's glowing coastline, plus (optional, "Backdrop points" layer) a
  hologram point cloud of the land.
  Positions are absolute projected metres; the parent group applies the world origin offset.
  Points fade out inside the active day's grid so they don't double up with its own terrain,
  and screen density is capped by level of detail (pointLod.ts) so zooming out never white-outs.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { PerspectiveCamera } from 'three';
	import { gridLevel, hash01, LOD_GLSL } from './pointLod';
	import { pointScale } from './pointScale';
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

	let {
		region,
		active,
		settings,
		parkMask
	}: { region: Terrain; active: DaySummary | undefined; settings: Settings; parkMask: Uint8Array | null } = $props();

	// svelte-ignore state_referenced_locally — the backdrop grid never changes
	const { cols, rows, spacing, x0, n1, maxH } = region.meta;

	// deterministic per-cell jitter in [-0.5, 0.5): breaks up the moiré a perfectly regular grid
	// of small points makes when seen from far away
	const jitter = (i: number, salt: number) => {
		const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
		return s - Math.floor(s) - 0.5;
	};

	function buildPoints() {
		const pos: number[] = [];
		const levels: number[] = [];
		const hashes: number[] = [];
		const inPark: number[] = [];
		for (let r = 0; r < rows; r++)
			for (let c = 0; c < cols; c++) {
				const i = r * cols + c;
				const h = region.heights[i];
				if (h <= 0.5) continue; // sea: the coastline carries it
				pos.push(x0 + (c + jitter(i, 1) * 0.8) * spacing, h, -(n1 - (r + jitter(i, 2) * 0.8) * spacing));
				levels.push(gridLevel(c, r));
				hashes.push(hash01(i));
				inPark.push(parkMask?.[i] ? 1 : 0);
			}
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
		g.setAttribute('aLevel', new BufferAttribute(new Float32Array(levels), 1));
		g.setAttribute('aHash', new BufferAttribute(new Float32Array(hashes), 1));
		g.setAttribute('aPark', new BufferAttribute(new Float32Array(inPark), 1));
		return g;
	}

	function buildCoast() {
		const pos: number[] = [];
		// d3 grid coords (cell centres at +0.5) -> projected metres
		const gx = (c: number) => x0 + (c - 0.5) * spacing;
		const gz = (r: number) => -(n1 - (r - 0.5) * spacing);
		const trace = (level: number, y: number) => {
			const [line] = contours().size([cols, rows]).thresholds([level])(Array.from(region.heights));
			for (const poly of line.coordinates)
				for (const ring of poly)
					for (let i = 1; i < ring.length; i++) {
						// where land runs off the grid the contour closes along the edge: that's no line on
						// the ground, so leave it out
						const [a, b] = [ring[i - 1], ring[i]];
						if ((a[0] === b[0] && (a[0] <= 0 || a[0] >= cols)) || (a[1] === b[1] && (a[1] <= 0 || a[1] >= rows))) continue;
						pos.push(gx(a[0]), y, gz(a[1]), gx(b[0]), y, gz(b[1]));
					}
		};
		// an inland region has no coast to outline: draw its shape with a line every 1,000 m instead
		if (region.heights.some((h) => h <= 0.5)) trace(0.5, 1);
		else for (let level = 1000; level < maxH; level += 1000) trace(level, level);
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
			uPixelRatio: { value: 1 },
			uProj: { value: 1000 },
			uSpacing: { value: spacing },
			uDensity: { value: 1 },
			uParks: { value: 1 }
		},
		vertexShader: /* glsl */ `
			uniform float uMaxH;
			uniform float uSize;
			uniform float uGlow;
			uniform vec4 uDay;
			uniform float uPixelRatio;
			uniform float uProj; // device pixels per metre at 1 m from the camera
			uniform float uSpacing;
			uniform float uDensity;
			attribute float aLevel;
			attribute float aPark;
			uniform float uParks;
			attribute float aHash;
			${LOD_GLSL}
			varying vec3 vColor;
			varying float vAlpha;
			void main() {
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				gl_Position = projectionMatrix * mv;
				float h = clamp(position.y / uMaxH, 0.0, 1.0);
				vec3 base = mix(vec3(0.0, 0.5, 0.75), vec3(0.75, 1.0, 1.0), pow(h, 0.6));
				// national parks read as green islands in the teal hologram
				vec3 park = mix(vec3(0.15, 0.6, 0.3), vec3(0.75, 1.0, 0.7), pow(h, 0.6));
				vColor = mix(base, park, aPark * uParks) * uGlow;
				// fade inside the active day's grid (3 km soft edge)
				float inX = smoothstep(uDay.x, uDay.x + 3000.0, position.x) * (1.0 - smoothstep(uDay.y - 3000.0, uDay.y, position.x));
				float inZ = smoothstep(uDay.z, uDay.z + 3000.0, position.z) * (1.0 - smoothstep(uDay.w - 3000.0, uDay.w, position.z));
				// constant-size dots; how many are shown is controlled by screen density (LOD)
				float dotPx = uSize * uPixelRatio * 0.9;
				float keep = lodKeep(uSpacing, -mv.z, aLevel, aHash, dotPx * 1.8 / uDensity, uProj);
				vAlpha = 0.6 * (1.0 - inX * inZ) * keep;
				gl_PointSize = keep > 0.01 ? dotPx : 0.0;
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

	const { camera, size, renderer } = useThrelte();
	useTask(() => {
		pointScale(material, camera.current as PerspectiveCamera, size.current.height, renderer.getPixelRatio());
		const u = material.uniforms;
		u.uSize.value = settings.pointSize;
		u.uGlow.value = settings.pointGlow;
		u.uDensity.value = settings.pointDensity;
		u.uParks.value = settings.layers.parks ? 1 : 0;
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

<!-- backdrop points are optional (off by default): the tour overview reads as coastline, parks and routes -->
{#if settings.layers.backdropPoints}
	<T.Points geometry={points} {material} frustumCulled={false} />
{/if}
<T.LineSegments geometry={coast} material={coastMat} frustumCulled={false} />
