# Self-contained: every font, image and colour lives inside the theme

**The rule:** the jar is the whole theme. At runtime the login, account and admin pages fetch
nothing from a CDN, from Google Fonts, or from the app's own origin. Everything they show is a file
under `<type>/resources/` or a literal in the theme's own CSS.

**Why:**

- Keycloak serves these pages from **its own origin**, often a different host from the app. A link
  to the app's `/style/fonts/x.woff2` 404s there.
- A CDN font or image is a **third-party request on the login page**. It leaks the visitor's IP to
  a third party (a GDPR problem for Google Fonts), it fails behind a strict CSP or an offline
  intranet, and it is a dependency the theme cannot pin.
- A theme that pulls from the app breaks the day the app moves or renames a file, and nothing in
  Keycloak logs it.

`scripts/check-self-contained.mjs` enforces the rule and runs as the first gate in `build.sh`.

---

## Fonts

- Copy the **woff2** files into `login/resources/fonts/` and `account/resources/fonts/`. Each
  theme type resolves resources separately, so both need their own copy.
- Declare them with `@font-face` in that type's own stylesheet, using paths relative to the CSS
  file: `url('../fonts/<file>.woff2')`.
- Ship **only the weights used**, and only the subsets the realm's locales need (`latin` plus
  `latin-ext` covers Dutch, French and German). Total fonts per type should stay well under
  400 KB; the checker warns above that.
- `font-display: swap`.
- No `local()` in `src`. A visitor with a different cut installed would get that cut instead.
- **Variable fonts** are fine and often smaller than three static weights. Declare
  `font-weight: 100 900` on the one face.
- Copy the files with `cp -p` (keep timestamps) so `zip -X` produces a byte-identical jar for an
  unchanged tree.
- **Mail is the exception:** mail clients ignore `@font-face`, so the email theme uses a system
  stack. That is a recorded deviation, not an oversight.
- **Licence:** confirm the font may be self-hosted. Open-licence fonts (OFL) may. A commercial
  webfont licence may restrict the domains it can be served from, and the auth domain counts.

## Images

- The logo and favicon go in `<type>/resources/img/`. Reference them from `theme.properties`
  (`logo=img/logo.svg`, `favIcon=/img/logo.svg`) and from `template.ftl` through
  `${url.resourcesPath}/img/…`.
- Prefer **SVG** for marks. Check that the SVG has no live `<text>` (the next point explains why)
  and no embedded remote `href`.
- ⚠️ **Lettering in an SVG must be outlined to paths.** Every logo in a Keycloak theme is loaded
  through `<img>`, a sandboxed context no webfont can reach. Live `<text>` in the SVG therefore
  renders in whatever font the client picked. Either the artwork carries its lettering as paths,
  or you use a lettering-free mark with a CSS wordmark beside it (`x-brand-wordmark=true` in the
  login starter).
- Raster images (an illustration panel, a background photo): PNG or WebP at 2× the displayed size.
  Watch the size, because they load before login.
- Small icons may be inlined as `data:` URIs in CSS. That still counts as embedded.
- **Variable fonts with several subsets**: one `@font-face` per family per subset, each with the
  weight range (`font-weight: 100 900`) and the subset's `unicode-range` (copy them from the
  fontsource CSS). A second family (a serif for body copy) gets its own token, e.g. `--p-font-body`.
- **A wide lock-up makes an illegible favicon.** Crop the symbol out of it (`viewBox` on the mark
  alone) into its own `favicon.svg`.
- ⚠️ **The favicon is the mark itself**, `image/svg+xml`. Never reference `favicon.ico` unless you
  ship one. The stock theme asks for it and every page load 404s.
- Check that the **mark contrasts with the ground it sits on.** The login card and the account
  masthead are usually opposite grounds, and one cut may not work on both. If so, ship two cuts
  (one per type) and note it in `build.sh` and the README: one decision in two files.

## Colours

- Every colour is a **literal in the theme's own `:root`**, with its source in a comment. Never
  `@import` the app's stylesheet and never `var()` a token the theme does not define itself.
- Login and account share the `--p-*` vocabulary. The email template repeats the same values as
  inline literals (mail clients ignore custom properties). The comment block at the top of
  `email/html/template.ftl` maps each literal to its `--p-*` token.
- Outside `:root`, the stylesheets reference tokens only. A literal hex in a rule is a colour that
  will not follow the next palette change.

## Mail images: the one place the rule bends

Mail is read outside the browser session, days later. Its images cannot be embedded usefully:

- **Base64 (`data:`) images are not a solution.** Gmail (web and apps) removes them and every
  Outlook shows them broken. Only Apple Mail and Thunderbird render them. They also make each mail
  about a third larger and look spammy.
- Gmail and Outlook strip inline SVG and do not render SVG in `<img>` either.
- Remote images are blocked by default in many clients (Outlook) until the reader allows them.

So the starter's email theme is **type-only** by default: a text wordmark with a rule under it.
There is nothing to block, nothing remote, and it is fully self-contained.

### The recommended opt-in: the logo ships in the theme, Keycloak serves it

Keycloak is public anyway, so it can host the mail's images itself:

1. Put the PNG **in the email theme**: `email/resources/img/logo.png`. It ships in the jar like
   every other asset.
2. Set `x-mail-logo=img/logo.png` in `email/theme.properties`. The starter's `html/template.ftl`
   then renders `<img src="${url.resourcesUrl}/img/logo.png">`. In a mail template,
   `url.resourcesUrl` is the **absolute public URL** of this email theme's resources (built from
   Keycloak's configured hostname, so set `KC_HOSTNAME` correctly in production).
3. ⚠️ **The URL contains a version segment** (`/resources/<ver>/email/<Theme>/…`). Measured on 26.6.1:
   it is stable across restarts, and a request with an **outdated** segment (a mail sent before an
   upgrade) answers **307** to the current version and the image loads. So old mails keep their
   logo after an upgrade. (A malformed segment answers 404; real ones redirect.) Re-check this
   after every Keycloak upgrade: request an image under a made-up 5-character segment and expect 307.
4. The image still breaks if the **theme name** or the **hostname** changes, or the theme is
   removed from that server.

This keeps the self-contained rule: nothing outside the jar. It is still a remote image to the mail
client, so Outlook shows it only after "show images", and the type wordmark stays as the `alt`
fallback.

### The other opt-in: an image host outside the theme

Only when Keycloak's own URL will not do (e.g. the auth server is not reachable from where mail is
read). It breaks the self-contained rule, so only with the user's explicit OK.

1. The PNGs live **in the theme**, in `email/resources/img/`. That folder is the source of truth,
   reviewed and versioned with everything else.
2. The **app** (or any static host that does not change on a Keycloak upgrade) serves the same
   files at a stable public path, e.g. `https://<app>/assets/email/`. In most projects this is a
   copy step into the app's public/static folder, or a static route pointing at that folder.
3. `email/theme.properties` gets `assetBaseUrl=<that URL>` **and** `x-mail-images-hosted=true`.
   The second line records the decision in the theme. The checker then reports it as a warning,
   not an error, and still requires `email/resources/img/` to exist.
4. Check the URL is public: `curl -s -o /dev/null -w "%{http_code}" <assetBaseUrl>/brand.png`
   must say 200 without signing in.

Rules for the images: PNG, not SVG (Gmail and Outlook do not render SVG in `<img>`); transparent;
2× the displayed width; every image with its name as `alt`. The type wordmark stays as the
fallback, because most clients block remote images until the reader allows them.

⚠️ Rasterise SVG to PNG with a tool that **keeps alpha**. macOS `qlmanage` flattens onto white,
shifts colours and pads to a square. A headless browser canvas works: draw the SVG at
`width × width/viewBoxAspect` and `toBlob('image/png')`. Derive the aspect from the **viewBox**,
not from declared `width`/`height`, which sometimes contradict it.

(Truly embedded images, attached inline as `cid:` parts, need a custom Java email provider. That is
real work and is out of scope for a theme.)
