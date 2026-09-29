// Which /day/<date> pages to prerender: every built day. Server-only, so the file listing never
// reaches the client bundle.
import fs from 'node:fs';

export const entries = () =>
	fs
		.readdirSync('static/data/days')
		.filter((d) => fs.existsSync(`static/data/days/${d}/track.json`))
		.map((day) => ({ day }));
