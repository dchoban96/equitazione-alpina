// Turns the raw content files (as the API returns them) into what the panel
// shows: one item per page, article, gallery and list, grouped like the site.
import { parse } from 'yaml';

export interface RawFile {
  path: string;
  sha: string;
  text: string;
}

export type Kind = 'page' | 'article' | 'gallery' | 'list' | 'settings';
export type State = 'live' | 'hidden' | 'draft' | 'mock';

export interface Item {
  id: string; // the file path
  kind: Kind;
  title: string;
  state: State;
  depth: number;
  data: Record<string, any>;
  body?: string; // articles: the text after the front matter
  file: RawFile;
}

export interface Group {
  key: string;
  label: string;
  items: Item[];
}

export interface Model {
  head: string;
  settings?: Item;
  groups: Group[];
  byId: Map<string, Item>;
  photos: string[];
}

export const REPO_RAW = 'https://raw.githubusercontent.com/dchoban96/equitazione-alpina/main/';
export const SITE_URL = 'https://www.equitazione-alpina.it';

/** "@assets/foto/x.jpg" or "../../../assets/foto/x.jpg" -> a URL that shows the photo. */
export function photoUrl(ref: unknown): string | null {
  if (typeof ref !== 'string' || !ref) return null;
  const m = ref.match(/assets\/(.+)$/);
  return m ? `${REPO_RAW}src/assets/${m[1]}` : null;
}

export const pageUrl = (slug: string) => `${SITE_URL}/${slug ? `${slug}/` : ''}`;

const SECTION_GROUPS = ['equitazione', 'pastore-del-lagorai', 'capra-orobica', 'valtellina'];

function stateOf(d: Record<string, any>): State {
  if (d.draft) return 'draft';
  if (d.mockup) return 'mock';
  if (d.nav?.hidden) return 'hidden';
  return 'live';
}

/** Lists are stored either as a plain array or under `items:`. */
export const listItems = (d: unknown): Record<string, any>[] =>
  Array.isArray(d) ? d : Array.isArray((d as any)?.items) ? (d as any).items : [];

export function buildModel(head: string, files: RawFile[], photos: string[]): Model {
  const byId = new Map<string, Item>();
  const add = (it: Item) => (byId.set(it.id, it), it);

  const pages: Item[] = [];
  const articles: Item[] = [];
  const galleries: Item[] = [];
  let settings: Item | undefined;
  const lists: Item[] = [];

  for (const f of files) {
    try {
      if (f.path.includes('/pages/')) {
        const d = parse(f.text) ?? {};
        pages.push(add({ id: f.path, kind: 'page', title: d.nav?.label || d.title || f.path, state: stateOf(d), depth: 0, data: d, file: f }));
      } else if (f.path.includes('/articles/')) {
        const m = f.text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
        const d = (m && parse(m[1])) ?? {};
        articles.push(add({ id: f.path, kind: 'article', title: d.title || f.path, state: stateOf(d), depth: 0, data: d, body: m?.[2] ?? '', file: f }));
      } else if (f.path.includes('/galleries/')) {
        const d = parse(f.text) ?? {};
        const n = (d.photos || []).length;
        galleries.push(add({ id: f.path, kind: 'gallery', title: `${d.title || 'Galleria'} · ${n} foto`, state: 'live', depth: 0, data: d, file: f }));
      } else if (f.path.endsWith('site.yaml')) {
        settings = add({ id: f.path, kind: 'settings', title: 'Dati aziendali', state: 'live', depth: 0, data: parse(f.text) ?? {}, file: f });
      } else {
        const name = f.path.endsWith('faq.yaml') ? 'Domande frequenti' : f.path.endsWith('reviews.yaml') ? 'Recensioni' : 'Lo sapevi?';
        const d = parse(f.text);
        lists.push(add({ id: f.path, kind: 'list', title: `${name} · ${listItems(d).length}`, state: 'live', depth: 0, data: { items: listItems(d) }, file: f }));
      }
    } catch (err) {
      console.error('Cannot read', f.path, err);
    }
  }

  // pages of one section, as a tree: parent before children, siblings by menu position
  const tree = (rootSlug: string, list: Item[]): Item[] => {
    const out: Item[] = [];
    const slugOf = (p: Item) => String(p.data.slug ?? '');
    const order = (p: Item) => Number(p.data.nav?.order ?? 100);
    const walk = (slug: string, depth: number) => {
      list
        .filter((p) => {
          const s = slugOf(p);
          return s.startsWith(`${slug}/`) && !s.slice(slug.length + 1).includes('/');
        })
        .sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title, 'it'))
        .forEach((p) => {
          p.depth = depth;
          out.push(p);
          walk(slugOf(p), depth + 1);
        });
    };
    const root = list.find((p) => slugOf(p) === rootSlug);
    if (root) out.push(root);
    walk(rootSlug, root ? 1 : 0);
    // anything the tree did not reach (an unusual slug) still shows
    for (const p of list) if (!out.includes(p)) out.push(p);
    return out;
  };

  const inSection = (s: string) => pages.filter((p) => p.data.section === s);
  const groups: Group[] = [];

  const home = pages.find((p) => (p.data.slug ?? '') === '');
  if (home) groups.push({ key: 'home', label: 'Home', items: [home] });

  // a gallery's photos sit right under the page that shows them
  const placed = new Set<Item>();
  const withGalleries = (items: Item[]): Item[] =>
    items.flatMap((p) => {
      if (p.kind !== 'page') return [p];
      const ids = (p.data.blocks || []).filter((b: any) => b.type === 'gallery').map((b: any) => b.gallery);
      const own = galleries.filter((g) => !placed.has(g) && ids.includes(g.id.split('/').pop()!.replace(/\.ya?ml$/, '')));
      own.forEach((g) => {
        placed.add(g);
        g.depth = p.depth + 1;
        g.title = `Foto · ${(g.data.photos || []).length}`;
      });
      return [p, ...own];
    });

  for (const s of SECTION_GROUPS) {
    const items = withGalleries(tree(s, inSection(s)));
    for (const g of galleries.filter((g) => g.data.section === s && !placed.has(g))) {
      placed.add(g);
      g.depth = 1;
      items.push(g);
    }
    if (items.length) groups.push({ key: s, label: items[0]?.data.title || s, items });
  }

  const curiosita = inSection('curiosita');
  const sortedArticles = [...articles].sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
  sortedArticles.forEach((a) => (a.depth = 1));
  groups.push({ key: 'curiosita', label: 'Curiosità', items: [...curiosita, ...sortedArticles] });

  const info = inSection('info').sort((a, b) => Number(a.data.nav?.order ?? 100) - Number(b.data.nav?.order ?? 100));
  if (info.length) groups.push({ key: 'info', label: 'Informazioni', items: info });

  const rest = [
    ...lists,
    ...withGalleries(pages.filter((p) => !['home', 'info', 'curiosita', ...SECTION_GROUPS].includes(p.data.section) && p !== home)),
    ...galleries.filter((g) => !placed.has(g)),
  ];
  rest.forEach((r) => (r.depth = placed.has(r) ? 1 : 0));
  groups.push({ key: 'altro', label: 'Altro', items: rest });

  return { head, settings, groups, byId, photos };
}
