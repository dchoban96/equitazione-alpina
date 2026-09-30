// Build checks for missing content.
//  - Lists every [DA COMPLETARE: ...] marker in src/content/ (drafts included).
//  - Production build: fails if a published page still shows a marker.
//    The preview build (`npm run build:preview`) and the dev server only list them.
//  - Lists every page still marked `mockup: true` (published, but not final).
//  - Renames host-redirects.txt to _redirects for hosts with real redirects.
import { readdir, readFile, rename, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = /\[DA COMPLETARE(?::[^\]]*)?\]/g;

async function walk(dir, exts) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p, exts)));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(p);
  }
  return out;
}

async function sourceMarkers(root) {
  const contentDir = fileURLToPath(new URL('src/content/', root));
  const rows = [];
  for (const file of await walk(contentDir, ['.yaml', '.yml', '.md', '.mdx'])) {
    const text = await readFile(file, 'utf8');
    const draft = /^draft:\s*true\b/m.test(text);
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(MARKER)) {
        rows.push({ file: relative(fileURLToPath(root), file).replaceAll('\\', '/'), line: i + 1, marker: m[0], draft });
      }
    });
  }
  return rows;
}

async function mockupFiles(root) {
  const contentDir = fileURLToPath(new URL('src/content/', root));
  const out = [];
  for (const file of await walk(contentDir, ['.yaml', '.yml', '.md', '.mdx'])) {
    if (/^mockup:\s*true\b/m.test(await readFile(file, 'utf8'))) {
      out.push(relative(fileURLToPath(root), file).replaceAll('\\', '/'));
    }
  }
  return out;
}

async function reportMockups(logger, root) {
  const files = await mockupFiles(root);
  if (files.length) {
    logger.warn(`${files.length} files still use mockup text and illustrations (mockup: true):\n  ${files.join('\n  ')}`);
  }
}

function report(logger, rows) {
  if (!rows.length) {
    logger.info('No [DA COMPLETARE] markers left in src/content/.');
    return;
  }
  const byFile = Map.groupBy(rows, (r) => r.file);
  logger.info(`${rows.length} [DA COMPLETARE] markers in ${byFile.size} files:`);
  for (const [file, list] of byFile) {
    const tag = list[0].draft ? ' (draft)' : '';
    logger.info(`  ${file}${tag}`);
    for (const r of list) logger.info(`    ${r.line}: ${r.marker}`);
  }
}

const modeFromArgv = () => {
  const i = process.argv.indexOf('--mode');
  return i > -1 ? process.argv[i + 1] : 'production';
};

export default function daCompletare() {
  let root;
  return {
    name: 'da-completare',
    hooks: {
      'astro:config:setup': ({ config }) => {
        root = config.root;
      },
      'astro:server:start': async ({ logger }) => {
        report(logger, await sourceMarkers(root));
        await reportMockups(logger, root);
      },
      'astro:build:start': async ({ logger }) => {
        report(logger, await sourceMarkers(root));
        await reportMockups(logger, root);
      },
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);

        const hostFile = join(out, 'host-redirects.txt');
        if (await stat(hostFile).catch(() => null)) await rename(hostFile, join(out, '_redirects'));

        const offending = [];
        for (const file of await walk(out, ['.html'])) {
          const html = await readFile(file, 'utf8');
          const found = [...new Set(html.match(MARKER) ?? [])];
          if (found.length) offending.push({ page: '/' + relative(out, file).replaceAll('\\', '/'), found });
        }
        if (!offending.length) return;

        const lines = offending.map((o) => `  ${o.page}: ${o.found.join(', ')}`).join('\n');
        if (modeFromArgv() === 'production') {
          throw new Error(
            `Published pages still contain [DA COMPLETARE] markers:\n${lines}\n` +
              'Fill them in, or set draft: true on the page. `npm run build:preview` builds anyway.',
          );
        }
        logger.warn(`Pages with [DA COMPLETARE] markers (allowed in this build):\n${lines}`);
      },
    },
  };
}
