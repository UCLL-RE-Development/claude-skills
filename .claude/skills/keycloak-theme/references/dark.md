# Dark variants

Build a dark theme as a **separate, selectable theme**: `<Name>Dark`, a child theme in the source
(`parent=<Name>`) that only overrides colours. The realm then picks light or dark per realm, in
the same dropdowns. The build flattens it into its own standalone jar. Learned building the UCLL
dark themes (login, account and admin) on 26.6.1.

## Structure

```text
src/theme/<Name>Dark/login/theme.properties     parent=<Name>, styles=<parent's sheets> css/dark.css
                       resources/css/dark.css   only the dark tokens and the few rules that flip
                       resources/img/logo.svg   the WHITE cut, under the parent's file name
src/theme/<Name>Dark/account/…                  the same for the account console
src/theme/<Base>Dark/…  (x-kte-base=true)       dark layer for a base with environment children;
src/theme/<Env>Dark/…   parent=<Base>Dark       each environment: dark env.css + banner keys
```

- **No email type in the dark theme.** Mail clients repaint dark mails unpredictably, so mails
  stay light. A dark realm keeps the **light** theme as its Email theme. Say so in the install
  guide.
- `styles=` replaces, not merges: list the parent's sheets first, then `css/dark.css` (then
  `css/env.css` for an environment).
- Mark only the source-only dark base with `x-kte-base=true`. The dark children are deployable.

## Always dark, not the visitor's OS

A dark theme is chosen by the realm. It must not depend on the visitor's preference:

- **Login:** `color-scheme: dark` on `html.kcHtmlClass` in CSS (the meta alone is not enough),
  plus the template's colour-mode property set to dark. Keep `darkMode=false` so Keycloak's own
  `prefers-color-scheme` script stays off.
- **Account and admin (PatternFly v5):** keep `darkMode=false` and **retint the
  `--pf-v5-global--*` tokens** to dark values in `dark.css`. Do not force `pf-v5-theme-dark`:
  that class repaints menus and controls in PatternFly's own greys instead of your palette, and
  its rules ignore the global tokens. Verified: screenshots with the browser preferring light and
  preferring dark come out byte-identical.
- The admin **loading splash** must be dark too (it has its own colour rule), or every load
  flashes white.

## Traps that only appear on dark

- ⚠️ **One ink no longer fits every fill.** On light, white sits on every fill. On dark, a light hover
  fill (`#8FD3F5`) or a lifted pink used as a fill needs **dark** ink. Declare it per fill
  (`--p-accent-hi-ink: #232325`), and `contrast.mjs` measures that pair. Do not use a text colour
  as a fill: keep destructive buttons and the current wizard step on the full brand red, not the
  lifted pink text tone.
- ⚠️ **The light sheet derives things from "ink is dark":** tooltip grounds, every shadow and the
  dialog backdrop are built from `--p-text`, so on dark they become light veils. Re-derive them
  from black and the border tone. Shadows hardly read on dark, so separate menus and popovers
  with the raised tone plus a hairline.
- ⚠️ **The light/dark Color family flips** ([account.md](account.md#️-the-lightdark-family-trap)).
  On a dark ground the "dark-*" ink tokens must become light ink. Re-declare all ~75 mapped
  tokens in `dark.css`, not just the obvious ones. **Chips** are the trap here as on light: they
  take a white ground and, in this palette, light text.
- **Admin:** `BackgroundColor--100` (the card) stays on the raised tone. The masthead, hero,
  tables, menus and popovers use the raised tone. The switch knob reads `BackgroundColor--100`, so
  check it stays visible. The code editor (Monaco) stays light; leave it.
- **The QR code on TOTP setup stays black on white.** Scanners need it. Give it its own light
  ground token (`--p-qr-ground`).
- **Logos:** use the white cut, and check its **viewBox** against the light cut's. Exports often
  carry padding, which shrinks the lock-up. Crop the viewBox to the artwork.
- **Favicon:** a white logo is invisible on a light browser tab strip. Point
  `x-kte-favicon=img/favicon.svg` (starter `template.ftl`) at a coloured mark.
- **Native controls:** `color-scheme: dark` gives dark checkboxes, scrollbars and autofill. Chrome
  still paints autofill its own way, so use an inset `box-shadow`. Checkboxes come out as dark
  native boxes; say so if the design draws white ones.
- **An environment's current-item fill can vanish** on its dark sidebar (navy on navy, 1.6:1).
  Add a light marker (`--p-env-marker`, a 4px rule) and measure it at 3:1.

## Verify

Everything in [verify.md](verify.md), plus:

- Screenshot every page twice, with the browser preferring **light** and preferring **dark**
  (`screenshot.mjs --light` / `--dark`). The two must be identical.
- `contrast.mjs --css <parent sheet> --css dark.css [--css env.css]`.
- One jar alone in a throwaway Keycloak: sign-in, account or admin, and the splash.
