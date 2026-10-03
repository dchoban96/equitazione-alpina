# equitazione-alpina.it

Static site for Equitazione Alpina (Albosaggia, Valtellina), built with
[Astro](https://astro.build). Every page is plain HTML; content lives in typed
files under `src/content/`, so a future CMS only has to read and write them.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (Node 22 or newer). |
| `npm run dev` | Local site at http://localhost:4321, drafts included and marked «Bozza». |
| `npm run build:preview` | Build for review: drafts included, every page `noindex`, `robots.txt` blocks everything. Missing-content markers are listed but allowed. |
| `npm run build` | Production build into `dist/`. **Fails** if a published page still shows a `[DA COMPLETARE]` marker. |
| `npm run preview` | Serve the last build locally. |
| `node scripts/make-placeholder.mjs` | Regenerate the placeholder photo from the theme colours. |
| `node scripts/make-mockups.mjs` | Regenerate the mockup illustrations (`src/assets/foto/mockup-*.jpg`). |

The demo page with every block is at `/demo/` (not indexed, not in the menu).

## Where things are

```
src/content/
  settings/site.yaml       business name, phone, address, social links, menu, footer, form, statistics, mountains
  settings/theme.yaml      colours, fonts, sizes, spacing, motion (becomes CSS custom properties)
  settings/redirects.yaml  old Shopify URLs -> new URLs
  it/ui.yaml               interface text (buttons, labels, form)
  it/pages/*.yaml          one file per page
  it/articles/*.mdx        one file per curiosity article
  it/galleries/*.yaml      one file per gallery
  it/faq.yaml  it/reviews.yaml  it/curiosities.yaml
src/assets/foto/           all photos, referenced from content as "@assets/foto/<file>"
public/admin/              the admin (Decap CMS), see ADMIN.md
src/components/blocks/     the 15 section blocks
reference/                 Shopify theme export and notes; never used by the site
```

Nothing visible is written inside components: text, images, colours and fonts
all come from the files above.

## Mockup content

Until real texts and photos arrive, every page is published with mockup
content and carries `mockup: true`:

- Home, "Chi siamo" and the FAQ reuse the copy of the current Shopify site.
- Everything else is test text ("Testo di prova") and general facts about the
  valley that the owner must check.
- Images are generated illustrations (`mockup-*.jpg`), each marked
  "illustrazione di prova". No stock photos.

Every build lists the files still marked `mockup: true`. To replace a page:
write the real text, swap the images, remove `mockup: true`. Delete the
`mockup-*.jpg` files once nothing uses them.

## Missing content

Anything not yet supplied is written as `[DA COMPLETARE: what is needed]`. It
shows on the page in orange. Every build lists all markers; the production
build stops if a published page (not `draft: true`) still has one.

## Add a page

1. Copy a file in `src/content/it/pages/` and rename it (the name is free, e.g. `equitazione--lezioni.yaml`).
2. Set `slug` (the URL without slashes, e.g. `equitazione/lezioni`), `title`, `section`, `draft`.
3. Fill `seo.title` (max 60 characters), `seo.description` (max 155), `seo.image`.
4. List the `blocks` in order. The first block is always `hero` (its `title` is the page H1); business and guide pages end with `cta-contact`.
5. Optional: `nav.label` and `nav.order` for the menu, `altimeter: { enabled: true, min, max }` plus an `altitude` on at least two blocks.

The menu, breadcrumb, sitemap and footer update by themselves. Top-level menu
items are listed by slug in `settings/site.yaml` (`menu`, `footer`); sub-pages
appear under their parent automatically. Drafts are left out.

Block fields are checked when the site builds: a missing required field stops
the build with a message naming the file and field. The demo page
(`src/content/it/pages/demo.yaml`) shows every block with its fields.

## Add a photo to a gallery

1. Put the file in `src/assets/foto/`, with a descriptive Italian
   name (`passeggiata-cavallo-alpe-palu.jpg`), at most 2400 px on the long side.
2. Add an entry to `src/content/it/galleries/<section>.yaml`:

   ```yaml
   photos:
     - file: "@assets/foto/passeggiata-cavallo-alpe-palu.jpg"
       alt: Due cavalli al passo sul sentiero dell'Alpe Palù
       caption: Verso l'Alpe Palù      # optional
       place: Valmalenco               # optional
       altitude: 2000                  # optional, metres
   ```

`alt` is required: a photo without it stops the build. Sizes, AVIF/WebP and
lazy loading are handled automatically. A gallery page stays `draft: true`
until it holds at least 10 real photos.

## Add an article

1. Copy an article in `src/content/it/articles/`; the file name becomes the URL (`/curiosita/<file-name>/`).
2. Fill `title`, `date`, `summary` (max 155 characters), `cover`, `coverAlt`, `section`.
3. Write the text in Markdown, with at least one link to a business section.
4. Set `draft: false` to publish. It appears in `/curiosita/` and in the sitemap.

## Admin

The client edits content at `/admin/` (Decap CMS, in Italian; login with
email and password via DecapBridge): pages and sections, photos, galleries,
articles, FAQ, reviews and company data. Every save is a commit and goes
live after the next deploy. Setup, login and local testing are in
`ADMIN.md`; the client's guide (Italian) is `GUIDA-ADMIN.md`.

## SEO

- Every page: title and description (`seo`), canonical URL, Open Graph and
  Twitter tags with a 1200x630 share image, `noindex` for drafts and previews.
- Structured data: LocalBusiness (home, contatti), WebSite (home),
  BreadcrumbList, FAQPage, Article, ImageGallery. No review stars.
- `sitemap.xml`: published pages and articles, each with the date of its last
  commit and the photos it shows (image sitemap).
- `robots.txt`: allows everything except `/admin/` and names the sitemap;
  the preview build blocks everything.
- Search Console / Bing ownership codes: `verification` in `settings/site.yaml`
  (also in the admin).

## Hosting and redirects

- GitHub Pages at `www.equitazione-alpina.it` (DNS at register.it: `www` CNAME
  to `dchoban96.github.io`, the bare domain on GitHub's four A records):
  `.github/workflows/deploy.yml` publishes the production build on every push
  to `main`. Old Shopify URLs get small forwarding pages there (not real 301s).
- A host with real 301s (Netlify, Cloudflare Pages) can use `dist/_redirects`,
  which the build writes from `settings/redirects.yaml`.
- See `LAUNCH-CHECKLIST.md` before going live.

## Rules kept by the code

- No UI framework, no animation library; JavaScript only for the altimeter,
  animations, lightbox, menu and (when enabled) the cookie banner.
- Pages read fully without JavaScript; animations hide content only after a
  script has marked the page, and everything stops with reduced motion.
- Statistics (if enabled in `site.yaml`) load only after consent.
- Fonts are self-hosted (`src/assets/fonts/`, Inter under the SIL OFL).
