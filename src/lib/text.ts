import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { url } from './content';

/** Missing content is written in the files as [DA COMPLETARE: what is needed]. */
export const TODO_RE = /\[DA COMPLETARE(?::[^\]]*)?\]/g;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const highlight = (html: string) => html.replace(TODO_RE, (m) => `<mark class="todo">${m}</mark>`);

/** Plain text field -> safe HTML, with markers highlighted. Use with set:html. */
export function txt(s: string | undefined): string {
  return s ? highlight(escapeHtml(s)) : '';
}

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

/** Markdown field -> HTML. Internal links get the deploy base path. */
export async function md(s: string | undefined): Promise<string> {
  if (!s) return '';
  processor ??= createMarkdownProcessor({ gfm: true, smartypants: false, syntaxHighlight: false });
  // Protect markers from being read as Markdown link references.
  const tokens: string[] = [];
  const protectedSrc = s.replace(TODO_RE, (m) => `@@TODO${tokens.push(m) - 1}@@`);
  const { code } = await (await processor).render(protectedSrc);
  return code
    .replace(/@@TODO(\d+)@@/g, (_, i) => `<mark class="todo">${escapeHtml(tokens[Number(i)])}</mark>`)
    .replace(/href="(\/[^"/][^"]*|\/)"/g, (_, href) => `href="${url(href)}"`);
}

/** Markdown field -> plain text (for meta and JSON-LD). */
export const plain = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const waHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;
