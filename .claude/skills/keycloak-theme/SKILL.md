---
name: keycloak-theme
description: Build or update a self-contained Keycloak theme — either the end-user pages (login, register, password, account console, mails) or ALL of Keycloak including a full admin-console restyle — that looks like a given source: the host project's own UI (its CSS tokens, fonts and logo) or a design (a Figma file, a Claude Design artifact, a token export, or screenshots). Every font, image and colour is embedded in the theme jar; nothing loads from a CDN or the app. Leaves a dev Keycloak running with links to every page. Use when asked to make, rebrand, restyle or update a Keycloak theme, to make Keycloak's login or admin console match the app or a design, or when fixing a Keycloak theme defect.
---

# Keycloak theme

Makes Keycloak look like it belongs to the product, so that someone who clicks "Login" does not
feel they have left it.

Everything here was learned by building a theme and measuring it against a running Keycloak (26.x).
Every ⚠️ in `references/` shipped as a visible defect first, and most are **invisible in a static
read of the CSS**. Read the reference for a surface before you touch that surface.

## Two choices: scope and source

**Scope** decides which theme types get built:

| Scope | Started by | Types |
| --- | --- | --- |
| **user** | `/keycloak-theme-user` | `login`, `account`, `email`: every page an end user meets |
| **full** | `/keycloak-theme-full` | the same, **plus `admin`** as a full restyle ([admin.md](references/admin.md), "full restyle") |

**Source** decides where the look comes from. It is picked by the arguments: a design link or file
means design mode, nothing means project mode.

| Source | Where the look comes from | Read |
| --- | --- | --- |
| **project** | the host repo's own stylesheets, components, fonts and logo | [tokens-from-project.md](references/tokens-from-project.md) |
| **design** | a Figma file, a Claude Design artifact, a tokens export or screenshots | [tokens-from-design.md](references/tokens-from-design.md) |

The source only changes **Step 2** (the token sheet). The scope only changes which types are kept
in Step 4 and filled in Step 6. If you were invoked without a command and either choice is unclear,
ask: "Only the pages your users see, or the admin console too?" and "Should it copy this project's
UI, or a design? If a design, send the link."

## Hard rules

1. **Self-contained.** Every font, image and colour lives inside the theme. There is no CDN, no
   Google Fonts and no link to the app's origin. Mail is the only exception, and only with the
   user's explicit OK. See [self-contained.md](references/self-contained.md).
   `tools/check-self-contained.mjs` gates the build.
2. **No invented values.** Every token comes from the source, or is marked `DERIVED` (built from
   the source's own ramp) or `DEVIATION` (changed for contrast), with the reason.
3. **Measured, not eyeballed.** Contrast comes from `scripts/contrast.mjs`, and coverage comes
   from the audit. The README quotes numbers.
4. **Restyle, do not fork.** Keep `parent=base` / `keycloak.v3`, never copy `index.ftl`, and never
   copy the base page templates. Copy changes go in `messages_<locale>.properties`.
5. **Do not commit unless asked. Never apply realm configuration to production.** Produce it,
   verify it locally, and hand it over.

## Procedure

### Step 1: Scope

Look first: is there already a Keycloak theme in the repo (`**/keycloak-themes.json`,
`**/theme.properties`)? If there is, this is an **update**. Do not re-scaffold. Run its gates (or
this skill's checker) to get a baseline, then change only what is asked.

**First question, always: "Which Keycloak version does production run?"** Never assume it, and
never take it from a compose file or a README without confirming. It decides which page templates
the theme is built against. Then check it against the latest release:

```bash
node <skill>/scripts/keycloak-versions.mjs --check <prod-version> [--verified <version in the theme README>]
```

Tell the user the result in one line, e.g. "Production runs 26.6.1, the latest is 26.8.0 (1 Oct):
I'll build and verify on 26.6.1 and also audit against 26.8.0." When production is behind, run
`--diff <prod> <latest> <dir>` and audit the theme against the newer templates too (`--templates`
gives `--base` for `audit-coverage.mjs`), so the next upgrade does not break the theme. In **update**
mode, also compare the version the theme was verified on (its README) with production, and re-audit
when they differ.

Then ask only what you cannot read off the repo or the design:

- **realm name** and **web client id** (the one the browser reaches)
- whether the realm has **Organizations** enabled
- the realm's **locales**
- **footer / legal links**: which ones, and their URL **per locale** (e.g. a privacy statement). A
  design's footer links are usually placeholders (`href="#"`). Never ship a `#` link; leave out
  any link the user does not want or has no URL for.
- for master-realm or environment themes: should the warning banner appear **only on the sign-in
  pages** (the default: once signed in, the frame, badge and colours carry the environment), or
  also inside the admin console?
- **where the theme should live**. Propose `keycloak/` at the repo root, or the folder the project
  keeps infrastructure in.

### Step 2: The token sheet

Follow the mode's reference and write the sheet into the theme README **before writing any CSS**:

| Token | Value | Source | Contrast |
| --- | --- | --- | --- |
| `--p-canvas` | `#FAFCFF` | `--neutral-10-color` / `color/surface/card` | (ground) |
| `--p-text` | `#232933` | `--input-text` | 14.22:1 on canvas |
| … | | | |

The roles are the `--p-*` names in the starter's `login/resources/css/styles.css` `:root`, plus
`--p-sunken`, `--p-masthead` and `--p-masthead-ink` in `account.css`, plus, for full scope,
`--p-sidebar`, `--p-sidebar-ink`, `--p-sidebar-ink-2` and `--p-sidebar-accent` in `admin.css`. The same sheet feeds login,
account and the email literals. Also record the font family, its weights and files, the shapes
(radii, shadows, card width), the page ground, and the logo cuts.

Run `node scripts/contrast.mjs` on candidate pairs while you build the sheet, not afterwards.

### Step 3: Decide four things, out loud

- **Theme name.** One name for every type. It becomes the jar name, the directory under `theme/`,
  and what gets selected in Realm settings.
- **Light or dark, single cut.** Match the app or design. A login page that flips on an OS
  preference the app does not honour is a bug. Pin it in `theme.properties`
  (`darkMode=false`, `x-kte-color-mode=light`) **and** in CSS (`color-scheme`).
- **Realm name vs product name.** They are usually different strings (`XPLab_MoocCE` vs "Circulaire
  Economie"). Keep them apart from the start.
- **Which types.** These follow from the scope: user gives `login` + `account` + `email`; full adds
  `admin`. Ask whether the account console should hide any tabs (e.g. Applications). With full
  scope, also ask whether the admin restyle may apply to **every** realm (it is set on the realm
  you sign in to, usually `master`) or only while one realm is managed (the realm gate in
  `admin.js`).

### Step 4: Scaffold from the starter

```bash
cp -r <skill>/assets/starter/. <dest>/
mv <dest>/src/theme/__THEME__ <dest>/src/theme/<Name>
cp <skill>/scripts/check-self-contained.mjs <dest>/tools/
chmod +x <dest>/build.sh
```

Delete the type folders outside the scope (with user scope, `admin/`), and list exactly the
remaining types in
`src/META-INF/keycloak-themes.json`. Then replace every placeholder (the checker fails on any that
remain):

| Placeholder | Becomes |
| --- | --- |
| `__THEME__` | theme name |
| `__BRAND__` | product display name |
| `__FONT_UI__`, `__FONT_HEAD__` | font family names |
| `__FONT_UI_400__`, `_600__`, `_700__` | font file basenames (without `.woff2`) |
| `__WEB_CLIENT_ID__` | the web client id |
| `__KC_VERSION__` | production's Keycloak version |
| `__CONTAINER__` | dev container name, e.g. `<name>-theme-dev` |
| `__PLACEHOLDER_LOGO__` | (marker inside the placeholder `logo.svg`) replace the file with the real mark |

Each starter file opens with a "this is the starter, fill in …" header. Rewrite it to describe
*this* theme, keeping the lessons, so the shipped files do not read as a template (the checker
warns on leftover headers and on `SOURCE: ?`). The checker scans only the theme. Check the rest of
the project too: `grep -rn "__[A-Z][A-Z0-9_]*__" dev tools build.sh src/META-INF` must print nothing.

**Several themes in one project** (one per sub-brand, a login-only theme for the master realm,
environment variants): give each its own folder under `src/theme/`, list every one in
`keycloak-themes.json`, and build variants as child themes of one base
([admin.md](references/admin.md#several-environments-from-one-base-child-themes)).

### Step 5: Embed the assets

Copy the font files (only the weights used) and the logo cut(s) into each type's `resources/`, with
`cp -p`. Follow [self-contained.md](references/self-contained.md): woff2, outlined lettering, one
mark per ground, and the SVG favicon.

### Step 6: Fill each surface

Fill `:root` from the token sheet first; the rules below it reference tokens only. Then work through
the traps in each reference:

1. **login**: [login.md](references/login.md)
2. **account**: [account.md](references/account.md)
3. **email**: [email.md](references/email.md). Inline literals from the same sheet, type-only brand.
4. **admin**, full scope only: [admin.md](references/admin.md), the "full restyle" part. It uses the
   same `--p-*` sheet as account, plus the sidebar tokens.

In **design mode**, also check [what a design cannot change](references/tokens-from-design.md#6-what-a-design-cannot-change-keycloaks-structure)
and tell the user what will differ from the mock-up before you build it.

### Step 7: Verify

Follow [verify.md](references/verify.md). `./build.sh` must pass both gates (self-contained and
coverage), `contrast.mjs --css` must pass on both stylesheets, and the harness must look right.
`build.sh` writes **one standalone jar per theme** to `dist/`. A child theme is flattened into its
own jar, and a base theme gets none. Prove one jar alone works when the project has child themes:
mount just that jar as `/opt/keycloak/providers` in a throwaway container and open its pages.
When Docker is available, drive the real pages on the pinned version with their error states
forced. Use `scripts/screenshot.mjs` to look at them yourself; it drives the local Edge or Chrome
headless and can sign in. Say plainly which checks you could not run.

### Step 8: Leave it running, hand over the links

Run `./dev/preview.sh <Name>` from the theme root. It starts the pinned Keycloak and MailHog
(**under their own Compose project name**, never the folder name), creates or updates a
`<name>-preview` realm using every type the theme has, adds a test user and a link-friendly client
(and, with an admin type, a realm-scoped `realm-admin` whose console at `/admin/<realm>/console/`
wears the theme without touching master), sends a real mail through the email theme, and prints the
links. **Leave it running.** The user wants to look for themselves. Re-running is safe: it re-applies
the themes to the realm. Several themes in one project: run it once per theme. A login theme meant
for the master realm: add `--master`. A second preview beside a running one: `KC_PORT=8088
MAIL_PORT=8026 ./dev/preview.sh`.

Before calling the theme done, check that every printed link answers 200 with the theme's own
stylesheet, and that MailHog received the mail. A theme whose mail template fails to render still
serves perfect login pages.

### Step 9: README and hand-over

Write the README next to the theme from the outline in [deploy.md](references/deploy.md), including
the deploy checklist. Then report in chat:

- **the preview links as a table** (sign in, register, forgot password, account console, admin
  console, MailHog), with the test logins (`tester` / `test`, `admin` / `admin`) and how to stop it
- what was built (types, theme name, jar size)
- the token source, and the deviations with their measured numbers
- the gate results and what was verified live versus not
- the settings a human must click: theme dropdowns (including **Email**), client theme override,
  Home URL, Display name, Internationalization
- anything from the design that Keycloak's structure prevented

## Files in this skill

```text
SKILL.md
references/
  tokens-from-project.md   Mode A: reading tokens from the host codebase
  tokens-from-design.md    Mode B: Figma, Claude Design, token exports, screenshots
  self-contained.md        the embed rule: fonts, images, colours; the mail exception
  login.md  account.md  email.md  admin.md     per-surface procedure and traps
  verify.md                gates, harness, driving it, version drift
  deploy.md                deliverables, deploy checklist, README outline
scripts/
  check-self-contained.mjs copied into the theme's tools/, gates build.sh
  contrast.mjs             WCAG ratios for one pair, or every role pair in a stylesheet
  screenshot.mjs           headless Edge/Chrome over CDP: sign in, screenshot a page (no deps)
  render-design-canvas.mjs Claude Design canvas artboards -> static pages to screenshot as reference
  keycloak-versions.mjs    latest release vs production; extract / diff base templates per version
assets/starter/tools/
  flatten-theme.mjs        merges a child theme with its base for a standalone jar (build.sh)
assets/starter/            the generic theme: build.sh, dev/ (compose + preview.sh), tools/, src/
                           src/theme/__THEME__/{login,account,email,admin}
```
