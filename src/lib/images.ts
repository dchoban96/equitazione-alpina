import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

/** Output widths for every image (spec: 480, 800, 1200, 1600). */
export const WIDTHS = [480, 800, 1200, 1600];

export const widthsFor = (img: ImageMetadata) => {
  const w = WIDTHS.filter((x) => x <= img.width);
  return w.length ? w : [img.width];
};

/** Attributes for <link rel="preload" as="image"> of the hero (AVIF). */
export async function preloadFor(img: ImageMetadata, sizes: string) {
  const res = await getImage({ src: img, widths: widthsFor(img), format: 'avif', sizes });
  return { srcset: res.srcSet.attribute, sizes, type: 'image/avif' };
}

/** Large AVIF + WebP sources for the gallery lightbox. */
export async function lightboxSources(img: ImageMetadata) {
  const widths = widthsFor(img);
  const [avif, webp] = await Promise.all([
    getImage({ src: img, widths, format: 'avif' }),
    getImage({ src: img, widths, format: 'webp' }),
  ]);
  return { avif: avif.srcSet.attribute, webp: webp.srcSet.attribute, src: webp.src };
}
