import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';

/* Real 301 redirects in the `_redirects` format read by Netlify and
   Cloudflare Pages. The build integration renames this file to `_redirects`
   (Astro does not route file names that start with an underscore).
   GitHub Pages ignores it and uses the forwarding pages instead. */
export const GET: APIRoute = async () => {
  const list = (await getEntry('redirects', 'redirects'))?.data.redirects ?? [];
  const body = list.map((r) => `${r.from}  ${r.to}  301`).join('\n') + '\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
