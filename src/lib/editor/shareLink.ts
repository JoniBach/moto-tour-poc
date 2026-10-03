// A story in a link: the whole story file (title, time, cover, address and the Markdown body, with
// its photos by id; the photos themselves are already published) plus the draft flag, compressed
// (deflate) and base64url-encoded into the link's fragment, /wysiwyg#story=… The fragment never
// reaches the server, so the story stays out of server logs and long ones aren't refused. The editor
// opens it on arrival.

const PARAM = 'story';
const VERSION = '1';

export interface SharedStory {
	/** the story file, as "Save a copy" writes it */
	file: string;
	draft: boolean;
}

async function squeeze(text: string): Promise<Uint8Array> {
	const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unsqueeze(bytes: Uint8Array): Promise<string> {
	const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return new Response(stream).text();
}

function toBase64Url(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The link to the editor with this story in it. */
export async function shareLink(story: SharedStory, editorUrl: string): Promise<string> {
	const packed = toBase64Url(await squeeze(JSON.stringify({ f: story.file, d: story.draft ? 1 : 0 })));
	const url = new URL(editorUrl);
	url.search = '';
	url.hash = `${PARAM}=${VERSION}.${packed}`;
	return url.href;
}

/** The story in a link's fragment, if it has one (null if none; throws if it's damaged). */
export async function readShared(hash: string): Promise<SharedStory | null> {
	const value = new URLSearchParams(hash.replace(/^#/, '')).get(PARAM);
	if (!value) return null;
	const [version, packed] = value.split('.', 2);
	if (version !== VERSION || !packed) throw new Error('This link is from a different version of the editor.');
	const { f, d } = JSON.parse(await unsqueeze(fromBase64Url(packed)));
	if (typeof f !== 'string') throw new Error('This link doesn’t hold a story.');
	return { file: f, draft: d === 1 };
}
