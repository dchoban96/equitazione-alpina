# Admin (content management)

The admin is [Decap CMS](https://decapcms.org), in Italian, at `/admin/`
(preview: `https://dchoban96.github.io/equitazione-alpina/admin/`). There is
no server and no database: every save is a commit to this repository, GitHub
Actions rebuilds the site, and the change is live in about two minutes.

The client signs in with **email and password** (or Google / Microsoft)
through [DecapBridge](https://decapbridge.com): no GitHub account, no
Cloudflare. DecapBridge is free for up to 3 sites and 10 collaborators.

| File | What it is |
| --- | --- |
| `public/admin/index.html` | Loads Decap CMS 3.x (plus a small script, see "Photo previews") |
| `public/admin/config.yml` | What the client sees and edits, with Italian labels; mirrors `src/content.config.ts` |
| `GUIDA-ADMIN.md` | Short guide for the client, in Italian |

## What the client sees

Only what they need:

- **Pagine**: title, address, section, draft, menu name and position, Google
  title / description / share photo, and the sections (add, remove,
  reorder; all 15 section types, each with only its useful fields).
- **Gallerie**: photos with description and caption, reorder.
- **Articoli**: the Curiosità articles.
- **Domande, recensioni, curiosità**: FAQ, reviews, "Lo sapevi?" snippets.
- **Dati aziendali**: name, phone, WhatsApp, email, address, opening hours,
  social links, legal name and VAT number, menu and footer order, contact
  form reasons.

Technical fields (anchors, altitudes, IDs, the hero video, the home data
panel, Google flags, statistics, Search Console codes, coordinates) are
`hidden` in `config.yml`: they stay in the files untouched when the client
saves. Interface wording (`ui.yaml`), redirects and the design (`theme.yaml`)
are not in the admin at all.

## One-time setup (owner)

1. **GitHub access token for DecapBridge.** On GitHub: Settings > Developer
   settings > Personal access tokens > Fine-grained tokens > Generate new
   token. Repository access: only `dchoban96/equitazione-alpina`.
   Permissions: **Contents: Read and write**. Copy the token.
2. **DecapBridge.** Register at <https://decapbridge.com>, add a site:
   - Git provider: GitHub, repository `dchoban96/equitazione-alpina`, branch `main`
   - the access token from step 1
   - site URL: `https://dchoban96.github.io/equitazione-alpina/` (and the
     admin URL `.../admin/`)
   - login methods: email/password (and Google or Microsoft if wanted)
3. **Paste the generated config.** DecapBridge shows a `config.yml` snippet.
   Replace the `backend:` block in `public/admin/config.yml` with its
   `backend:` block (keep `commit_messages` and everything else in the
   file). Commit and push.
4. **Invite the client** from the DecapBridge dashboard, by email. They set a
   password (or use Google) and open the admin.

The token lives only in DecapBridge, never in this repository. To remove
someone's access, remove them in DecapBridge; to cut DecapBridge off, delete
the token on GitHub.

## Testing locally, without logging in

```bash
npx decap-server
```

and, in a second terminal, `npm run dev`; then open
<http://localhost:4321/admin/> and click **Accedi**. With `local_backend: true`
the admin reads and writes the files on disk directly (nothing is committed):
check the result with `git diff` and `npm run build:preview`. Back up or
commit first: saved test edits are real file changes.

## How content and photos are stored

- All photos are in **`src/assets/foto/`** (one flat folder: it is what
  Decap's media library and previews expect). Content refers to them as
  `"@assets/foto/<file>"`, an alias set in `tsconfig.json`; the build makes
  the AVIF/WebP sizes the pages use.
- Uploads go to the same folder as they are. Decap does not resize them: ask
  the client to avoid huge originals, or reduce them before a big batch.
- FAQ, reviews and "Lo sapevi?" files keep their entries under `items:`.
  Entries added in the admin get an id from their position (`voce-12`).
- Empty optional fields may be saved as `""`: the content schema treats
  `""` and `null` as "not set" (`opt()` in `src/content.config.ts`).
- Saving rewrites the file: comments are dropped and long texts are wrapped,
  but the values stay identical (checked by parsing before and after a save).

## Photo previews

Decap shows the photo previews in the forms only after its media library has
loaded once, and it loads the library only when "Media" is opened. A small
script in `index.html` opens the library once, invisibly, right after
sign-in. If a page is opened in the first seconds, its previews may stay
empty: going back and reopening it shows them.

## Safety net

- `src/content.config.ts` checks every file on every build. If an edit breaks
  a rule (a gallery photo without a description, a page without an opening
  section), the build fails and the live site **stays on the previous
  version**; GitHub emails the repository owner about the failed run.
- Every change is a commit: any edit can be undone with `git revert`.
- The admin page is `noindex` and `/admin/` is disallowed in `robots.txt`.

## When the content model changes

`config.yml` mirrors `src/content.config.ts`. When a block type or a field is
added there, add it to `config.yml` too (visible, or `hidden` to keep it out
of the client's way).
