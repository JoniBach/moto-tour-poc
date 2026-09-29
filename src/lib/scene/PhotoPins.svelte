<!--
  Photo pins, clustered on screen. A few times a second every photo is projected to the screen
  and photos within ~120 px of a group's centre merge into one pin (thumbnail + count), so pins
  group into places as you zoom out and split into single photos as you zoom in. Clicking a pin
  opens its photos in the gallery. Under the pins, every photo also keeps a small fixed-size dot
  at exactly where it was taken, so the grouping never hides the real spots.
  Positions are absolute BNG metres; the parent group applies the world origin.
-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { BufferAttribute, BufferGeometry, ShaderMaterial, Vector3 } from 'three';
	import { photoUrl, type Photo, type Terrain } from '$lib/data';
	import { clickThroughControls } from './controls';

	let {
		photos,
		uk,
		dayTerrain,
		origin,
		exaggeration,
		onopen
	}: {
		photos: Photo[];
		uk: Terrain;
		dayTerrain: Terrain | null;
		origin: { e: number; n: number };
		exaggeration: number;
		onopen: (photos: Photo[]) => void;
	} = $props();

	const CELL = 120; // CSS px: photos closer than this on screen share a pin
	const MAX_PINS = 120;
	const { camera, size } = useThrelte();

	// ground height under each photo: the active day's terrain where it has it, else the UK grid
	const heights = $derived.by(() => {
		const out = new Float32Array(photos.length);
		photos.forEach((p, k) => {
			let h = uk.heightAt(p.e, p.n);
			if (dayTerrain) {
				const { originE, originN, x0, n1, cols, rows, spacing } = dayTerrain.meta;
				const x = p.e - originE;
				const y = p.n - originN;
				if (x >= x0 && x <= x0 + (cols - 1) * spacing && y <= n1 && y >= n1 - (rows - 1) * spacing)
					h = dayTerrain.heightAt(x, y);
			}
			out[k] = Math.max(0, h);
		});
		return out;
	});

	interface Pin {
		key: string; // the cover photo's id: keeps the DOM node stable between re-clusters
		cover: Photo;
		members: Photo[];
		pos: [number, number, number]; // local (absolute BNG) position of the cover photo
	}
	let pins = $state.raw<Pin[]>([]);

	const v = new Vector3();
	let since = 1;
	useTask((dt) => {
		since += dt;
		if (since < 0.2) return;
		since = 0;
		const cam = camera.current;
		cam.updateMatrixWorld();
		const { width, height } = size.current;
		// distance-based: a photo joins the nearest group whose centre is within CELL px, else
		// starts its own (fixed grid cells would split neighbours that straddle a cell edge)
		const groups: { members: Photo[]; ks: number[]; sx: number; sy: number }[] = [];
		photos.forEach((p, k) => {
			v.set(p.e - origin.e, heights[k] * exaggeration, -(p.n - origin.n)).project(cam);
			if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return; // behind or off screen
			const sx = ((v.x + 1) / 2) * width;
			const sy = ((1 - v.y) / 2) * height;
			let best = null;
			let bestD = CELL;
			for (const g of groups) {
				const d = Math.hypot(g.sx - sx, g.sy - sy);
				if (d < bestD) [best, bestD] = [g, d];
			}
			if (best) {
				best.members.push(p);
				best.ks.push(k);
				// running centre so the group follows its photos
				best.sx += (sx - best.sx) / best.members.length;
				best.sy += (sy - best.sy) / best.members.length;
			} else groups.push({ members: [p], ks: [k], sx, sy });
		});
		const next: Pin[] = [];
		for (const c of groups) {
			// cover = the middle photo in time: a fair pick for a place
			const m = Math.floor(c.members.length / 2);
			const cover = c.members[m];
			const k = c.ks[m];
			next.push({ key: cover.id, cover, members: c.members, pos: [cover.e, heights[k] * exaggeration, -cover.n] });
		}
		next.sort((a, b) => b.members.length - a.members.length);
		pins = next.slice(0, MAX_PINS);
	});
	// ---- exact spots: one dot per photo, constant size on screen, never merged ----
	const DOT_LIFT = 4; // metres above the ground (before exaggeration)
	const dotGeo = new BufferGeometry();
	const dotMat = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		depthTest: false, // a photo spot behind a hill should still show where it is
		uniforms: { uPx: { value: 9 * Math.min(window.devicePixelRatio, 2) } },
		vertexShader: /* glsl */ `
			uniform float uPx;
			void main() {
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				gl_PointSize = uPx;
			}
		`,
		fragmentShader: /* glsl */ `
			void main() {
				float d = length(gl_PointCoord - 0.5) * 2.0;
				if (d > 1.0) discard;
				// warm amber dot with a dark outline: distinct from the cyan hologram
				float aa = fwidth(d);
				float dot = 1.0 - smoothstep(0.62 - aa, 0.62 + aa, d);
				float edge = 1.0 - smoothstep(0.95 - aa, 0.95 + aa, d);
				vec3 col = mix(vec3(0.02, 0.05, 0.08), vec3(1.0, 0.82, 0.4), dot);
				gl_FragColor = vec4(col, edge * 0.95);
			}
		`
	});
	$effect(() => {
		const pos = new Float32Array(photos.length * 3);
		photos.forEach((p, k) => pos.set([p.e, (heights[k] + DOT_LIFT) * exaggeration, -p.n], k * 3));
		dotGeo.setAttribute('position', new BufferAttribute(pos, 3));
		dotGeo.computeBoundingSphere();
	});
	$effect(() => () => {
		dotGeo.dispose();
		dotMat.dispose();
	});
</script>

<T.Points geometry={dotGeo} material={dotMat} frustumCulled={false} renderOrder={12} />

{#each pins as pin (pin.key)}
	<T.Group position={pin.pos}>
		<HTML center zIndexRange={[48, 46]}>
			<button
				class="photo-pin"
				class:many={pin.members.length > 1}
				{@attach clickThroughControls}
				onclick={() => onopen(pin.members)}
				title={pin.members.length > 1 ? `${pin.members.length} photos` : 'Photo'}
			>
				<img src={photoUrl(pin.cover, 'thumb')} alt="" loading="lazy" draggable="false" />
				{#if pin.members.length > 1}<span class="count">{pin.members.length}</span>{/if}
			</button>
		</HTML>
	</T.Group>
{/each}

<style>
	.photo-pin {
		all: unset;
		cursor: pointer;
		position: relative;
		display: block;
		width: 38px;
		height: 38px;
		/* float above the spot so the exact-location dot below stays visible */
		transform: translateY(-46px);
		transition: transform 0.15s;
	}
	.photo-pin::after {
		/* a little stalk down to the spot on the ground */
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		width: 2px;
		height: 22px;
		transform: translateX(-50%);
		background: linear-gradient(#7cf7ff, transparent);
	}
	.photo-pin img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
		border: 2px solid #7cf7ff;
		box-shadow: 0 0 10px rgba(124, 247, 255, 0.6);
		background: #0b1620;
	}
	.photo-pin:hover {
		transform: translateY(-46px) scale(1.25);
		z-index: 1;
	}
	.count {
		position: absolute;
		top: -6px;
		right: -8px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		box-sizing: border-box;
		border-radius: 9px;
		background: #7cf7ff;
		color: #03070c;
		font-size: 10px;
		font-weight: 700;
		line-height: 18px;
		text-align: center;
	}
</style>
