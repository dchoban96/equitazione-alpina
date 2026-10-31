// Content Security Policy for the control panel (/pannello/), added to
// dist/_headers after the build. The panel's session lives in this origin's
// localStorage, so the page may run only its own files and Astro's two inline
// island scripts (allowed by their hash, computed here from the built page),
// and may talk only to this site and the panel's API (PUBLIC_PANNELLO_API).
import { createHash } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_RAW = 'https://raw.githubusercontent.com'; // photos and videos already on the site, shown in the panel

export default function pannelloCsp() {
  return {
    name: 'pannello-csp',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const html = await readFile(join(out, 'pannello', 'index.html'), 'utf8').catch(() => null);
        if (html === null) return;
        const hashes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
        );
        const api = process.env.PUBLIC_PANNELLO_API ? new URL(process.env.PUBLIC_PANNELLO_API).origin : '';
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(' ')}`.trim(),
          "style-src 'self' 'unsafe-inline'",
          `img-src 'self' data: blob: ${REPO_RAW}`,
          `media-src 'self' blob: ${REPO_RAW}`,
          `connect-src 'self' blob: ${api}`.trim(),
          "font-src 'self'",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; ');
        await appendFile(join(out, '_headers'), `\n/pannello/*\n  Content-Security-Policy: ${policy}\n`);
        logger.info(`CSP for /pannello/: ${hashes.length} inline scripts allowed by hash${api ? `, API ${api}` : ', no API set'}.`);
      },
    },
  };
}
