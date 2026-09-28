// Local feature flags. Hard-coded on purpose: flip here and rebuild.

export const FEATURES = {
	/**
	 * Show riding speed (HUD readout, "colour route by speed", mph legend).
	 * Off by default: this is a travelogue, and publishing speeds could read as
	 * encouraging people to race these roads.
	 */
	showSpeed: false
} as const;
