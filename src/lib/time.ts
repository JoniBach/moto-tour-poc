// UK-time helpers with no dependencies (shared by the 3D app and the blog).

const pad = (n: number) => String(n).padStart(2, '0');

/** Epoch seconds -> "HH:MM:SS" in UK time. */
export function ukClock(sec: number): string {
	const [h, m, s] = new Date(sec * 1000)
		.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour12: false })
		.split(':')
		.map(Number);
	return `${pad(h % 24)}:${pad(m)}:${pad(s)}`;
}
