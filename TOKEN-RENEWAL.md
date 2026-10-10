# Renew the GitHub token (once a year)

The control panel writes to GitHub with a fine-grained token that expires on
**31 October 2027**.
GitHub emails a reminder about a week before. If it expires, the panel still
opens but **Pubblica** fails.

Never paste the token into a file, a chat or this repository.

## 1. New token on GitHub

1. GitHub → avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Open `pannello-equitazione-alpina` → **Regenerate token**.
3. Expiration: Custom, about one year ahead. Keep the same access: only the `equitazione-alpina`
   repository, **Contents: Read and write**.
4. Copy the new token. The old one stops working at once.

## 2. Put it in Cloudflare

1. Cloudflare dashboard → **Workers & Pages** → the panel's Worker
   (`pannello-equitazione-alpina`).
2. **Settings → Variables and Secrets** → `GITHUB_TOKEN` → **Edit** → paste → **Save / Deploy**.

(From a terminal in this folder, the same thing: `npx wrangler secret put GITHUB_TOKEN`.)

## 3. Check

Sign in to the panel, change one word on any page, press **Pubblica**, and
check that a new commit appears on GitHub. Change the word back.
