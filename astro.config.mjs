import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import daCompletare from './integrations/da-completare.mjs';

const base = (process.env.BASE_PATH || '/').replace(/\/$/, '');

// Internal links written in articles (href="/equitazione/") get the deploy base path.
function prefixBase() {
  const walk = (node) => {
    const href = node.properties?.href;
    if (node.tagName === 'a' && typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) {
      node.properties.href = base + href;
    }
    node.children?.forEach(walk);
  };
  return (tree) => walk(tree);
}

// Production: `npm run build`. Preview for the owner (drafts included, marked,
// never indexed): `npm run build:preview`. BASE_PATH is set only when the site
// is served from a sub-folder, e.g. a GitHub Pages project URL.
export default defineConfig({
  site: 'https://www.equitazione-alpina.it',
  base: base || '/',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  prefetch: false,
  devToolbar: { enabled: false },
  markdown: { rehypePlugins: [prefixBase] },
  // Preact only for the control panel (src/pannello), the site itself ships no framework.
  integrations: [mdx(), preact({ include: ['src/pannello/**/*.tsx'] }), daCompletare()],
});
