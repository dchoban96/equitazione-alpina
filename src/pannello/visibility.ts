// Showing and hiding pages and articles. A hidden item is a draft (`draft: true`):
// the production build leaves it out, so it is not on the site, in the menu, in
// the sitemap or in Google, and links to it from other pages are switched off.
// The change goes online with Pubblica, like any other edit.
import { stateOf, type Item, type Model, type State } from './content';
import { saveDraft, working } from './drafts';

const slugOf = (it: Item) => String(working(it).data.slug ?? '');

/** True when the item, with its unpublished edits, is hidden from the site. */
export const isHidden = (it: Item) => working(it).data.draft === true;

/** The state the menu shows, counting edits not yet published. */
export const currentState = (it: Item): State =>
  it.kind === 'page' || it.kind === 'article' ? stateOf(working(it).data) : it.state;

/** The home page is the site itself: it cannot be hidden. */
export const canHide = (it: Item) => it.kind === 'article' || (it.kind === 'page' && slugOf(it) !== '');

export function setHidden(it: Item, hidden: boolean) {
  if (!canHide(it) || isHidden(it) === hidden) return;
  const { data, body } = working(it);
  saveDraft(it, { ...data, draft: hidden }, body);
}

const pagesOf = (model: Model) => [...model.byId.values()].filter((it) => it.kind === 'page');

/** Every page under this one ("equitazione" -> "equitazione/lezioni", "equitazione/lezioni/x"…). */
export function subpages(model: Model, it: Item): Item[] {
  const s = slugOf(it);
  if (it.kind !== 'page' || !s) return [];
  return pagesOf(model).filter((p) => slugOf(p).startsWith(`${s}/`));
}

/** The pages above this one, nearest last ("valtellina", "valtellina/cibo-e-vino"). */
export function ancestors(model: Model, it: Item): Item[] {
  const parts = slugOf(it).split('/');
  if (it.kind !== 'page' || parts.length < 2) return [];
  const pages = pagesOf(model);
  return parts
    .slice(0, -1)
    .map((_, i) => pages.find((p) => slugOf(p) === parts.slice(0, i + 1).join('/')))
    .filter((p): p is Item => Boolean(p));
}

/** Pages and articles that still carry test texts or photos (`mockup: true`), in menu order. */
export function mockups(model: Model): Item[] {
  return model.groups
    .flatMap((g) => g.items)
    .filter((it) => (it.kind === 'page' || it.kind === 'article') && working(it).data.mockup === true);
}
