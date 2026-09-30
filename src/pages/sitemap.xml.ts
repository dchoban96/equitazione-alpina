import type { APIRoute } from 'astro';
import { getArticles, getPages, getSite, pagePath } from '../lib/content';

/* Published, indexable pages and articles only: no drafts, no noindex pages,
   no forwarding pages for old URLs. */
export const GET: APIRoute = async () => {
  const [site, pages, articles] = await Promise.all([getSite(), getPages(), getArticles()]);
  const urls = [
    ...pages.filter((p) => !p.data.draft && !p.data.noindex).map((p) => ({ loc: pagePath(p.data.slug) })),
    ...articles
      .filter((a) => !a.data.draft)
      .map((a) => ({ loc: `/curiosita/${a.id}/`, lastmod: a.data.date.toISOString().slice(0, 10) })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url><loc>${new URL(u.loc, site.url).href}</loc>${'lastmod' in u ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
