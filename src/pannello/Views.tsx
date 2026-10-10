// Right-hand side of the panel: a read-only view of the selected item (phase 1).
import type { ComponentChildren } from 'preact';
import { md } from './md';
import { listItems, pageUrl, photoUrl, type Item } from './content';

const BLOCK_LABELS: Record<string, string> = {
  hero: 'Apertura',
  text: 'Testo',
  'text-image': 'Testo con foto',
  facts: 'Dati in evidenza',
  cards: 'Schede',
  places: 'Luoghi',
  quote: 'Citazione',
  'gallery-preview': 'Anteprima della galleria',
  gallery: 'Galleria',
  reviews: 'Recensioni',
  faq: 'Domande frequenti',
  curiosity: 'Lo sapevi?',
  'article-list': 'Elenco degli articoli',
  map: 'Mappa',
  'cta-contact': 'Contatti',
};

const FIELD_LABELS: Record<string, string> = {
  kicker: 'Etichetta',
  title: 'Titolo',
  heading: 'Titolo',
  intro: 'Introduzione',
  body: 'Testo',
  lead: 'Frase in evidenza',
  closing: 'Frase finale',
  text: 'Testo',
  author: 'Firma',
  caption: 'Didascalia',
  side: 'Posizione della foto',
  style: 'Stile',
  items: 'Elementi',
  label: 'Etichetta',
  value: 'Valore',
  link: 'Collegamento',
  name: 'Nome',
  season: 'Stagione',
  count: 'Quanti',
  tag: 'Argomento',
  ids: 'Selezione',
  section: 'Sezione',
  rating: 'Valutazione',
  sourceLabel: 'Fonte',
  sourceUrl: 'Collegamento alla fonte',
  form: 'Modulo di contatto',
  question: 'Domanda',
  answer: 'Risposta',
  place: 'Luogo',
  details: 'Dettagli',
  footnote: 'Nota in fondo',
  panelKicker: 'Etichetta del riquadro',
  panel: 'Riquadro',
  note: 'Nota',
  altitude: 'Altitudine (m)',
  tags: 'Argomenti',
  date: 'Data',
  stars: 'Stelle',
  sections: 'Sezioni',
};

// technical fields the client never sees (they stay untouched in the files)
const HIDDEN = new Set([
  'type', 'anchor', 'coordinates', 'video', 'approximate', 'fit', 'ridges', 'id',
  'imageAlt', 'alt', 'coverAlt', // shown under their photo
  'gallery', // the block has its own "Apri le foto della galleria" button
]);
const MARKDOWN = new Set(['intro', 'body', 'text', 'answer']);
const PHOTO = new Set(['image', 'cover', 'file']);
const SIDE: Record<string, string> = { left: 'Sinistra', right: 'Destra', below: 'Sotto il testo', overlay: 'Sotto il testo, sovrapposta' };
const STATE: Record<string, string> = {
  live: 'Pubblicata',
  hidden: 'Online, nascosta dal menu',
  draft: 'Bozza: non è sul sito',
  mock: 'Con testi o foto di prova',
};

export function Photo({ src, alt, size = 'm', caption = true }: { src: unknown; alt?: unknown; size?: 's' | 'm'; caption?: boolean }) {
  const url = photoUrl(src);
  if (!url) return null;
  return (
    <figure class={`p-photo p-photo--${size}`}>
      <img src={url} alt={String(alt || '')} loading="lazy" />
      {caption &&
        (alt ? <figcaption>{String(alt)}</figcaption> : <figcaption class="p-missing">Manca la descrizione della foto</figcaption>)}
    </figure>
  );
}

const itDate = (v: unknown) => {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v ?? '');
};

function Counter({ text, max }: { text: unknown; max: number }) {
  const n = String(text || '').length;
  return <span class={`p-count${n > max ? ' p-count--over' : ''}`}>{n} / {max}</span>;
}

function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="p-field">
      <div class="p-field__label">{label}</div>
      <div class="p-field__value">{children}</div>
    </div>
  );
}

function Value({ k, v, parent }: { k: string; v: unknown; parent: Record<string, any> }) {
  if (PHOTO.has(k)) return <Photo src={v} alt={parent.imageAlt ?? parent.alt ?? parent.coverAlt} />;
  if (typeof v === 'boolean') return <>{v ? 'Sì' : 'No'}</>;
  if (k === 'side' && typeof v === 'string') return <>{SIDE[v] ?? v}</>;
  if (typeof v === 'string') {
    if (MARKDOWN.has(k)) return <div class="p-prose" dangerouslySetInnerHTML={{ __html: md(v) }} />;
    if (/^https?:\/\//.test(v)) return <a href={v} target="_blank" rel="noopener">{v}</a>;
    return <>{v}</>;
  }
  if (typeof v === 'number') return <>{v}</>;
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== 'object')) return <div class="p-chips">{v.map((x) => <span class="p-chip">{String(x)}</span>)}</div>;
    return (
      <div class="p-sub">
        {v.map((obj, i) => (
          <div class="p-subcard" key={i}>
            <Fields obj={obj} />
          </div>
        ))}
      </div>
    );
  }
  if (v && typeof v === 'object') return <Fields obj={v as Record<string, any>} />;
  return null;
}

function Fields({ obj }: { obj: Record<string, any> }) {
  return (
    <>
      {Object.entries(obj)
        .filter(([k, v]) => !HIDDEN.has(k) && v !== '' && v != null)
        .map(([k, v]) => (
          <Field label={PHOTO.has(k) ? 'Foto' : FIELD_LABELS[k] ?? k} key={k}>
            <Value k={k} v={v} parent={obj} />
          </Field>
        ))}
    </>
  );
}

function Header({ item, children }: { item: Item; children?: ComponentChildren }) {
  return (
    <header class="p-head">
      <div>
        <h1>{item.data.title || item.title}</h1>
        <div class="p-head__meta">
          <span class={`p-dot p-dot--${item.state}`} /> {STATE[item.state]}
          {children}
        </div>
      </div>
    </header>
  );
}

const ReadOnly = () => (
  <p class="p-note">Per ora il pannello mostra i contenuti in sola lettura: la modifica arriva con il prossimo aggiornamento.</p>
);

function PageView({ item, open }: { item: Item; open: (id: string) => void }) {
  const d = item.data;
  return (
    <>
      <Header item={item}>
        {!d.draft && (
          <a class="p-link" href={pageUrl(d.slug ?? '')} target="_blank" rel="noopener">
            Vedi sul sito ↗
          </a>
        )}
      </Header>
      <ReadOnly />
      <section class="p-card">
        <h2>Google e condivisione</h2>
        <Field label="Titolo per Google">
          {d.seo?.title} <Counter text={d.seo?.title} max={60} />
        </Field>
        <Field label="Descrizione per Google">
          {d.seo?.description} <Counter text={d.seo?.description} max={155} />
        </Field>
        <Field label="Foto quando la pagina viene condivisa">
          <Photo src={d.seo?.image} size="s" caption={false} />
        </Field>
      </section>
      <section class="p-card">
        <h2>Menu</h2>
        <Field label="Indirizzo">/{d.slug ? `${d.slug}/` : ''}</Field>
        <Field label="Nome nel menu">{d.nav?.label || d.title}</Field>
        <Field label="Posizione">{d.nav?.order ?? 100}</Field>
      </section>
      {(d.blocks || []).map((b: Record<string, any>, i: number) => (
        <section class="p-card" key={i}>
          <h2>
            <span class="p-num">{i + 1}</span> {BLOCK_LABELS[b.type] ?? b.type}
          </h2>
          <Fields obj={b} />
          {(b.type === 'gallery' || b.type === 'gallery-preview') && b.gallery && (
            <button class="p-btn" type="button" onClick={() => open(`src/content/it/galleries/${b.gallery}.yaml`)}>
              Apri le foto della galleria
            </button>
          )}
        </section>
      ))}
    </>
  );
}

function ArticleView({ item }: { item: Item }) {
  const d = item.data;
  const slug = item.id.split('/').pop()!.replace(/\.mdx?$/, '');
  return (
    <>
      <Header item={item}>
        {!d.draft && (
          <a class="p-link" href={pageUrl(`curiosita/${slug}`)} target="_blank" rel="noopener">
            Vedi sul sito ↗
          </a>
        )}
      </Header>
      <ReadOnly />
      <section class="p-card">
        <Field label="Data">{itDate(d.date)}</Field>
        <Field label="Riassunto">
          {d.summary} <Counter text={d.summary} max={155} />
        </Field>
        <Field label="Copertina">
          <Photo src={d.cover} alt={d.coverAlt} />
        </Field>
        <Field label="Sezione">{d.section}</Field>
      </section>
      <section class="p-card">
        <h2>Testo</h2>
        <div class="p-prose" dangerouslySetInnerHTML={{ __html: md(item.body) }} />
      </section>
    </>
  );
}

function GalleryView({ item }: { item: Item }) {
  const photos: Record<string, any>[] = item.data.photos || [];
  return (
    <>
      <Header item={item} />
      <ReadOnly />
      <section class="p-grid">
        {photos.map((p, i) => (
          <div class="p-tile" key={i}>
            <img src={photoUrl(p.file) ?? ''} alt={p.alt || ''} loading="lazy" />
            <div class="p-tile__text">
              {p.caption && <strong>{p.caption}</strong>}
              <span>{p.alt || <em class="p-missing">Manca la descrizione</em>}</span>
              {p.place && <span class="p-quiet">{p.place}</span>}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function ListView({ item }: { item: Item }) {
  return (
    <>
      <Header item={item} />
      <ReadOnly />
      {listItems(item.data).map((obj, i) => (
        <section class="p-card" key={i}>
          <Fields obj={obj} />
        </section>
      ))}
    </>
  );
}

function SettingsView({ item }: { item: Item }) {
  const d = item.data;
  const addr = d.address || {};
  return (
    <>
      <Header item={item} />
      <ReadOnly />
      <section class="p-card">
        <h2>Contatti</h2>
        <Field label="Nome">{d.name}</Field>
        <Field label="Telefono">{d.phone}</Field>
        <Field label="WhatsApp">{d.whatsapp}</Field>
        <Field label="Email">{d.email}</Field>
        <Field label="Indirizzo">
          {addr.street}, {addr.postalCode} {addr.locality} ({addr.province})
        </Field>
      </section>
      <section class="p-card">
        <h2>Orari</h2>
        {(d.hours || []).map((h: Record<string, any>, i: number) => (
          <Field label={h.days} key={i}>
            {h.hours}
          </Field>
        ))}
      </section>
      <section class="p-card">
        <h2>Social</h2>
        {(d.social || []).map((s: Record<string, any>, i: number) => (
          <Field label={s.label} key={i}>
            <a href={s.url} target="_blank" rel="noopener">{s.url}</a>
          </Field>
        ))}
      </section>
      <section class="p-card">
        <h2>Dati legali</h2>
        <Field label="Ragione sociale">{d.legalName}</Field>
        <Field label="Partita IVA">{d.vatNumber}</Field>
      </section>
    </>
  );
}

export function View({ item, open }: { item: Item; open: (id: string) => void }) {
  switch (item.kind) {
    case 'page':
      return <PageView item={item} open={open} />;
    case 'article':
      return <ArticleView item={item} />;
    case 'gallery':
      return <GalleryView item={item} />;
    case 'list':
      return <ListView item={item} />;
    case 'settings':
      return <SettingsView item={item} />;
  }
}
