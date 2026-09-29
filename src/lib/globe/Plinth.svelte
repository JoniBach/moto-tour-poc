<!--
  The globe's base. A pale block whose top is the landscape's floor (scene y = 0), with an
  engraved compass ring around the land (north is -z, the far side as the globe first appears)
  and the day's name and date lettered around its side; below it a wider ledge whose top carries
  the controls (GlobeControls), their labels engraved here; and a soft shadow underneath.
-->
<script lang="ts">
	import { T } from '@threlte/core';
	import { CanvasTexture, CylinderGeometry, RingGeometry, SRGBColorSpace } from 'three';
	import { GROUPS, STEPPERS, SURFACE_KEYS, SWITCHES, type Layout } from './layout';

	let {
		R,
		L,
		title,
		date,
		shadow,
		size,
		relief
	}: {
		/** the globe's radius on screen */
		R: number;
		L: Layout;
		title: string;
		date: string;
		shadow: number;
		/** current values, engraved beside their buttons */
		size: string;
		relief: string;
	} = $props();

	// svelte-ignore state_referenced_locally — the size is fixed for the component's lifetime
	const { OUT, band: B, ledge } = L;
	const BAND_H = B.top - B.bottom;
	const LEDGE_H = ledge.top - ledge.bottom;
	const CREAM = '#f1ebe0';
	const INK = 'rgba(92, 76, 60, 0.85)';
	const LIGHT = 'rgba(255, 255, 255, 0.7)';
	const FONT = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';

	/** Text cut into the surface: a dark stroke with a light edge below it. */
	function engrave(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
		ctx.fillStyle = LIGHT;
		ctx.fillText(text, x, y + 2);
		ctx.fillStyle = INK;
		ctx.fillText(text, x, y);
	}

	function texture(c: HTMLCanvasElement) {
		const t = new CanvasTexture(c);
		t.colorSpace = SRGBColorSpace;
		t.anisotropy = 8;
		return t;
	}

	function compass() {
		const S = 2048;
		const c = document.createElement('canvas');
		c.width = c.height = S;
		const ctx = c.getContext('2d')!;
		const mid = S / 2;
		const inner = (R / OUT) * mid;
		ctx.fillStyle = CREAM;
		ctx.beginPath();
		ctx.arc(mid, mid, mid, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = INK;
		ctx.lineCap = 'round';
		// ticks: every 5°, longer every 15°, longest at the eight points
		for (let deg = 0; deg < 360; deg += 5) {
			const a = (deg * Math.PI) / 180;
			const len = deg % 45 === 0 ? 34 : deg % 15 === 0 ? 20 : 11;
			ctx.lineWidth = deg % 45 === 0 ? 4 : 2;
			const r1 = mid - 8;
			const [sx, sy] = [Math.sin(a), -Math.cos(a)]; // clockwise from north (canvas up)
			ctx.beginPath();
			ctx.moveTo(mid + sx * r1, mid + sy * r1);
			ctx.lineTo(mid + sx * (r1 - len), mid + sy * (r1 - len));
			ctx.stroke();
		}
		ctx.lineWidth = 2;
		for (const r of [inner + 6, inner + 12]) {
			ctx.beginPath();
			ctx.arc(mid, mid, r, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const rText = (inner + mid - 40) / 2 + 6;
		const points: [string, number, number][] = [
			['N', 0, 64],
			['NE', 45, 34],
			['E', 90, 56],
			['SE', 135, 34],
			['S', 180, 56],
			['SW', 225, 34],
			['W', 270, 56],
			['NW', 315, 34]
		];
		for (const [label, deg, size] of points) {
			const a = (deg * Math.PI) / 180;
			ctx.save();
			ctx.translate(mid + Math.sin(a) * rText, mid - Math.cos(a) * rText);
			ctx.rotate(a); // letters stand with their tops to the rim
			ctx.font = `${deg % 90 === 0 ? 700 : 500} ${size}px ${FONT}`;
			engrave(ctx, label, 0, 0);
			ctx.restore();
		}
		return texture(c);
	}

	function band(label: string) {
		const W = 4096;
		const Hpx = 256;
		const c = document.createElement('canvas');
		c.width = W;
		c.height = Hpx;
		const ctx = c.getContext('2d')!;
		ctx.fillStyle = CREAM;
		ctx.fillRect(0, 0, W, Hpx);
		ctx.fillStyle = 'rgba(92, 76, 60, 0.25)';
		ctx.fillRect(0, 14, W, 3);
		ctx.fillRect(0, Hpx - 17, W, 3);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `600 64px ${FONT}`;
		// centred on the front (u = 0.5 faces the viewer)
		engrave(ctx, label, W / 2, Hpx / 2);
		return texture(c);
	}

	/**
	 * The ledge's top: a plate under each control and its label, engraved. Seen from outside, so
	 * each label is turned to stand upright for someone looking in from that side.
	 */
	function ledgeTop(sizeText: string, reliefText: string) {
		const S = 2048;
		const c = document.createElement('canvas');
		c.width = c.height = S;
		const ctx = c.getContext('2d')!;
		const mid = S / 2;
		const k = mid / ledge.outer; // px per scene unit
		ctx.fillStyle = CREAM;
		ctx.beginPath();
		ctx.arc(mid, mid, mid, 0, Math.PI * 2);
		ctx.fill();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		// front is canvas-down (+z), the viewer's right is canvas-right (+x)
		const at = (deg: number, r: number, draw: () => void) => {
			const a = (deg * Math.PI) / 180;
			ctx.save();
			ctx.translate(mid + Math.sin(a) * r * k, mid + Math.cos(a) * r * k);
			ctx.rotate(-a);
			draw();
			ctx.restore();
		};
		const plate = (w: number) => () => {
			ctx.fillStyle = 'rgba(92, 76, 60, 0.12)';
			ctx.beginPath();
			ctx.roundRect(-w / 2, -26, w, 52, 12);
			ctx.fill();
		};
		// a fine line along the outer edge
		ctx.strokeStyle = INK;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(mid, mid, mid - 14, 0, Math.PI * 2);
		ctx.stroke();
		for (const s of [...SURFACE_KEYS, ...SWITCHES]) at(s.at, L.switchR, plate(54));
		for (const s of STEPPERS) for (const d of [s.minus, s.plus]) at(d, L.switchR, plate(48));
		ctx.font = `600 22px ${FONT}`;
		for (const s of [...SURFACE_KEYS, ...SWITCHES]) at(s.at, L.labelR, () => engrave(ctx, s.label, 0, 0));
		ctx.font = `700 34px ${FONT}`;
		for (const s of STEPPERS) {
			at(s.minus, L.labelR, () => engrave(ctx, '−', 0, 0));
			at(s.plus, L.labelR, () => engrave(ctx, '+', 0, 0));
		}
		ctx.font = `700 24px ${FONT}`;
		for (const g of GROUPS) at(g.at, L.groupR, () => engrave(ctx, g.label, 0, 0));
		at(STEPPERS[0].at, L.groupR, () => engrave(ctx, `SIZE  ${sizeText.toUpperCase()}`, 0, 0));
		at(STEPPERS[1].at, L.groupR, () => engrave(ctx, `RELIEF  ${reliefText}`, 0, 0));
		return texture(c);
	}

	function shadowTex() {
		const c = document.createElement('canvas');
		c.width = c.height = 256;
		const ctx = c.getContext('2d')!;
		const g = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
		g.addColorStop(0, 'rgba(40, 45, 60, 0.55)');
		g.addColorStop(1, 'rgba(40, 45, 60, 0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 256, 256);
		return new CanvasTexture(c);
	}

	const ringTex = compass();
	const shadeTex = shadowTex();
	const bandTex = $derived(band(`${title.toUpperCase()}   ·   ${date.toUpperCase()}`));
	const ledgeTex = $derived(ledgeTop(size, relief));
	$effect(() => {
		const t = bandTex;
		return () => t.dispose();
	});
	$effect(() => {
		const t = ledgeTex;
		return () => t.dispose();
	});

	// u = 0.5 at the front: start the side's texture seam at the back
	const bandGeo = new CylinderGeometry(OUT, OUT, BAND_H, 160, 1, true, Math.PI);
	// svelte-ignore state_referenced_locally
	const cap = new RingGeometry(R * 0.98, OUT, 160);
	const ledgeSide = new CylinderGeometry(ledge.outer, ledge.outer * 1.01, LEDGE_H, 160, 1, true);
	const ledgeCap = new RingGeometry(OUT * 0.99, ledge.outer, 200);

	$effect(() => () => {
		ringTex.dispose();
		shadeTex.dispose();
		bandGeo.dispose();
		cap.dispose();
		ledgeSide.dispose();
		ledgeCap.dispose();
	});
	const lit = { emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.85 };
</script>

<!-- the top block: the day's name around the side, the compass on top -->
<T.Mesh geometry={bandGeo} position.y={(B.top + B.bottom) / 2}>
	<T.MeshStandardMaterial map={bandTex} emissiveMap={bandTex} {...lit} />
</T.Mesh>
<T.Mesh geometry={cap} rotation.x={-Math.PI / 2} position.y={0.5}>
	<T.MeshStandardMaterial map={ringTex} emissiveMap={ringTex} {...lit} />
</T.Mesh>
<!-- the ledge: controls on top, labels engraved (canvas up is north, like the compass) -->
<T.Mesh geometry={ledgeSide} position.y={(ledge.top + ledge.bottom) / 2}>
	<T.MeshStandardMaterial color="#e6dfd2" emissive="#e6dfd2" emissiveIntensity={0.3} roughness={0.85} />
</T.Mesh>
<T.Mesh geometry={ledgeCap} rotation.x={-Math.PI / 2} position.y={ledge.top + 0.5}>
	<T.MeshStandardMaterial map={ledgeTex} emissiveMap={ledgeTex} {...lit} />
</T.Mesh>
<!-- underside -->
<T.Mesh rotation.x={Math.PI / 2} position.y={ledge.bottom}>
	<T.CircleGeometry args={[ledge.outer * 1.01, 96]} />
	<T.MeshStandardMaterial color="#d9d1c3" />
</T.Mesh>
<!-- soft shadow on the air below: grounds it without a table -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={ledge.bottom - R * 0.05}>
	<T.PlaneGeometry args={[ledge.outer * 3, ledge.outer * 3]} />
	<T.MeshBasicMaterial map={shadeTex} transparent opacity={shadow} depthWrite={false} />
</T.Mesh>
