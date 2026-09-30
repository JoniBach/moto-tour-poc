import { interpolateInferno, interpolateRdYlBu, interpolateSinebow, interpolateTurbo, rgb } from 'd3';
import { speedFigures, speedShade } from './config';
import type { Track } from './data';
import type { ColorBy } from './tour.svelte';

/** Per-fix colour for the route line and scrubber profile. */
export function colorScale(tr: Track, by: ColorBy): (i: number) => string {
	switch (by) {
		case 'speed':
			// belt and braces: never colour by speed with the feature off
			if (speedShade()) return (i) => interpolateTurbo(Math.min(1, tr.speed[i] / 28));
			return colorScale(tr, 'gradient');
		case 'lean':
			return (i) => interpolateInferno(0.15 + Math.min(1, Math.abs(tr.lean[i]) / 0.6) * 0.85);
		case 'gradient':
			return (i) => interpolateRdYlBu(0.5 - Math.max(-0.5, Math.min(0.5, gradientAt(tr, i) * 3)));
	}
}

/**
 * Per-fix colours as sRGB 0..1 triples, for shaders that write colour as-is (the globe's): the
 * same scales as colorScale, without three's linear conversion.
 */
export function fixColorsRGB(tr: Track, by: ColorBy): Float32Array {
	const scale = colorScale(tr, by);
	const out = new Float32Array(tr.count * 3);
	for (let i = 0; i < tr.count; i++) {
		const c = rgb(scale(i));
		out.set([c.r / 255, c.g / 255, c.b / 255], i * 3);
	}
	return out;
}

/** Rise over run across ~10 fixes, from the DEM (not GPS altitude). */
export function gradientAt(tr: Track, i: number): number {
	const j = Math.min(tr.count - 1, i + 5);
	const k = Math.max(0, i - 5);
	const run = tr.dist[j] - tr.dist[k];
	return run > 5 ? (tr.ground[j] - tr.ground[k]) / run : 0;
}

export const LEGENDS: Record<ColorBy, { label: string; interp: (t: number) => string; min: string; max: string }> = {
	// at speed level 1 the legend is relative only: no figures
	speed: {
		label: 'Speed',
		interp: interpolateTurbo,
		min: speedFigures() ? '0' : 'slower',
		max: speedFigures() ? '63 mph' : 'faster'
	},
	lean: { label: 'Lean angle', interp: (t) => interpolateInferno(0.15 + t * 0.85), min: '0°', max: '34°' },
	gradient: { label: 'Gradient', interp: (t) => interpolateRdYlBu(1 - t), min: '-17%', max: '+17%' }
};

/** One colour per day of the tour, spread around the hue wheel (stopping short of wrapping). */
export function dayColor(index: number, total: number): string {
	return interpolateSinebow((index / Math.max(1, total)) * 0.85);
}
