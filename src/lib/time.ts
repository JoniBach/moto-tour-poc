import { TOUR } from '$lib/tourConfig';
// UK-time helpers with no dependencies (shared by the 3D app and the blog).

const pad = (n: number) => String(n).padStart(2, '0');

/** Epoch seconds -> "HH:MM:SS" in the tour's time zone. */
export function tourClock(sec: number): string {
	const [h, m, s] = new Date(sec * 1000)
		.toLocaleTimeString(TOUR.locale, { timeZone: TOUR.timeZone, hour12: false })
		.split(':')
		.map(Number);
	return `${pad(h % 24)}:${pad(m)}:${pad(s)}`;
}
