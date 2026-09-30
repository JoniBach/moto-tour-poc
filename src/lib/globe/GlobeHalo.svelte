<!--
  The globe's surroundings, as the 3D view shows beyond its detail bubble: faint elevation lines,
  roads and the route carrying on past the rim at their real heights, and small dots where the
  places, photos and stories are (just marks: they become the real pins inside the globe),
  fading out into the air around the globe. Only lines: a see-through surface draws its contours and nothing else. Built from the
  day grid around the bike, re-built as it moves on.
  Lives inside the group scaled on Y by the exaggeration (raw metres, day-local).
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, DoubleSide, ShaderMaterial, Vector2 } from 'three';
	import type { Tour } from '$lib/tour.svelte';
	import type { GlobeLine, HaloMark } from './lines';
	import type { GlobeState } from './state';

	let {
		tour,
		globe,
		radius,
		contours,
		route,
		lines,
		shade,
		marks,
		open,
		fogIn = 1.55,
		fogOut = 2.6
	}: {
		tour: Tour;
		globe: GlobeState;
		radius: number;
		contours: boolean;
		route: boolean;
		/** the map's lines (roads, rivers, park edges) to carry on past the rim */
		lines: GlobeLine[];
		/** per-fix sRGB colours for the ridden route (the ride's data), or null for terracotta */
		shade: Float32Array | null;
		/** where the pins are (day-local metres) and their colour: shown beyond the rim as dots */
		marks: HaloMark[];
		/** how far the surroundings have opened out from the rim, 0 to 1, like an aperture (the stage's transitions) */
		open?: () => number;
		/** where the inner fog has cleared, in multiples of the radius (live) */
		fogIn?: number;
		/** where the outer fog has closed in, and how far the surroundings reach (a new value rebuilds) */
		fogOut?: number;
	} = $props();

	// svelte-ignore state_referenced_locally — a new radius remounts this component
	const R = radius;
	// svelte-ignore state_referenced_locally
	const { terrain, track: tr } = tour.data;
	/** where the lines start (just past the plinth) and fade out */
	// from the land's own edge: how far out they're hidden is the inner fog's job (fogIn)
	const INNER = R;
	// svelte-ignore state_referenced_locally — a new reach remounts this component
	const OUTER = R * fogOut;
	// grid cells across: finer cells for a wider reach, within reason
	// svelte-ignore state_referenced_locally
	const N = Math.min(260, Math.round((160 * fogOut) / 2.6));
	const CELL = (OUTER * 2) / N;
	const REBUILD = R * 0.25; // metres the bike moves before the surroundings re-build

	const fade = /* glsl */ `
		uniform vec2 uBike;
		uniform float uInner;
		uniform float uOuter;
		uniform float uClear;
		uniform float uFadeFrom;
		uniform float uBase;
		uniform float uDip;
		uniform float uOpen;
		float haloFade(vec2 xz, float h) {
			float d = distance(xz, uBike);
			if (d < uInner) return 0.0;
			// out from the plinth, then away into the air
			// the inner fog clears by uClear; the outer fog closes in from uFadeFrom to uOuter
			float f = smoothstep(uInner, max(uClear, uInner + 1.0), d) * (1.0 - smoothstep(uFadeFrom, uOuter, d));
			// the aperture: open out from the rim to the full reach, a soft edge on the way
			float edge = mix(uInner, uOuter * 1.08, uOpen);
			f *= 1.0 - smoothstep(edge - (uOuter - uInner) * 0.12, edge, d);
			// ground below the globe's floor would sit in front of the plinth: let it go
			return f * smoothstep(uBase - uDip, uBase, h);
		}
	`;
	const uniforms = () => ({
		uBike: { value: new Vector2() },
		uInner: { value: INNER },
		uOuter: { value: OUTER },
		uClear: { value: R * 1.55 },
		uFadeFrom: { value: OUTER * 0.7 },
		uBase: { value: 0 },
		uDip: { value: R * 0.08 },
		uOpen: { value: 1 }
	});

	// ---- elevation lines: a see-through surface that draws only its contours ------------------
	const S = N + 1;
	const positions = new Float32Array(S * S * 3);
	const index: number[] = [];
	for (let r = 0; r < N; r++)
		for (let c = 0; c < N; c++) {
			const a = r * S + c;
			index.push(a, a + S, a + 1, a + 1, a + S, a + S + 1);
		}
	const surface = new BufferGeometry();
	surface.setIndex(index);
	surface.setAttribute('position', new BufferAttribute(positions, 3));

	const surfaceMat = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		side: DoubleSide,
		uniforms: uniforms(),
		vertexShader: /* glsl */ `
			varying float vH;
			varying vec2 vXZ;
			void main() {
				vH = position.y;
				vXZ = position.xz;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			${fade}
			varying float vH;
			varying vec2 vXZ;
			void main() {
				float f = haloFade(vXZ, vH);
				if (f <= 0.001 || vH <= 0.5) discard; // nothing inside the globe; no lines on the sea
				float k = vH / 20.0;
				float fk = max(fwidth(k), 1e-4);
				float line = 1.0 - min(abs(fract(k - 0.5) - 0.5) / fk, 1.0);
				// where the 20 m lines crowd together on screen (steep ground), keep only the 100 m ones
				line *= 1.0 - smoothstep(0.25, 0.6, fk);
				float m = vH / 100.0;
				float major = 1.0 - min(abs(fract(m - 0.5) - 0.5) / max(fwidth(m), 1e-4), 1.0);
				float a = (line * 0.14 + major * 0.3) * f;
				if (a < 0.01) discard;
				gl_FragColor = vec4(0.36, 0.46, 0.56, a);
			}
		`
	});

	// ---- the route beyond the rim: a thin line at the ground's height ---------------------------
	const routeGeo = new BufferGeometry();
	const routeMat = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		uniforms: { ...uniforms(), uFix: { value: 0 } },
		vertexShader: /* glsl */ `
			attribute float aFix;
			attribute vec3 aCol;
			varying float vFix;
			varying vec3 vCol;
			varying vec2 vXZ;
			varying float vH;
			void main() {
				vFix = aFix;
				vCol = aCol;
				vXZ = position.xz;
				vH = position.y;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			${fade}
			uniform float uFix;
			varying float vFix;
			varying vec3 vCol;
			varying vec2 vXZ;
			varying float vH;
			void main() {
				float f = haloFade(vXZ, vH);
				if (f <= 0.001) discard;
				// ridden: terracotta or the ride's data shading; ahead: slate
				vec3 col = vFix <= uFix ? vCol : vec3(0.36, 0.46, 0.56);
				gl_FragColor = vec4(col, 0.75 * f);
			}
		`
	});
	const breaks = new Set(tr.breaks ?? []);

	// ---- the map's lines beyond the rim: faint, at the ground's height -------------------------
	const lineGeo = new BufferGeometry();
	const lineMat = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		uniforms: { ...uniforms(), uDash: { value: R * 0.03 } },
		vertexShader: /* glsl */ `
			attribute vec4 aLook;
			attribute float aDash;
			attribute float aDist;
			varying vec4 vLook;
			varying float vDashed;
			varying float vDist;
			varying vec2 vXZ;
			varying float vH;
			void main() {
				vLook = aLook;
				vDashed = aDash;
				vDist = aDist;
				vXZ = position.xz;
				vH = position.y;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			${fade}
			uniform float uDash;
			varying vec4 vLook;
			varying float vDashed;
			varying float vDist;
			varying vec2 vXZ;
			varying float vH;
			void main() {
				float f = haloFade(vXZ, vH);
				if (f <= 0.001) discard;
				if (vDashed > 0.5 && fract(vDist / uDash) > 0.55) discard;
				gl_FragColor = vec4(vLook.rgb, vLook.a * f);
			}
		`
	});
	let builtShade: Float32Array | null | undefined;
	let builtLines: GlobeLine[] | undefined;
	let builtMarks: HaloMark[] | undefined;

	// ---- pins beyond the rim: small dots, a constant few pixels across -------------------------
	const markGeo = new BufferGeometry();
	const markMat = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		uniforms: { ...uniforms(), uSize: { value: 7 * Math.min(2, globalThis.devicePixelRatio ?? 1) } },
		vertexShader: /* glsl */ `
			uniform float uSize;
			attribute vec3 aColor;
			varying vec3 vColor;
			varying vec2 vXZ;
			varying float vH;
			void main() {
				vColor = aColor;
				vXZ = position.xz;
				vH = position.y;
				gl_PointSize = uSize;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			${fade}
			varying vec3 vColor;
			varying vec2 vXZ;
			varying float vH;
			void main() {
				float f = haloFade(vXZ, vH);
				if (f <= 0.001) discard;
				// a round dot with a thin white edge, so it reads on the pale background
				float r = length(gl_PointCoord - 0.5) * 2.0;
				if (r > 1.0) discard;
				vec3 col = mix(vColor, vec3(1.0), smoothstep(0.62, 0.78, r));
				gl_FragColor = vec4(col, f * (1.0 - smoothstep(0.85, 1.0, r)) * 0.9);
			}
		`
	});

	let centre = { x: NaN, n: NaN };
	function build(bx: number, bn: number) {
		centre = { x: bx, n: bn };
		// contour surface: the day grid around the bike (coarse is fine for faint lines)
		for (let r = 0; r < S; r++)
			for (let c = 0; c < S; c++) {
				const x = bx - OUTER + c * CELL;
				const n = bn + OUTER - r * CELL;
				positions.set([x, Math.max(0, terrain.heightAt(x, n)), -n], (r * S + c) * 3);
			}
		surface.attributes.position.needsUpdate = true;
		surface.computeBoundingSphere();

		// route: every piece of the day's rides within reach (joined across nothing)
		const reach = OUTER + REBUILD;
		const pos: number[] = [];
		const fix: number[] = [];
		const col: number[] = [];
		const near = (i: number) => Math.hypot(tr.x[i] - bx, tr.n[i] - bn) < reach;
		const colour = (i: number) => (shade ? [shade[i * 3], shade[i * 3 + 1], shade[i * 3 + 2]] : [0.85, 0.36, 0.2]);
		for (let i = 1; i < tr.count; i++) {
			if (breaks.has(i) || !near(i) || !near(i - 1)) continue;
			pos.push(tr.x[i - 1], tr.ground[i - 1] + 3, -tr.n[i - 1], tr.x[i], tr.ground[i] + 3, -tr.n[i]);
			fix.push(i - 1, i);
			col.push(...colour(i - 1), ...colour(i));
		}
		routeGeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
		routeGeo.setAttribute('aFix', new BufferAttribute(new Float32Array(fix), 1));
		routeGeo.setAttribute('aCol', new BufferAttribute(new Float32Array(col), 3));
		routeGeo.computeBoundingSphere();

		// the map's lines: segments with both ends within reach, on the day grid's ground
		const lp: number[] = [];
		const look: number[] = [];
		const dash: number[] = [];
		const dist: number[] = [];
		const ground = (x: number, n: number) => Math.max(0, terrain.heightAt(x, n)) + 2;
		for (const line of lines) {
			const p = line.xy;
			const l = [...line.haloColor, line.haloAlpha];
			const d = line.dash ? 1 : 0;
			let along = 0;
			for (let k = 2; k < p.length; k += 2) {
				const seg = Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]);
				if (Math.hypot(p[k] - bx, p[k + 1] - bn) < reach && Math.hypot(p[k - 2] - bx, p[k - 1] - bn) < reach) {
					lp.push(p[k - 2], ground(p[k - 2], p[k - 1]), -p[k - 1], p[k], ground(p[k], p[k + 1]), -p[k + 1]);
					look.push(...l, ...l);
					dash.push(d, d);
					dist.push(along, along + seg);
				}
				along += seg;
			}
		}
		lineGeo.setAttribute('position', new BufferAttribute(new Float32Array(lp), 3));
		lineGeo.setAttribute('aLook', new BufferAttribute(new Float32Array(look), 4));
		lineGeo.setAttribute('aDash', new BufferAttribute(new Float32Array(dash), 1));
		lineGeo.setAttribute('aDist', new BufferAttribute(new Float32Array(dist), 1));
		lineGeo.computeBoundingSphere();

		// pins: a dot at the ground under each one within reach
		const mp: number[] = [];
		const mc: number[] = [];
		for (const m of marks) {
			if (Math.hypot(m.x - bx, m.n - bn) > reach) continue;
			mp.push(m.x, Math.max(0, terrain.heightAt(m.x, m.n)) + 6, -m.n);
			mc.push(...m.color);
		}
		markGeo.setAttribute('position', new BufferAttribute(new Float32Array(mp), 3));
		markGeo.setAttribute('aColor', new BufferAttribute(new Float32Array(mc), 3));
		markGeo.computeBoundingSphere();
	}

	useTask(() => {
		const b = tour.bike;
		if (!(Math.hypot(b.x - centre.x, b.n - centre.n) < REBUILD) || shade !== builtShade || lines !== builtLines || marks !== builtMarks) {
			builtShade = shade;
			builtLines = lines;
			builtMarks = marks;
			build(b.x, b.n);
		}
		for (const m of [surfaceMat, routeMat, lineMat, markMat]) {
			m.uniforms.uBike.value.set(b.x, -b.n);
			m.uniforms.uBase.value = globe.base;
			m.uniforms.uOpen.value = open?.() ?? 1;
			m.uniforms.uClear.value = R * fogIn;
			m.uniforms.uFadeFrom.value = Math.max(R * fogIn, OUTER * 0.7);
		}
		routeMat.uniforms.uFix.value = b.i + b.f;
	});

	$effect(() => () => {
		surface.dispose();
		surfaceMat.dispose();
		routeGeo.dispose();
		routeMat.dispose();
		lineGeo.dispose();
		markGeo.dispose();
		markMat.dispose();
		lineMat.dispose();
	});
</script>

<!-- drawn before the land's own lines and route (renderOrder 2 and 4), so nothing out here ever
     paints over the ride's route where they meet near the rim -->
{#if contours}<T.Mesh geometry={surface} material={surfaceMat} frustumCulled={false} renderOrder={1} />{/if}
{#if lines.length}<T.LineSegments geometry={lineGeo} material={lineMat} frustumCulled={false} renderOrder={1} />{/if}
{#if marks.length}<T.Points geometry={markGeo} material={markMat} frustumCulled={false} renderOrder={3} />{/if}
{#if route}<T.LineSegments geometry={routeGeo} material={routeMat} frustumCulled={false} renderOrder={2} />{/if}
