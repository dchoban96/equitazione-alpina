import type { APIRoute } from 'astro';
import { getSite, IS_PREVIEW } from '../lib/content';

export const GET: APIRoute = async () => {
  const site = await getSite();
  // Preview builds must never be indexed.
  const body = IS_PREVIEW
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${site.url}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
