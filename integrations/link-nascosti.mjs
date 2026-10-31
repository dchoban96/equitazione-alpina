// Links to hidden pages. A page or article hidden in the control panel
// (`draft: true`) is left out of the production build; a link to it from
// another page's text would then lead to "page not found". After the build,
// every <a> pointing to a hidden page that was not built is turned into plain
// text (its content stays, the link goes), and the build lists them.
// Cards that present a hidden page are already left out by the Cards block.
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

async function files(dir, ext) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(p, ext)));
    else if (entry.name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** "/valtellina/" for every page and article marked draft: true. */
async function hiddenPaths(root) {
  const out = new Set();
  const pagesDir = fileURLToPath(new URL('src/content/it/pages/', root));
  for (const f of await files(pagesDir, '.yaml')) {
    const d = yaml.load(await readFile(f, 'utf8')) ?? {};
    if (d.draft === true) out.add(d.slug ? `/${d.slug}/` : '/');
  }
  const articlesDir = fileURLToPath(new URL('src/content/it/articles/', root));
  for (const f of [...(await files(articlesDir, '.md')), ...(await files(articlesDir, '.mdx'))]) {
    const m = (await readFile(f, 'utf8')).match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const d = (m && yaml.load(m[1])) ?? {};
    if (d.draft === true) out.add(`/curiosita/${f.split(/[\\/]/).pop().replace(/\.mdx?$/, '')}/`);
  }
  return out;
}

const exists = (p) => access(p).then(() => true, () => false);
const ANCHOR = /<a\b([^>]*?)\shref="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g;

export default function linkNascosti() {
  let base = '/';
  return {
    name: 'link-nascosti',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = new URL('../', dir);
        const hidden = await hiddenPaths(root);
        if (!hidden.size) return;
        const out = fileURLToPath(dir);
        // a hidden page that was built anyway (preview build) is a working link: leave it
        const missing = new Set();
        for (const p of hidden) if (!(await exists(join(out, p, 'index.html')))) missing.add(p);
        if (!missing.size) return;

        const target = (href) => {
          if (!href.startsWith(base)) return null;
          const path = `/${href.slice(base.length)}`.replace(/[?#].*$/, '');
          const page = path.endsWith('/') ? path : `${path}/`;
          return missing.has(page) ? page : null;
        };
        const changed = [];
        for (const file of await files(out, '.html')) {
          const html = await readFile(file, 'utf8');
          let count = 0;
          const next = html.replace(ANCHOR, (whole, before, href, after, inner) => {
            if (!target(href)) return whole;
            count++;
            // keep classes and the like, drop what only makes sense on a link
            const attrs = `${before}${after}`.replace(/\s(?:target|rel|hreflang|download)="[^"]*"/g, '');
            return `<span${attrs}>${inner}</span>`;
          });
          if (count) {
            await writeFile(file, next);
            changed.push(`${file.slice(out.length).replace(/\\/g, '/')} (${count})`);
          }
        }
        logger.info(`Hidden pages: ${[...missing].join(', ')}`);
        if (changed.length) logger.info(`Links to hidden pages turned into plain text in:\n  ${changed.join('\n  ')}`);
      },
    },
  };
}
