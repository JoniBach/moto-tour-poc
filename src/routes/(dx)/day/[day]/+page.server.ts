// Which /day/<date> pages to prerender: every built day. Server-only, so the file listing never
// reaches the client bundle.
import fs from 'node:fs';
import { DATA_DIR } from '$lib/tourConfig';

export const entries = () =>
	fs
		.readdirSync(`${DATA_DIR}/days`)
		.filter((d) => fs.existsSync(`${DATA_DIR}/days/${d}/track.json`))
		.map((day) => ({ day }));
