// App-level state: the tour index, the region backdrop, which day is active, and the world origin.
// World coordinates are the tour's projected metres (src/lib/projection.ts) minus `origin`, with
// x = east, z = -north.
// The origin is the active day's origin, so a day's own data renders untransformed and precise;
// when switching days the origin moves mid-flight while the camera is high up, and the camera is
// shifted by the same amount so nothing visibly jumps.
import { Vector3 } from 'three';
import { toGrid } from './projection';
import { TOUR } from './tourConfig';
import {
	loadDay,
	loadBlog,
	loadFeed,
	loadParks,
	loadPhotos,
	loadTourIndex,
	loadRegion,
	type DaySummary,
	type BlogPost,
	type Feed,
	type Parks,
	type Photo,
	type Terrain,
	type TourData,
	type TourIndex
} from './data';
import { DEFAULT_VIEW, on, VIEWS_ON } from './flags';
import { Settings } from './settings.svelte';
import { Tour } from './tour.svelte';

/** Implemented by CameraRig once it mounts. */
export interface CameraController {
	/** ease camera + orbit target to these world positions */
	flyTo(position: Vector3, target: Vector3, seconds: number): Promise<void>;
	/** move camera + target by a world-space delta instantly (origin shifts) */
	shift(delta: Vector3): void;
	/** re-run the fly-in for the current camera mode (after a day swap) */
	reenter(): void;
	readonly target: Vector3;
}

export type View = '3d' | '2d' | 'globe';
const VIEW_KEY = 'moto-tour:view';

// the tour's centre (tour.config.json region.centre), used as the origin on the tour overview
const [homeE, homeN] = toGrid(...TOUR.region.centre);
const HOME = { e: Math.round(homeE / 1000) * 1000, n: Math.round(homeN / 1000) * 1000 };

/** Is downloading the next day ahead of time worth it here? Not on phones, slow links or Save-Data. */
function prefetchWorthIt(): boolean {
	const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
	if (c?.saveData || /(^|-)(2g|3g)$/.test(c?.effectiveType ?? '')) return false;
	return !matchMedia('(max-width: 900px), (pointer: coarse)').matches;
}

export class App {
	readonly settings = new Settings();
	index = $state.raw<TourIndex | null>(null);
	region = $state.raw<Terrain | null>(null);
	parks = $state.raw<Parks | null>(null);
	photos = $state.raw<Photo[]>([]);
	posts = $state.raw<BlogPost[]>([]);
	/** the blog post open in the reader */
	reading = $state.raw<BlogPost | null>(null);
	/** open photo gallery: the photos of a clicked cluster and which one is showing */
	gallery = $state<{ photos: Photo[]; index: number } | null>(null);
	/** riding time to jump to once the next day loads ("ride here" from a photo) */
	private pendingSeek: number | null = null;
	tour = $state.raw<Tour | null>(null);
	/** projected metres at world (0, 0, 0) */
	origin = $state.raw({ ...HOME });
	busy = $state(false);
	/** the page has applied its URL's moment (see moment.ts); until then the URL isn't rewritten */
	momentReady = $state(false);
	/** the day being flown to while the scene is empty mid-transition */
	pending = $state.raw<DaySummary | null>(null);
	error = $state<string | null>(null);
	camera: CameraController | null = null;
	/** called when a day finishes and auto-advance wants the next one (set by the layout: navigates) */
	onAdvance: ((day: string) => void) | null = null;

	private days = new Map<string, Promise<TourData>>();
	private wanted: string | null | undefined = undefined;

	/** 3D scene, flat 2D map or the globe: same tour and URLs (?view=2d / ?view=globe) */
	view = $state<View>('3d');

	/** Everything the tour needs. Safe to call again: only fetches what's missing. */
	async init() {
		await this.initShared();
		await this.ensureView();
	}

	/** The 3D view also needs the region's terrain backdrop; the 2D map doesn't. */
	async ensureView() {
		if (this.view === '3d' && !this.region) this.region = await loadRegion();
	}

	/** Switch between 3D and 2D, remembering the choice for next time. */
	setView(view: View) {
		if (!VIEWS_ON.includes(view)) return; // switched off in this release
		this.view = view;
		try {
			localStorage.setItem(VIEW_KEY, view);
		} catch {
			// private mode: fine, just not remembered
		}
		this.ensureView().catch((e) => (this.error = String(e)));
		// the day was loaded light for the map: the 3D views need its landscape
		if (view !== '2d' && this.tour?.data.light) this.reloadFull().catch((e) => (this.error = String(e)));
	}

	/** Swap a light day (2D map) for the full one, at the same moment. */
	private async reloadFull() {
		const old = this.tour!;
		const day = old.data.track.day;
		this.pending = this.summary(day) ?? null;
		this.tour = null;
		const data = await this.fetchDay(day);
		if (this.tour || this.pending?.day !== day) return; // moved on meanwhile
		this.tour = this.makeTour(day, data, old.playing);
		this.tour.seek(old.rt);
		this.pending = null;
	}

	private makeTour(day: string, loaded: TourData, playing: boolean) {
		// weather switched off: the day simply has none (no readouts, rain, clouds)
		const data = on('weather') ? loaded : { ...loaded, weather: null };
		const tour = new Tour(data, this.settings);
		tour.photos = this.photos.filter((ph) => ph.day === day && ph.rt != null);
		tour.posts = this.posts.filter((po) => po.day === day);
		tour.playing = playing;
		tour.onEnded = () => {
			const next = this.neighbour(1);
			if (next && this.settings.autoAdvance) this.onAdvance?.(next.day);
		};
		return tour;
	}

	/** The view a page load starts in: the URL's ?view=, else the viewer's last choice, else the default (flags.ts). */
	static startView(params: URLSearchParams): View {
		// only views switched on in this release (src/lib/flags.ts); the first on is the default
		const ok = (v: string | null): v is View => VIEWS_ON.includes(v as View);
		const asked = params.get('view');
		if (ok(asked)) return asked;
		try {
			const saved = localStorage.getItem(VIEW_KEY);
			if (ok(saved)) return saved;
		} catch {
			// no storage: default
		}
		return DEFAULT_VIEW ?? '3d';
	}

	/** The light data both experiences share (no terrain): the blog only needs this + the feed. */
	async initShared() {
		if (this.index) return;
		// photos and stories switched off in this release aren't even fetched: every view then
		// simply has none (no pins, gallery, reader, pop-ups)
		const [index, parks, photos, posts] = await Promise.all([
			loadTourIndex(),
			loadParks(),
			on('photos') ? loadPhotos() : Promise.resolve([]),
			on('stories') ? loadBlog() : Promise.resolve([])
		]);
		this.posts = posts;
		this.parks = parks;
		this.photos = photos;
		this.index = index; // last: pages wait on the index
	}

	/** The blog's per-day event list (scripts/build-feed.mjs). */
	feed = $state.raw<Feed | null>(null);
	async initBlog() {
		await this.initShared();
		if (!this.feed) this.feed = await loadFeed();
	}

	summary(day: string | null | undefined): DaySummary | undefined {
		return this.index?.days.find((d) => d.day === day);
	}

	/** The day on screen, or the one we're flying to. */
	get currentDay(): string | null {
		return this.tour?.data.track.day ?? this.pending?.day ?? null;
	}

	neighbour(offset: number): DaySummary | undefined {
		const days = this.index?.days ?? [];
		const i = days.findIndex((d) => d.day === this.currentDay);
		return i < 0 ? undefined : days[i + offset];
	}

	/** Go to a photo's or post's moment: its day, at the time it was taken / is about. */
	rideTo(item: Photo | BlogPost, navigate: (day: string) => void) {
		const day = item.day;
		if (!day) return;
		// time-placed photos carry rt (off-ride ones: the day's start or end); GPS ones start the day
		const rt = item.rt ?? 0;
		if (this.tour?.data.track.day === day) this.tour.seek(rt);
		else {
			this.pendingSeek = rt;
			navigate(day);
		}
	}

	/** World position of an absolute projected point at the current origin. */
	world(e: number, n: number, h = 0) {
		return new Vector3(e - this.origin.e, h, -(n - this.origin.n));
	}

	/** A day's data, cached; `light` for the 2D map (see loadTour). */
	private fetchDay(day: string, light = false) {
		const key = light ? `${day}:light` : day;
		let p = this.days.get(key);
		if (!p) {
			p = loadDay(day, light);
			this.days.set(key, p);
			p.catch(() => this.days.delete(key));
		}
		return p;
	}

	/** Camera over the whole tour: looking at the overview origin from high enough to see every ride. */
	homePose() {
		let [e0, n0, e1, n1] = [Infinity, Infinity, -Infinity, -Infinity];
		for (const { extent: x } of this.index?.days ?? [])
			(e0 = Math.min(e0, x.minE)), (n0 = Math.min(n0, x.minN)), (e1 = Math.max(e1, x.maxE)), (n1 = Math.max(n1, x.maxN));
		const span = e0 < e1 ? Math.max(e1 - e0, n1 - n0) : 700_000;
		const height = Math.max(40_000, span * 1.5);
		return { pos: new Vector3(0, height, height * 0.55), target: new Vector3(0, 0, 0) };
	}

	/** Show a day (or the whole-tour overview when null). Later calls win if one arrives mid-transition. */
	async show(day: string | null) {
		this.wanted = day;
		if (this.busy) return;
		this.busy = true;
		try {
			while (this.wanted !== undefined) {
				const target = this.wanted;
				this.wanted = undefined;
				if ((this.tour?.data.track.day ?? null) === target) continue; // already there
				await this.transition(target);
			}
		} catch (e) {
			this.error = String(e);
		} finally {
			this.busy = false;
		}
	}

	private async transition(day: string | null) {
		this.momentReady = false; // the new page applies its URL's moment, then sets this
		const summary = day ? this.summary(day) : undefined;
		if (day && !summary) throw new Error(`Unknown day ${day}`);
		const hadDay = !!this.tour;
		const wasPlaying = this.tour?.playing ?? false;
		// start the download now; it runs while the camera climbs
		const light = this.view === '2d';
		const loading = day ? this.fetchDay(day, light) : Promise.resolve(null);

		// 1. clear the old day straight away: only the region backdrop and the route lines remain
		this.pending = summary ?? null;
		this.tour = null;

		const newOrigin = summary ? { e: summary.originE, n: summary.originN } : { ...HOME };
		const cam = this.camera;
		let data: TourData | null;
		if (cam && (hadDay || day)) {
			// 2. climb to a point above the midpoint of here and there (high enough to see both)
			//    while the new day loads; carry on once both are done
			const from = cam.target.clone();
			const to = this.world(newOrigin.e, newOrigin.n);
			const mid = from.clone().add(to).multiplyScalar(0.5);
			const span = Math.max(from.distanceTo(to), 40_000);
			const height = day ? span * 0.9 : this.homePose().pos.y;
			[data] = await Promise.all([loading, cam.flyTo(new Vector3(mid.x, height, mid.z + height * 0.55), mid, day ? 1.8 : 2.2)]);
		} else {
			data = await loading;
		}

		// 3. move the origin and bring the new day in; shift the camera by the same amount (no jump)
		const delta = new Vector3(-(newOrigin.e - this.origin.e), 0, newOrigin.n - this.origin.n);
		this.origin = newOrigin;
		cam?.shift(delta);
		if (data && day) {
			const tour = this.makeTour(day, data, wasPlaying);
			if (this.pendingSeek != null) {
				tour.seek(this.pendingSeek);
				tour.playing = false;
				this.pendingSeek = null;
			}
			this.tour = tour;
			// warm the cache for the next day so the following transition is instant, where that's
			// cheap: not on phones or slow or data-saving connections (a day is a few MB), where
			// it's fetched when someone actually moves on
			const next = this.neighbour(1);
			if (next && prefetchWorthIt()) this.fetchDay(next.day, light);
			// keep only this day and its neighbours: a day is several MB, a whole tour would fill a phone
			const keep = new Set([day, next?.day, this.neighbour(-1)?.day]);
			for (const key of this.days.keys()) if (!keep.has(key.split(':')[0])) this.days.delete(key);
		}
		this.pending = null;

		// 4. descend into the new day (camera mode fly-in), or settle over the whole tour
		if (cam) {
			if (data) cam.reenter();
			else {
				const home = this.homePose();
				await cam.flyTo(home.pos, home.target, 1.2);
			}
		}
	}
}

export const app = new App();
