// Distances and temperatures in the tour's units (tours/<id>/tour.config.json). Data is metric
// throughout (km, °C); this is only how it's shown.
import { TOUR } from './tourConfig';

const MI = TOUR.units.distance === 'mi';
const F = TOUR.units.temperature === 'F';

/** km → the tour's distance unit, as a number */
export const distance = (km: number) => (MI ? km / 1.609344 : km);
/** "mi" / "km" */
export const distUnit = MI ? 'mi' : 'km';
/** "miles" / "kilometres" (or "kilometers": follows the locale) */
export const distWord = MI ? 'miles' : TOUR.locale.startsWith('en-US') ? 'kilometers' : 'kilometres';
/** 82 (whole units) */
export const distRound = (km: number) => Math.round(distance(km));

/** °C → the tour's temperature unit, as a number */
export const temperature = (c: number) => (F ? (c * 9) / 5 + 32 : c);
/** "°C" / "°F" */
export const tempUnit = F ? '°F' : '°C';
/** "13" (whole degrees in the tour's unit) */
export const tempRound = (c: number) => temperature(c).toFixed(0);

/** mph (as the weather is stored) → the tour's speed unit for wind: "mph" or "km/h" */
export const wind = (mph: number) => (MI ? mph : mph * 1.609344);
export const windUnit = MI ? 'mph' : 'km/h';
