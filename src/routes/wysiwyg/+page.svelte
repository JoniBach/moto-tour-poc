<!--
  The story editor (/wysiwyg): write a story for the tour on the move, see it exactly as it will
  read in the blog, and save it as a Markdown file to commit later. Nothing leaves the device:
  open an existing .md, edit, and "Save a copy" downloads a new timestamped file; the draft also
  stays in this browser between visits. Not linked from anywhere, and not indexed.

  The preview is the real thing: the same renderer as the build (src/lib/story.js) and the same
  article as the story page (StoryArticle), placed on the day's route at the story's moment.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { TOUR, photoSrc } from '$lib/tourConfig';
	import { loadDay, loadFeed, loadPhotos, loadTourIndex, bisect, type FeedDay, type Photo, type TourData, type TourIndex } from '$lib/data';
	import { ukToEpoch } from '$lib/moment';
	import { excerptOf, frontmatter, minutesOf, plainText, renderStory, slugFor, storyFile } from '$lib/story.js';
	import { sketch } from '$lib/sketch';
	import StoryArticle from '$lib/blog/StoryArticle.svelte';

	// ---- the tour's published data ------------------------------------------------------------
	let days = $state.raw<FeedDay[]>([]);
	let photos = $state.raw<Photo[]>([]);
	let index = $state.raw<TourIndex | null>(null);
	let loadError = $state<string | null>(null);
	onMount(() => {
		Promise.all([loadFeed(), loadPhotos(), loadTourIndex()])
			.then(([f, p, i]) => ((days = f.days), (photos = p), (index = i)))
			.catch((e) => (loadError = String(e)));
	});
	const byId = $derived(new Map(photos.map((p) => [p.id, p])));

	// ---- the story being written (kept in this browser between visits) ---------------------------
	const KEY = `gt-story-editor:${TOUR.id}`;
	type Draft = { title: string; date: string; clock: string; cover: string; slug: string; slugEdited: boolean; draft: boolean; body: string };
	const blank = (): Draft => ({ title: '', date: '', clock: '12:00', cover: '', slug: '', slugEdited: false, draft: false, body: '' });
	let s = $state<Draft>(blank());
	onMount(() => {
		try {
			const saved = localStorage.getItem(KEY);
			if (saved) s = { ...blank(), ...JSON.parse(saved) };
		} catch {
			/* private mode or storage off: start blank */
		}
	});
	// kept a moment after a change settles (and when the page is hidden or left), with the latest text
	function persist() {
		try {
			localStorage.setItem(KEY, JSON.stringify({ ...s, body: latest() }));
		} catch {
			/* storage full or off: the draft just won't survive a reload */
		}
	}
	$effect(() => {
		JSON.stringify(s); // every field, so any settled change is kept
		const id = setTimeout(persist, 500);
		return () => clearTimeout(id);
	});
	onMount(() => persist);
	// the first day by default, once the days are in
	$effect(() => {
		if (!s.date && days.length) s.date = days[0].day;
	});
	// the address follows the date and title until it's edited by hand
	$effect(() => {
		if (!s.slugEdited) s.slug = slugFor(s.date, s.title);
	});

	// ---- where the story sits -------------------------------------------------------------------
	const day = $derived(days.find((d) => d.day === s.date));
	const t = $derived(s.date && /^\d{1,2}:\d{2}$/.test(s.clock) ? ukToEpoch(s.date, s.clock) : NaN);
	let dayData = $state.raw<TourData | null>(null);
	let loadedDay = '';
	$effect(() => {
		const d = s.date;
		if (!d || d === loadedDay || !days.some((x) => x.day === d)) return;
		loadedDay = d;
		dayData = null;
		loadDay(d, true)
			.then((data) => {
				if (loadedDay === d) dayData = data;
			})
			.catch(() => {});
	});
	/** the ride's position at the story's moment, like the build places it */
	const spot = $derived.by(() => {
		if (!dayData || !Number.isFinite(t)) return null;
		const tr = dayData.track;
		const meta = dayData.terrain.meta;
		const rel = t - tr.t0;
		const i = rel <= 0 ? 0 : bisect(tr.t, rel);
		const x = tr.x[i];
		const n = tr.n[i];
		const near = (dayData.osm?.places ?? [])
			.map((p) => ({ name: p.name, d: Math.hypot(p.x - x, p.n - n) }))
			.filter((p) => p.d < 8000)
			.sort((a, b) => a.d - b.d)[0];
		return { e: x + meta.originE, n: n + meta.originN, place: near?.name ?? null, inRide: rel >= 0 && rel <= tr.t[tr.count - 1] };
	});
	const where = $derived.by(() => {
		const lines = index?.days.find((d) => d.day === s.date)?.lines;
		return lines ? sketch(lines, { dot: spot ?? undefined }) : null;
	});

	// ---- the preview -----------------------------------------------------------------------------
	// It follows s.body, which only changes once typing settles (see "the text box" below), and
	// only while it's on screen: beside the text on wide screens, or its own tab on phones.
	let tab = $state<'write' | 'preview'>('write');
	let wide = $state(true);
	onMount(() => {
		const mq = matchMedia('(min-width: 901px)');
		const set = () => (wide = mq.matches);
		set();
		mq.addEventListener('change', set);
		return () => mq.removeEventListener('change', set);
	});
	const previewing = $derived(wide || tab === 'preview');
	const rendered = $derived(renderStory(s.body, { photos: byId, src: (id) => photoSrc('large', id) }));
	const text = $derived(plainText(s.body));
	const coverPhoto = $derived(s.cover ? byId.get(s.cover) : undefined);
	const fileOf = (text: string) => storyFile({ title: s.title, time: `${s.date} ${s.clock}`, cover: s.cover, slug: s.slug }, text);
	const file = $derived(fileOf(s.body));

	const problems = $derived.by(() => {
		const out: string[] = [];
		if (!s.title.trim()) out.push('Give it a title.');
		if (!day) out.push('Pick a day of the tour.');
		else if (!Number.isFinite(t)) out.push('Set the time (hh:mm, the tour’s local time).');
		else if (spot && !spot.inRide) out.push('That time is outside the day’s riding: it’ll be pinned to the nearest end of the ride.');
		if (s.cover && !coverPhoto) out.push(`The cover photo ${s.cover} isn’t in the tour.`);
		for (const id of rendered.withheld) out.push(`Photo ${id} isn’t in the tour (or is kept private): it won’t show.`);
		if (s.draft) out.push('Marked as a draft: the file name starts with “_”, and the build skips it.');
		return out;
	});

	// ---- the text box ----------------------------------------------------------------------------
	// Not bound to the draft: the browser owns what's typed, and a key press only restarts a timer.
	// The draft (and with it the preview, the file and the saved copy) catches up once typing
	// settles, when the box loses focus, and before anything reads it (save, copy, new, preview tab).
	// Re-rendering on every key, or at every short pause, made typing lag on iPads.
	const SETTLE_MS = 700;
	let area = $state<HTMLTextAreaElement>();
	let settling: ReturnType<typeof setTimeout> | undefined;
	/** the text as it is in the box right now */
	const latest = () => area?.value ?? s.body;
	function typed() {
		clearTimeout(settling);
		settling = setTimeout(settle, SETTLE_MS);
	}
	function settle() {
		clearTimeout(settling);
		if (area && area.value !== s.body) s.body = area.value;
	}
	onMount(() => () => clearTimeout(settling));
	// text from elsewhere (the saved draft, an opened file, "New", the toolbar) into the box
	$effect(() => {
		const text = s.body;
		if (area && area.value !== text) area.value = text;
	});

	// ---- editing helpers -------------------------------------------------------------------------
	function edit(fn: (sel: string) => { text: string; select?: [number, number] }) {
		if (!area) return;
		const { selectionStart: a, selectionEnd: b, value } = area;
		const out = fn(value.slice(a, b));
		s.body = value.slice(0, a) + out.text + value.slice(b);
		clearTimeout(settling);
		queueMicrotask(() => {
			area?.focus();
			const [x, y] = out.select ?? [out.text.length, out.text.length];
			area?.setSelectionRange(a + x, a + y);
		});
	}
	const wrap = (mark: string, placeholder: string) =>
		edit((sel) => {
			const inner = sel || placeholder;
			return { text: `${mark}${inner}${mark}`, select: [mark.length, mark.length + inner.length] };
		});
	const lines = (prefix: string, placeholder: string) =>
		edit((sel) => {
			const inner = sel || placeholder;
			const text = inner
				.split('\n')
				.map((l) => prefix + l)
				.join('\n');
			return { text: `\n${text}\n`, select: [1 + prefix.length, 1 + text.length] };
		});
	const link = () =>
		edit((sel) => {
			const label = sel || 'link text';
			return { text: `[${label}](https://)`, select: [label.length + 3, label.length + 11] };
		});

	// the photo picker: the day's photos, nearest the story's moment first in view
	let picking = $state<'embed' | 'cover' | null>(null);
	const dayPhotos = $derived(photos.filter((p) => p.day === s.date).sort((a, b) => a.t - b.t));
	const clockOf = (sec: number) =>
		new Date(sec * 1000).toLocaleTimeString(TOUR.locale, { hour: '2-digit', minute: '2-digit', timeZone: TOUR.timeZone });
	function pick(p: Photo) {
		if (picking === 'cover') s.cover = p.id;
		else edit(() => ({ text: `\n![Caption](photo:${p.id})\n`, select: [3, 10] }));
		picking = null;
	}

	// ---- files: open one from the device, save a new timestamped copy, copy the Markdown -------------
	let status = $state('');
	function open(text: string, name: string) {
		const { data, body } = frontmatter(text);
		const [date = '', clock = '12:00'] = (data.time ?? '').split(/[ T]/);
		s = {
			title: data.title ?? '',
			date,
			clock: clock.slice(0, 5),
			cover: data.cover ?? '',
			slug: data.slug ?? name.replace(/^_/, '').replace(/\.md$/i, '').replace(/\s*\(saved [^)]*\)$/, ''),
			slugEdited: true,
			draft: name.startsWith('_'),
			body: body.replace(/^\n+/, '')
		};
		status = `Opened ${name}`;
	}
	async function openFile(f: File | undefined) {
		if (f) open(await f.text(), f.name);
	}
	function save() {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}`;
		const name = `${s.draft ? '_' : ''}${s.slug || 'story'} (saved ${stamp}).md`;
		settle();
		const url = URL.createObjectURL(new Blob([fileOf(s.body)], { type: 'text/markdown' }));
		const a = Object.assign(document.createElement('a'), { href: url, download: name });
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		status = `Saved ${name}`;
	}
	async function copy() {
		try {
			settle();
			await navigator.clipboard.writeText(fileOf(s.body));
			status = 'Copied the Markdown';
		} catch {
			status = 'Couldn’t copy: your browser blocked it';
		}
	}
	function fresh() {
		settle();
		if (s.body.trim() && !confirm('Start a new story? The current one is only kept if you’ve saved a copy.')) return;
		s = { ...blank(), date: days[0]?.day ?? '' };
		status = 'New story';
	}

	let showFile = $state(false);
	let dragging = $state(false);
	const dayLabel = (d: FeedDay) =>
		`Day ${d.index + 1} · ${new Date(d.start * 1000).toLocaleDateString(TOUR.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TOUR.timeZone })} · ${d.title}`;
</script>

<svelte:head>
	<title>Story editor · {TOUR.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<svelte:window
	onpagehide={() => (settle(), persist())}
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={(e) => {
		e.preventDefault();
		dragging = false;
		openFile(e.dataTransfer?.files[0]);
	}}
/>

<svelte:document onvisibilitychange={() => document.visibilityState === 'hidden' && (settle(), persist())} />

<div class="editor" class:dragging>
	<header class="bar">
		<div class="brand">
			<span class="mark" aria-hidden="true">✎</span>
			<div>
				<h1 class="display">Story editor</h1>
				<p>{TOUR.name} · saved on this device only</p>
			</div>
		</div>
		<div class="actions">
			<label class="pill">
				Open .md
				<input type="file" accept=".md,.markdown,text/markdown,text/plain" onchange={(e) => openFile((e.currentTarget as HTMLInputElement).files?.[0])} />
			</label>
			<button type="button" class="pill" onclick={fresh}>New</button>
			<button type="button" class="pill" onclick={copy}>Copy Markdown</button>
			<button type="button" class="pill go" onclick={save}>Save a copy</button>
		</div>
		<p class="status" role="status">{status}</p>
	</header>

	<div class="tabs" role="tablist" aria-label="Write or preview">
		<button type="button" role="tab" aria-selected={tab === 'write'} onclick={() => (tab = 'write')}>Write</button>
		<button type="button" role="tab" aria-selected={tab === 'preview'} onclick={() => (settle(), (tab = 'preview'))}>Preview</button>
	</div>

	{#if loadError}<p class="problem">Couldn’t load the tour’s data: {loadError}</p>{/if}

	<div class="panes">
		<section class="write" class:shown={tab === 'write'} aria-label="Write">
			<label class="field">
				<span>Title</span>
				<input bind:value={s.title} placeholder="Up and over Honister" />
			</label>
			<div class="row">
				<label class="field grow">
					<span>Day</span>
					<select bind:value={s.date}>
						{#each days as d (d.day)}<option value={d.day}>{dayLabel(d)}</option>{/each}
					</select>
				</label>
				<label class="field">
					<span>Time</span>
					<input type="time" bind:value={s.clock} />
				</label>
			</div>
			<div class="row">
				<div class="field grow">
					<span>Cover photo</span>
					<div class="cover">
						{#if coverPhoto}<img src={photoSrc('thumb', coverPhoto.id)} alt="" />{/if}
						<button type="button" class="pill small" onclick={() => (picking = picking === 'cover' ? null : 'cover')}>{s.cover ? 'Change' : 'Choose'}</button>
						{#if s.cover}<button type="button" class="pill small" onclick={() => (s.cover = '')}>Remove</button>{/if}
					</div>
				</div>
				<label class="field check">
					<input type="checkbox" bind:checked={s.draft} />
					<span>Draft</span>
				</label>
			</div>
			<label class="field">
				<span>Address <small>(the story’s page: /blog/{s.date}/{s.slug || '…'})</small></span>
				<input bind:value={s.slug} oninput={() => (s.slugEdited = true)} spellcheck="false" />
			</label>

			<div class="toolbar" role="toolbar" aria-label="Formatting">
				<button type="button" onclick={() => wrap('**', 'bold')} aria-label="Bold"><b>B</b></button>
				<button type="button" onclick={() => wrap('*', 'italic')} aria-label="Italic"><i>I</i></button>
				<button type="button" onclick={() => lines('## ', 'Heading')} aria-label="Heading">H</button>
				<button type="button" onclick={() => lines('> ', 'A quote')} aria-label="Quote">❝</button>
				<button type="button" onclick={() => lines('- ', 'A point')} aria-label="List">•</button>
				<button type="button" onclick={link} aria-label="Link">🔗</button>
				<button type="button" class="photo" onclick={() => (picking = picking === 'embed' ? null : 'embed')} aria-expanded={picking === 'embed'}>＋ Photo</button>
			</div>

			{#if picking}
				<div class="picker">
					<p>
						{picking === 'cover' ? 'Choose the cover' : 'Add a photo where the cursor is'} · {dayPhotos.length} photos on this day
						<button type="button" class="pill small" onclick={() => (picking = null)}>Close</button>
					</p>
					<ul>
						{#each dayPhotos as p (p.id)}
							<li>
								<button type="button" onclick={() => pick(p)} aria-label="Photo at {clockOf(p.t)}">
									<img src={photoSrc('thumb', p.id)} alt="" loading="lazy" />
									<span>{clockOf(p.t)}</span>
								</button>
							</li>
						{:else}
							<li class="none">No photos on this day.</li>
						{/each}
					</ul>
				</div>
			{/if}

			<textarea bind:this={area} oninput={typed} onblur={settle} placeholder="Write the story in Markdown…" aria-label="The story, in Markdown" spellcheck="true"></textarea>

			{#if problems.length}
				<ul class="notes" aria-label="Before it’s ready">
					{#each problems as p (p)}<li>{p}</li>{/each}
				</ul>
			{/if}
			<details class="source" bind:open={showFile}>
				<summary>The file it saves</summary>
				{#if showFile}<pre>{file}</pre>{/if}
			</details>
		</section>

		<section class="preview" class:shown={tab === 'preview'} aria-label="Preview, as it will read in the blog">
			<div class="page blog-palette">
				{#if !previewing}
					<!-- not on screen (the Write tab on a phone): not rendered -->
				{:else if day && Number.isFinite(t)}
					<StoryArticle
						preview
						post={{ slug: s.slug, title: s.title || 'Untitled story', t, html: rendered.html, minutes: minutesOf(text) }}
						cover={coverPhoto ? { id: coverPhoto.id, w: coverPhoto.w, h: coverPhoto.h } : null}
						day={{ day: day.day, index: day.index, title: day.title }}
						dayCount={days.length}
						{where}
						place={spot?.place ?? null}
					/>
					{#if text}<p class="excerpt"><b>In the day’s timeline:</b> {excerptOf(text)}</p>{/if}
				{:else}
					<p class="empty">Pick a day and a time to see the story where it happened.</p>
				{/if}
			</div>
		</section>
	</div>
</div>

<style>
	.editor {
		min-height: 100vh;
		box-sizing: border-box;
		padding: 16px;
		background: linear-gradient(to bottom, #cfe6f5 0, #e6f1f6 14rem, #fbf6ec 30rem) no-repeat, #fbf6ec;
		color: var(--text);
		font-family: var(--font-ui);
	}
	.editor.dragging {
		outline: 4px dashed var(--accent);
		outline-offset: -8px;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		max-width: 96rem;
		margin: 0 auto 12px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 20px;
	}
	.brand h1 {
		margin: 0;
		font-size: 24px;
	}
	.brand p {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pill {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 42px;
		padding: 0 16px;
		border: 0;
		border-radius: 999px;
		background: var(--card);
		color: var(--text);
		font: inherit;
		font-weight: 650;
		font-size: 14px;
		cursor: pointer;
		box-shadow:
			var(--press),
			0 0 0 1px var(--line);
	}
	.pill.go {
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 3px 0 color-mix(in srgb, var(--accent) 55%, #000);
	}
	.pill.small {
		min-height: 32px;
		padding: 0 12px;
		font-size: 13px;
	}
	.pill input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.status {
		flex-basis: 100%;
		margin: 0;
		min-height: 1.2em;
		font-size: 13px;
		color: var(--muted);
		text-align: right;
	}
	.tabs {
		display: none;
	}
	.panes {
		display: grid;
		grid-template-columns: minmax(0, 34rem) minmax(0, 1fr);
		gap: 20px;
		max-width: 96rem;
		margin: 0 auto;
		align-items: start;
	}
	.write {
		/* typing changes nothing outside the panel: the browser needn't re-lay out the page */
		contain: layout style;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px;
		border-radius: 24px;
		background: var(--glass);
		box-shadow: var(--shadow);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
		font-weight: 650;
	}
	.field small {
		font-weight: 400;
		color: var(--muted);
	}
	.field input:not([type='checkbox']),
	.field select {
		min-height: 42px;
		padding: 0 12px;
		border: 0;
		border-radius: 12px;
		background: var(--card);
		box-shadow: 0 0 0 1px var(--line);
		color: var(--text);
		font: inherit;
		font-weight: 500;
		font-size: 15px;
	}
	.row {
		display: flex;
		gap: 12px;
		align-items: end;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.check {
		flex-direction: row;
		align-items: center;
		gap: 8px;
		min-height: 42px;
	}
	.check input {
		width: 20px;
		height: 20px;
		accent-color: var(--accent);
	}
	.cover {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 42px;
	}
	.cover img {
		width: 56px;
		height: 42px;
		object-fit: cover;
		border-radius: 10px;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.toolbar button {
		min-width: 40px;
		min-height: 40px;
		padding: 0 10px;
		border: 0;
		border-radius: 12px;
		background: var(--card);
		box-shadow: 0 0 0 1px var(--line);
		color: var(--text);
		font: inherit;
		font-size: 15px;
		cursor: pointer;
	}
	.toolbar button:hover {
		background: var(--accent-soft);
	}
	.toolbar .photo {
		margin-left: auto;
		font-weight: 650;
	}
	.picker {
		padding: 10px;
		border-radius: 16px;
		background: var(--card);
		box-shadow: 0 0 0 1px var(--line);
	}
	.picker p {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 0 0 8px;
		font-size: 13px;
		font-weight: 650;
	}
	.picker ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
		gap: 6px;
		max-height: 260px;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}
	.picker li button {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 11px;
		cursor: pointer;
	}
	.picker img {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 10px;
	}
	.picker li button:hover img {
		outline: 3px solid var(--accent);
	}
	.picker .none {
		grid-column: 1 / -1;
		font-size: 13px;
		color: var(--muted);
	}
	textarea {
		min-height: 22rem;
		padding: 14px;
		border: 0;
		border-radius: 16px;
		background: var(--card);
		box-shadow: 0 0 0 1px var(--line);
		color: var(--text);
		font: 15px/1.6 ui-monospace, 'Cascadia Code', Consolas, monospace;
		resize: vertical;
	}
	.notes {
		margin: 0;
		padding: 10px 12px 10px 28px;
		border-radius: 14px;
		background: var(--butter);
		color: var(--butter-ink);
		font-size: 13px;
		line-height: 1.5;
	}
	.problem {
		max-width: 96rem;
		margin: 0 auto 12px;
		padding: 10px 14px;
		border-radius: 14px;
		background: var(--accent-soft);
		color: var(--accent-ink);
	}
	.source summary {
		cursor: pointer;
		font-size: 13px;
		font-weight: 650;
		color: var(--muted);
	}
	.source pre {
		margin: 8px 0 0;
		padding: 12px;
		border-radius: 12px;
		background: var(--card);
		box-shadow: 0 0 0 1px var(--line);
		font-size: 12px;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.preview {
		contain: layout style;
		position: sticky;
		top: 16px;
		max-height: calc(100vh - 32px);
		overflow-y: auto;
		border-radius: 24px;
		background: var(--paper);
		box-shadow: var(--shadow);
	}
	.page {
		max-width: 46rem;
		margin: 0 auto;
		padding: 24px 20px 32px;
	}
	.excerpt,
	.empty {
		margin-top: 2rem;
		padding: 12px 14px;
		border-radius: 14px;
		background: var(--sky);
		color: var(--sky-ink);
		font-size: 14px;
	}
	/* phones: one pane at a time */
	@media (max-width: 900px) {
		.editor {
			padding: 12px;
		}
		.actions {
			width: 100%;
		}
		.tabs {
			display: flex;
			gap: 4px;
			margin: 0 0 12px;
			padding: 4px;
			border-radius: 999px;
			background: var(--glass);
			box-shadow:
				var(--press),
				0 0 0 1px var(--line);
		}
		.tabs button {
			flex: 1;
			min-height: 40px;
			border: 0;
			border-radius: 999px;
			background: none;
			color: var(--muted);
			font: inherit;
			font-weight: 650;
		}
		.tabs button[aria-selected='true'] {
			background: var(--ink);
			color: var(--paper);
		}
		.panes {
			display: block;
		}
		.write,
		.preview {
			display: none;
		}
		.write.shown,
		.preview.shown {
			display: flex;
		}
		.preview.shown {
			display: block;
			position: static;
			max-height: none;
		}
	}
</style>
