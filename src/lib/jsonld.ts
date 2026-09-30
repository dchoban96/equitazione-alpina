/* Structured data (JSON-LD), generated from content. No rating markup:
   self-published review stars are against Google's guidelines. */
import type { Crumb, Site } from './content';
import { TODO_RE, plain } from './text';

const clean = (s: string) => s.replace(TODO_RE, '').trim();

export function breadcrumbJsonLd(crumbs: Crumb[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: new URL(c.href, siteUrl).href } : {}),
    })),
  };
}

export function localBusinessJsonLd(site: Site, imageUrl: string) {
  const legal = clean(site.legalName);
  const vat = clean(site.vatNumber);
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${site.url}/#business`,
    name: site.name,
    ...(legal ? { legalName: legal } : {}),
    ...(vat ? { vatID: vat } : {}),
    url: `${site.url}/`,
    image: imageUrl,
    telephone: site.phone.replace(/[^\d+]/g, ''),
    ...(site.email ? { email: site.email } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      postalCode: site.address.postalCode,
      addressLocality: site.address.locality,
      addressRegion: site.address.province,
      addressCountry: site.address.country,
    },
    ...(site.geo.lat !== null && site.geo.lng !== null
      ? { geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng } }
      : {}),
    // Opening is by appointment, so it is described in words, not as hours.
    ...(site.hours.length
      ? { description: site.hours.map((h) => `${h.days}: ${h.hours}`).join('; ') }
      : {}),
    sameAs: site.social.map((s) => s.url),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: plain(q.answer) },
    })),
  };
}

export function articleJsonLd(a: {
  title: string;
  description: string;
  url: string;
  image: string;
  date: Date;
  site: Site;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    image: a.image,
    datePublished: a.date.toISOString(),
    mainEntityOfPage: a.url,
    author: { '@type': 'Organization', name: a.site.name, url: `${a.site.url}/` },
    publisher: { '@type': 'Organization', name: a.site.name, url: `${a.site.url}/` },
  };
}

export function galleryJsonLd(name: string, pageUrl: string, photos: { url: string; caption: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name,
    url: pageUrl,
    image: photos.map((p) => ({ '@type': 'ImageObject', contentUrl: p.url, caption: p.caption })),
  };
}
