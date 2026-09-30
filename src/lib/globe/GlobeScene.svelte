<!--
  The globe: the day's landscape as a round diorama on a plinth, the bike fixed at its centre while
  the land slides beneath it. North is always the same way (-z); you turn the globe by orbiting the
  camera, it never turns itself. The sun and moon sit where they really were for that place and
  moment, and set the light, the shadows' direction and (via onsky) the sky behind.
-->
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { CanvasTexture, Color, Group, Mesh, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3 } from 'three';
	import { fromGrid } from '$lib/projection';
	import { weatherAt, type BlogPost, type Parks, type Photo } from '$lib/data';
	import Traveller from '$lib/scene/Traveller.svelte';
	import type { Tour } from '$lib/tour.svelte';
	import DioramaTerrain from './DioramaTerrain.svelte';
	import GlobeHalo from './GlobeHalo.svelte';
	import GlobeLines from './GlobeLines.svelte';
	import { globeLines, haloMarks } from './lines';
	import { fixColorsRGB } from '$lib/colors';
	import GlobeLabels from './GlobeLabels.svelte';
	import GlobePins from './GlobePins.svelte';
	import GlobeWeather from './GlobeWeather.svelte';
	import Plinth from './Plinth.svelte';
	import RouteRibbon from './RouteRibbon.svelte';
	import { direction, moonAt, skyColours, sunAt } from './sky';
	import { GlobeState } from './state';

	let {
		tour,
		originE,
		originN,
		parks,
		title,
		date,
		onsky,
		onphotos,
		onpost,
		onshadow,
		rise,
		mini = false,
		staged = false
	}: {
		tour: Tour;
		originE: number;
		originN: number;
		parks: Parks | null;
		title: string;
		date: string;
		onsky: (top: string, bottom: string) => void;
		onphotos: (photos: Photo[]) => void;
		onpost: (post: BlogPost) => void;
		/**
		 * The small live globe in the map view's corner: follows the ride (the map plays it), no
		 * controls, labels, pins, surroundings or weather, framed for a small square.
		 */
		mini?: boolean;
		/** on the persistent globe (GlobeStage), which owns the camera and the plinth */
		staged?: boolean;
		/** how dark the plinth's shadow should be, when the stage draws it */
		onshadow?: (s: number) => void;
		/** how far the relief has risen out of the plinth, 0 (flat) to 1: the stage's transitions */
		rise?: () => number;
	} = $props();

	/** the globe's size on screen (scene units): fixed; the landscape is scaled to fit it */
	const V = 1800;
	/** metres of landscape from the bike to the rim (a setting) */
	const R = $derived(tour.settings.globeRadius);
	/** the ride's data on the route (speed shade, lean or gradient), as in the 3D view; null = terracotta */
	const shade = $derived(tour.settings.globeColorBy === 'plain' ? null : fixColorsRGB(tour.data.track, tour.settings.globeColorBy));
	// the pins beyond the rim, as small dots
	const marks = $derived(
		haloMarks(tour.data.pins, tour.photos, tour.posts, originE, originN, {
			pins: tour.layers.pins,
			photos: tour.layers.photos,
			stories: tour.layers.blog
		})
	);
	// the map's lines: roads, rivers, national park edges (each follows its switch)
	const lines = $derived(
		globeLines(tour.data.osm, parks, originE, originN, { roads: tour.layers.roads, rivers: tour.layers.water, parks: tour.layers.parks })
	);
	// pull back on tall, narrow screens so the whole globe fits across
	// (follows the window: turning a phone re-frames the globe)
	let width = $state(globalThis.innerWidth ?? 1);
	let height = $state(globalThis.innerHeight ?? 1);
	const fit = $derived(mini ? 1.15 : Math.max(1, 1.25 / Math.max(0.3, width / height)));
	const globe = new GlobeState(V);
	const RAD = Math.PI / 180;

	// the landscape group: moves so the bike is always at the centre, floor at y = 0
	const land = new Group();
	let exag = $state(2);
	/** labels and pins stand at full height: they wait until the land has risen */
	let settled = $state(true);
	const risen = () => rise?.() ?? 1;
	// the surroundings keep their full height and open out like an aperture instead; this holds
	// them level while the land beside them rises (the land group sits at -base × exag)
	let haloLift = $state(0);

	// sun and moon: small bodies on a wide arc around the globe
	const ORBIT = V * 1.55;
	const glow = (() => {
		const c = document.createElement('canvas');
		c.width = c.height = 128;
		const ctx = c.getContext('2d')!;
		const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
		g.addColorStop(0, 'rgba(255, 244, 214, 1)');
		g.addColorStop(0.25, 'rgba(255, 214, 140, 0.9)');
		g.addColorStop(1, 'rgba(255, 200, 120, 0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 128, 128);
		return new CanvasTexture(c);
	})();
	// the moon lit by the sun: its phase shows for free
	const moonGeo = new SphereGeometry(V * 0.05, 32, 16);
	const moonMat = new ShaderMaterial({
		uniforms: { uSun: { value: new Vector3(0, 1, 0) } },
		vertexShader: /* glsl */ `
			varying vec3 vN;
			void main() {
				vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			uniform vec3 uSun;
			varying vec3 vN;
			void main() {
				float lit = smoothstep(-0.05, 0.15, dot(normalize(vN), uSun));
				gl_FragColor = vec4(mix(vec3(0.42, 0.46, 0.58), vec3(0.98, 0.96, 0.90), lit), 1.0);
			}
		`
	});

	const sunBody = new Sprite(new SpriteMaterial({ map: glow, depthWrite: false, transparent: true }));
	sunBody.scale.setScalar(V * 0.32);
	const moonBody = new Mesh(moonGeo, moonMat);
	let shadow = $state(0.5);

	let sunLight = $state<import('three').DirectionalLight>();
	let hemi = $state<import('three').HemisphereLight>();
	let sky = '';
	const tmp = new Color();

	useTask((dt) => {
		if (!mini) tour.advance(Math.min(dt, 0.1)); // the mini globe follows whoever plays the ride
		const r = risen();
		exag = tour.exaggeration * r;
		if (settled !== r > 0.999) settled = r > 0.999;
		haloLift = Number.isFinite(globe.base) ? globe.base * (exag - tour.exaggeration) : 0;
		const b = tour.bike;
		// scale the landscape so its radius R fills the globe's fixed size V
		const k = V / R;
		land.scale.setScalar(k);
		if (Number.isFinite(globe.base)) land.position.set(-b.x * k, -globe.base * exag * k, b.n * k);
		tour.imagery.update(b.x, b.n);

		// weather now
		const w = weatherAt(tour.data.weather, tour.rt);
		globe.weather = w;
		const drizzle = w && w.code >= 51 && w.code <= 57 ? 0.25 : 0;
		globe.rain = tour.layers.weather && w ? Math.min(1, Math.max(drizzle, (w.precip ?? 0) / 1.5)) : 0;

		// sun and moon for this place and moment
		const [lon, lat] = fromGrid(b.x + originE, b.n + originN);
		const sun = sunAt(b.time, lat, lon);
		const moon = moonAt(b.time, lat, lon);
		globe.sunDir.set(...direction(sun));
		globe.moonDir.set(...direction(moon));
		sunBody.position.copy(globe.sunDir).multiplyScalar(ORBIT);
		moonBody.position.copy(globe.moonDir).multiplyScalar(ORBIT);
		sunBody.visible = sun.alt > -2 * RAD;
		moonBody.visible = moon.alt > -2 * RAD && sun.alt < 12 * RAD;
		moonMat.uniforms.uSun.value.copy(globe.sunDir);

		// light: the sun by day; the moon (or a faint sky glow) by night
		const deg = sun.alt / RAD;
		globe.daylight = Math.min(1, Math.max(0, (deg + 8) / 16));
		const colours = skyColours(sun.alt, tour.layers.weather && w ? w.cloud / 100 : 0, globe.rain);
		globe.light.set(colours.light);
		if (deg > -3) {
			globe.lightDir.copy(globe.sunDir);
			if (globe.lightDir.y < 0.08) globe.lightDir.setY(0.08).normalize(); // grazing, never from below
			globe.lightStrength = 0.25 + 0.75 * Math.min(1, Math.max(0, (deg + 3) / 20));
		} else {
			globe.lightDir.copy(moon.alt > 0 ? globe.moonDir : new Vector3(0.2, 1, 0.3).normalize());
			globe.lightStrength = moon.alt > 0 ? 0.3 : 0.12;
		}
		// overcast softens the direct light
		if (tour.layers.weather && w) globe.lightStrength *= 1 - 0.45 * (w.cloud / 100);
		if (sunLight) {
			sunLight.position.copy(globe.lightDir).multiplyScalar(R * 3);
			sunLight.color.copy(globe.light);
			sunLight.intensity = globe.lightStrength * 1.6;
		}
		if (hemi) {
			hemi.intensity = 0.55 + 0.6 * globe.daylight;
			hemi.color.copy(tmp.set(colours.top));
		}
		const s = Math.round((0.2 + 0.35 * globe.daylight) * 20) / 20;
		if (s !== shadow) {
			shadow = s;
			onshadow?.(s);
		}
		const next = colours.top + colours.bottom;
		if (next !== sky) {
			sky = next;
			onsky(colours.top, colours.bottom);
		}
	});

	$effect(() => tour.imagery.setStyle(tour.mapStyle));

	$effect(() => () => {
		glow.dispose();
		sunBody.material.dispose();
		moonGeo.dispose();
		moonMat.dispose();
	});
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

{#if !staged}
	<T.PerspectiveCamera makeDefault position={[0, V * 2.1 * fit, V * 3.9 * fit]} fov={34} near={V * 0.01} far={V * 40}>
		<OrbitControls
			enabled={!mini}
			target={[0, V * 0.05, 0]}
			enablePan={false}
			enableDamping
			minDistance={V * 1.3}
			maxDistance={V * 6 * fit}
			maxPolarAngle={Math.PI * 0.47}
		/>
	</T.PerspectiveCamera>
{/if}

<T.HemisphereLight bind:ref={hemi} args={['#dfeef7', '#d8cbb4', 1.2]} />
<T.DirectionalLight bind:ref={sunLight} position={[V, V * 2, V]} intensity={2} />

{#if !staged}<Plinth R={V} {title} {date} {shadow} />{/if}

<T is={land}>
	<!-- a new size rebuilds what's cut to the circle; the floor eases to its new level -->
	{#key R}
		<T.Group scale.y={exag}>
			<DioramaTerrain {tour} {globe} radius={R} />
			{#if lines.length}<GlobeLines {tour} {globe} radius={R} {lines} />{/if}
			{#if tour.layers.route}<RouteRibbon {tour} {globe} radius={R} {shade} />{/if}
		</T.Group>
		{#if tour.settings.globeHalo && !mini}
			<T.Group scale.y={tour.exaggeration} position.y={haloLift}>
				<GlobeHalo {tour} {globe} radius={R} contours={tour.layers.contours} route={tour.layers.route} {lines} {shade} {marks} open={risen} />
			</T.Group>
		{/if}
		{#if !mini && settled}
			{#if tour.layers.labels && tour.data.osm}<GlobeLabels {tour} {globe} radius={R} places={tour.data.osm.places} />{/if}
			<GlobePins {tour} {globe} radius={R} {originE} {originN} {onphotos} {onpost} />
		{/if}
	{/key}
	<!-- the same size on screen whatever the landscape's scale -->
	<Traveller {tour} beacon={false} grow={R / V} groundAt={(x, n) => globe.ground(x, n) * risen()} />
</T>

{#if !mini}<GlobeWeather {globe} show={tour.layers.weather} />{/if}

<T is={sunBody} />
<T is={moonBody} />
