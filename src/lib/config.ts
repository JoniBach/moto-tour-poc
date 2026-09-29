// Local feature flags. Hard-coded on purpose: flip here and rebuild.

/**
 * How much of the riding speed the tour reveals:
 *   0 – none: no speed colouring, no numbers
 *   1 – shade only: the route and profile can be coloured by speed (relative "slower / faster"),
 *       but no mph figures anywhere — no readout, no legend values
 *   2 – full: speed readout in the HUD and mph on the legend
 * This is a travelogue; published speed figures could read as encouraging people to race these
 * roads, so figures stay off unless deliberately enabled.
 */
export type SpeedLevel = 0 | 1 | 2;

export const FEATURES = {
	speed: 1 as SpeedLevel
};

/** Speed can be used to colour the route. */
export const speedShade = () => FEATURES.speed >= 1;
/** Speed figures (mph) can be shown. */
export const speedFigures = () => FEATURES.speed >= 2;
