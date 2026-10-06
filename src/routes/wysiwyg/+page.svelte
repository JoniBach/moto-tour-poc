<!--
  The story editor (/wysiwyg): write a story for the tour on the move, straight onto the page as
  it will read in the blog. The page is the story page itself (StoryArticle): type the title into
  its heading and the story into its text, format with the toolbar (it floats above the keyboard),
  add the day's photos with their captions, tap the cover to choose it. Day, time, address and
  draft are in the settings drawer, with the Markdown it saves. Nothing leaves the device: open
  an existing .md, edit, and "Save a copy" downloads a new timestamped file; the draft also stays
  in this browser between visits. "Share link" puts the whole story in a link (#story=…) that
  opens it in the editor on another device. Not linked from anywhere, and not indexed.

  The story is a Tiptap (ProseMirror) document, read from and written to the story's Markdown
  (src/lib/editor/storyEditor.ts), and only offers what the blog publishes.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import { TOUR, photoSrc } from '$lib/tourConfig';
	import { clock, loadDay, loadFeed, loadPhotos, loadPlaces, loadTourIndex, bisect, type FeedDay, type Photo as TourPhoto, type TourData, type TourIndex } from '$lib/data';
	import { ukToEpoch } from '$lib/moment';
	import { excerptOf, frontmatter, minutesOf, plainText, slugFor, storyFile } from '$lib/story.js';
	import { sketch } from '$lib/sketch';
	import StoryArticle from '$lib/blog/StoryArticle.svelte';
	import Photo from '$lib/blog/Photo.svelte';
	import { createStoryEditor, insertFigure, insertPhoto, photoIds, softBreaks } from '$lib/editor/storyEditor';
	import { MAP_ZOOM } from '$lib/story.js';
	import { readShared, shareLink } from '$lib/editor/shareLink';
	import { findMentions, linkMention, placeFinder, rescan, visitFor, type Mention } from '$lib/editor/places';

	// ---- the tour's published data ------------------------------------------------------------
	let days = $state.raw<FeedDay[]>([]);
	let photos = $state.raw<TourPhoto[]>([]);
	let index = $state.raw<TourIndex | null>(null);
	let loadError = $state<string | null>(null);
	onMount(() => {
		Promise.all([loadFeed(), loadPhotos(), loadTourIndex()])
			.then(([f, p, i]) => ((days = f.days), (photos = p), (index = i)))
			.catch((e) => (loadError = String(e)));
	});
	const byId = $derived(new Map(photos.map((p) => [p.id, p])));

	// ---- places: mentions of places on the route, linked to the moment the ride was there ----------
	let finder = placeFinder([]);
	let placesReady = $state(false);
	onMount(() => {
		loadPlaces().then((list) => {
			finder = placeFinder(list);
			placesReady = true;
			if (editor) {
				rescan(editor.view);
				unlinked = findMentions(editor.state.doc, finder).length;
			}
		});
	});

	// ---- the story being written (kept in this browser between visits) ---------------------------
	const KEY = `gt-story-editor:${TOUR.id}`;
	/** when: during the trip (at a moment of a day's ride), or before / after it (pinned to its start / end, with an optional date: on) */
	type When = 'before' | 'during' | 'after';
	type Draft = { title: string; when: When; date: string; clock: string; on: string; cover: string; slug: string; slugEdited: boolean; draft: boolean; body: string };
	const blank = (): Draft => ({ title: '', when: 'during', date: '', clock: '12:00', on: '', cover: '', slug: '', slugEdited: false, draft: false, body: '' });
	let s = $state<Draft>(blank());
	let restored = $state(false);
	onMount(() => {
		try {
			const saved = localStorage.getItem(KEY);
			if (saved) s = { ...blank(), ...JSON.parse(saved) };
		} catch {
			/* private mode or storage off: start blank */
		}
		restored = true;
		arrive(); // a shared story in the link replaces it (after asking)
	});
	let saved = $state(false);
	function persist() {
		if (!restored) return;
		try {
			localStorage.setItem(KEY, JSON.stringify({ ...s, body: latest() }));
			saved = true;
		} catch {
			/* storage full or off: the draft just won't survive a reload */
		}
	}
	// kept a moment after a change settles (and when the page is hidden or left)
	$effect(() => {
		JSON.stringify(s); // every field
		if (!restored) return;
		saved = false;
		const id = setTimeout(persist, 500);
		return () => clearTimeout(id);
	});
	// the first day by default, once the days are in
	$effect(() => {
		if (restored && !s.date && days.length) s.date = days[0].day;
	});
	// the address follows the date and title until it's edited by hand
	$effect(() => {
		if (!s.slugEdited) s.slug = slugFor(s.date, s.title);
	});

	// ---- where the story sits -------------------------------------------------------------------
	const day = $derived(days.find((d) => d.day === s.date));
	// before the trip: where it set off (the first day's start); after: where it ended (the last day's end)
	const t = $derived(
		s.when === 'before'
			? (days[0]?.start ?? NaN)
			: s.when === 'after'
				? (days.at(-1)?.end ?? NaN)
				: s.date && /^\d{1,2}:\d{2}$/.test(s.clock)
					? ukToEpoch(s.date, s.clock)
					: NaN
	);
	/** switching between before, during and after: before and after belong to the first and last day */
	function setWhen(w: When) {
		s.when = w;
		if (w === 'before' && days.length) s.date = days[0].day;
		if (w === 'after' && days.length) s.date = days.at(-1)!.day;
	}
	// before / after opened before the days were in (a shared link, a saved draft): their day, once known
	$effect(() => {
		if (!days.length) return;
		if (s.when === 'before' && s.date !== days[0].day) s.date = days[0].day;
		if (s.when === 'after' && s.date !== days.at(-1)!.day) s.date = days.at(-1)!.day;
	});
	/** a before / after story's own date, shown on its page (epoch seconds), if it has one */
	const onDate = $derived(s.when !== 'during' && /^\d{4}-\d{2}-\d{2}$/.test(s.on) ? ukToEpoch(s.on, '12:00') : undefined);
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

	// ---- the story's text: the editor ------------------------------------------------------------
	// Typing touches nothing else: the Markdown (s.body, and with it the saved draft, the reading
	// time and the notes) catches up once typing settles.
	const SETTLE_MS = 600;
	let editor = $state.raw<Editor | null>(null);
	let settling: ReturnType<typeof setTimeout> | undefined;
	/** the photos in the story, as of the last settle */
	let embedded = $state<string[]>([]);
	/** the story's Markdown right now */
	const latest = () => editor?.getMarkdown() ?? s.body;
	function settle() {
		clearTimeout(settling);
		if (!editor) return;
		const md = editor.getMarkdown();
		if (md !== s.body) s.body = md;
		embedded = photoIds(editor);
		unlinked = findMentions(editor.state.doc, finder).length;
	}
	/** place mentions not linked yet (the toolbar's "Link places"), as of the last settle */
	let unlinked = $state(0);
	// toolbar state, at most once a frame
	let active = $state({ bold: false, italic: false, h2: false, h3: false, quote: false, bullets: false, numbers: false, link: false });
	let frame = 0;
	function selectionMoved() {
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			const e = editor;
			if (!e) return;
			active = {
				bold: e.isActive('bold'),
				italic: e.isActive('italic'),
				h2: e.isActive('heading', { level: 2 }),
				h3: e.isActive('heading', { level: 3 }),
				quote: e.isActive('blockquote'),
				bullets: e.isActive('bulletList'),
				numbers: e.isActive('orderedList'),
				link: e.isActive('link')
			};
		});
	}
	/** mounts the editor on the story page's own text element (StoryArticle's .prose) */
	const prose = (el: HTMLElement) => {
		const e = createStoryEditor({
			el,
			markdown: untrack(() => s.body),
			photoSrc: (id) => photoSrc('large', id),
			photoKnown: (id) => byId.has(id),
			onChange: () => {
				chip = null;
				clearTimeout(settling);
				settling = setTimeout(settle, SETTLE_MS);
				selectionMoved();
			},
			// the cursor moved off the mention: the offer goes (moves within it, as a tap makes, keep it)
			onSelection: () => {
				const at = e.state.selection.from;
				if (chip && (at < chip.m.from || at > chip.m.to)) chip = null;
				selectionMoved();
			},
			findPlaces: (text) => finder(text),
			onPlace: (m, view) => {
				const at = view.coordsAtPos(m.from);
				chip = { m, x: at.left, y: at.bottom };
			}
		});
		editor = e;
		embedded = photoIds(e);
		unlinked = findMentions(e.state.doc, finder).length;
		return () => {
			settle();
			editor = null;
			e.destroy();
		};
	};
	/** put Markdown into the story (an opened file, a new story) */
	function setBody(md: string) {
		s.body = md;
		if (!editor) return;
		editor.commands.setContent(md, { contentType: 'markdown' });
		softBreaks(editor);
		embedded = photoIds(editor);
	}

	// formatting (buttons keep the story's focus and selection: no keyboard flicker on iPad)
	const keep = (e: Event) => e.preventDefault();
	const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => editor && fn(editor.chain().focus()).run();
	function link() {
		if (!editor) return;
		const was = editor.getAttributes('link').href as string | undefined;
		const url = prompt('Link to (leave empty to remove the link)', was ?? 'https://');
		if (url === null) return;
		if (!url.trim() || url.trim() === 'https://') run((c) => c.extendMarkRange('link').unsetLink());
		else run((c) => c.extendMarkRange('link').setLink({ href: url.trim() }));
	}

	// the toolbar floats just above the on-screen keyboard (or the bottom of the window without one)
	let keyboard = $state(0);
	onMount(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const place = () => (keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
		vv.addEventListener('resize', place);
		vv.addEventListener('scroll', place);
		return () => {
			vv.removeEventListener('resize', place);
			vv.removeEventListener('scroll', place);
		};
	});

	// ---- the title: typed into the page's heading ---------------------------------------------------
	let titleEl = $state<HTMLElement>();
	const titleAttach = (el: HTMLElement) => {
		titleEl = el;
		el.textContent = untrack(() => s.title);
		return () => (titleEl = undefined);
	};
	// a title from elsewhere (the saved draft, an opened file, "New") into the heading
	$effect(() => {
		const title = s.title;
		if (titleEl && titleEl.textContent !== title) titleEl.textContent = title;
	});
	function titleTyped(e: Event) {
		const el = e.currentTarget as HTMLElement;
		const text = (el.textContent ?? '').replace(/\s*\n\s*/g, ' ');
		if (!text.trim()) el.textContent = ''; // empty again: the placeholder shows
		s.title = text;
	}
	function titleKey(e: KeyboardEvent) {
		// Enter: on to the story
		if (e.key === 'Enter' && editor) {
			e.preventDefault();
			// straight away, so the next letters typed land in the story, not the title
			editor.view.focus();
			editor.commands.setTextSelection(1);
		}
	}

	/** the offer to link a tapped mention, under it */
	let chip = $state<{ m: Mention; x: number; y: number } | null>(null);
	const moment = (v: [string, number]) => {
		const d = days.find((x) => x.day === v[0]);
		return `${d ? `Day ${d.index + 1}` : v[0]} · ${clock(v[1])}`;
	};
	function linkChip() {
		if (!editor || !chip) return;
		linkMention(editor, chip.m, visitFor(chip.m.place, s.date), clock);
		chip = null;
	}
	/** every mention not linked yet (for the settings drawer), as of when it opened */
	let mentions = $state<Mention[]>([]);
	function linkAll() {
		if (!editor) return;
		const all = findMentions(editor.state.doc, finder);
		// the last first, so nothing moves under the ones still to do
		for (const m of all.reverse()) linkMention(editor, m, visitFor(m.place, s.date), clock);
		mentions = [];
		unlinked = 0;
		chip = null;
		status = all.length ? `Linked ${all.length === 1 ? '1 place' : `${all.length} places`} to the ride` : 'No places to link';
	}
	// the story moved to another day: which visits are offered changes
	$effect(() => {
		void s.date;
		if (editor) untrack(() => rescan(editor!.view));
	});

	// ---- the notes: what's missing before it's ready -----------------------------------------------
	const coverPhoto = $derived(s.cover ? byId.get(s.cover) : undefined);
	const text = $derived(plainText(s.body));
	const problems = $derived.by(() => {
		const out: string[] = [];
		if (!s.title.trim()) out.push('Give it a title.');
		if (!day) out.push('Pick a day of the tour.');
		else if (s.when === 'during' && !Number.isFinite(t)) out.push('Set the time (hh:mm, the tour’s local time).');
		else if (spot && !spot.inRide) out.push('That time is outside the day’s riding: it’ll be pinned to the nearest end of the ride.');
		if (s.cover && !coverPhoto) out.push(`The cover photo ${s.cover} isn’t in the tour.`);
		for (const id of embedded) if (!byId.has(id)) out.push(`Photo ${id} isn’t in the tour (or is kept private): it won’t show.`);
		if (s.draft) out.push('Marked as a draft: the file name starts with “_”, and the build skips it.');
		return out;
	});

	// ---- photos: the picker, for the story or the cover ---------------------------------------------
	// ---- the picker: any day's photos, or the 2D map at a moment ------------------------------------
	let picking = $state<'embed' | 'cover' | null>(null);
	/** photos or the map (the cover is always a photo) */
	let pickKind = $state<'photos' | 'map'>('photos');
	/** whose photos (or map) it shows: the story's day to start with */
	let pickDay = $state('');
	let mapTime = $state('12:00');
	let mapZoom = $state(MAP_ZOOM);
	/** a moment of a day, a stretch of it, or the whole journey (with the chosen day picked out, if asked) */
	let mapKind = $state<'moment' | 'stretch' | 'whole'>('moment');
	let mapPick = $state(true);
	let mapEnd = $state('12:30');
	const pickedShot = () =>
		mapKind === 'whole'
			? { whole: true, day: mapPick ? pickDay : '', time: '', zoom: MAP_ZOOM, end: '' }
			: mapKind === 'stretch'
				? { day: pickDay, time: mapTime, zoom: MAP_ZOOM, whole: false, end: mapEnd }
				: { day: pickDay, time: mapTime, zoom: mapZoom, whole: false, end: '' };
	const ZOOMS = [
		{ zoom: 14, label: 'Close up' },
		{ zoom: MAP_ZOOM, label: 'Around' },
		{ zoom: 10, label: 'The area' }
	];
	function openPicker(kind: 'embed' | 'cover') {
		picking = kind;
		pickDay = s.date;
		if (kind === 'cover') pickKind = 'photos';
		mapTime = /^\d{1,2}:\d{2}$/.test(s.clock) ? s.clock.padStart(5, '0') : '12:00';
		// a stretch: half an hour on, to start with
		const [h, m] = mapTime.split(':').map(Number);
		mapEnd = `${String(Math.min(23, h + (m >= 30 ? 1 : 0))).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`;
	}
	const dayPhotos = $derived(photos.filter((p) => p.day === pickDay).sort((a, b) => a.t - b.t));
	const shortDay = (d: FeedDay) =>
		`Day ${d.index + 1} · ${new Date(d.start * 1000).toLocaleDateString(TOUR.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TOUR.timeZone })}`;
	/** the map tab's preview: the snapshot as it will be added (redrawn as the moment or zoom change) */
	const mapPreview = (el: HTMLElement) => {
		const shot = pickedShot();
		if (!shot.whole && (!shot.day || !/^\d{2}:\d{2}$/.test(shot.time) || (shot.end !== '' && !/^\d{2}:\d{2}$/.test(shot.end)))) return;
		const stop = new AbortController();
		el.textContent = 'Drawing the map…';
		import('$lib/map/mapShot')
			.then(({ drawShot }) => drawShot(el, shot, stop.signal))
			.catch(() => !stop.signal.aborted && (el.textContent = 'The map couldn’t load'));
		return () => stop.abort();
	};
	function addMap() {
		if (editor) insertFigure(editor, 'mapShot', pickedShot());
		picking = null;
	}
	const clockOf = (sec: number) =>
		new Date(sec * 1000).toLocaleTimeString(TOUR.locale, { hour: '2-digit', minute: '2-digit', timeZone: TOUR.timeZone });
	function pick(p: TourPhoto) {
		if (picking === 'cover') s.cover = p.id;
		else if (editor) insertPhoto(editor, p.id);
		picking = null;
	}

	// ---- files: open one from the device, save a new timestamped copy, copy the Markdown -------------
	let status = $state('');
	const fileOf = () =>
		storyFile(
			{ title: s.title, when: s.when === 'during' ? '' : s.when, time: s.when === 'during' ? `${s.date} ${s.clock}` : s.on, cover: s.cover, slug: s.slug },
			latest()
		);
	function open(file: string, name: string) {
		const { data, body } = frontmatter(file);
		const [date = '', clock = '12:00'] = (data.time ?? '').split(/[ T]/);
		const when: When = data.when === 'before' || data.when === 'after' ? data.when : 'during';
		s = {
			title: data.title ?? '',
			when,
			// before / after: the first / last day; the time line is the story's own date, if any
			date: when === 'before' ? (days[0]?.day ?? date) : when === 'after' ? (days.at(-1)?.day ?? date) : date,
			clock: when === 'during' ? clock.slice(0, 5) : '12:00',
			on: when === 'during' ? '' : date,
			cover: data.cover ?? '',
			slug: data.slug ?? name.replace(/^_/, '').replace(/\.md$/i, '').replace(/\s*\(saved [^)]*\)$/, ''),
			slugEdited: true,
			draft: name.startsWith('_'),
			body: ''
		};
		setBody(body.replace(/^\n+/, ''));
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
		const url = URL.createObjectURL(new Blob([fileOf()], { type: 'text/markdown' }));
		const a = Object.assign(document.createElement('a'), { href: url, download: name });
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		status = `Saved ${name}`;
	}
	async function copy() {
		try {
			await navigator.clipboard.writeText(fileOf());
			status = 'Copied the Markdown';
		} catch {
			status = 'Couldn’t copy: your browser blocked it';
		}
	}
	// ---- share: the whole story in a link (src/lib/editor/shareLink.ts) -----------------------------
	async function share() {
		settle();
		const url = await shareLink({ file: fileOf(), draft: s.draft }, location.href);
		if (navigator.share) {
			try {
				await navigator.share({ title: s.title || 'A story', url });
				status = 'Shared a link to this story';
				return;
			} catch (e) {
				if ((e as Error).name === 'AbortError') return; // closed the share sheet
			}
		}
		try {
			await navigator.clipboard.writeText(url);
			status = `Copied a link to this story (${(url.length / 1024).toFixed(1)} KB)`;
		} catch {
			status = 'Couldn’t copy the link: your browser blocked it';
		}
	}
	/** a story arriving in the link (on load, or a link pasted into this tab) */
	async function arrive() {
		let shared;
		try {
			shared = await readShared(location.hash);
		} catch (e) {
			status = `Couldn’t open the shared story: ${(e as Error).message}`;
		}
		if (shared === undefined) return;
		// the story is in the editor now (or declined): out of the address bar either way
		history.replaceState(history.state, '', location.pathname + location.search);
		if (!shared) return;
		const mine = plainText(latest()).trim() && fileOf() !== shared.file;
		if (mine && !confirm('Open the shared story? It replaces the one you’re writing, which is only kept if you’ve saved a copy.')) return;
		const { data } = frontmatter(shared.file);
		open(shared.file, `${shared.draft ? '_' : ''}${data.slug || 'story'}.md`);
		status = 'Opened a shared story';
	}
	onMount(() => {
		addEventListener('hashchange', arrive);
		return () => removeEventListener('hashchange', arrive);
	});

	function fresh() {
		if (plainText(latest()).trim() && !confirm('Start a new story? The current one is only kept if you’ve saved a copy.')) return;
		s = { ...blank(), date: days[0]?.day ?? '' };
		setBody('');
		status = 'New story';
		titleEl?.focus();
	}

	// ---- the settings drawer --------------------------------------------------------------------
	let settings = $state(false);
	let markdown = $state<string | null>(null);
	let dragging = $state(false);
	const dayLabel = (d: FeedDay) =>
		`Day ${d.index + 1} · ${new Date(d.start * 1000).toLocaleDateString(TOUR.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TOUR.timeZone })} · ${d.title}`;
	const ready = $derived(!!index && days.length > 0 && restored);
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

<div class="editor blog-palette" class:dragging>
	<header class="bar">
		<div class="brand">
			<span class="mark" aria-hidden="true">✎</span>
			<div>
				<h1 class="pc-display">Story editor</h1>
				<p role="status">{status || (saved ? 'Saved on this device' : ' ')}</p>
			</div>
		</div>
		<div class="actions">
			<button type="button" class="pill" onclick={() => ((mentions = editor ? findMentions(editor.state.doc, finder) : []), (settings = true))} aria-haspopup="dialog">
				Story settings{#if problems.length}<span class="count" aria-label="{problems.length} notes">{problems.length}</span>{/if}
			</button>
			<label class="pill">
				Open .md
				<input type="file" accept=".md,.markdown,text/markdown,text/plain" onchange={(e) => openFile((e.currentTarget as HTMLInputElement).files?.[0])} />
			</label>
			<button type="button" class="pill" onclick={fresh}>New</button>
			<button type="button" class="pill" onclick={share}>Share link</button>
			<button type="button" class="pill" onclick={copy}>Copy Markdown</button>
			<button type="button" class="pill go" onclick={save}>Save a copy</button>
		</div>
	</header>

	{#if loadError}<p class="problem">Couldn’t load the tour’s data: {loadError}</p>{/if}

	<main class="page">
		{#if ready && day}
			<StoryArticle
				preview
				post={{
					slug: s.slug,
					title: s.title || 'Untitled story',
					t: Number.isFinite(t) ? t : day.start,
					html: '',
					minutes: minutesOf(text),
					when: s.when === 'during' ? undefined : s.when,
					date: onDate
				}}
				cover={null}
				day={{ day: day.day, index: day.index, title: day.title }}
				dayCount={days.length}
				{where}
				place={spot?.place ?? null}
				{titleSlot}
				{coverSlot}
				{prose}
			/>
		{:else if !loadError}
			<p class="loading">Getting the tour’s days and photos…</p>
		{/if}
	</main>
</div>

{#snippet titleSlot()}
	<span
		class="title-edit"
		contenteditable="plaintext-only"
		role="textbox"
		tabindex="0"
		aria-label="Title"
		data-placeholder="Give it a title"
		spellcheck="true"
		{@attach titleAttach}
		oninput={titleTyped}
		onkeydown={titleKey}
	></span>
{/snippet}

{#snippet coverSlot()}
	{#if coverPhoto}
		<button type="button" class="cover-pick" onclick={() => openPicker('cover')} aria-label="Change the cover photo">
			<Photo class="cover" id={coverPhoto.id} size={[coverPhoto.w, coverPhoto.h]} alt="" sizes="(max-width: 46rem) 100vw, 46rem" priority />
			<span class="cover-hint">Change the cover</span>
		</button>
	{:else}
		<button type="button" class="cover-add" onclick={() => openPicker('cover')}>＋ Add a cover photo</button>
	{/if}
{/snippet}

<!-- a tapped place mention: link it to the moment the ride was there -->
{#if chip}
	<div class="place-chip" style:left="{Math.min(chip.x, innerWidth - 300)}px" style:top="{chip.y + 6}px" role="dialog" aria-label="Link this place">
		<button type="button" class="pill small go" onmousedown={keep} onclick={linkChip}>
			Link to {moment(visitFor(chip.m.place, s.date))}{chip.m.place.kind === 'park' ? ` in the ${chip.m.place.name}` : ''}
		</button>
		<button type="button" class="pill small" onmousedown={keep} onclick={() => (chip = null)} aria-label="Not this">×</button>
	</div>
{/if}

<!-- formatting: floats above the on-screen keyboard -->
{#if editor}
	<div class="toolbar" role="toolbar" aria-label="Formatting" style:bottom="{keyboard + 12}px">
		<button type="button" onmousedown={keep} onclick={() => run((c) => c.toggleBold())} aria-pressed={active.bold} aria-label="Bold"><b>B</b></button>
		<button type="button" onmousedown={keep} onclick={() => run((c) => c.toggleItalic())} aria-pressed={active.italic} aria-label="Italic"><i>I</i></button>
		<button type="button" onmousedown={keep} onclick={() => run((c) => c.toggleHeading({ level: 2 }))} aria-pressed={active.h2} aria-label="Heading">H</button>
		<button type="button" onmousedown={keep} onclick={() => run((c) => c.toggleHeading({ level: 3 }))} aria-pressed={active.h3} aria-label="Small heading" class="small">h</button>
		<button type="button" onmousedown={keep} onclick={() => run((c) => c.toggleBlockquote())} aria-pressed={active.quote} aria-label="Quote">❝</button>
		<button type="button" onmousedown={keep} onclick={() => run((c) => c.toggleBulletList())} aria-pressed={active.bullets} aria-label="Bullet list">•</button>
		<button type="button" onmousedown={keep} onclick={() => run((c) => c.toggleOrderedList())} aria-pressed={active.numbers} aria-label="Numbered list">1.</button>
		<button type="button" onmousedown={keep} onclick={link} aria-pressed={active.link} aria-label="Link">🔗</button>
		<span class="sep" aria-hidden="true"></span>
		<button
			type="button"
			class="places-btn"
			onmousedown={keep}
			onclick={linkAll}
			disabled={!unlinked}
			title={unlinked ? 'Link every place mentioned to the moment the ride was there' : 'No places to link'}
			aria-label="Link places{unlinked ? `: ${unlinked}` : ''}"
			><span aria-hidden="true">📍</span><span class="label"> Link places</span>{#if unlinked}<span class="n">{unlinked}</span>{/if}</button
		>
		<button type="button" class="photo" onmousedown={keep} onclick={() => openPicker('embed')} aria-label="Add a photo or map">＋<span class="label"> Photo or map</span></button>
	</div>
{/if}

<!-- any day's photos (for the story at the cursor, or the cover), or the 2D map at a moment -->
{#if picking}
	<div class="scrim" onclick={() => (picking = null)} aria-hidden="true"></div>
	<div class="sheet picker" role="dialog" aria-modal="true" aria-label={picking === 'cover' ? 'Choose the cover' : 'Add a photo or a map'}>
		<p class="sheet-head">
			<b>{picking === 'cover' ? 'Choose the cover' : 'Add where the cursor is'}</b>
			<span>
				{#if picking === 'cover' && s.cover}<button type="button" class="pill small" onclick={() => ((s.cover = ''), (picking = null))}>Remove the cover</button>{/if}
				<button type="button" class="pill small" onclick={() => (picking = null)}>Close</button>
			</span>
		</p>
		<div class="pick-row">
			{#if picking === 'embed'}
				<div class="seg" role="tablist" aria-label="Photo or map">
					<button type="button" role="tab" aria-selected={pickKind === 'photos'} onclick={() => (pickKind = 'photos')}>Photos</button>
					<button type="button" role="tab" aria-selected={pickKind === 'map'} onclick={() => (pickKind = 'map')}>Map</button>
				</div>
			{/if}
			<select bind:value={pickDay} aria-label="Which day">
				{#each days as d (d.day)}<option value={d.day}>{shortDay(d)}{d.day === s.date ? ' (this story)' : ''}</option>{/each}
			</select>
		</div>
		{#if pickKind === 'map' && picking === 'embed'}
			<div class="map-pick">
				<div class="seg" role="radiogroup" aria-label="Which map">
					<button type="button" role="radio" aria-checked={mapKind === 'moment'} onclick={() => (mapKind = 'moment')}>A moment</button>
					<button type="button" role="radio" aria-checked={mapKind === 'stretch'} onclick={() => (mapKind = 'stretch')}>A stretch</button>
					<button type="button" role="radio" aria-checked={mapKind === 'whole'} onclick={() => (mapKind = 'whole')}>The whole journey</button>
				</div>
				<div class="pick-row">
					{#if mapKind === 'whole'}
						<label class="field check"><input type="checkbox" bind:checked={mapPick} /> <span>Pick out the day chosen above</span></label>
					{:else if mapKind === 'stretch'}
						<label class="field inline"><span>From</span> <input type="time" bind:value={mapTime} /></label>
						<label class="field inline"><span>to</span> <input type="time" bind:value={mapEnd} /></label>
					{:else}
						<label class="field inline"><span>At</span> <input type="time" bind:value={mapTime} /></label>
						<div class="seg" role="radiogroup" aria-label="Zoom">
							{#each ZOOMS as z (z.zoom)}
								<button type="button" role="radio" aria-checked={mapZoom === z.zoom} onclick={() => (mapZoom = z.zoom)}>{z.label}</button>
							{/each}
						</div>
					{/if}
				</div>
				<div class="map-preview" class:whole={mapKind === 'whole'} {@attach mapPreview}></div>
				<button type="button" class="pill go" onclick={addMap}>Add this map</button>
			</div>
		{:else}
		<p class="count-line">{dayPhotos.length} photos on this day</p>
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
		{/if}
	</div>
{/if}

<!-- story settings: when and where it goes, its address, draft, and the Markdown it saves -->
{#if settings}
	<div class="scrim" onclick={() => (settings = false)} aria-hidden="true"></div>
	<div class="sheet drawer" role="dialog" aria-modal="true" aria-label="Story settings">
		<p class="sheet-head"><b>Story settings</b> <button type="button" class="pill small" onclick={() => (settings = false)}>Done</button></p>
		<div class="field">
			<span>When</span>
			<div class="seg when" role="radiogroup" aria-label="When it's about">
				<button type="button" role="radio" aria-checked={s.when === 'before'} onclick={() => setWhen('before')}>Before the trip</button>
				<button type="button" role="radio" aria-checked={s.when === 'during'} onclick={() => setWhen('during')}>During</button>
				<button type="button" role="radio" aria-checked={s.when === 'after'} onclick={() => setWhen('after')}>After the trip</button>
			</div>
		</div>
		{#if s.when === 'during'}
			<label class="field">
				<span>Day</span>
				<select bind:value={s.date}>
					{#each days as d (d.day)}<option value={d.day}>{dayLabel(d)}</option>{/each}
				</select>
			</label>
			<label class="field">
				<span>Time <small>(the tour’s local time: the story goes where the bike was)</small></span>
				<input type="time" bind:value={s.clock} />
			</label>
		{:else}
			<p class="hint">
				{s.when === 'before' ? 'Pinned to where the journey set off, at the start of Day 1.' : `Pinned to where the journey ended, at the end of Day ${days.length}.`}
			</p>
			<label class="field">
				<span>Date <small>(optional: shown on the story)</small></span>
				<input type="date" bind:value={s.on} />
			</label>
		{/if}
		<label class="field">
			<span>Address <small>(/blog/{s.date}/{s.slug || '…'})</small></span>
			<input bind:value={s.slug} oninput={() => (s.slugEdited = true)} spellcheck="false" />
		</label>
		<label class="field check">
			<input type="checkbox" bind:checked={s.draft} />
			<span>Draft (not published yet)</span>
		</label>
		<div class="field">
			<span>Cover photo</span>
			<div class="row">
				<button type="button" class="pill small" onclick={() => ((settings = false), openPicker('cover'))}>{s.cover ? 'Change' : 'Choose'}</button>
				{#if s.cover}<button type="button" class="pill small" onclick={() => (s.cover = '')}>Remove</button>{/if}
			</div>
		</div>
		{#if problems.length}
			<ul class="notes" aria-label="Before it’s ready">
				{#each problems as p (p)}<li>{p}</li>{/each}
			</ul>
		{/if}
		{#if mentions.length}
			<div class="places">
				<p><b>Places mentioned</b>: link each to the moment the ride was there</p>
				<ul>
					{#each mentions as m (m.from)}
						<li><span class="m">{m.text}</span> → {moment(visitFor(m.place, s.date))}</li>
					{/each}
				</ul>
				<button type="button" class="pill small go" onclick={linkAll}>Link all {mentions.length}</button>
			</div>
		{:else if placesReady && editor}
			<p class="hint">Places on the route you mention (the Lakes, Keswick, Honister…) get a dotted underline: tap one to link it to the moment you were there.</p>
		{/if}
		{#if text}<p class="excerpt"><b>In the day’s timeline:</b> {excerptOf(text)}</p>{/if}
		<details class="source" ontoggle={(e) => (markdown = (e.currentTarget as HTMLDetailsElement).open ? fileOf() : null)}>
			<summary>View the Markdown it saves</summary>
			{#if markdown !== null}<pre>{markdown}</pre>{/if}
		</details>
	</div>
{/if}

<style>
	.editor {
		min-height: 100vh;
		box-sizing: border-box;
		/* room for the floating toolbar under the story */
		padding: 16px 16px 120px;
		background: var(--pc-paper);
		color: var(--pc-ink);
		font-family: var(--pc-font-ui);
	}
	.editor.dragging {
		outline: 4px dashed var(--pc-accent);
		outline-offset: -8px;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		max-width: 72rem;
		margin: 0 auto 8px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--pc-accent);
		color: var(--pc-on-accent);
		font-size: 18px;
	}
	.brand h1 {
		margin: 0;
		font-size: 20px;
	}
	.brand p {
		margin: 0;
		min-height: 1.2em;
		font-size: 13px;
		color: var(--pc-muted);
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
		gap: 6px;
		min-height: 40px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: var(--pc-card);
		color: var(--pc-ink);
		font: inherit;
		font-weight: 650;
		font-size: 14px;
		cursor: pointer;
		box-shadow:
			var(--pc-press),
			0 0 0 1px var(--pc-line);
	}
	.pill.go {
		background: var(--pc-accent);
		color: var(--pc-on-accent);
		box-shadow: 0 3px 0 var(--pc-accent-deep);
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
	.count {
		display: grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		box-sizing: border-box;
		border-radius: 999px;
		background: var(--pc-butter);
		color: var(--pc-butter-ink);
		font-size: 12px;
	}
	.page {
		max-width: 46rem;
		margin: 0 auto;
	}
	.loading,
	.problem {
		margin: 2rem auto;
		max-width: 46rem;
		color: var(--pc-muted);
	}

	/* ---- writing on the page ---- */
	.title-edit {
		display: inline-block;
		min-width: 6ch;
		outline: none;
		cursor: text;
	}
	.title-edit:empty::before {
		content: attr(data-placeholder);
		color: var(--pc-muted, var(--pc-muted));
		opacity: 0.6;
	}
	.page :global(.prose.ProseMirror) {
		outline: none;
		min-height: 40vh;
		caret-color: var(--pc-accent);
	}
	.page :global(.prose p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		height: 0;
		color: var(--pc-muted, var(--pc-muted));
		opacity: 0.6;
		pointer-events: none;
	}
	.page :global(.prose figure.is-empty figcaption::before) {
		content: 'Add a caption…';
		color: var(--pc-muted, var(--pc-muted));
		opacity: 0.6;
		pointer-events: none;
	}
	.page :global(.prose figure.ProseMirror-selectednode img) {
		outline: 4px solid var(--pc-accent);
	}
	.page :global(.prose .missing-photo) {
		padding: 2rem 1rem;
		border: 2px dashed var(--pc-line);
		border-radius: 18px;
		color: var(--pc-muted);
		font-size: 0.9rem;
		text-align: center;
	}
	.cover-pick {
		position: relative;
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.cover-hint {
		position: absolute;
		right: 12px;
		bottom: 2.6rem;
		padding: 4px 12px;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.55);
		color: #fff;
		font: 600 13px var(--pc-font-ui);
	}
	.cover-add {
		display: block;
		width: 100%;
		margin: 0.5rem 0 2rem;
		padding: 2.2rem 1rem;
		border: 2px dashed var(--pc-line);
		border-radius: 22px;
		background: none;
		color: var(--pc-muted);
		font: 600 15px var(--pc-font-ui);
		cursor: pointer;
	}

	/* ---- places: mentions waiting to be linked, and ones linked to a moment ---- */
	.page :global(.place-mention) {
		text-decoration: underline dotted var(--pc-accent);
		text-decoration-thickness: 2px;
		text-underline-offset: 0.25em;
		cursor: pointer;
	}
	.page :global(.prose a[href^='tour:']) {
		text-decoration-style: dotted;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.22em;
	}
	.place-chip {
		position: fixed;
		z-index: 35;
		display: flex;
		gap: 6px;
		padding: 6px;
		border-radius: 999px;
		background: var(--pc-paper);
		box-shadow:
			var(--pc-shadow),
			0 0 0 1px var(--pc-line);
	}
	.seg.when {
		flex-wrap: wrap;
		align-self: flex-start;
	}
	.places {
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--pc-card);
		box-shadow: 0 0 0 1px var(--pc-line);
		font-size: 13px;
	}
	.places p {
		margin: 0 0 6px;
	}
	.places ul {
		margin: 0 0 10px;
		padding-left: 18px;
		line-height: 1.6;
	}
	.places .m {
		font-weight: 650;
	}
	.hint {
		margin: 0;
		font-size: 12px;
		color: var(--pc-muted);
	}

	/* ---- the formatting toolbar: a pill above the keyboard ---- */
	.toolbar {
		position: fixed;
		z-index: 30;
		/* centred with the whole width to fit in (left: 50% would leave it only half) */
		left: 0;
		right: 0;
		width: fit-content;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 2px;
		max-width: calc(100% - 16px);
		overflow-x: auto;
		padding: 5px;
		box-sizing: border-box;
		border-radius: 999px;
		background: var(--pc-card);
		box-shadow:
			var(--pc-shadow),
			0 0 0 1px var(--pc-line);
		font-family: var(--pc-font-ui);
	}
	.toolbar button {
		flex: none;
		min-width: 40px;
		height: 40px;
		padding: 0 8px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--pc-ink);
		font: inherit;
		font-size: 16px;
		cursor: pointer;
	}
	.toolbar button.small {
		font-size: 13px;
	}
	.toolbar button[aria-pressed='true'] {
		background: var(--pc-ink);
		color: var(--pc-paper);
	}
	.toolbar .places-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 0 12px;
		font-size: 14px;
		font-weight: 650;
	}
	.toolbar .places-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.places-btn .n {
		display: grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		box-sizing: border-box;
		border-radius: 999px;
		background: var(--pc-accent);
		color: var(--pc-on-accent);
		font-size: 11px;
	}
	.toolbar .photo {
		padding: 0 14px;
		background: var(--pc-accent-soft);
		color: var(--pc-accent-ink);
		font-weight: 700;
		font-size: 14px;
	}
	.sep {
		flex: none;
		width: 1px;
		height: 24px;
		margin: 0 4px;
		background: var(--pc-line);
	}

	/* ---- sheets: the photo picker and the settings drawer ---- */
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgb(30 30 30 / 0.3);
	}
	.sheet {
		position: fixed;
		z-index: 41;
		box-sizing: border-box;
		padding: 16px;
		background: var(--pc-paper);
		box-shadow: var(--pc-shadow);
		font-family: var(--pc-font-ui);
		overflow-y: auto;
	}
	.sheet-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 0 0 12px;
		font-size: 14px;
	}
	.sheet-head span {
		display: flex;
		gap: 6px;
	}
	.picker {
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: min(46rem, 100%);
		max-height: 70vh;
		border-radius: 24px 24px 0 0;
	}
	.pick-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}
	.pick-row select {
		min-height: 36px;
		padding: 0 10px;
		border: 0;
		border-radius: 999px;
		background: var(--pc-card);
		box-shadow: 0 0 0 1px var(--pc-line);
		color: var(--pc-ink);
		font: inherit;
		font-size: 14px;
	}
	.seg {
		display: inline-flex;
		padding: 3px;
		border-radius: 999px;
		background: var(--pc-card);
		box-shadow: 0 0 0 1px var(--pc-line);
	}
	.seg button {
		min-height: 30px;
		padding: 0 12px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--pc-muted);
		font: inherit;
		font-size: 13px;
		font-weight: 650;
		cursor: pointer;
	}
	.seg button[aria-selected='true'],
	.seg button[aria-checked='true'] {
		background: var(--pc-ink);
		color: var(--pc-paper);
	}
	.field.inline {
		flex-direction: row;
		align-items: center;
		gap: 6px;
	}
	.field.inline input {
		min-height: 36px;
	}
	.count-line {
		margin: 0 0 8px;
		font-size: 13px;
		color: var(--pc-muted);
	}
	.map-pick {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
	}
	.map-preview {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 3 / 2;
		max-height: 40vh;
		overflow: hidden;
		border-radius: 14px;
		background: var(--pc-sunk);
		color: var(--pc-muted);
		font-size: 13px;
	}
	.map-preview.whole {
		width: auto;
		height: 40vh;
		aspect-ratio: 4 / 5;
	}
	.map-preview :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* a map snapshot in the story: its zoom and time, over its top corner */
	.page :global(.prose figure.map-shot) {
		position: relative;
	}
	.page :global(.map-tools) {
		position: absolute;
		top: 10px;
		right: 10px;
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.9);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
		font: 13px var(--pc-font-ui);
	}
	.page :global(.map-tools[hidden]) {
		display: none;
	}
	.page :global(.map-tools button) {
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: 50%;
		background: none;
		font-size: 18px;
		cursor: pointer;
	}
	.page :global(.map-tools input) {
		border: 0;
		background: none;
		font: inherit;
	}
	.page :global(.prose figure.map-shot.ProseMirror-selectednode .map-frame) {
		outline: 4px solid var(--pc-accent);
	}
	.picker ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 8px;
		margin: 0;
		padding: 0;
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
		color: var(--pc-muted);
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
		outline: 3px solid var(--pc-accent);
	}
	.picker .none {
		grid-column: 1 / -1;
		font-size: 13px;
		color: var(--pc-muted);
	}
	.drawer {
		top: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: min(24rem, 100%);
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
		color: var(--pc-muted);
	}
	.field input:not([type='checkbox']),
	.field select {
		min-height: 42px;
		padding: 0 12px;
		border: 0;
		border-radius: 12px;
		background: var(--pc-card);
		box-shadow: 0 0 0 1px var(--pc-line);
		color: var(--pc-ink);
		font: inherit;
		font-weight: 500;
		font-size: 15px;
	}
	.check {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}
	.check input {
		width: 20px;
		height: 20px;
		accent-color: var(--pc-accent);
	}
	.row {
		display: flex;
		gap: 8px;
	}
	.notes {
		margin: 0;
		padding: 10px 12px 10px 28px;
		border-radius: 14px;
		background: var(--pc-butter);
		color: var(--pc-butter-ink);
		font-size: 13px;
		line-height: 1.5;
	}
	.excerpt {
		margin: 0;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--pc-sky);
		color: var(--pc-sky-ink);
		font-size: 13px;
	}
	.source summary {
		cursor: pointer;
		font-size: 13px;
		font-weight: 650;
		color: var(--pc-muted);
	}
	.source pre {
		margin: 8px 0 0;
		padding: 12px;
		border-radius: 12px;
		background: var(--pc-card);
		box-shadow: 0 0 0 1px var(--pc-line);
		font-size: 12px;
		white-space: pre-wrap;
		word-break: break-word;
	}
	@media (max-width: 700px) {
		.editor {
			padding: 12px 12px 110px;
		}
		.actions {
			width: 100%;
		}
	}
	/* phones: the whole toolbar on screen, Photo included */
	@media (max-width: 480px) {
		.toolbar button {
			min-width: 32px;
			padding: 0 4px;
		}
		.toolbar button.small,
		.places-btn .label,
		.photo .label {
			display: none;
		}
		.toolbar .photo {
			padding: 0 10px;
		}
		.sep {
			margin: 0 2px;
		}
	}
</style>
