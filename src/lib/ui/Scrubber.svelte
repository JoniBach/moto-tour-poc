<!--
  Timeline scrubber on the riding-time axis (stops collapsed to a few seconds).
  Elevation profile filled with the active colour scale, stop + pin markers, draggable playhead,
  and a row of photo ticks (hover to preview, click to jump there and open the photo).
-->
<script lang="ts">
	import { A, cap } from '$lib/activity';
	import { distance, distUnit, tempRound, tempUnit, wind, windUnit } from '$lib/units';
	import { TOUR } from '$lib/tourConfig';
	import { area, line, scaleLinear } from 'd3';
	import { app } from '$lib/app.svelte';
	import { clock, mph, photoUrl, PIN_META, roadAtFix, weatherAt, weatherLabel, type Photo } from '$lib/data';
	import { colorScale, gradientAt, LEGENDS } from '$lib/colors';
	import { speedFigures } from '$lib/config';
	import { copyLink, momentUrl } from '$lib/moment';
	import type { Tour } from '$lib/tour.svelte';

	let { tour }: { tour: Tour } = $props();
	// svelte-ignore state_referenced_locally — `tour` is fixed for the component's lifetime
	const tr = tour.data.track;

	let width = $state(800);
	const HEIGHT = 104;
	const PAD = { top: 22, bottom: 26 }; // bottom: photo row + clock labels
	const PHOTO_Y = HEIGHT - PAD.bottom + 7;

	const x = $derived(scaleLinear().domain([0, tour.duration]).range([0, width]));
	const lo = Math.min(...tr.ground, ...tr.ele);
	const hi = Math.max(...tr.ground, ...tr.ele);
	const y = scaleLinear().domain([Math.min(0, lo), hi * 1.05]).range([HEIGHT - PAD.bottom, PAD.top]);

	// decimate to ~2 samples per pixel
	const idx = $derived.by(() => {
		const step = Math.max(1, Math.floor(tr.count / (width * 2)));
		const out: number[] = [];
		for (let i = 0; i < tr.count; i += step) out.push(i);
		if (out.at(-1) !== tr.count - 1) out.push(tr.count - 1);
		return out;
	});

	const groundPath = $derived(
		area<number>()
			.x((i) => x(tr.rt[i]))
			.y0(HEIGHT - PAD.bottom)
			.y1((i) => y(tr.ground[i]))(idx) ?? ''
	);
	const gpsPath = $derived(
		line<number>()
			.x((i) => x(tr.rt[i]))
			.y((i) => y(tr.ele[i]))(idx) ?? ''
	);

	const stops = $derived.by(() => {
		const scale = colorScale(tr, tour.colorBy);
		const n = 160;
		return Array.from({ length: n + 1 }, (_, k) => {
			const i = Math.round((k / n) * (tr.count - 1));
			return { offset: tr.rt[i] / tour.duration, color: scale(i) };
		});
	});

	const ticks = $derived(
		x.ticks(Math.max(2, Math.floor(width / 110))).map((rt) => {
			const i = Math.min(tr.count - 1, tr.rt.findIndex((v) => v >= rt));
			return { rt, label: clock(tr.t0 + tr.t[Math.max(0, i)]) };
		})
	);

	let dragging = $state(false);
	let hoverX = $state<number | null>(null);
	let svg: SVGSVGElement;

	function rtAt(e: PointerEvent) {
		const r = svg.getBoundingClientRect();
		return x.invert(Math.max(0, Math.min(width, e.clientX - r.left)));
	}

	const b = $derived(tour.bike);
	const road = $derived(roadAtFix(tour.data.osm, b.i));
	const wx = $derived(weatherAt(tour.data.weather, tour.rt));
	const wxLabel = $derived(wx ? weatherLabel(wx.code, wx.isDay) : null);

	// weather strip: rain bars along the bottom, temperature trace near the top
	// svelte-ignore state_referenced_locally
	const wxSamples = tour.data.weather?.samples ?? [];
	const temps = wxSamples.map((s) => s.temp ?? 0);
	const tempY = scaleLinear()
		.domain([Math.min(...temps) - 0.5, Math.max(...temps) + 0.5])
		.range([PAD.top + 22, PAD.top + 2]);
	const tempPath = $derived(
		line<(typeof wxSamples)[number]>()
			.x((s) => x(s.rt))
			.y((s) => tempY(s.temp ?? 0))(wxSamples) ?? ''
	);
	const roadTitle = $derived(road ? [road.ref, road.name].filter(Boolean).join(' · ') || road.highway : '—');
	const roadNotes = $derived(
		road ? [road.singleTrack && 'single track', road.maxspeed && `limit ${road.maxspeed}`].filter(Boolean).join(' · ') : ''
	);
	// photo ticks: photos within 4 px of each other share a tick (with a count)
	const photoTicks = $derived.by(() => {
		const out: { px: number; photos: Photo[]; first: number }[] = [];
		tour.photos.forEach((ph, k) => {
			const px = x(ph.rt!);
			const last = out.at(-1);
			if (last && px - last.px < 4) last.photos.push(ph);
			else out.push({ px, photos: [ph], first: k });
		});
		return out;
	});
	let photoHover = $state<{ px: number; photos: Photo[] } | null>(null);

	// publish the scrubber's height so pop-ups and cards can sit just above it
	let scrubH = $state(0);
	$effect(() => {
		document.documentElement.style.setProperty('--scrub-h', `${scrubH}px`);
	});

	let linked = $state(false);
	async function shareMoment() {
		// just the moment: '' leaves out whatever post or photo is open
		linked = await copyLink(momentUrl(app, { post: '', photo: '' }));
		setTimeout(() => (linked = false), 1500);
	}

	// dev helper: copy a ready-made Markdown header for the moment on screen (nearest photo as cover)
	let copied = $state(false);
	async function copyPostHeader() {
		const t = tour.bike.time;
		const d = new Date(t * 1000);
		const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleString(TOUR.locale, { timeZone: TOUR.timeZone, ...o });
		const stamp = `${d.toLocaleDateString('en-CA', { timeZone: TOUR.timeZone })} ${part({ hour: '2-digit', minute: '2-digit', hour12: false })}`;
		const near = [...tour.photos].sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
		const cover = near && Math.abs(near.t - t) < 1800 ? `
cover: ${near.id}` : '';
		const where = road ? [road.ref, road.name].filter(Boolean).join(' ') : '';
		await navigator.clipboard.writeText(`---
title: ${where || 'Untitled'}
time: ${stamp}${cover}
---

`);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	const legend = $derived(LEGENDS[tour.colorBy]);
	const legendGradient = $derived(
		Array.from({ length: 11 }, (_, k) => `${legend.interp(k / 10)} ${k * 10}%`).join(', ')
	);
</script>

<div class="scrubber" bind:offsetHeight={scrubH}>
	<div class="bar">
		<button class="play" onclick={() => tour.togglePlay()} aria-label={tour.playing ? 'Pause' : 'Play'}>
			{tour.playing ? '❚❚' : '▶'}
		</button>
		<label class="rate">
			<select bind:value={tour.rate} aria-label="Playback speed">
				{#each [1, 5, 20, 60, 200] as r (r)}<option value={r}>{r}×</option>{/each}
			</select>
		</label>
		<div class="clock display">{clock(b.time)}</div>
		{#if wx && wxLabel}
			<div class="wx" title="{wxLabel.label}, cloud {wx.cloud}%, gusts {wind(wx.gust ?? 0).toFixed(0)} {windUnit}">
				<span class="wx-icon">{wxLabel.icon}</span>
				<span class="wx-main">
					<span class="wx-temp">{tempRound(wx.temp ?? 0)}{tempUnit}</span>
					<small>
						{wxLabel.label} · <span class="arrow" style:transform="rotate({wx.windDir + 180}deg)">↑</span>
						{wind(wx.wind ?? 0).toFixed(0)} {windUnit}{#if (wx.precip ?? 0) > 0} · {wx.precip} mm/h{/if}
					</small>
				</span>
			</div>
		{/if}
		<div class="road">
			<span class="road-title">{roadTitle}</span>
			{#if roadNotes}<small>{roadNotes}</small>{/if}
		</div>
		<dl class="readouts">
			{#if speedFigures()}
				<div><dt>Speed</dt><dd>{wind(mph(b.speed)).toFixed(0)}<small>{windUnit}</small></dd></div>
			{/if}
			<div><dt>Ground</dt><dd>{b.h.toFixed(0)}<small>m</small></dd></div>
			<div><dt>GPS alt</dt><dd>{b.ele.toFixed(0)}<small>m</small></dd></div>
			{#if A.leans}<div><dt>Lean</dt><dd>{Math.abs((b.lean * 180) / Math.PI).toFixed(0)}<small>°</small></dd></div>{/if}
			<div><dt>Gradient</dt><dd>{(gradientAt(tr, b.i) * 100).toFixed(0)}<small>%</small></dd></div>
			<div><dt>Distance</dt><dd>{distance(b.dist / 1000).toFixed(1)}<small>{distUnit}</small></dd></div>
		</dl>
		<button class="share" onclick={shareMoment} title="Copy a link to this moment of the {A.leg}">
			{linked ? '✓ Copied' : '🔗 Share moment'}
		</button>
		<button class="stretch-btn" onclick={() => tour.pickStretch()} title="Choose a stretch of the {A.leg} to share, with a GPX to ride it" aria-label="Share a stretch">
			<span aria-hidden="true">✂</span><span class="label"> Share a stretch</span>
		</button>
		{#if import.meta.env.DEV}
			<button class="post-here" onclick={copyPostHeader} title="Copy a blog post header for this moment">
				{copied ? '✓ Copied' : '✎ Post here'}
			</button>
		{/if}
		<div class="legend">
			<span>{legend.label}</span>
			<span class="ramp" style:background="linear-gradient(90deg, {legendGradient})"></span>
			<span class="ends"><small>{legend.min}</small><small>{legend.max}</small></span>
		</div>
	</div>

	<div class="track" bind:clientWidth={width}>
		<svg
			bind:this={svg}
			{width}
			height={HEIGHT}
			role="slider"
			tabindex="0"
			aria-label="{cap(A.leg)} timeline"
			aria-valuemin={0}
			aria-valuemax={tour.duration}
			aria-valuenow={tour.rt}
			onpointerdown={(e) => {
				e.preventDefault(); // a drag here is scrubbing, not selecting the text around it
				dragging = true;
				svg.setPointerCapture(e.pointerId);
				tour.seek(rtAt(e));
			}}
			onpointermove={(e) => {
				hoverX = e.clientX - svg.getBoundingClientRect().left;
				if (dragging) tour.seek(rtAt(e));
			}}
			onpointerup={() => (dragging = false)}
			onpointerleave={() => (hoverX = null)}
		>
			<defs>
				<linearGradient id="profile-fill" x1="0" x2={width} gradientUnits="userSpaceOnUse">
					{#each stops as s, k (k)}<stop offset={s.offset} stop-color={s.color} />{/each}
				</linearGradient>
			</defs>

			<path d={groundPath} fill="url(#profile-fill)" opacity="0.85" />
			{#if tour.layers.weather && wxSamples.length}
				{#each wxSamples as s, k (k)}
					{#if (s.precip ?? 0) > 0}
						{@const x1 = x(s.rt)}
						{@const x2 = x(wxSamples[k + 1]?.rt ?? tour.duration)}
						{@const bh = Math.min(1, (s.precip ?? 0) / 1.5) * 26 + 3}
						<rect x={x1} y={HEIGHT - PAD.bottom - bh} width={Math.max(1, x2 - x1)} height={bh} class="rain" />
					{/if}
				{/each}
				<path d={tempPath} class="temp" />
			{/if}
			{#if tour.layers.gpsAltitude}
				<path d={gpsPath} class="gps" />
			{/if}

			<!-- not-yet-ridden part dimmed -->
			<rect x={x(tour.rt)} y="0" width={Math.max(0, width - x(tour.rt))} height={HEIGHT} class="unridden" />

			{#each tr.stops as s (s.start)}
				{@const sx = x(tr.rt[s.start])}
				<line x1={sx} x2={sx} y1={PAD.top - 4} y2={HEIGHT - PAD.bottom} class="stop" />
				<text x={sx + 3} y={HEIGHT - PAD.bottom - 4} class="stop-label">⏸ {Math.round(s.duration / 60)} min</text>
			{/each}

			{#each tour.data.pins as p (p.id)}
				{@const m = PIN_META[p.type]}
				<g
					class="pin-tick"
					transform="translate({x(p.rt)}, 10)"
					role="button"
					tabindex="-1"
					onpointerdown={(e) => {
						e.stopPropagation();
						tour.seek(p.rt);
						tour.selectedPin = p.id;
					}}
				>
					<circle r="7" fill={m.color} />
					<text text-anchor="middle" dy="3.5" font-size="8">{m.icon}</text>
				</g>
			{/each}

			{#if tour.layers.blog}
				{#each tour.posts as po (po.slug)}
					<g
						class="post-tick"
						transform="translate({x(po.rt)}, 10)"
						role="button"
						tabindex="-1"
						aria-label="Story: {po.title}"
						onpointerdown={(e) => {
							e.stopPropagation();
							tour.seek(po.rt);
							tour.playing = false;
							app.reading = po;
						}}
					>
						<title>{po.title}</title>
						<circle r="8" />
						<text text-anchor="middle" dy="3.5" font-size="9">✎</text>
					</g>
				{/each}
			{/if}

			{#each photoTicks as pt (pt.first)}
				<g
					class="photo-tick"
					class:passed={pt.px <= x(tour.rt)}
					transform="translate({pt.px}, {PHOTO_Y})"
					role="button"
					tabindex="-1"
					aria-label="{pt.photos.length} photo(s)"
					onpointerenter={() => (photoHover = { px: pt.px, photos: pt.photos })}
					onpointerleave={() => (photoHover = null)}
					onpointerdown={(e) => {
						e.stopPropagation();
						tour.seek(pt.photos[0].rt!);
						tour.playing = false;
						app.gallery = { photos: tour.photos, index: pt.first };
					}}
				>
					<circle r={pt.photos.length > 1 ? 4.5 : 3.5} />
				</g>
			{/each}

			{#each ticks as t (t.rt)}
				<text x={x(t.rt)} y={HEIGHT - 4} class="tick" text-anchor={x(t.rt) < 20 ? 'start' : x(t.rt) > width - 20 ? 'end' : 'middle'}>{t.label}</text>
			{/each}

			<line x1={x(tour.rt)} x2={x(tour.rt)} y1="0" y2={HEIGHT - PAD.bottom} class="head" />
			<circle cx={x(tour.rt)} cy={y(b.h)} r="5" class="head-dot" />

			{#if hoverX != null && !dragging}
				{@const hi = tr.rt.findIndex((v) => v >= x.invert(hoverX!))}
				<text x={hoverX} y={PAD.top - 8} class="hover" text-anchor="middle">{clock(tr.t0 + tr.t[Math.max(0, hi)])}</text>
			{/if}
		</svg>
		{#if photoHover}
			{@const ph = photoHover.photos[0]}
			<div class="photo-preview" style:left="{Math.max(56, Math.min(width - 56, photoHover.px))}px">
				<img src={photoUrl(ph, 'thumb')} alt="" />
				<span>{clock(ph.t)}{#if photoHover.photos.length > 1} · {photoHover.photos.length} photos{/if}</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.scrubber {
		position: absolute;
		z-index: 100;
		left: 16px;
		right: 16px;
		bottom: 16px;
		padding: 10px 16px 8px;
		border: 0;
		border-radius: 24px;
		background: var(--glass);
		backdrop-filter: blur(12px);
		box-shadow:
			var(--shadow),
			0 0 0 1px var(--line);
		color: var(--text);
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
		margin-bottom: 4px;
	}
	.play {
		all: unset;
		cursor: pointer;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 15px;
		box-shadow: 0 3px 0 color-mix(in srgb, var(--accent) 55%, #000);
	}
	.rate select {
		background: var(--card);
		color: var(--text);
		border: 0;
		border-radius: 999px;
		padding: 6px 8px;
		font: inherit;
		font-weight: 650;
		box-shadow: 0 0 0 1px var(--line);
	}
	.rate option {
		background: var(--card);
	}
	.clock {
		font-size: 22px;
		font-variant-numeric: tabular-nums;
		color: var(--text);
		min-width: 64px;
	}
	.wx {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 150px;
	}
	.wx-icon {
		font-size: 22px;
	}
	.wx-main {
		display: flex;
		flex-direction: column;
	}
	.wx-temp {
		font-size: 15px;
		font-weight: 600;
	}
	.wx small {
		font-size: 10px;
		color: var(--muted);
	}
	.arrow {
		display: inline-block;
		color: var(--text);
	}
	.rain {
		fill: #6fa8d6;
		opacity: 0.5;
		pointer-events: none;
	}
	.temp {
		fill: none;
		stroke: #d98b4a;
		stroke-width: 1.2;
		stroke-dasharray: 3 2;
		opacity: 0.8;
		pointer-events: none;
	}
	.road {
		display: flex;
		flex-direction: column;
		min-width: 170px;
		max-width: 240px;
	}
	.road-title {
		font-size: 14px;
		font-weight: 650;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.road small {
		font-size: 10px;
		color: var(--muted);
	}
	.readouts {
		display: flex;
		gap: 16px;
		margin: 0;
		flex-wrap: wrap;
	}
	.readouts div {
		display: flex;
		flex-direction: column;
	}
	dt {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-size: 16px;
		font-variant-numeric: tabular-nums;
	}
	dd small {
		font-size: 10px;
		color: var(--muted);
		margin-left: 2px;
	}
	.legend {
		margin-left: auto;
		display: grid;
		grid-template-columns: auto 120px;
		column-gap: 8px;
		align-items: center;
		font-size: 11px;
		color: var(--muted);
	}
	.ramp {
		height: 8px;
		border-radius: 4px;
	}
	.ends {
		grid-column: 2;
		display: flex;
		justify-content: space-between;
	}
	.track {
		position: relative;
		width: 100%;
	}
	.post-tick {
		cursor: pointer;
	}
	.post-tick circle {
		fill: #f2c14e;
		stroke: var(--card);
		stroke-width: 2;
	}
	.post-tick text {
		fill: #263238;
		pointer-events: none;
	}
	.post-tick:hover circle {
		transform: scale(1.2);
	}
	.share {
		all: unset;
		cursor: pointer;
		padding: 6px 12px;
		border-radius: 999px;
		box-shadow: 0 0 0 1px var(--line);
		background: var(--card);
		color: var(--text);
		font-size: 12px;
		font-weight: 650;
		white-space: nowrap;
	}
	.stretch-btn {
		flex: none;
		min-height: 34px;
		padding: 0 12px;
		border: 1px dashed var(--line);
		border-radius: 999px;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 12px;
		font-weight: 650;
		cursor: pointer;
	}
	.stretch-btn:hover {
		background: var(--card);
	}
	.share:hover {
		color: var(--text);
		background: var(--accent-soft);
	}
	.post-here {
		all: unset;
		cursor: pointer;
		padding: 4px 9px;
		border-radius: 999px;
		border: 1px dashed var(--muted);
		color: var(--muted);
		font-size: 11px;
		white-space: nowrap;
	}
	.photo-tick {
		cursor: pointer;
	}
	.photo-tick circle {
		fill: #8d7cc4;
		stroke: var(--card);
		stroke-width: 1.5;
		opacity: 0.55;
	}
	.photo-tick.passed circle {
		opacity: 1;
	}
	.photo-tick:hover circle {
		opacity: 1;
		transform: scale(1.5);
	}
	.photo-preview {
		position: absolute;
		bottom: calc(100% - 6px);
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 4px;
		border: 0;
		border-radius: 14px;
		background: var(--card);
		box-shadow: var(--shadow);
		pointer-events: none;
		z-index: 2;
	}
	.photo-preview img {
		width: 104px;
		height: 78px;
		object-fit: cover;
		border-radius: 10px;
	}
	.photo-preview span {
		font-size: 10px;
		color: var(--muted);
	}
	svg {
		display: block;
		cursor: ew-resize;
		touch-action: none;
		outline: none;
	}
	.gps {
		fill: none;
		stroke: var(--text);
		stroke-width: 1;
		opacity: 0.7;
	}
	/* the part of the day not yet reached, washed out */
	.unridden {
		fill: color-mix(in srgb, var(--card) 62%, transparent);
		pointer-events: none;
	}
	.stop {
		stroke: var(--muted);
		stroke-dasharray: 2 3;
		opacity: 0.5;
	}
	.stop-label,
	.tick,
	.hover {
		font-size: 10px;
		fill: var(--muted);
	}
	.hover {
		fill: var(--text);
	}
	/* decorations must not swallow clicks meant for the pin ticks */
	.stop,
	.stop-label,
	.tick,
	.hover,
	.head,
	.head-dot {
		pointer-events: none;
	}
	.pin-tick {
		cursor: pointer;
	}
	.head {
		stroke: var(--accent);
		stroke-width: 2;
	}
	.head-dot {
		fill: var(--accent);
		stroke: var(--card);
		stroke-width: 2;
	}
	/* phones: play, time, weather, road + the timeline; the rest lives in the sheets */
	@media (max-width: 900px) {
		.scrubber {
			left: 6px;
			right: 6px;
			bottom: calc(6px + env(safe-area-inset-bottom));
			padding: 8px 10px 4px;
		}
		.bar {
			gap: 10px;
			flex-wrap: nowrap;
			min-width: 0;
		}
		.stretch-btn .label {
			display: none;
		}
		.legend,
		.readouts,
		.stop-label,
		.share,
		.post-here,
		.wx small,
		.road small {
			display: none;
		}
		.play {
			width: 44px;
			height: 44px;
			flex-shrink: 0;
		}
		.rate select {
			padding: 8px 4px;
		}
		.clock {
			font-size: 19px;
			min-width: 0;
		}
		.wx {
			min-width: 0;
			flex-shrink: 0;
		}
		.road {
			min-width: 0;
			flex: 1;
		}
		.road-title {
			font-size: 13px;
		}
	}
	/* fingers: bigger hit areas on the timeline markers */
	@media (pointer: coarse) {
		.photo-tick circle {
			r: 6px;
		}
		.post-tick circle,
		.pin-tick circle {
			r: 10px;
		}
	}
</style>
