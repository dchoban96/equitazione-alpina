# Launch checklist

Deployment, DNS and closing the Shopify plan are done by the owner. The
Shopify store stays online until Phase 1 has been accepted.

## Before launch

- [ ] Phase 1 accepted by the owner.
- [ ] `npm run build` passes (no `[DA COMPLETARE]` on published pages).
- [ ] Legal data in `src/content/settings/site.yaml`: `legalName`, `vatNumber`; privacy and cookie pages written.
- [ ] Decimal coordinates confirmed in `site.yaml` (`geo.lat`, `geo.lng`).
- [ ] Form service chosen and its URL set in `site.yaml` (`contactForm.action`); a test message received.
- [ ] Statistics: tool chosen, `analytics.provider` and `analytics.id` set, cookie page lists the cookies.
- [ ] Launch host chosen that serves real 301 redirects (e.g. Netlify or Cloudflare Pages); `dist/_redirects` checked against `settings/redirects.yaml`.
- [ ] Structured data checked with Google's Rich Results Test on home, contatti, one FAQ page, one gallery page.
- [ ] Lighthouse (mobile) on home and two inner pages: 95+ in all four categories, LCP < 2.5 s, CLS < 0.1.

## Going live

- [ ] Deploy `dist/` from `npm run build` (not the preview build) to the launch host.
- [ ] Custom domain `www.equitazione-alpina.it` on the host, HTTPS active.
- [ ] Bare domain `equitazione-alpina.it` redirects (301) to `https://www.equitazione-alpina.it/`.
- [ ] DNS switched from Shopify to the new host.
- [ ] Spot-check old URLs: `/pages/contact`, `/collections/voucher`, `/products/<any>`, `/policies/privacy-policy` all answer 301 to the right page.
- [ ] `https://www.equitazione-alpina.it/robots.txt` allows crawling and names the sitemap.

## After launch

- [ ] Submit `https://www.equitazione-alpina.it/sitemap.xml` in Google Search Console.
- [ ] Update the website link in the Google Business Profile, Tripadvisor, Facebook and Instagram.
- [ ] Watch Search Console coverage and 404s for two weeks; add missing old URLs to `redirects.yaml`.
- [ ] Only then close the Shopify plan.
