// Editing a page or an article. Every change is kept as a draft in this
// browser (drafts.ts) until Pubblica sends all of them in one commit.
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { pageUrl, photoUrl, type Item } from './content';
import { addPhoto } from './photos';
import { allDrafts, discard, rebase, saveDraft, working } from './drafts';
import { md } from './md';
import { ORIGIN } from './save';
import { problems } from './validate';
import { Photo } from './Views';

type Path = (string | number)[];
type Data = Record<string, any>;

/* ---------- what each section shows, in the site's order ---------- */

type Kind = 'line' | 'para' | 'md' | 'photo' | 'bool' | 'side' | 'style' | 'section' | 'number' | 'pairs' | 'items' | 'chips' | 'url';
interface Spec {
  key: string;
  kind: Kind;
  label: string;
  req?: boolean; // the site needs it: cleared fields stay as "" instead of being removed
  alt?: string; // photo: the key of its description
  min?: number;
  max?: number;
  item?: Spec[]; // items: the fields of one entry
  blank?: Data; // items: a new entry
  hint?: string;
  limit?: number; // characters, shown as a counter
}

const HEADING: Spec[] = [
  { key: 'kicker', kind: 'line', label: 'Etichetta sopra il titolo' },
  { key: 'note', kind: 'line', label: 'Nota accanto all\'etichetta' },
  { key: 'heading', kind: 'line', label: 'Titolo' },
];
const PAIRS = (key: string, label: string, min = 0): Spec => ({ key, kind: 'pairs', label, min });

const BLOCKS: Record<string, { name: string; fields: Spec[] }> = {
  hero: {
    name: 'Apertura',
    fields: [
      { key: 'kicker', kind: 'line', label: 'Etichetta sopra il titolo' },
      { key: 'title', kind: 'line', label: 'Titolo principale', req: true },
      { key: 'intro', kind: 'md', label: 'Introduzione' },
      { key: 'closing', kind: 'line', label: 'Frase finale' },
      { key: 'footnote', kind: 'line', label: 'Nota in fondo' },
      { key: 'image', kind: 'photo', label: 'Foto', alt: 'imageAlt' },
      { key: 'panelKicker', kind: 'line', label: 'Titolo del riquadro' },
      PAIRS('panel', 'Riquadro'),
    ],
  },
  text: {
    name: 'Testo',
    fields: [...HEADING, { key: 'image', kind: 'photo', label: 'Foto sotto il titolo', alt: 'alt' }, { key: 'body', kind: 'md', label: 'Testo', req: true }],
  },
  'text-image': {
    name: 'Testo con foto',
    fields: [
      ...HEADING,
      { key: 'lead', kind: 'para', label: 'Frase in evidenza' },
      { key: 'body', kind: 'md', label: 'Testo' },
      { key: 'image', kind: 'photo', label: 'Foto', alt: 'alt' },
      { key: 'caption', kind: 'line', label: 'Didascalia' },
      { key: 'side', kind: 'side', label: 'Posizione della foto', req: true },
      PAIRS('details', 'Dettagli'),
    ],
  },
  facts: { name: 'Dati in evidenza', fields: [...HEADING, PAIRS('items', 'Dati', 1)] },
  cards: {
    name: 'Schede',
    fields: [
      ...HEADING,
      { key: 'style', kind: 'style', label: 'Aspetto', req: true },
      {
        key: 'items',
        kind: 'items',
        label: 'Schede',
        min: 1,
        blank: { title: '' },
        item: [
          { key: 'title', kind: 'line', label: 'Titolo', req: true },
          { key: 'label', kind: 'line', label: 'Etichetta' },
          { key: 'text', kind: 'md', label: 'Testo' },
          { key: 'link', kind: 'url', label: 'Collegamento', hint: 'Una pagina del sito, es. /equitazione/lezioni/' },
          { key: 'image', kind: 'photo', label: 'Foto', alt: 'alt' },
        ],
      },
    ],
  },
  places: {
    name: 'Luoghi',
    fields: [
      ...HEADING,
      {
        key: 'items',
        kind: 'items',
        label: 'Luoghi',
        min: 1,
        blank: { name: '' },
        item: [
          { key: 'name', kind: 'line', label: 'Nome', req: true },
          { key: 'season', kind: 'line', label: 'Stagione' },
          { key: 'text', kind: 'md', label: 'Testo' },
        ],
      },
    ],
  },
  quote: {
    name: 'Citazione',
    fields: [
      { key: 'text', kind: 'para', label: 'Citazione', req: true },
      { key: 'author', kind: 'line', label: 'Firma' },
    ],
  },
  'gallery-preview': {
    name: 'Anteprima della galleria',
    fields: [
      ...HEADING,
      { key: 'count', kind: 'number', label: 'Foto mostrate', min: 4, max: 6 },
      { key: 'link', kind: 'url', label: 'Collegamento "vedi tutte"' },
    ],
  },
  gallery: { name: 'Galleria', fields: HEADING },
  reviews: {
    name: 'Recensioni',
    fields: [
      ...HEADING,
      { key: 'rating', kind: 'line', label: 'Valutazione', hint: 'es. 4,9 su 5' },
      { key: 'count', kind: 'line', label: 'Numero di recensioni' },
      { key: 'sourceLabel', kind: 'line', label: 'Nome della fonte' },
      { key: 'sourceUrl', kind: 'url', label: 'Indirizzo della fonte' },
      { key: 'ids', kind: 'chips', label: 'Recensioni mostrate' },
    ],
  },
  faq: {
    name: 'Domande frequenti',
    fields: [...HEADING, { key: 'tag', kind: 'chips', label: 'Argomento' }, { key: 'ids', kind: 'chips', label: 'Domande mostrate' }],
  },
  curiosity: { name: 'Lo sapevi?', fields: [{ key: 'section', kind: 'section', label: 'Scelto tra quelli della sezione' }] },
  'article-list': {
    name: 'Elenco degli articoli',
    fields: [
      ...HEADING,
      { key: 'section', kind: 'section', label: 'Articoli della sezione' },
      { key: 'count', kind: 'number', label: 'Quanti articoli', min: 1, max: 24 },
    ],
  },
  map: {
    name: 'Mappa',
    fields: [
      ...HEADING,
      { key: 'label', kind: 'line', label: 'Etichetta', req: true },
      { key: 'image', kind: 'photo', label: 'Immagine', alt: 'alt' },
    ],
  },
  'cta-contact': {
    name: 'Contatti',
    fields: [...HEADING, { key: 'body', kind: 'md', label: 'Testo' }, { key: 'form', kind: 'bool', label: 'Mostra il modulo di contatto' }],
  },
};

const SECTIONS: Record<string, string> = {
  home: 'Home',
  equitazione: 'Equitazione',
  'pastore-del-lagorai': 'Pastore del Lagorai',
  'capra-orobica': 'Capra Orobica',
  valtellina: 'Valtellina',
  curiosita: 'Curiosità',
  info: 'Informazioni',
  demo: 'Demo',
};

/* ---------- small pieces ---------- */

function setIn(obj: any, path: Path, value: unknown): any {
  if (!path.length) return value;
  const [k, ...rest] = path;
  const copy = Array.isArray(obj) ? [...obj] : { ...(obj ?? {}) };
  (copy as any)[k] = setIn(copy[k as any], rest, value);
  return copy;
}

function Count({ text, max }: { text: string; max: number }) {
  const n = text.length;
  return <span class={`p-count${n > max ? ' p-count--over' : ''}`}>{n} / {max}</span>;
}

function Labelled({ label, side, hint, children }: { label: string; side?: ComponentChildren; hint?: string; children: ComponentChildren }) {
  return (
    <label class="p-input">
      <span class="p-input__label">
        {label}
        {side}
      </span>
      {children}
      {hint && <span class="p-quiet">{hint}</span>}
    </label>
  );
}

function Grow({ value, onInput, rows = 2, ...rest }: { value: string; onInput: (v: string) => void; rows?: number; [k: string]: any }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={rows} value={value} onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)} {...rest} />;
}

/** Markdown with a toolbar: bold, italic, link, list (and subheadings in articles). */
function Markdown({ value, onInput, headings, big, label }: { value: string; onInput: (v: string) => void; headings?: boolean; big?: boolean; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const area = () => ref.current?.querySelector('textarea') as HTMLTextAreaElement;
  const edit = (fn: (sel: string) => [string, number?, number?], placeholder: string) => {
    const t = area();
    const { selectionStart: s, selectionEnd: e } = t;
    const sel = value.slice(s, e) || placeholder;
    const [text, from = 0, to = text.length] = fn(sel);
    onInput(value.slice(0, s) + text + value.slice(e));
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(s + from, s + to);
    });
  };
  const wrap = (mark: string, ph: string) => edit((sel) => [`${mark}${sel}${mark}`, mark.length, mark.length + sel.length], ph);
  const lines = (prefix: string, ph: string) =>
    edit((sel) => {
      const t = area();
      const atLineStart = t.selectionStart === 0 || value[t.selectionStart - 1] === '\n';
      const text = (atLineStart ? '' : '\n') + sel.split('\n').map((l) => prefix + l).join('\n');
      return [text];
    }, ph);
  const link = () => {
    const url = prompt('Indirizzo del collegamento (una pagina del sito come /contatti/, oppure https://…)');
    if (url) edit((sel) => [`[${sel}](${url.trim()})`, 1, 1 + sel.length], 'testo del collegamento');
  };
  return (
    <div class="p-md" ref={ref}>
      <div class="p-md__bar" role="toolbar" aria-label="Formattazione">
        <button type="button" onClick={() => wrap('**', 'testo')} title="Grassetto"><b>G</b></button>
        <button type="button" onClick={() => wrap('*', 'testo')} title="Corsivo"><i>C</i></button>
        <button type="button" onClick={link} title="Collegamento">Link</button>
        <button type="button" onClick={() => lines('- ', 'voce')} title="Elenco puntato">• Elenco</button>
        {headings && <button type="button" onClick={() => lines('## ', 'Titoletto')} title="Titoletto">Titoletto</button>}
      </div>
      <Grow aria-label={label} value={value} onInput={onInput} rows={big ? 14 : 3} />
      <details class="p-md__preview">
        <summary>Anteprima</summary>
        <div class="p-prose" dangerouslySetInnerHTML={{ __html: md(value) }} />
      </details>
    </div>
  );
}

function Mover({ i, n, min = 0, floor = 0, onMove, onRemove, what }: { i: number; n: number; min?: number; floor?: number; onMove: (to: number) => void; onRemove: () => void; what: string }) {
  return (
    <span class="p-mover">
      <button type="button" class="p-icon" title="Sposta su" aria-label={`Sposta su ${what}`} disabled={i <= floor} onClick={() => onMove(i - 1)}>↑</button>
      <button type="button" class="p-icon" title="Sposta giù" aria-label={`Sposta giù ${what}`} disabled={i >= n - 1} onClick={() => onMove(i + 1)}>↓</button>
      <button type="button" class="p-icon p-icon--danger" title="Elimina" aria-label={`Elimina ${what}`} disabled={n <= min} onClick={onRemove}>✕</button>
    </span>
  );
}

const move = <T,>(list: T[], from: number, to: number) => {
  const copy = [...list];
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
};

/* ---------- one field ---------- */

function FieldEdit({ spec, obj, path, set }: { spec: Spec; obj: Data; path: Path; set: (p: Path, v: unknown) => void }) {
  const v = obj[spec.key];
  const here = [...path, spec.key];
  const text = (val: string) => set(here, val === '' && !spec.req ? undefined : val);
  switch (spec.kind) {
    case 'line':
    case 'url':
      return (
        <Labelled label={spec.label} hint={spec.hint} side={spec.limit && <Count text={v ?? ''} max={spec.limit} />}>
          <input type="text" aria-label={spec.label} value={v ?? ''} onInput={(e) => text((e.target as HTMLInputElement).value)} />
        </Labelled>
      );
    case 'para':
      return (
        <Labelled label={spec.label} hint={spec.hint} side={spec.limit && <Count text={v ?? ''} max={spec.limit} />}>
          <Grow aria-label={spec.label} value={v ?? ''} onInput={text} />
        </Labelled>
      );
    case 'md':
      return (
        <Labelled label={spec.label}>
          <Markdown label={spec.label} value={v ?? ''} onInput={text} />
        </Labelled>
      );
    case 'photo':
      if (!v) return null;
      return (
        <div class="p-input">
          <span class="p-input__label">{spec.label}</span>
          <div class="p-photoedit">
            <div>
              <Photo src={v} size="s" caption={false} />
              <PhotoPicker label="Cambia foto" prefix={String(spec.alt === 'coverAlt' ? 'copertina' : 'foto')} onPicked={([f]) => set(here, f)} />
            </div>
            <Labelled label="Descrizione della foto" hint="Per Google e per chi usa un lettore di schermo: cosa si vede nella foto.">
              <Grow aria-label="Descrizione della foto" value={obj[spec.alt!] ?? ''} onInput={(val) => set([...path, spec.alt!], val)} />
            </Labelled>
          </div>
        </div>
      );
    case 'bool':
      return (
        <label class="p-check">
          <input type="checkbox" checked={v !== false} onChange={(e) => set(here, (e.target as HTMLInputElement).checked)} />
          {spec.label}
        </label>
      );
    case 'side':
      return (
        <Labelled label={spec.label}>
          <select aria-label={spec.label} value={v ?? 'right'} onChange={(e) => set(here, (e.target as HTMLSelectElement).value)}>
            <option value="right">A destra del testo</option>
            <option value="left">A sinistra del testo</option>
            <option value="below">Sotto il testo</option>
            <option value="overlay">Grande, con il testo sopra</option>
          </select>
        </Labelled>
      );
    case 'style':
      return (
        <Labelled label={spec.label}>
          <select aria-label={spec.label} value={v ?? 'tiles'} onChange={(e) => set(here, (e.target as HTMLSelectElement).value)}>
            <option value="tiles">Riquadri</option>
            <option value="cards">Schede con bordo</option>
          </select>
        </Labelled>
      );
    case 'section':
      return (
        <Labelled label={spec.label}>
          <select aria-label={spec.label} value={v ?? ''} onChange={(e) => set(here, (e.target as HTMLSelectElement).value || undefined)}>
            <option value="">Tutte</option>
            {Object.entries(SECTIONS).map(([k, l]) => (
              <option value={k} key={k}>{l}</option>
            ))}
          </select>
        </Labelled>
      );
    case 'number':
      return (
        <Labelled label={spec.label}>
          <select aria-label={spec.label} value={String(v ?? '')} onChange={(e) => set(here, Number((e.target as HTMLSelectElement).value))}>
            {v == null && <option value="">Predefinito</option>}
            {Array.from({ length: spec.max! - spec.min! + 1 }, (_, k) => spec.min! + k).map((n) => (
              <option value={n} key={n}>{n}</option>
            ))}
          </select>
        </Labelled>
      );
    case 'chips': {
      if (v == null || (Array.isArray(v) && !v.length)) return null;
      const list = Array.isArray(v) ? v : [v];
      return (
        <div class="p-input">
          <span class="p-input__label">{spec.label}</span>
          <div class="p-chips">{list.map((x) => <span class="p-chip" key={String(x)}>{String(x)}</span>)}</div>
          <span class="p-quiet">Si sceglie dalle liste in «Altro».</span>
        </div>
      );
    }
    case 'pairs': {
      const list: Data[] = v || [];
      if (!list.length && !spec.min && spec.key !== 'items') return null;
      return (
        <div class="p-input">
          <span class="p-input__label">{spec.label}</span>
          {list.map((row, i) => (
            <div class="p-pair" key={row[ORIGIN] ?? `n${i}`}>
              <input type="text" aria-label="Etichetta" placeholder="Etichetta" value={row.label ?? ''} onInput={(e) => set([...here, i, 'label'], (e.target as HTMLInputElement).value)} />
              <input type="text" aria-label="Valore" placeholder="Valore" value={row.value ?? ''} onInput={(e) => set([...here, i, 'value'], (e.target as HTMLInputElement).value)} />
              <Mover i={i} n={list.length} min={spec.min} what="la riga" onMove={(to) => set(here, move(list, i, to))} onRemove={() => set(here, list.filter((_, k) => k !== i))} />
            </div>
          ))}
          <button type="button" class="p-btn p-btn--small" onClick={() => set(here, [...list, { label: '', value: '' }])}>+ Aggiungi una riga</button>
        </div>
      );
    }
    case 'items': {
      const list: Data[] = v || [];
      return (
        <div class="p-input">
          <span class="p-input__label">{spec.label}</span>
          <div class="p-sub">
            {list.map((it, i) => (
              <div class="p-subcard" key={it[ORIGIN] ?? `n${i}`}>
                <div class="p-subcard__head">
                  <span class="p-quiet">{i + 1}</span>
                  <Mover i={i} n={list.length} min={spec.min} what="l'elemento" onMove={(to) => set(here, move(list, i, to))} onRemove={() => confirm('Eliminare questo elemento?') && set(here, list.filter((_, k) => k !== i))} />
                </div>
                {spec.item!.map((s) => (
                  <FieldEdit key={s.key} spec={s} obj={it} path={[...here, i]} set={set} />
                ))}
              </div>
            ))}
          </div>
          <button type="button" class="p-btn p-btn--small" onClick={() => set(here, [...list, { ...spec.blank }])}>+ Aggiungi</button>
        </div>
      );
    }
  }
}

/* ---------- choosing photos ---------- */

/** A button that opens the phone's photos or the computer's files, then prepares the chosen photos. */
function PhotoPicker({ label, prefix, multiple, onPicked, primary }: { label: string; prefix: string; multiple?: boolean; onPicked: (paths: string[]) => void; primary?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const paths: string[] = [];
    try {
      for (const [i, file] of [...files].entries()) {
        setBusy(files.length > 1 ? `Preparo le foto… ${i + 1} di ${files.length}` : 'Preparo la foto…');
        paths.push(await addPhoto(file, prefix));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
      if (input.current) input.current.value = '';
    }
    if (paths.length) onPicked(paths);
  };
  return (
    <div class="p-picker">
      <button type="button" class={`p-btn p-btn--small${primary ? ' p-btn--primary' : ''}`} disabled={Boolean(busy)} onClick={() => input.current?.click()}>
        {busy || label}
      </button>
      <input ref={input} type="file" accept="image/*" multiple={multiple} hidden onChange={(e) => pick((e.target as HTMLInputElement).files)} />
      {error && <p class="p-error">{error}</p>}
    </div>
  );
}

function GalleryEditor({ item, data, set }: { item: Item; data: Data; set: (p: Path, v: unknown) => void }) {
  const photos: Data[] = data.photos || [];
  const name = item.id.split('/').pop()!.replace(/\.ya?ml$/, '');
  const field = (i: number, key: string, label: string, opts: { req?: boolean; para?: boolean; hint?: string } = {}) => {
    const v = photos[i][key] ?? '';
    const put = (val: string) => set(['photos', i, key], val === '' && !opts.req ? undefined : val);
    return (
      <Labelled label={label} hint={opts.hint}>
        {opts.para ? (
          <Grow aria-label={label} value={v} onInput={put} />
        ) : (
          <input type="text" aria-label={label} value={v} onInput={(e) => put((e.target as HTMLInputElement).value)} />
        )}
      </Labelled>
    );
  };
  return (
    <>
      <section class="p-card">
        <h2>Galleria</h2>
        <FieldEdit spec={{ key: 'title', kind: 'line', label: 'Titolo della galleria', req: true }} obj={data} path={[]} set={set} />
        <p class="p-quiet">
          {photos.length} foto. Le foto nuove vanno in cima e vengono ridotte a 2400 pixel; la posizione e i dati della fotocamera
          vengono tolti prima di caricarle.
        </p>
        <PhotoPicker
          primary
          multiple
          label="+ Aggiungi foto"
          prefix={name}
          onPicked={(paths) => set(['photos'], [...paths.map((file) => ({ file, alt: '' })), ...photos])}
        />
      </section>
      <div class="p-gedit">
        {photos.map((p, i) => (
          <section class="p-card p-gedit__item" key={p.__i ?? p.file}>
            <div class="p-gedit__photo">
              <img src={photoUrl(p.file) ?? ''} alt="" loading="lazy" />
              <span class="p-num">{i + 1}</span>
            </div>
            <div class="p-gedit__fields">
              <div class="p-gedit__tools">
                <PhotoPicker
                  label="Sostituisci"
                  prefix={name}
                  // the old description was about the old photo: a new one is asked for
                  onPicked={([file]) => set(['photos', i], { ...p, file, alt: '' })}
                />
                <Mover
                  i={i}
                  n={photos.length}
                  what="la foto"
                  onMove={(to) => set(['photos'], move(photos, i, to))}
                  onRemove={() => confirm('Togliere questa foto dalla galleria?') && set(['photos'], photos.filter((_, k) => k !== i))}
                />
              </div>
              {field(i, 'caption', 'Titolo')}
              {field(i, 'alt', 'Descrizione', { req: true, para: true, hint: 'Cosa si vede nella foto. Compare sotto il titolo quando la foto si apre.' })}
              {field(i, 'place', 'Luogo')}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/* ---------- the editor ---------- */

// Unticking writes false only where the file already had the flag, so ticking and unticking is no change.
function Mockup({ item, data, set }: { item: Item; data: Data; set: (p: Path, v: unknown) => void }) {
  return (
    <label class="p-check">
      <input
        type="checkbox"
        checked={data.mockup === true}
        onChange={(e) => set(['mockup'], (e.target as HTMLInputElement).checked ? true : 'mockup' in item.data ? false : undefined)}
      />
      Ha ancora testi o foto di prova
    </label>
  );
}

function DraftBar({ item }: { item: Item }) {
  const d = allDrafts()[item.id];
  if (!d) return null;
  const stale = d.sha !== item.file.sha;
  return (
    <div class={`p-draftbar${stale ? ' p-draftbar--warn' : ''}`}>
      {stale ? (
        <>
          <span>Qualcuno ha pubblicato questa pagina dopo che hai iniziato a modificarla. «Unisci» porta le tue modifiche sulla versione nuova: dove avete cambiato lo stesso testo resta il tuo.</span>
          <span class="p-draftbar__actions">
            <button type="button" class="p-btn p-btn--small" onClick={() => rebase(item)}>Unisci le modifiche</button>
            <button type="button" class="p-btn p-btn--small" onClick={() => discard([item.id])}>Scarta le mie</button>
          </span>
        </>
      ) : (
        <>
          <span>Modifiche non ancora pubblicate.</span>
          <button type="button" class="p-btn p-btn--small p-btn--quiet" onClick={() => confirm('Annullare le modifiche a questa pagina?') && discard([item.id])}>
            Annulla le modifiche
          </button>
        </>
      )}
    </div>
  );
}

export function Editor({ item, open }: { item: Item; open: (id: string) => void }) {
  const { data, body } = working(item);
  const set = (path: Path, value: unknown) => saveDraft(item, setIn(data, path, value), body);
  const setBody = (b: string) => saveDraft(item, data, b);
  const issues = allDrafts()[item.id] ? problems(item, data, body) : [];
  const live = item.kind === 'gallery' ? null : item.kind === 'article' ? pageUrl(`curiosita/${item.id.split('/').pop()!.replace(/\.mdx?$/, '')}`) : pageUrl(data.slug ?? '');

  return (
    <>
      <header class="p-head">
        <div>
          <h1>{data.title || item.title}</h1>
          <div class="p-head__meta">
            {!data.draft && live && (
              <a class="p-link" href={live} target="_blank" rel="noopener">Vedi sul sito ↗</a>
            )}
          </div>
        </div>
      </header>
      <DraftBar item={item} />
      {issues.length > 0 && (
        <div class="p-issues" role="status">
          <strong>Da sistemare prima di pubblicare:</strong>
          <ul>{issues.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}

      {item.kind === 'gallery' ? (
        <GalleryEditor item={item} data={data} set={set} />
      ) : item.kind === 'page' ? (
        <>
          <section class="p-card">
            <h2>Pagina</h2>
            <FieldEdit spec={{ key: 'title', kind: 'line', label: 'Titolo della pagina', req: true, hint: 'Compare nel percorso in cima alla pagina e negli elenchi.' }} obj={data} path={[]} set={set} />
            <FieldEdit spec={{ key: 'label', kind: 'line', label: 'Nome nel menu', hint: 'Se vuoto si usa il titolo della pagina.' }} obj={data.nav ?? {}} path={['nav']} set={set} />
            <Mockup item={item} data={data} set={set} />
            <p class="p-quiet">Indirizzo: /{data.slug ? `${data.slug}/` : ''}</p>
          </section>
          <section class="p-card">
            <h2>Google e condivisione</h2>
            <FieldEdit spec={{ key: 'title', kind: 'line', label: 'Titolo per Google', req: true, limit: 60 }} obj={data.seo ?? {}} path={['seo']} set={set} />
            <FieldEdit spec={{ key: 'description', kind: 'para', label: 'Descrizione per Google', req: true, limit: 155 }} obj={data.seo ?? {}} path={['seo']} set={set} />
            <div class="p-input">
              <span class="p-input__label">Foto quando la pagina viene condivisa</span>
              <Photo src={data.seo?.image} size="s" caption={false} />
              <PhotoPicker label="Cambia foto" prefix="condivisione" onPicked={([f]) => set(['seo', 'image'], f)} />
            </div>
          </section>
          {(data.blocks || []).map((b: Data, i: number) => {
            const spec = BLOCKS[b.type];
            const blocks: Data[] = data.blocks;
            return (
              <section class="p-card" key={b[ORIGIN] ?? `n${i}`}>
                <h2>
                  <span class="p-num">{i + 1}</span> {spec?.name ?? b.type}
                  {b.type !== 'hero' && (
                    <Mover
                      i={i}
                      n={blocks.length}
                      floor={1}
                      what="la sezione"
                      onMove={(to) => set(['blocks'], move(blocks, i, to))}
                      onRemove={() => confirm(`Eliminare la sezione «${spec?.name ?? b.type}» dalla pagina?`) && set(['blocks'], blocks.filter((_, k) => k !== i))}
                    />
                  )}
                </h2>
                {(spec?.fields ?? []).map((s) => (
                  <FieldEdit key={s.key} spec={s} obj={b} path={['blocks', i]} set={set} />
                ))}
                {(b.type === 'gallery' || b.type === 'gallery-preview') && b.gallery && (
                  <button class="p-btn p-btn--small" type="button" onClick={() => open(`src/content/it/galleries/${b.gallery}.yaml`)}>
                    Vedi le foto della galleria
                  </button>
                )}
              </section>
            );
          })}
          <p class="p-quiet">Le nuove sezioni arrivano con un prossimo aggiornamento del pannello.</p>
        </>
      ) : (
        <>
          <section class="p-card">
            <h2>Articolo</h2>
            <FieldEdit spec={{ key: 'title', kind: 'line', label: 'Titolo', req: true }} obj={data} path={[]} set={set} />
            <Labelled label="Data">
              <input type="date" aria-label="Data" value={String(data.date ?? '')} onInput={(e) => set(['date'], (e.target as HTMLInputElement).value)} />
            </Labelled>
            <FieldEdit spec={{ key: 'summary', kind: 'para', label: 'Riassunto (anche descrizione per Google)', req: true, limit: 155 }} obj={data} path={[]} set={set} />
            <Labelled label="Sezione">
              <select aria-label="Sezione" value={data.section} onChange={(e) => set(['section'], (e.target as HTMLSelectElement).value)}>
                {Object.entries(SECTIONS).map(([k, l]) => (
                  <option value={k} key={k}>{l}</option>
                ))}
              </select>
            </Labelled>
            <FieldEdit spec={{ key: 'cover', kind: 'photo', label: 'Copertina', alt: 'coverAlt' }} obj={data} path={[]} set={set} />
            <Mockup item={item} data={data} set={set} />
          </section>
          <section class="p-card">
            <h2>Testo</h2>
            <Markdown label="Testo dell'articolo" value={body ?? ''} onInput={setBody} headings big />
          </section>
        </>
      )}
    </>
  );
}
