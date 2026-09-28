import { interpolateInferno, interpolateRdYlBu, interpolateTurbo } from 'd3';
import { FEATURES } from './config';
import type { Track } from './data';
import type { ColorBy } from './tour.svelte';

/** Per-fix colour for the route line and scrubber profile. */
export function colorScale(tr: Track, by: ColorBy): (i: number) => string {
	switch (by) {
		case 'speed':
			// belt and braces: never colour by speed with the feature off
			if (FEATURES.showSpeed) return (i) => interpolateTurbo(Math.min(1, tr.speed[i] / 28));
			return colorScale(tr, 'gradient');
		case 'lean':
			return (i) => interpolateInferno(0.15 + Math.min(1, Math.abs(tr.lean[i]) / 0.6) * 0.85);
		case 'gradient':
			return (i) => interpolateRdYlBu(0.5 - Math.max(-0.5, Math.min(0.5, gradientAt(tr, i) * 3)));
	}
}

/** Rise over run across ~10 fixes, from the DEM (not GPS altitude). */
export function gradientAt(tr: Track, i: number): number {
	const j = Math.min(tr.count - 1, i + 5);
	const k = Math.max(0, i - 5);
	const run = tr.dist[j] - tr.dist[k];
	return run > 5 ? (tr.ground[j] - tr.ground[k]) / run : 0;
}

export const LEGENDS: Record<ColorBy, { label: string; interp: (t: number) => string; min: string; max: string }> = {
	speed: { label: 'Speed', interp: interpolateTurbo, min: '0', max: '63 mph' },
	lean: { label: 'Lean angle', interp: (t) => interpolateInferno(0.15 + t * 0.85), min: '0°', max: '34°' },
	gradient: { label: 'Gradient', interp: (t) => interpolateRdYlBu(1 - t), min: '-17%', max: '+17%' }
};
