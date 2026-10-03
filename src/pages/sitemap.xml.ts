import type { APIRoute } from 'astro';
import type { ImageMetadata } from 'astro';
import { getEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import { execFileSync } from 'node:child_process';
import { getArticles, getPages, getSite, pagePath, type Page } from '../lib/content';

/* Published, indexable pages and articles only: no drafts, no noindex pages,
   no forwarding pages for old URLs. Each URL carries the date of its file's
   last commit (when git history is available) and the photos it shows, so
   they can appear in image search. */

/** Last commit date of a file (YYYY-MM-DD), or undefined without git history. */
function lastCommit(file: string | undefined): string | undefined {
  if (!file) return undefined;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The photos a page shows: block images and the photos of its galleries. */
async function pageImages(page: Page): Promise<ImageMetadata[]> {
  const out: ImageMetadata[] = [];
  for (const b of page.data.blocks) {
    if ('image' in b && b.image) out.push(b.image);
    if (b.type === 'cards') for (const i of b.items) if (i.image) out.push(i.image);
    if (b.type === 'gallery') {
      const g = await getEntry('galleries', b.gallery);
      if (g) out.push(...g.data.photos.map((p) => p.file));
    }
  }
  // the same photo used twice on a page is listed once
  return [...new Map(out.map((i) => [i.src, i])).values()];
}

export const GET: APIRoute = async () => {
  const [site, pages, articles] = await Promise.all([getSite(), getPages(), getArticles()]);
  const imageUrl = async (img: ImageMetadata) =>
    new URL((await getImage({ src: img, width: Math.min(1600, img.width), format: 'jpg' })).src, site.url).href;

  const urls = await Promise.all([
    ...pages
      .filter((p) => !p.data.draft && !p.data.noindex)
      .map(async (p) => ({
        loc: pagePath(p.data.slug),
        lastmod: lastCommit(p.filePath),
        images: await Promise.all((await pageImages(p)).map(imageUrl)),
      })),
    ...articles
      .filter((a) => !a.data.draft)
      .map(async (a) => ({
        loc: `/curiosita/${a.id}/`,
        lastmod: lastCommit(a.filePath) ?? a.data.date.toISOString().slice(0, 10),
        images: [await imageUrl(a.data.cover)],
      })),
  ]);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) =>
      `  <url><loc>${esc(new URL(u.loc, site.url).href)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.images
        .map((i) => `<image:image><image:loc>${esc(i)}</image:loc></image:image>`)
        .join('')}</url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
