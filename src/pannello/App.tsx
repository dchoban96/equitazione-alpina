// The control panel: sign-in, the menu of pages and articles on the left,
// the selected item on the right. Phase 1 shows everything read-only.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api, apiConfigured, ApiError, loadSession, saveSession, type Session } from './api';
import { buildModel, type Item, type Model, type RawFile } from './content';
import { View } from './Views';

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [linkError, setLinkError] = useState('');
  const [checking, setChecking] = useState(() => new URLSearchParams(location.search).has('accesso'));

  // Opening the emailed link: trade the one-time code for a session, then tidy the address bar.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('accesso');
    if (!token) return;
    params.delete('accesso');
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
    api<Session>('/auth/verify', { body: { token } })
      .then((s) => {
        saveSession(s);
        setSession(s);
      })
      .catch((e) => setLinkError(e.message))
      .finally(() => setChecking(false));
  }, []);

  const signOut = () => {
    saveSession(null);
    setSession(null);
  };

  if (checking) return <Splash text="Accesso in corso…" />;
  if (!session) return <Login error={linkError} />;
  return <Shell session={session} onSignOut={signOut} />;
}

function Splash({ text }: { text: string }) {
  return (
    <div class="p-splash">
      <div class="p-spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function Login({ error }: { error: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState('');
  const [err, setErr] = useState(error);

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ ok: boolean; devLink?: string }>('/auth/request', { body: { email } });
      setSent(true);
      setDevLink(r.devLink || '');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="p-login">
      <div class="p-login__box">
        <p class="p-login__kicker">Equitazione Alpina</p>
        <h1>Pannello del sito</h1>
        {!apiConfigured() ? (
          <p class="p-error">Il pannello non è ancora collegato al suo servizio.</p>
        ) : sent ? (
          <>
            <p>
              Se <strong>{email}</strong> è tra gli indirizzi abilitati, riceverai a breve un'email con il collegamento per
              entrare. Il collegamento vale 15 minuti e funziona una volta sola.
            </p>
            {devLink && (
              <p class="p-note">
                Prova locale, nessuna email inviata: <a href={devLink}>entra da qui</a>
              </p>
            )}
            <button class="p-btn p-btn--quiet" type="button" onClick={() => setSent(false)}>
              Usa un altro indirizzo
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <label for="p-email">La tua email</label>
            <input
              id="p-email"
              type="email"
              required
              autocomplete="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            />
            {err && <p class="p-error">{err}</p>}
            <button class="p-btn p-btn--primary" type="submit" disabled={busy}>
              {busy ? 'Invio…' : 'Inviami il collegamento'}
            </button>
            <p class="p-quiet">Niente password: ti mandiamo un collegamento per entrare.</p>
          </form>
        )}
      </div>
    </main>
  );
}

interface Status {
  status: string;
  conclusion?: string | null;
  updated?: string;
  url?: string;
}

function statusText(s: Status | null): { text: string; tone: string } {
  if (!s || s.status === 'unknown') return { text: '', tone: '' };
  if (s.status !== 'completed') return { text: 'Pubblicazione in corso…', tone: 'busy' };
  if (s.conclusion !== 'success') return { text: 'Ultima pubblicazione non riuscita', tone: 'bad' };
  const when = s.updated ? new Date(s.updated).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '';
  return { text: `Sito aggiornato${when ? ` · ${when}` : ''}`, tone: 'ok' };
}

const currentId = () => decodeURIComponent(location.hash.replace(/^#\/?/, ''));

function Shell({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(currentId);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) onSignOut();
    else setError((e as Error).message);
  };

  const load = () => {
    setError('');
    api<{ head: string; files: RawFile[]; photos: string[] }>('/content', { session: session.session })
      .then((r) => setModel(buildModel(r.head, r.files, r.photos)))
      .catch(fail);
  };
  useEffect(load, []);

  // the address bar remembers the open item, so Back and reloading work
  useEffect(() => {
    const onHash = () => setSelected(currentId());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    // every minute, every 15 seconds while a publication is running
    // (skipped while the tab is in the background, refreshed when it comes back)
    let timer = 0;
    let stopped = false;
    const poll = async (force = false) => {
      clearTimeout(timer);
      let s: Status | null = null;
      if (force || document.visibilityState === 'visible') {
        s = await api<Status>('/status', { session: session.session }).catch(() => null);
        if (!stopped) setStatus(s);
      }
      const running = s && s.status !== 'completed' && s.status !== 'unknown';
      if (!stopped) timer = window.setTimeout(poll, running ? 15000 : 60000);
    };
    const onVisible = () => document.visibilityState === 'visible' && poll();
    poll(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => document.querySelector('.p-row--on')?.scrollIntoView({ block: 'nearest' }), [selected, model]);

  const open = (id: string) => {
    location.hash = `/${id}`;
    setMenuOpen(false);
    document.querySelector('.p-main')?.scrollTo(0, 0);
  };

  const item = model && selected ? model.byId.get(selected) : undefined;
  const st = statusText(status);

  return (
    <div class={`p-shell${menuOpen ? ' p-shell--menu' : ''}`}>
      <aside class="p-side" aria-label="Contenuti del sito">
        <div class="p-side__top">
          <a class="p-brand" href="#/" onClick={() => setMenuOpen(false)}>
            Pannello
          </a>
          <button class="p-btn p-btn--quiet" type="button" disabled title="Arriva con un prossimo aggiornamento">
            + Nuovo
          </button>
        </div>
        <input
          class="p-search"
          type="search"
          placeholder="Cerca"
          aria-label="Cerca tra pagine e articoli"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <nav class="p-nav">{model ? <Menu model={model} query={query} selected={selected} open={open} /> : null}</nav>
        <div class="p-side__foot">
          {st.text &&
            (status?.url ? (
              <a class={`p-status p-status--${st.tone}`} href={status.url} target="_blank" rel="noopener">
                {st.text}
              </a>
            ) : (
              <span class={`p-status p-status--${st.tone}`}>{st.text}</span>
            ))}
          <div class="p-user">
            <span title={session.email}>{session.email}</span>
            <button class="p-btn p-btn--quiet" type="button" onClick={onSignOut}>
              Esci
            </button>
          </div>
        </div>
      </aside>
      <button class="p-scrim" type="button" aria-label="Chiudi il menu" onClick={() => setMenuOpen(false)} />
      <main class="p-main">
        <div class="p-mobilebar">
          <button class="p-btn" type="button" onClick={() => setMenuOpen(true)} aria-label="Apri il menu">
            ☰ Menu
          </button>
          <span>{item?.title}</span>
        </div>
        <div class="p-content">
          {error ? (
            <div class="p-card">
              <p class="p-error">{error}</p>
              <button class="p-btn" type="button" onClick={load}>
                Riprova
              </button>
            </div>
          ) : !model ? (
            <Splash text="Carico i contenuti…" />
          ) : item ? (
            <View item={item} open={open} />
          ) : (
            <Welcome model={model} open={open} />
          )}
        </div>
      </main>
    </div>
  );
}

const matches = (it: Item, q: string) => it.title.toLowerCase().includes(q) || String(it.data.slug ?? '').includes(q);

function Menu({ model, query, selected, open }: { model: Model; query: string; selected: string; open: (id: string) => void }) {
  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () => model.groups.map((g) => ({ ...g, items: q ? g.items.filter((it) => matches(it, q)) : g.items })).filter((g) => g.items.length),
    [model, q],
  );
  const row = (it: Item, depth = it.depth) => (
    <li key={it.id}>
      <a
        href={`#/${it.id}`}
        class={`p-row${it.id === selected ? ' p-row--on' : ''}`}
        style={{ paddingLeft: `${0.75 + (q ? 0 : depth) * 0.9}rem` }}
        onClick={(e) => {
          e.preventDefault();
          open(it.id);
        }}
      >
        <span class={`p-dot p-dot--${it.state}`} aria-hidden="true" />
        <span class="p-row__text">{it.title}</span>
      </a>
    </li>
  );
  return (
    <>
      {model.settings && (!q || matches(model.settings, q)) && <ul class="p-group">{row(model.settings, 0)}</ul>}
      {groups.map((g) => (
        <section key={g.key}>
          <h2 class="p-group__label">{g.label}</h2>
          <ul class="p-group">{g.items.map((it) => row(it))}</ul>
        </section>
      ))}
      {q && !groups.length && <p class="p-quiet p-pad">Nessun risultato.</p>}
    </>
  );
}

function Welcome({ model, open }: { model: Model; open: (id: string) => void }) {
  const all = model.groups.flatMap((g) => g.items);
  const count = (k: string) => all.filter((i) => i.kind === k).length;
  const mock = all.filter((i) => i.state === 'mock');
  return (
    <>
      <header class="p-head">
        <h1>Benvenuto</h1>
      </header>
      <p class="p-note">Per ora il pannello mostra i contenuti in sola lettura: la modifica arriva con il prossimo aggiornamento.</p>
      <section class="p-card">
        <p>
          Il sito ha <strong>{count('page')}</strong> pagine, <strong>{count('article')}</strong> articoli,{' '}
          <strong>{count('gallery')}</strong> gallerie e <strong>{model.photos.length}</strong> foto. Scegli dal menu cosa
          vuoi vedere.
        </p>
        <ul class="p-legend">
          <li><span class="p-dot p-dot--live" /> Pubblicata</li>
          <li><span class="p-dot p-dot--hidden" /> Online, nascosta dal menu</li>
          <li><span class="p-dot p-dot--mock" /> Con testi o foto di prova</li>
          <li><span class="p-dot p-dot--draft" /> Bozza, non è sul sito</li>
        </ul>
      </section>
      {mock.length > 0 && (
        <section class="p-card">
          <h2>Da completare</h2>
          <p class="p-quiet">Queste pagine hanno ancora testi o foto di prova.</p>
          <ul class="p-links">
            {mock.map((m) => (
              <li key={m.id}>
                <a href={`#/${m.id}`} onClick={(e) => (e.preventDefault(), open(m.id))}>
                  {m.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
