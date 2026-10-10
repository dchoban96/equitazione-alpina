// Pannello API: sign-in by email link and access to the site's content on GitHub.
//
// One file, no dependencies: paste it into the Cloudflare dashboard
// (Workers & Pages > pannello-equitazione-alpina > Edit code), or run it
// locally with `node worker/dev-server.mjs`.
//
// Settings (Cloudflare: Settings > Variables and Secrets):
//   GITHUB_TOKEN     secret  fine-grained token, Contents: read and write (see TOKEN-RENEWAL.md)
//   RESEND_API_KEY   secret  sends the sign-in emails
//   SESSION_SECRET   secret  any long random string; changing it signs everyone out
//   ALLOWED_EMAILS   text    who may sign in, comma separated
//   ALLOWED_ORIGINS  text    where the panel is served, comma separated
//   PANEL_URL        text    the panel address the email links open
//   MAIL_FROM        text    sender, e.g. "Pannello <pannello@equitazione-alpina.it>"
//   REPO, BRANCH     text    dchoban96/equitazione-alpina, main
// Binding: PANNELLO_KV (a KV namespace) for one-time sign-in codes and rate limits.

const LINK_TTL = 15 * 60; // seconds a sign-in link stays valid
const SESSION_DAYS = 30;
const MAX_LINKS_PER_HOUR = 5;

// The only places the panel may read and write.
const CONTENT_DIRS = ['src/content/it/pages', 'src/content/it/articles', 'src/content/it/galleries'];
const CONTENT_FILES = [
  'src/content/it/faq.yaml',
  'src/content/it/reviews.yaml',
  'src/content/it/curiosities.yaml',
  'src/content/settings/site.yaml',
];
const PHOTO_DIR = 'src/assets/foto';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      const url = new URL(request.url);
      const route = `${request.method} ${url.pathname}`;
      let res;
      if (route === 'GET /health') res = health(env);
      else if (route === 'POST /auth/request') res = await requestLink(request, env);
      else if (route === 'POST /auth/verify') res = await verifyLink(request, env);
      else {
        const user = await authenticate(request, env);
        if (!user) res = json({ error: 'Accesso scaduto: entra di nuovo.' }, 401);
        else if (route === 'GET /me') res = json({ email: user.email });
        else if (route === 'GET /content') res = await readContent(env);
        else if (route === 'GET /status') res = await publishStatus(env);
        else if (route === 'POST /publish') res = await publish(request, env, user);
        else res = json({ error: 'Not found' }, 404);
      }
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (err) {
      console.error(err);
      return json({ error: 'Errore del server. Riprova tra poco.' }, 500, cors);
    }
  },
};

/* ---------- sign-in ---------- */

async function requestLink(request, env) {
  const { email: raw } = await request.json().catch(() => ({}));
  const email = String(raw || '').trim().toLowerCase();
  // The same answer whether or not the address may sign in, so the list stays private.
  const done = (extra = {}) => json({ ok: true, ...extra });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Indirizzo email non valido.' }, 400);
  if (!allowed(email, env)) {
    console.log('sign-in refused: address not in ALLOWED_EMAILS');
    return done();
  }

  const rlKey = `rl:${email}`;
  const count = Number((await env.PANNELLO_KV.get(rlKey)) || 0);
  if (count >= MAX_LINKS_PER_HOUR) return done();
  await env.PANNELLO_KV.put(rlKey, String(count + 1), { expirationTtl: 3600 });

  const token = randomToken();
  await env.PANNELLO_KV.put(`login:${await sha256(token)}`, email, { expirationTtl: LINK_TTL });
  const link = `${env.PANEL_URL}?accesso=${token}`;

  if (!env.RESEND_API_KEY) {
    // Local development only: no email service, the link comes back in the answer.
    if (env.DEV === '1') return done({ devLink: link });
    throw new Error('RESEND_API_KEY missing');
  }
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [email],
      subject: 'Accesso al pannello di Equitazione Alpina',
      text: `Per entrare nel pannello apri questo collegamento entro 15 minuti:\n\n${link}\n\nSe non hai chiesto tu l'accesso, ignora questa email.`,
      html: `<p>Per entrare nel pannello di Equitazione Alpina apri questo collegamento entro 15 minuti:</p><p><a href="${link}">Entra nel pannello</a></p><p style="color:#666">Se non hai chiesto tu l'accesso, ignora questa email.</p>`,
    }),
  });
  if (!sent.ok) throw new Error(`Resend ${sent.status}: ${await sent.text()}`);
  return done();
}

async function verifyLink(request, env) {
  const { token } = await request.json().catch(() => ({}));
  if (!token) return json({ error: 'Collegamento non valido.' }, 400);
  const key = `login:${await sha256(String(token))}`;
  const email = await env.PANNELLO_KV.get(key);
  if (!email || !allowed(email, env)) return json({ error: 'Collegamento scaduto o già usato: chiedine uno nuovo.' }, 401);
  await env.PANNELLO_KV.delete(key); // each link works once
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  return json({ email, session: await sign({ email, exp }, env.SESSION_SECRET) });
}

async function authenticate(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const session = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const data = session && (await verify(session, env.SESSION_SECRET));
  if (!data || data.exp < Date.now() / 1000) return null;
  // Removing an address from ALLOWED_EMAILS signs that person out at once.
  return allowed(data.email, env) ? data : null;
}

// Pasted settings can carry quotes, spaces or invisible characters: keep only what an address can contain.
const allowList = (env) =>
  String(env.ALLOWED_EMAILS || '')
    .split(/[,;\s]+/)
    .map((e) => e.toLowerCase().replace(/[^a-z0-9@._+-]/g, ''))
    .filter((e) => e.includes('@'));

const allowed = (email, env) => allowList(env).includes(email);

// Which settings the Worker can see, for setting it up: yes/no and counts only, never a value.
function health(env) {
  return json({
    kv: Boolean(env.PANNELLO_KV),
    githubToken: Boolean(env.GITHUB_TOKEN),
    resendKey: Boolean(env.RESEND_API_KEY),
    sessionSecret: String(env.SESSION_SECRET || '').length >= 32,
    allowedEmails: allowList(env).length,
    allowedOrigins: String(env.ALLOWED_ORIGINS || '').split(',').filter((o) => o.trim()).length,
    panelUrl: Boolean(env.PANEL_URL),
    mailFrom: Boolean(env.MAIL_FROM),
    repo: Boolean(env.REPO && env.BRANCH),
  });
}

/* ---------- content ---------- */

async function readContent(env) {
  const [owner, name] = env.REPO.split('/');
  const dirs = CONTENT_DIRS.map(
    (d, i) => `d${i}: object(expression: "${env.BRANCH}:${d}") { ... on Tree { entries { name oid object { ... on Blob { text } } } } }`,
  );
  const files = CONTENT_FILES.map(
    (f, i) => `f${i}: object(expression: "${env.BRANCH}:${f}") { ... on Blob { oid text } }`,
  );
  const query = `query { repository(owner: "${owner}", name: "${name}") {
    ref(qualifiedName: "refs/heads/${env.BRANCH}") { target { oid } }
    ${dirs.join('\n')}
    ${files.join('\n')}
    photos: object(expression: "${env.BRANCH}:${PHOTO_DIR}") { ... on Tree { entries { name } } }
  } }`;
  const data = await github(env, 'POST', '/graphql', { query });
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  const repo = data.data.repository;

  const out = [];
  CONTENT_DIRS.forEach((d, i) => {
    for (const e of repo[`d${i}`]?.entries || []) {
      if (e.object?.text != null) out.push({ path: `${d}/${e.name}`, sha: e.oid, text: e.object.text });
    }
  });
  CONTENT_FILES.forEach((f, i) => {
    const b = repo[`f${i}`];
    if (b) out.push({ path: f, sha: b.oid, text: b.text });
  });
  return json({
    head: repo.ref.target.oid,
    files: out,
    photos: (repo.photos?.entries || []).map((e) => e.name),
  });
}

// Pubblica: every changed file in one commit. `base` is the commit the panel
// read; if someone published in the meantime GitHub refuses and the panel
// reloads before trying again, so nobody overwrites changes they never saw.
async function publish(request, env, user) {
  const { base, files, summary } = await request.json().catch(() => ({}));
  if (!/^[0-9a-f]{40}$/.test(String(base))) return json({ error: 'Richiesta non valida.' }, 400);
  if (!Array.isArray(files) || !files.length || files.length > 50) return json({ error: 'Nessuna modifica da pubblicare.' }, 400);
  for (const f of files) {
    if (!writable(f?.path) || typeof f.text !== 'string' || f.text.length > 500_000)
      return json({ error: `File non modificabile: ${String(f?.path)}` }, 400);
  }
  const headline = `Pannello: ${String(summary || 'modifiche ai testi').slice(0, 100)}`;
  const query = `mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }`;
  const input = {
    branch: { repositoryNameWithOwner: env.REPO, branchName: env.BRANCH },
    expectedHeadOid: base,
    message: { headline, body: files.map((f) => `- ${f.path}`).join('\n') },
    fileChanges: { additions: files.map((f) => ({ path: f.path, contents: b64utf8(f.text) })) },
  };
  const data = await github(env, 'POST', '/graphql', { query, variables: { input } });
  if (data.errors) {
    const msg = JSON.stringify(data.errors);
    if (/expected|STALE_DATA|is at/i.test(msg)) return json({ error: 'conflict' }, 409);
    throw new Error(msg);
  }
  console.log('publish', user.email, data.data.createCommitOnBranch.commit.oid, files.map((f) => f.path).join(' '));
  return json({ commit: data.data.createCommitOnBranch.commit.oid });
}

// Existing content files only: the fixed list, or a file directly inside a content folder.
function writable(path) {
  if (typeof path !== 'string') return false;
  if (CONTENT_FILES.includes(path)) return true;
  const dir = CONTENT_DIRS.find((d) => path.startsWith(`${d}/`));
  return Boolean(dir) && /^[a-z0-9][a-z0-9-]*\.(ya?ml|mdx?)$/.test(path.slice(dir.length + 1));
}

async function publishStatus(env) {
  // Needs "Actions: Read-only" on the token; without it the panel just shows no status.
  const res = await githubRaw(env, 'GET', `/repos/${env.REPO}/actions/runs?branch=${env.BRANCH}&per_page=1`);
  if (!res.ok) return json({ status: 'unknown' });
  const run = (await res.json()).workflow_runs?.[0];
  if (!run) return json({ status: 'unknown' });
  return json({ status: run.status, conclusion: run.conclusion, updated: run.updated_at, url: run.html_url });
}

async function github(env, method, path, body) {
  const res = await githubRaw(env, method, path, body);
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

function githubRaw(env, method, path, body) {
  return fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'pannello-equitazione-alpina',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/* ---------- helpers ---------- */

function corsHeaders(origin, env) {
  const origins = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim());
  return origins.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : { Vary: 'Origin' };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

const enc = new TextEncoder();
const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function b64utf8(text) {
  const bytes = enc.encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function randomToken() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(text) {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function hmacKey(secret) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(mac)}`;
}

async function verify(token, secret) {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const key = await hmacKey(secret);
  try {
    // a malformed token (bad base64, bad JSON) is simply not a valid session
    const ok = await crypto.subtle.verify('HMAC', key, unb64url(mac), enc.encode(body));
    return ok ? JSON.parse(new TextDecoder().decode(unb64url(body))) : null;
  } catch {
    return null;
  }
}
