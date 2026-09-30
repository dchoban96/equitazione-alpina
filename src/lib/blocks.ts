import { getCollection, getEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import type { Block, Page, Site } from './content';
import { absolute, pagePath } from './content';
import { faqJsonLd, galleryJsonLd, localBusinessJsonLd } from './jsonld';

type FaqBlock = Extract<Block, { type: 'faq' }>;

export async function faqFor(b: FaqBlock) {
  const all = await getCollection('faq');
  if (b.ids) {
    return b.ids.map((id) => {
      const q = all.find((x) => x.id === id);
      if (!q) throw new Error(`faq block: no question "${id}" in src/content/it/faq.yaml`);
      return q.data;
    });
  }
  return all.filter((q) => !b.tag || q.data.tags.includes(b.tag)).map((q) => q.data);
}

/** Structured data generated from a page's content and blocks. */
export async function pageJsonLd(page: Page, site: Site): Promise<object[]> {
  const out: object[] = [];
  const pageUrl = absolute(pagePath(page.data.slug), site.url);

  if (page.data.localBusiness) {
    const img = await getImage({ src: page.data.seo.image, width: 1200, format: 'jpg' });
    out.push(localBusinessJsonLd(site, absolute(img.src, site.url)));
  }

  const faqs = (await Promise.all(page.data.blocks.filter((b) => b.type === 'faq').map(faqFor))).flat();
  if (faqs.length) out.push(faqJsonLd(faqs));

  for (const b of page.data.blocks) {
    if (b.type !== 'gallery') continue;
    const g = await getEntry('galleries', b.gallery);
    if (!g || g.data.photos.length === 0) continue;
    const photos = await Promise.all(
      g.data.photos.map(async (p) => ({
        url: absolute((await getImage({ src: p.file, width: 1600, format: 'jpg' })).src, site.url),
        caption: p.caption ?? p.alt,
      })),
    );
    out.push(galleryJsonLd(g.data.title, pageUrl, photos));
  }
  return out;
}

/** Altimeter settings for a page, or null when it must stay hidden. */
export function altimeterFor(page: Page) {
  const a = page.data.altimeter;
  const altitudes = page.data.blocks.map((b) => b.altitude).filter((x): x is number => x !== undefined);
  if (!a?.enabled || altitudes.length < 2) return null;
  return { min: a.min, max: a.max, start: altitudes[0] };
}
