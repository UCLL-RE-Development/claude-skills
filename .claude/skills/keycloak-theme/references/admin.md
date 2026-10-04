# The admin console: skip, brand only, or full restyle

The admin console is **Keycloak's tool, not the product's surface**. The default is to build no
`admin` type, and to say so in the README. When the user asks for it, there are two modes:

| Mode | What it does | Starter |
| --- | --- | --- |
| **Brand only** | logo, one wordmark rule, one small script; everything else stays stock Keycloak | none (a few lines, below) |
| **Full restyle** | the whole console in the product's palette, fonts and corners, like the account console | `assets/starter/src/theme/__THEME__/admin/` |

Ask which one. "Make Keycloak look like us" for an internal team usually means brand only; "style
ALL of Keycloak" or an admin-facing product means full restyle. Both share the first three sections.

## ⚠️ Keycloak resolves the admin theme from the realm you sign in to

The admin theme comes from the realm you **signed in to**, never from the realm in the switcher.
Nearly every administrator signs in to `master`. Setting the theme on the product's realm alone
leaves it missing from the console people actually reach. Setting it on `master`
(`kcadm.sh update realms/master -s adminTheme=<Name>`) styles **every** realm administered from
there. Neither expresses "only this product".

Close the gap in script. Read the managed realm from the SPA route (`#/<realm>/…`, the only thing
that tracks the switcher), toggle a class on `<html>`, and hang the branding off it. Then the theme
is safe to set on both realms. The failure mode is stock Keycloak, which is the right direction.
The full-restyle starter's `js/admin.js` has this gate, **off by default** (`BRAND_REALMS = []`).

⚠️ **The realm name and the wordmark are different strings** (`XPLab_MoocCE` vs "Circulaire
Economie"). Declare them separately. If you collapse them, the route is compared against the
display name and the brand never appears.

## ⚠️ The console's own sign-in page is master's LOGIN theme

`/admin/master/console/` redirects to master's login page, which is rendered by master's
**loginTheme**, not by the admin theme. A full restyle that stops at `adminTheme` greets every
administrator with stock Keycloak first. Tell the user: a full restyle also means
`loginTheme=<Name>` on master (the login type already exists). It is their realm configuration;
produce the command, do not apply it to production.

## ⚠️ `logo=` and `favIcon=` need a leading slash

Use `logo=/img/logo.svg`. Measured in the 26.6.1 bundle: the **masthead** joins `resourceUrl` and
`logo` with a slash-normalising helper, so it works either way. The **realm dashboard** does
`resourceUrl + logo` with **no separator**, so `img/logo.svg` requests `…/admin/<Name>img/logo.svg`.
That URL does not 404: it resolves through theme inheritance to the **parent's** logo (measured: 200,
22377 bytes, Keycloak's own file). The symptom is "the masthead is branded but the realm dashboard
still shows the Keycloak logo". `favIcon` is concatenated the same way (`${resourceUrl}${favIcon}`).

One `logo` file is shown on **two grounds**: the masthead (`--p-masthead`) and the dashboard's light
card. Pick a cut that reads on both, usually the account theme's masthead cut.

---

## Several environments from one base: child themes

A design often shows **one layout in several environment colours**: a master realm per server, a
yellow test server, a red production console. Build that as **one base theme plus thin child
themes**, never as copies. Verified on 26.6.1 for both `login` and `admin`:

```text
src/theme/<Base>/{login,admin}/           the whole theme, env tokens defaulted
src/theme/<Base>Prod/{login,admin}/       theme.properties  parent=<Base>
                                          resources/css/env.css   only the env tokens (+ banner copy)
                                          messages/messages_<locale>.properties   (login: banner keys only)
```

- **Inherited:** templates, `footer.ftl`, every resource (css, fonts, img, js) under the child's own
  URL, every property (the class-name map, `darkMode`, `logo`, `favIcon`, `scripts`, custom `x-…`),
  and message keys. New theme folders are picked up without a restart.
- ⚠️ **`styles=` is replaced, not merged.** A child that sets it must list the parent's sheet first:
  `styles=css/admin.css css/env.css`. `check-self-contained.mjs` warns when a child drops one.
- **Admin text from CSS.** The admin console has no message bundle the theme controls, so banner,
  badge and eyebrow copy are custom properties rendered with `content: var(--…)`. They cannot be
  translated; say so.
- **Inheritance is for the source only. The jars are flattened.** `build.sh` merges each child with
  its base into a standalone `dist/<Child>.jar` (`tools/flatten-theme.mjs`), and the base gets no
  jar. A deployed jar must never need another jar next to it, so each environment's server gets
  exactly its own jar. Verified: a fresh Keycloak with only the test variant's jar renders its
  complete sign-in and admin console.
- **Warning banners belong on the sign-in pages.** That is where someone decides whether they are on
  the right server. Inside the admin console the frame, the badge, the realm block and the
  current-item colour already carry the environment, and a 76px strip on every screen only costs
  room. Ask, but default to sign-in only.
- Measure a child with the parent's sheet and its own: `contrast.mjs --css <parent> --css env.css`.
  The checker and the coverage audit follow `parent=` to sibling themes.
- Chrome Keycloak does not have (a warning banner over the whole page, a frame around the window,
  an environment badge) goes on `body::before` / `html` borders / a masthead pseudo-element. Keep it
  `pointer-events: none` and out of the tab order, and reserve the space it takes with padding so
  it covers nothing.

## Mode 1: brand only

Build `admin/` by hand: `parent=keycloak.v2`, the logo (with the slash), a stylesheet with one rule
for the wordmark, and a small script for the realm gate. No token mapping, no component rules.

### Handing the masthead back when unbranded

Paint Keycloak's own logo from `../logo.svg` relative to your stylesheet. You deliberately do
**not** ship that path, so it resolves up the inheritance chain to `keycloak.v2`'s own file, with
no version hash in the URL. Mark that `url()` line with a `/* kc-inherit */` comment so
`check-self-contained.mjs` accepts it. Do this in CSS, not by rewriting `img.src` once: the console
is React and reverts attributes on the next render.

---

## Mode 2: full restyle

Starter: `assets/starter/src/theme/__THEME__/admin/`

```text
theme.properties        parent=keycloak.v2, import=common/keycloak, darkMode=false,
                        styles=css/admin.css, scripts=js/admin.js, logo=/img/logo.svg, favIcon=/img/logo.svg
resources/css/admin.css the retint: same --p-* palette as account.css + admin-only roles, the
                        PatternFly mapping, and the component fixes below
resources/js/admin.js   dark-class backstop + the optional realm gate
resources/img/logo.svg  placeholder; replace with the masthead cut
resources/fonts/        empty in the starter; copy the same woff2 files as account
```

Add `"admin"` to the types in `src/META-INF/keycloak-themes.json`. `dev/preview.sh` gives the
preview realm its own administrator (`realm-admin` / `admin`) and prints that realm's console,
`/admin/<realm>/console/`. Signing in to the realm itself is what makes Keycloak pick the realm's
admin theme, and its sign-in page is the realm's login theme, so master is left alone. Pass
`--master` to also apply the theme to master's console and sign-in page on the dev server.

Like the account console, `keycloak.v2/admin` is a **PatternFly v5 React app** with `index.ftl` as a
shell. **Do not copy `index.ftl`**: it is generated against one admin-ui build. Everything is done
through `styles=`, `scripts=`, `logo`, `favIcon`, `title`, `description` and `darkMode`.

### The palette: the account console's, plus four roles

Copy the `--p-*` values from `account.css` unchanged. The admin adds:

| Token | Default | Role |
| --- | --- | --- |
| `--p-sidebar` | `var(--p-canvas)` | sidebar ground. Decide light vs dark from the palette (below) |
| `--p-sidebar-ink` | `var(--p-text-2)` | nav links, ≥ 4.5:1 on `--p-sidebar` |
| `--p-sidebar-ink-2` | `var(--p-text-3)` | nav section titles, ≥ 4.5:1 |
| `--p-sidebar-accent` | `var(--p-accent)` | current-item rule, ≥ 3:1 (non-text) |
| `--p-radius-sm` / `--p-radius` / `--p-radius-lg` / `--p-radius-xl` | 8 / 12 / 16 / 20px | labels / controls / menus, alerts / cards, modals |

Hover and current fills in the sidebar are **derived** (`color-mix` of the ink or accent into
`--p-sidebar`), so the same rules work for a light or a dark sidebar. `contrast.mjs --css admin.css`
measures the three sidebar pairs alongside the rest.

The radii are tokens because the console is **dense**: joined toolbar controls, table rows,
long stacked forms. A very round brand may want `--p-radius` smaller here than on login.

### The mapping: read it from the console's stylesheet

PatternFly declares its tokens on `:where(:root)` (zero specificity), so a plain `:root` in
`admin.css` wins. The console's `main-*.css` (in `org.keycloak.keycloak-admin-ui-*.jar`, under
`theme/keycloak.v2/admin/resources/assets/`) defines **242** `--pf-v5-global--*` tokens on 26.6.1;
97 of them are colour, shadow, radius and font, and `admin.css` maps all 97. Beyond the account list the
admin uses `custom-color--100/200/300` (the teal label/alert variant, folded into the accent ramp)
and every shadow step (`lg`, `xl`, the directional `-top/-right/-bottom/-left`, `inset`). Re-read
after an upgrade:

```bash
grep -o -- '--pf-v5-global--[A-Za-z0-9_-]*:' main-*.css | sort -u
```

⚠️ **`BackgroundColor--100` is the card here, not the page.** `account.css` maps `--100` to the
page ground and repaints cards by hand. The admin console spends `--100` on tables, toolbars,
modals, menus, drawers, wizards and fields, so mapping it to the page ground turns all of those
grey. Here `--100` → `--p-canvas`, and the page ground comes from `BackgroundColor--light-300` /
`--200` (→ `--p-surface`), which is where `--pf-v5-c-page--BackgroundColor` reads it. PatternFly's
own section variants then give "cards on a darker ground" with no extra rules.

⚠️ **`BorderColor--200` is the mid tone, `--300` the lightest** in this PatternFly build (stock
`#8a8d90` and `#f0f0f0`). Map by what they are (`--200` → `--p-border-mid`, `--300` →
`--p-line`), not by number. `account.css` maps them the other way round. If the account-ui
build has the same stock values (not checked yet), it is masked there because the form-control
pseudo-borders are removed.

The account console's traps all apply unchanged: the **light/dark family** (`light-*` / `dark-*`
name the ground, not the mode, and tooltips pair `BackgroundColor--dark-100` with
`Color--light-100`), and **status `--200` is the ink** ([account.md](account.md)).

### ⚠️ `darkMode=false`, and a second dark source it does not reach

`keycloak.v2/admin` sets `darkMode=true`. Unlike the account console (where the **bundle** stamps
the class), here `index.ftl` emits an inline script that adds `pf-v5-theme-dark` to `<html>` from
`prefers-color-scheme`, plus `<meta name="color-scheme" content="light dark">`. `darkMode=false`
removes the script and the meta becomes `light`. Measured on 26.6.1: the stock console in a
dark-OS browser has `html.pf-v5-theme-dark` and is near-black; with the theme, under
`prefers-color-scheme: dark`, there is no class, the meta reads `light`, and the screenshot is
byte-identical to one taken under an emulated `prefers-color-scheme: light`. This held with master's realm-level **Dark mode** switch at its
default (on).

⚠️ The bundle has a **second** source: the Realm settings → Themes quick-theme editor adds the
class itself from the OS preference unless the realm attribute `darkMode` is `"false"`. It is behind
the experimental `QUICK_THEME` feature (off on 26.6.1 by default), so it was read in the bundle,
not exercised live. `admin.js` strips the class whenever it appears (verified: a class added by hand
is gone within 300 ms). The cost is that the quick-theme editor's dark preview no longer previews
dark.

⚠️ The loading splash in `index.ftl` has its own `@media (prefers-color-scheme: dark)` rule that is
**not** gated by `darkMode`: without the splash rules in `admin.css`, a dark-OS visitor sees a
near-black flash on every load.

### ⚠️ The sidebar and masthead are dark by default

- **Sidebar.** `.pf-v5-c-page__sidebar` takes `BackgroundColor--dark-300` and `.pf-v5-c-nav` paints
  links in `Color--light-100`. The console renders the plain (dark) variants, not `pf-m-light`, so
  the stock **light** mode already has a black sidebar. After the family mapping it becomes a slate
  rail with white links that matches nothing. `admin.css` re-points the nav's component variables,
  scoped to `.pf-v5-c-page__sidebar`, to the `--p-sidebar*` roles. **Light sidebar** (default)
  suits a light app; choose a **dark sidebar** only if the app has a dark rail, set `--p-sidebar`
  and a light `--p-sidebar-ink`, and re-measure.
- ⚠️ **The current-item rule** is the link's `::after` (a 4px inline-start border), and its colour
  variable is declared **on the link**, so setting it on the nav does not reach it. It resolves to
  `active-color--200` (stock a pale blue, `#bee1f4`, meant for the dark nav), which vanishes on a
  light sidebar. Paint the `::after` border directly.
- **Masthead.** Its ground is `BackgroundColor--dark-100`, and its toolbar paints
  `--pf-v5-c-masthead--c-toolbar--BackgroundColor`, which defaults to the **raw palette** black
  (`palette--black-1000`), not a global token, so no mapping reaches it. Set both. The masthead
  re-scopes its descendants to light ink, so the rules pin buttons and the user-menu toggle to
  `--p-masthead-ink`; that is what makes a **light** `--p-masthead` work.
- ⚠️ **Menus opened from the masthead render inside it** (PatternFly appends poppers inline), so the
  help menu and the user menu would inherit the bar's ink. Reset `.pf-v5-c-masthead .pf-v5-c-menu`
  to `--p-text`.
- The avatar is a bare `<svg>` beside the user menu, not a control: hidden, as in the account console.
- The "temporary admin user" banner (`pf-m-gold`) takes `warning-color--100` (→ `--p-warn`). Its
  ink is pinned to `--p-text` (8.31:1 on the starter's amber).

### ⚠️ Form controls: four shapes with pseudo-borders, two kinds of joined groups

The account console's two corner traps apply ([account.md](account.md)): the border is drawn on
square `::before` / `::after` pseudo-elements, and an opaque square inner `<input>` paints over
the wrapper's curve. The admin console has **four** shapes built that way, and all of them lose
both pseudo-elements and take the border on the element:

| Shape | Where |
| --- | --- |
| `.pf-v5-c-form-control` | every text field, select, textarea |
| `.pf-v5-c-menu-toggle` | selects, "Action ▾", pagination, the "Default search ▾" filter |
| `.pf-v5-c-text-input-group__text` | search boxes, typeahead selects |
| `.pf-v5-c-button.pf-m-control` | the joined "→" search button, the clipboard copy button |

Then re-declare the validation states on the element, as in the account console.

⚠️ **Joined controls.** Rounding every piece turns "Default search ▾ | Search user | →" into a row
of pills pressed together with doubled borders between them. Only the outer ends are round, and each
later piece overlaps the previous border by 1px. **There are two containers:**
`.pf-v5-c-input-group` (toolbars, with `__item` wrappers) and `.pf-v5-c-clipboard-copy__group`
(realm name, client id, user ID), which has no `__item` wrappers and needs its own selectors.
Measured: with only the first handled, the realm name and its copy button rendered as two separate
pills.

⚠️ **Read-only without the modifier.** The admin marks many read-only inputs with a bare
`readonly` attribute and **no** `pf-m-readonly` on the wrapper (user ID, Created at). Without
`.pf-v5-c-form-control:has(> input[readonly])` they render as editable white fields, which is the
account console's "the field you cannot type in looks writable" defect again.

A text-input-group **inside** a typeahead menu toggle is part of that toggle: give it no border of
its own. Disabled **plain** toggles (the toolbar kebab) must stay transparent; exclude `pf-m-plain`
from the disabled fill or they become a grey pill.

Form labels stay **sentence case**. The account console's spaced 10px capitals work for a few
short labels; the admin's long horizontal forms ("Front channel logout session required") become
unreadable that way.

### ⚠️ Raw-palette fallbacks the mapping never reaches

Some PatternFly components read the raw palette (`--pf-v5-global--palette--*`), not the role
tokens:

- **Coloured labels.** `--pf-v5-c-label--m-blue--BackgroundColor` is `palette--blue-50`. The
  sidebar's "Current realm" pill and the tables' status labels stay PatternFly blue on an indigo
  theme. `admin.css` re-points blue/cyan/purple → accent, green → online, gold/orange → warn,
  red → alert, with the `-text` inks.
- **The masthead toolbar** (above).

### ⚠️ Focus on dialogs

PatternFly gives buttons no focus outline of their own, and a modal **autofocuses its close (×)**.
Measured: the browser's own `auto` ring drew a heavy black box in the corner of every dialog.
`.pf-v5-c-button:focus-visible` gets the theme's focus colour.

### ⚠️ More traps, from a radius-0 design build (26.6.1)

- **The starter assumes rounded corners, a light sidebar and a rule marker** for the current nav
  item. A square, solid-fill design overrides those rules, so check the nav item, the switches and
  the checkboxes after setting the radii to 0. They must still read as controls.
- **The danger `--200` → hover mapping** turns error text into whatever the hover colour is. With a
  non-red hover, map danger `--200` to the error ink explicitly.
- **Groups puts the page header inside a drawer.** A loose `:has([data-testid=view-header])` turns
  the whole drawer into the hero. Scope hero rules to the page section.
- **Tab bars keep 24px of inset padding at desktop widths** through their `pf-m-inset-*` classes.
  Override the inset variable, not the padding.
- **List tables have one fewer header cell than body cells** (the kebab column), so a header
  background stops short. Paint it on the `thead tr`.
- **`pf-m-primary` link-buttons are `inline-block`**, so their label does not centre vertically.
  Make them `inline-flex`.
- **The masthead brand is a single `<img>`.** A text lock-up beside it ("Digital Solutions / Admin
  Console") must come from pseudo-elements on the brand link. A `float` fails because `::before`
  comes first.
- **26.6 has no realm switcher in the sidebar**: the design's realm "selector" can only be a styled
  label. It shows the realm's display name, which is "Keycloak" on master until it is set.
- **Coloured avatar squares and extra table columns** (status) do not exist in the DOM. List them as
  not possible.

### What is deliberately left alone

- **Monaco** (the code editor in client export, realm partial import, authorization JSON) paints its
  own canvas and theme, not CSS variables. Only the frame (border, corners) is themed.
- PatternFly's page-section variants. The token mapping gives the right grounds; overriding sections
  by hand (as `account.css` does) fights the console's own layout.

### Optional realm gate (`admin.js`)

`BRAND_REALMS = []` at the top of the script. Empty: the theme applies to every realm. Filled with
realm **names**: on any other realm `admin.js` adds `kc-unbranded` to `<html>`, **disables** the
theme's stylesheet (a full restyle cannot hang off one class without prefixing every rule), and
points the masthead logo and dashboard icon back at Keycloak's own `logo.svg` / `icon.svg`. The
theme does not ship those paths, so they resolve to `keycloak.v2`'s files. They are re-asserted on
every mutation, because React restores `src`. Measured on 26.6.1 with
`BRAND_REALMS = ["smoke-preview"]`: on `#/master`, the stylesheet is disabled, the Keycloak logo is
shown and the console is stock **light** (`darkMode=false` still governs the shell). On
`#/smoke-preview`, the class is `kc-brand` and the theme is on.

### Verify

1. Run `dev/preview.sh`, open `http://localhost:<port>/admin/<realm>/console/` as
   `realm-admin` / `admin`, and check that the page links `admin.css`
   and `admin.js` and that both, the fonts and the logo return 200. Also check that the shell has
   `<meta name="color-scheme" content="light">`.
2. `node scripts/check-self-contained.mjs src/theme/<Name>` and
   `node scripts/contrast.mjs --css src/theme/<Name>/admin/resources/css/admin.css`, which also
   measures the three sidebar pairs. For a child theme add `--css <child>/…/env.css`.
3. Screenshots with `scripts/screenshot.mjs` (one signed-in session, `--click` to open a menu or a
   dialog), at 1440×900. Shoot the realm dashboard, Users, a user's Details, Clients, Realm settings,
   Authentication, a dialog, the create-client wizard, an open typeahead and the user menu. Then run
   **once more with `--dark`**. Look for: a dark sidebar or toolbar, square corners or doubled edges
   on fields, pills where controls should join, blue labels, white read-only fields, and the black
   focus box on dialogs.

   ```bash
   node scripts/screenshot.mjs --login admin:admin --wait 3500 \
     --shot "$URL#/<realm>/users" shots/admin-users.png \
     --shot "$URL#/<realm>/users" shots/admin-modal.png \
       --click 'table tbody tr:first-child input[type=checkbox]' --click '[data-testid=delete-user-btn]'
   ```

   ⚠️ A headless browser inherits the OS colour scheme. On a dark-mode machine the "light" run is
   already a dark-preference run, and the stock console looks dark in it.
