// Edits not yet published, kept in this browser until Pubblica, so closing
// the tab loses nothing. One entry per file, with the version it started from.
import { useEffect, useState } from 'preact/hooks';
import { annotate, ORIGIN, strip } from './save';
import type { Item } from './content';

export interface Draft {
  sha: string; // the file version the edits started from
  data: Record<string, any>; // the whole edited item, lists marked with save.ORIGIN
  body?: string; // articles: the edited text
  base?: Record<string, any>; // the item as it was when editing started, to merge with newer versions
  baseBody?: string;
  at: number;
}

const KEY = 'pannello.drafts.v1';
type Drafts = Record<string, Draft>;

let drafts: Drafts = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
})();
const listeners = new Set<() => void>();

function commit(next: Drafts) {
  drafts = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(drafts));
  } catch {
    /* storage full or blocked: edits last until the tab closes */
  }
  listeners.forEach((l) => l());
}

export const allDrafts = () => drafts;

/** Re-renders the component whenever a draft changes. */
export function useDrafts(): Drafts {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return drafts;
}

/** Article text as the panel shows it: without the blank line after the front matter. */
export const cleanBody = (body = '') => body.replace(/^\s*\n/, '').replace(/\s*$/, '\n');

/** What the editor works on: the draft if there is one, else a fresh copy of the file. */
export function working(item: Item): { data: Record<string, any>; body?: string } {
  const d = drafts[item.id];
  if (d) return { data: d.data, body: d.body };
  return { data: annotate(structuredClone(item.data)), body: item.kind === 'article' ? cleanBody(item.body) : undefined };
}

const same = (a: unknown, b: unknown) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));

export function saveDraft(item: Item, data: Record<string, any>, body?: string) {
  const unchanged = same(data, item.data) && (item.kind !== 'article' || body === cleanBody(item.body));
  const next = { ...drafts };
  if (unchanged) delete next[item.id];
  else {
    const prev = drafts[item.id];
    next[item.id] = prev
      ? { ...prev, data, body, at: Date.now() }
      : { sha: item.file.sha, data, body, base: annotate(structuredClone(item.data)), baseBody: cleanBody(item.body), at: Date.now() };
  }
  commit(next);
}

export function discard(ids: string[]) {
  const next = { ...drafts };
  ids.forEach((id) => delete next[id]);
  commit(next);
}

const plain = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const order = (list: any[]) => list.map((x) => (plain(x) ? x[ORIGIN] : x)).join(',');

/** Applies what changed from base to mine onto theirs: their edits stay, where both changed the same text mine wins. */
function threeWay(base: any, mine: any, theirs: any): any {
  if (same(base, mine)) return theirs;
  if (plain(base) && plain(mine) && plain(theirs)) {
    const out: Record<string, any> = { ...theirs };
    for (const k of new Set([...Object.keys(base), ...Object.keys(mine)])) {
      if (k === ORIGIN) continue;
      const v = threeWay(base[k], mine[k], theirs[k]);
      if (v === undefined) delete out[k];
      else out[k] = v;
    }
    return out;
  }
  // a list merges entry by entry only if nobody added, removed or moved entries
  if (Array.isArray(base) && Array.isArray(mine) && Array.isArray(theirs) && order(base) === order(mine) && base.length === theirs.length)
    return mine.map((m, i) => threeWay(base[i], m, theirs[i]));
  return mine;
}

/** After a conflict: carry the edits over to the newer version of the item. */
export function rebase(item: Item) {
  const d = drafts[item.id];
  if (!d) return;
  const theirs = annotate(structuredClone(item.data));
  const theirsBody = cleanBody(item.body);
  const data = d.base ? threeWay(d.base, d.data, theirs) : d.data;
  const body = item.kind !== 'article' ? undefined : d.baseBody !== undefined && d.body === d.baseBody ? theirsBody : d.body;
  commit({ ...drafts, [item.id]: { ...d, sha: item.file.sha, data, body, base: theirs, baseBody: theirsBody, at: Date.now() } });
}
