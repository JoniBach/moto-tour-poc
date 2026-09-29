// App-level state: the tour index, the UK backdrop, which day is active, and the world origin.
// World coordinates are British National Grid metres minus `origin`, with x = east, z = -north.
// The origin is the active day's origin, so a day's own data renders untransformed and precise;
// when switching days the origin moves mid-flight while the camera is high up, and the camera is
// shifted by the same amount so nothing visibly jumps.
import { Vector3 } from 'three';
import {
	loadDay,
	loadParks,
	loadPhotos,
	loadTourIndex,
	loadUk,
	type DaySummary,
	type Parks,
	type Photo,
	type Terrain,
	type TourData,
	type TourIndex
} from './data';
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

// the middle of Great Britain, used as the origin on the tour overview
const UK_CENTRE = { e: 380_000, n: 620_000 };

export class App {
	readonly settings = new Settings();
	index = $state.raw<TourIndex | null>(null);
	uk = $state.raw<Terrain | null>(null);
	parks = $state.raw<Parks | null>(null);
	photos = $state.raw<Photo[]>([]);
	/** open photo gallery: the photos of a clicked cluster and which one is showing */
	gallery = $state<{ photos: Photo[]; index: number } | null>(null);
	/** riding time to jump to once the next day loads ("ride here" from a photo) */
	private pendingSeek: number | null = null;
	tour = $state.raw<Tour | null>(null);
	/** BNG metres at world (0, 0, 0) */
	origin = $state.raw({ ...UK_CENTRE });
	busy = $state(false);
	/** the day being flown to while the scene is empty mid-transition */
	pending = $state.raw<DaySummary | null>(null);
	error = $state<string | null>(null);
	camera: CameraController | null = null;
	/** called when a day finishes and auto-advance wants the next one (set by the layout: navigates) */
	onAdvance: ((day: string) => void) | null = null;

	private days = new Map<string, Promise<TourData>>();
	private wanted: string | null | undefined = undefined;

	async init() {
		const [index, uk, parks, photos] = await Promise.all([loadTourIndex(), loadUk(), loadParks(), loadPhotos()]);
		this.index = index;
		this.uk = uk;
		this.parks = parks;
		this.photos = photos;
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

	/** Go to where a photo was taken: its day, at the moment it was taken. */
	rideTo(photo: Photo, navigate: (day: string) => void) {
		if (!photo.day) return;
		// time-placed photos carry rt (off-ride ones: the day's start or end); GPS ones start the day
		const rt = photo.rt ?? 0;
		if (this.tour?.data.track.day === photo.day) this.tour.seek(rt);
		else {
			this.pendingSeek = rt;
			navigate(photo.day);
		}
	}

	/** World position of an absolute BNG point at the current origin. */
	world(e: number, n: number, h = 0) {
		return new Vector3(e - this.origin.e, h, -(n - this.origin.n));
	}

	private fetchDay(day: string) {
		let p = this.days.get(day);
		if (!p) {
			p = loadDay(day);
			this.days.set(day, p);
			p.catch(() => this.days.delete(day));
		}
		return p;
	}

	/** Show a day (or the UK overview when null). Later calls win if one arrives mid-transition. */
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
		const summary = day ? this.summary(day) : undefined;
		if (day && !summary) throw new Error(`Unknown day ${day}`);
		const hadDay = !!this.tour;
		const wasPlaying = this.tour?.playing ?? false;
		// start the download now; it runs while the camera climbs
		const loading = day ? this.fetchDay(day) : Promise.resolve(null);

		// 1. clear the old day straight away: only the UK backdrop and the route lines remain
		this.pending = summary ?? null;
		this.tour = null;

		const newOrigin = summary ? { e: summary.originE, n: summary.originN } : { ...UK_CENTRE };
		const cam = this.camera;
		let data: TourData | null;
		if (cam && (hadDay || day)) {
			// 2. climb to a point above the midpoint of here and there (high enough to see both)
			//    while the new day loads; carry on once both are done
			const from = cam.target.clone();
			const to = this.world(newOrigin.e, newOrigin.n);
			const mid = from.clone().add(to).multiplyScalar(0.5);
			const span = Math.max(from.distanceTo(to), 40_000);
			const height = day ? span * 0.9 : 1_100_000;
			[data] = await Promise.all([loading, cam.flyTo(new Vector3(mid.x, height, mid.z + height * 0.55), mid, day ? 1.8 : 2.2)]);
		} else {
			data = await loading;
		}

		// 3. move the origin and bring the new day in; shift the camera by the same amount (no jump)
		const delta = new Vector3(-(newOrigin.e - this.origin.e), 0, newOrigin.n - this.origin.n);
		this.origin = newOrigin;
		cam?.shift(delta);
		if (data) {
			const tour = new Tour(data, this.settings);
			tour.photos = this.photos.filter((ph) => ph.day === day && ph.rt != null);
			tour.playing = wasPlaying;
			if (this.pendingSeek != null) {
				tour.seek(this.pendingSeek);
				tour.playing = false;
				this.pendingSeek = null;
			}
			tour.onEnded = () => {
				const next = this.neighbour(1);
				if (next && this.settings.autoAdvance) this.onAdvance?.(next.day);
			};
			this.tour = tour;
			// warm the cache for the next day so the following transition is instant
			const next = this.neighbour(1);
			if (next) this.fetchDay(next.day);
		}
		this.pending = null;

		// 4. descend into the new day (camera mode fly-in), or settle over the UK
		if (cam) {
			if (data) cam.reenter();
			else await cam.flyTo(new Vector3(0, 1_100_000, 600_000), new Vector3(0, 0, 0), 1.2);
		}
	}
}

export const app = new App();
