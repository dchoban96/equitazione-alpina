// Turns an edited item back into its file text. The edits are applied onto the
// original YAML document, so comments, quoting and key order stay as they were
// and only the changed values differ in the commit.
import { isMap, isScalar, isSeq, parseDocument, Scalar, type Document } from 'yaml';
import type { RawFile } from './content';

/** Marks each object in a list with its position in the file, so moved and removed entries keep their comments. */
export const ORIGIN = '__i';

export function annotate<T>(value: T): T {
  if (Array.isArray(value))
    return value.map((v, i) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...annotate(v), [ORIGIN]: i } : annotate(v))) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, annotate(v)])) as T;
  return value;
}

export function strip<T>(value: T): T {
  if (Array.isArray(value)) return value.map(strip) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== ORIGIN).map(([k, v]) => [k, strip(v)])) as T;
  return value;
}

function merge(doc: Document, node: unknown, value: unknown): unknown {
  if (Array.isArray(value) && isSeq(node)) {
    const old = node.items;
    node.items = value.map((v, k) => {
      const from = v && typeof v === 'object' && ORIGIN in v ? old[(v as any)[ORIGIN]] : old[k];
      return from === undefined ? doc.createNode(strip(v)) : merge(doc, from, v);
    }) as typeof node.items;
    return node;
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && isMap(node)) {
    const obj = value as Record<string, unknown>;
    node.items = node.items.filter((pair) => {
      const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
      return key in obj && obj[key] !== undefined;
    });
    for (const [key, v] of Object.entries(obj)) {
      if (key === ORIGIN || v === undefined) continue;
      const pair = node.items.find((p) => (isScalar(p.key) ? p.key.value : p.key) === key);
      if (pair) pair.value = merge(doc, pair.value, v) as typeof pair.value;
      else node.set(key, doc.createNode(strip(v)));
    }
    return node;
  }
  if (isScalar(node) && (typeof value !== 'object' || value === null)) {
    if (node.value === value) return node;
    node.value = value;
    // a text that now has line breaks is written as a readable block
    if (typeof value === 'string' && value.includes('\n')) node.type = Scalar.BLOCK_LITERAL;
    return node;
  }
  return doc.createNode(strip(value));
}

const OPTIONS = { lineWidth: 0, flowCollectionPadding: false } as const;

function yamlWith(text: string, data: unknown): string {
  const doc = parseDocument(text);
  doc.contents = merge(doc, doc.contents, data) as typeof doc.contents;
  return doc.toString(OPTIONS);
}

export const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n)?([\s\S]*)$/;

/** The new text of a file: YAML for pages, front matter plus Markdown for articles. */
export function fileText(file: RawFile, data: unknown, body?: string): string {
  if (/\.mdx?$/.test(file.path)) {
    const m = file.text.match(FRONT_MATTER);
    const front = yamlWith(m ? m[1] + '\n' : '', data);
    if (body === undefined) return `---\n${front}---\n${m?.[3] ?? ''}`;
    // the panel shows the text without the blank line that follows the front matter
    return `---\n${front}---\n\n${body.replace(/^\s*\n/, '').replace(/\s*$/, '\n')}`;
  }
  return yamlWith(file.text, data);
}
