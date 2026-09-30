# Animations found in the theme export

Every animation in `reference/shopify-theme/` that the `ea-*` sections or the
Horizon header use, and how it maps to the three kinds allowed by the spec:
**scroll reveal**, **page transition**, **hero entrance**.

Shopify-only motion (cart drawer, quick add, fly-to-cart, predictive search,
product media, slideshow, marquee) is not listed: those features do not exist
on the new site.

| # | Where | What it does | Maps to | Status |
|---|-------|--------------|---------|--------|
| 1 | `assets/ea-racconto.css` `.ea-rivela` + script in `sections/ea-atmosfera.liquid` | Section content fades in and rises 26 px, 0.9 s, `cubic-bezier(.2,.7,.3,1)`, once per page view | Scroll reveal | Built. Rise set to 16 px and children staggered by 60 ms, as the spec asks; duration and easing kept (motion tokens). |
| 2 | `layout/theme.liquid` `@view-transition` (`page_transition_enabled: true`) | Cross-fade between pages (native cross-document view transitions) | Page transition | Built the same way (native `@view-transition`, no JavaScript). Header and altimeter have their own transition names, so they stay still while the page cross-fades. |
| 3 | — | The theme has no entrance animation on the opening | Hero entrance | New, as the spec asks: kicker, title, intro in sequence, 700 ms in total. The title only moves (no fade) so it never delays LCP. |
| 4 | `ea-racconto.css` `.ea-altimetro .marker` `transition: top .18s` | Altimeter marker glides | Altimeter (its own spec section) | Built with `transform` instead of `top` and eased in JavaScript; no easing with reduced motion. |
| 5 | `ea-racconto.css` `.ea-btn:hover`, `.ea-card:hover`, `.ea-servizio:hover` | Buttons and cards lift 2–4 px and gain a shadow on hover | none (hover feedback) | Built: short hover transitions on transform and shadow, disabled with reduced motion. Not one of the three page animations; flagged here for review. |
| 6 | `snippets/header-drawer.liquid` `menu-drawer-nav-open` | Mobile menu drawer slides in | none | **Not built.** The drawer opens at once (native `<details>`, works without JavaScript). Can be added as a transform-only slide if wanted. |
| 7 | `ea-racconto.css` `@keyframes ea-deriva` | The three mountain ridges drift sideways forever (52–120 s loops, animates `background-position`) | Ambient (added at the owner's request, 2026-09-30) | **Built.** Ridges fixed to the bottom of the screen, same tiles and loop times, animated with `transform` only; stops with reduced motion. The nearest ridge sits in front of the page, so content rises from behind it. |
| 8 | `ea-racconto.css` `@keyframes ea-galleggia` | Watercolour motifs float and rotate slightly forever (55–90 s) | **does not fit** | **Not built — waiting for a decision.** Motifs are drawn static. Endless ambient loop. |
| 9 | `ea-racconto.css` `@keyframes ea-pulsa` | The line before "Si sale da 500 a 1950 m" pulses forever | **does not fit** | **Not built — waiting for a decision.** Line is static. |

Rows 8–9 could come back as transform-only loops that stop with
`prefers-reduced-motion`, if the owner wants them: they would add a fourth kind
of motion ("ambient") to the spec.
