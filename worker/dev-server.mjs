// Runs the Pannello API on this computer at http://localhost:8787, without Cloudflare.
//
//   node worker/dev-server.mjs
//
// Settings come from worker/.dev.vars (KEY=value lines, never committed) and the
// environment. KV is kept in memory. With no RESEND_API_KEY, the sign-in link is
// returned in the answer and printed here instead of being emailed.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import worker from './pannello.js';

const vars = {};
const file = new URL('./.dev.vars', import.meta.url);
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

const store = new Map();
const kv = {
  async get(key) {
    const item = store.get(key);
    if (!item) return null;
    if (item.exp && item.exp < Date.now()) return store.delete(key), null;
    return item.value;
  },
  async put(key, value, opts = {}) {
    store.set(key, { value, exp: opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : 0 });
  },
  async delete(key) {
    store.delete(key);
  },
};

const env = {
  DEV: '1',
  REPO: 'dchoban96/equitazione-alpina',
  BRANCH: 'main',
  PANEL_URL: 'http://localhost:4321/pannello/',
  ALLOWED_ORIGINS: 'http://localhost:4321',
  MAIL_FROM: 'Pannello <onboarding@resend.dev>',
  SESSION_SECRET: 'local-development-secret-only-for-this-computer',
  ...vars,
  ...Object.fromEntries(
    ['GITHUB_TOKEN', 'RESEND_API_KEY', 'ALLOWED_EMAILS'].filter((k) => process.env[k]).map((k) => [k, process.env[k]]),
  ),
  PANNELLO_KV: kv,
};

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:8787${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
  const response = await worker.fetch(request, env);
  const text = await response.text();
  if (req.url === '/auth/request' && text.includes('devLink')) console.log('Sign-in link:', JSON.parse(text).devLink);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(text);
}).listen(8787, () => console.log('Pannello API on http://localhost:8787 (allowed:', env.ALLOWED_EMAILS || 'nobody', ')'));
