// The checks the site's build makes (src/content.config.ts), run before
// Pubblica so an edit can never stop the site from updating.
import type { Item } from './content';

const empty = (v: unknown) => typeof v !== 'string' || !v.trim();
const BLOCK_NAMES: Record<string, string> = {
  hero: 'Apertura',
  text: 'Testo',
  'text-image': 'Testo con foto',
  facts: 'Dati in evidenza',
  cards: 'Schede',
  places: 'Luoghi',
  quote: 'Citazione',
  map: 'Mappa',
};

export function problems(item: Item, data: Record<string, any>, body?: string): string[] {
  const out: string[] = [];
  if (item.kind === 'page') {
    if (empty(data.title)) out.push('Manca il titolo della pagina.');
    if (empty(data.seo?.title)) out.push('Manca il titolo per Google.');
    if ((data.seo?.title || '').length > 60) out.push('Il titolo per Google supera i 60 caratteri.');
    if (empty(data.seo?.description)) out.push('Manca la descrizione per Google.');
    if ((data.seo?.description || '').length > 155) out.push('La descrizione per Google supera i 155 caratteri.');
    (data.blocks || []).forEach((b: Record<string, any>, i: number) => {
      const where = `Sezione ${i + 1} (${BLOCK_NAMES[b.type] ?? b.type})`;
      if (b.type === 'hero' && empty(b.title)) out.push(`${where}: manca il titolo.`);
      if ((b.type === 'text-image' || b.type === 'map') && empty(b.alt)) out.push(`${where}: manca la descrizione della foto.`);
      if (b.type === 'map' && empty(b.label)) out.push(`${where}: manca l'etichetta.`);
      if (b.type === 'quote' && empty(b.text)) out.push(`${where}: manca il testo.`);
      if (['facts', 'cards', 'places'].includes(b.type) && !(b.items || []).length) out.push(`${where}: serve almeno un elemento.`);
      (b.items || []).forEach((it: Record<string, any>, k: number) => {
        if (b.type === 'cards' && empty(it.title)) out.push(`${where}, scheda ${k + 1}: manca il titolo.`);
        if (b.type === 'places' && empty(it.name)) out.push(`${where}, luogo ${k + 1}: manca il nome.`);
        if (b.type === 'facts' && (empty(it.label) || empty(it.value))) out.push(`${where}, dato ${k + 1}: servono etichetta e valore.`);
      });
    });
  }
  if (item.kind === 'gallery') {
    if (empty(data.title)) out.push('Manca il titolo della galleria.');
    (data.photos || []).forEach((p: Record<string, any>, i: number) => {
      if (empty(p.alt)) out.push(`Foto ${i + 1}${p.caption ? ` («${p.caption}»)` : ''}: manca la descrizione.`);
    });
  }
  if (item.kind === 'article') {
    if (empty(data.title)) out.push('Manca il titolo.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date ?? ''))) out.push('La data non è valida.');
    if (empty(data.summary)) out.push('Manca il riassunto.');
    if ((data.summary || '').length > 155) out.push('Il riassunto supera i 155 caratteri.');
    if (empty(data.coverAlt)) out.push('Manca la descrizione della copertina.');
    if (empty(body)) out.push('Il testo è vuoto.');
    // MDX reads { } as code and < as a tag: one of them in the text stops the build
    if (item.id.endsWith('.mdx') && /[{}<]/.test(body || ''))
      out.push('Nel testo dell\'articolo non si possono usare i caratteri { } e <.');
  }
  // the production build refuses a published page that still has a placeholder
  if (!data.draft && /\[DA COMPLETARE/i.test(JSON.stringify(data) + (body || '')))
    out.push('Il testo contiene ancora un segnaposto [DA COMPLETARE …]: completalo prima di pubblicare.');
  return out;
}
