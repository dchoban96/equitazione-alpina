import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type Page = CollectionEntry<'pages'>;
export type Block = Page['data']['blocks'][number];
export type Site = CollectionEntry<'site'>['data'];

/**
 * Drafts are left out of production builds. The dev server and the preview
 * build (`npm run build:preview`) include them, marked as drafts, so the
 * owner can review work in progress.
 */
export const INCLUDE_DRAFTS = import.meta.env.MODE !== 'production';
export const IS_PREVIEW = import.meta.env.MODE === 'preview';

const need = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`Missing content: ${what}`);
  return value;
};

export async function getSite(): Promise<Site> {
  return need(await getEntry('site', 'site'), 'src/content/settings/site.yaml').data;
}

export async function getUi(): Promise<Record<string, string>> {
  const ui = need(await getEntry('ui', 'ui'), 'src/content/it/ui.yaml').data;
  // Missing keys throw at build time instead of printing "undefined".
  return new Proxy(ui, {
    get(target, key: string | symbol) {
      // `then` and symbols are probed by await and by the runtime, not by templates.
      if (typeof key !== 'string' || key === 'then') return undefined;
      if (!(key in target)) throw new Error(`Missing interface text "${key}" in src/content/it/ui.yaml`);
      return target[key];
    },
  });
}

export async function getThemeCss(): Promise<string> {
  const theme = need(await getEntry('theme', 'theme'), 'src/content/settings/theme.yaml').data;
  const vars = Object.values(theme)
    .flatMap((group) => Object.entries(group))
    .map(([name, value]) => `--${name}:${value};`)
    .join('');
  return `:root{${vars}}`;
}

export async function getToken(name: string): Promise<string> {
  const theme = need(await getEntry('theme', 'theme'), 'src/content/settings/theme.yaml').data;
  for (const group of Object.values(theme)) if (name in group) return String(group[name]);
  throw new Error(`Missing theme token "${name}" in src/content/settings/theme.yaml`);
}

export async function getPages(): Promise<Page[]> {
  return getCollection('pages', (p) => INCLUDE_DRAFTS || !p.data.draft);
}

export async function getArticles() {
  const all = await getCollection('articles', (a) => INCLUDE_DRAFTS || !a.data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/* ---------- URLs ---------- */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Internal link with the deploy base path. Leaves external links, anchors and mailto/tel alone. */
export function url(path: string): string {
  if (!path.startsWith('/')) return path;
  return `${BASE}${path}`;
}

export const pagePath = (slug: string) => (slug ? `/${slug}/` : '/');

export function absolute(path: string, site: string): string {
  return new URL(path, site).href;
}

/* ---------- navigation ---------- */

export const navLabel = (p: Page) => p.data.nav.label ?? p.data.title;

const parentSlug = (slug: string) => (slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : '');

export function childrenOf(pages: Page[], slug: string): Page[] {
  return pages
    .filter((p) => p.data.slug !== slug && parentSlug(p.data.slug) === slug && p.data.slug !== '')
    .filter((p) => !p.data.nav.hidden)
    .sort((a, b) => a.data.nav.order - b.data.nav.order);
}

export interface NavItem {
  label: string;
  href: string;
  draft: boolean;
  children: NavItem[];
}

function toNav(pages: Page[], p: Page, depth: number): NavItem {
  return {
    label: navLabel(p),
    href: url(pagePath(p.data.slug)),
    draft: p.data.draft,
    children: depth > 0 ? childrenOf(pages, p.data.slug).map((c) => toNav(pages, c, depth - 1)) : [],
  };
}

/** Items listed by slug in site settings; slugs without a published page are skipped. */
export function navFrom(pages: Page[], slugs: string[], depth = 2): NavItem[] {
  return slugs
    .map((s) => pages.find((p) => p.data.slug === s))
    .filter((p): p is Page => Boolean(p))
    .map((p) => toNav(pages, p, depth));
}

export interface Crumb {
  label: string;
  href: string;
}

export function breadcrumbs(pages: Page[], slug: string, homeLabel: string, last?: string): Crumb[] {
  if (!slug) return [];
  const crumbs: Crumb[] = [{ label: homeLabel, href: '/' }];
  const parts = slug.split('/');
  parts.forEach((_, i) => {
    const s = parts.slice(0, i + 1).join('/');
    const p = pages.find((x) => x.data.slug === s);
    // An ancestor without its own page (or still a draft) is skipped.
    if (p) crumbs.push({ label: navLabel(p), href: pagePath(s) });
  });
  if (last) crumbs.push({ label: last, href: '' });
  return crumbs;
}
