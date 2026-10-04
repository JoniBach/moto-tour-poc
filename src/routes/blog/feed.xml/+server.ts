// The blog's RSS feed: every story in full, newest first, at /<tour>/blog/feed.xml. Feed readers
// follow it, and the mailing list sends each new story from it. Prerendered (a static file), so
// it's only as new as the last deploy.
//
// A story leaves the site here, so it's made to stand alone: every address made full, photos as
// the JPEG copies email clients can show, and map snapshots (drawn by script on the story page) as
// the stills scripts/build-email-images.mjs saved, or else a link to the map. Its date is when it
// went out ("published"), not the moment of the ride it's about.
import fs from 'node:fs';
import { base } from '$app/paths';
import type { BlogPost } from '$lib/data';
import { on } from '$lib/flags';
import { mapFile, parseMapRef } from '$lib/story.js';
import { DATA_DIR, emailPhotoSrc, ORIGIN, SITE_NAME, SITE_URL, TOUR } from '$lib/tourConfig';

export const prerender = on('blog') && on('stories');

const PHOTOS_DIR = `static/photos/${TOUR.id}`;
const has = (file: string) => fs.existsSync(`${PHOTOS_DIR}/${file}`);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** HTML inside the XML: as CDATA, split wherever the text itself would end it */
const cdata = (html: string) => `<![CDATA[${html.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
const IMG_STYLE = 'max-width:100%;height:auto;display:block';

/** where a map snapshot's moment is in the tour (as build-blog.mjs links places) */
function mapHref(ref: string) {
	const shot = parseMapRef(ref);
	if (!shot) return `${base}/`;
	if (shot.whole) return shot.day ? `${base}/day/${shot.day}` : `${base}/`;
	return `${base}/day/${shot.day}?t=${shot.time}${shot.end ? `&amp;to=${shot.end}` : ''}`;
}

/** The story's HTML, standing alone. */
function content(post: BlogPost) {
	const url = `${SITE_URL}/blog/${post.day}/${post.slug}`;
	let html = post.html
		// map snapshots: the saved still, linked to the map; or just the link
		.replace(
			/<figure class="map-shot[^"]*" data-map="([^"]+)"><div class="map-frame" role="img" aria-label="([^"]*)"><\/div>(?:<figcaption>([\s\S]*?)<\/figcaption>)?<\/figure>/g,
			(_, ref: string, label: string, caption?: string) => {
				const href = mapHref(ref);
				return has(`maps/${mapFile(ref)}`)
					? `<figure><a href="${href}"><img src="${base}/photos/${TOUR.id}/maps/${mapFile(ref)}" alt="${label}" style="${IMG_STYLE}"></a>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`
					: `<p><a href="${href}">🗺 ${caption?.replace(/<a [^>]*>[\s\S]*?<\/a>/g, '').trim() || label} (see the map)</a></p>`;
			}
		)
		// photos: the JPEG copy where there is one, sized to fit
		.replace(/<img src="([^"]+)" width="\d+" height="\d+" alt="([^"]*)" loading="lazy" data-photo="([^"]+)">/g, (_, src: string, alt: string, id: string) =>
			`<img src="${has(`email/${id}.jpg`) ? emailPhotoSrc(id) : src}" alt="${alt}" style="${IMG_STYLE}">`
		);
	if (post.cover) {
		const src = has(`email/${post.cover}.jpg`) ? emailPhotoSrc(post.cover) : `${base}/photos/${TOUR.id}/large/${post.cover}.webp`;
		html = `<p><a href="${url}"><img src="${src}" alt="" style="${IMG_STYLE}"></a></p>\n${html}`;
	}
	html += `\n<p><a href="${url}">Read it on the ${esc(TOUR.name)} blog</a>, where every place links to the moment the ride was there.</p>`;
	// every address on the site made full: they're read somewhere else now
	return html.replace(/(href|src)="\//g, `$1="${ORIGIN}/`);
}

export function GET() {
	const file = `${DATA_DIR}/blog.json`;
	const posts: BlogPost[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).posts : [];
	posts.sort((a, b) => b.published - a.published);
	const date = (s: number) => new Date(s * 1000).toUTCString();
	const self = `${SITE_URL}/blog/feed.xml`;
	const items = posts.map((p) => {
		const url = `${SITE_URL}/blog/${p.day}/${p.slug}`;
		return `		<item>
			<title>${esc(p.title)}</title>
			<link>${url}</link>
			<guid isPermaLink="true">${url}</guid>
			<pubDate>${date(p.published)}</pubDate>
			<description>${esc(p.excerpt)}</description>
			<content:encoded>${cdata(content(p))}</content:encoded>
		</item>`;
	});
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
	<channel>
		<title>${esc(SITE_NAME)}</title>
		<link>${SITE_URL}/blog</link>
		<description>${esc(`${TOUR.title}, ${TOUR.summary}`)}</description>
		<language>${esc(TOUR.locale)}</language>
		<atom:link href="${self}" rel="self" type="application/rss+xml" />
${posts.length ? `		<lastBuildDate>${date(posts[0].published)}</lastBuildDate>\n` : ''}${items.join('\n')}
	</channel>
</rss>
`;
	return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
