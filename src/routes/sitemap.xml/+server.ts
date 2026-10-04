// The sitemap, for search engines: the tour's front page and every blog page, at /<tour>/sitemap.xml
// (named in robots.txt). Prerendered.
import { blogPaths } from '$lib/server/blog-data';
import { SITE_URL } from '$lib/tourConfig';

export const prerender = true;

export function GET() {
	const urls = [{ path: '/' }, ...blogPaths()].map(
		({ path, changed }) =>
			`\t<url><loc>${SITE_URL}${path}</loc>${changed ? `<lastmod>${new Date(changed * 1000).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`
	);
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
