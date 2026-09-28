// App-level state: the tour index, the UK backdrop, which day is active, and the world origin.
// World coordinates are British National Grid metres minus `origin`, with x = east, z = -north.
// The origin is the active day's origin, so a day's own data renders untransformed and precise;
// when switching days the origin moves mid-flight while the camera is high up, and the camera is
// shifted by the same amount so nothing visibly jumps.
import { Vector3 } from 'three';
import { loadDay, loadTourIndex, loadUk, type DaySummary, type Terrain, type TourData, type TourIndex } from './data';
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
	tour = $state.raw<Tour | null>(null);
	/** BNG metres at world (0, 0, 0) */
	origin = $state.raw({ ...UK_CENTRE });
	busy = $state(false);
	error = $state<string | null>(null);
	camera: CameraController | null = null;
	/** called when a day finishes and auto-advance wants the next one (set by the layout: navigates) */
	onAdvance: ((day: string) => void) | null = null;

	private days = new Map<string, Promise<TourData>>();
	private wanted: string | null | undefined = undefined;

	async init() {
		const [index, uk] = await Promise.all([loadTourIndex(), loadUk()]);
		this.index = index;
		this.uk = uk;
	}

	summary(day: string | null | undefined): DaySummary | undefined {
		return this.index?.days.find((d) => d.day === day);
	}

	neighbour(offset: number): DaySummary | undefined {
		const days = this.index?.days ?? [];
		const i = days.findIndex((d) => d.day === this.tour?.data.track.day);
		return i < 0 ? undefined : days[i + offset];
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
		const data = day ? await this.fetchDay(day) : null;
		const wasPlaying = this.tour?.playing ?? false;

		const newOrigin = summary ? { e: summary.originE, n: summary.originN } : { ...UK_CENTRE };
		const cam = this.camera;
		if (cam && (this.tour || day)) {
			// 1. climb to a point above the midpoint of here and there, high enough to see both
			const from = cam.target.clone();
			const to = this.world(newOrigin.e, newOrigin.n);
			const mid = from.clone().add(to).multiplyScalar(0.5);
			const span = Math.max(from.distanceTo(to), 40_000);
			const height = day ? span * 0.9 : 1_100_000;
			await cam.flyTo(new Vector3(mid.x, height, mid.z + height * 0.55), mid, day ? 1.8 : 2.2);
		}

		// 2. swap the day and move the origin; shift the camera by the same amount (no visible jump)
		const delta = new Vector3(-(newOrigin.e - this.origin.e), 0, newOrigin.n - this.origin.n);
		this.origin = newOrigin;
		cam?.shift(delta);
		if (data) {
			const tour = new Tour(data, this.settings);
			tour.playing = wasPlaying;
			tour.onEnded = () => {
				const next = this.neighbour(1);
				if (next && this.settings.autoAdvance) this.onAdvance?.(next.day);
			};
			this.tour = tour;
			// warm the cache for the next day so the following transition is instant
			const next = this.neighbour(1);
			if (next) this.fetchDay(next.day);
		} else {
			this.tour = null;
		}

		// 3. descend into the new day (camera mode fly-in), or settle over the UK
		if (cam) {
			if (data) cam.reenter();
			else await cam.flyTo(new Vector3(0, 1_100_000, 600_000), new Vector3(0, 0, 0), 1.2);
		}
	}
}

export const app = new App();
