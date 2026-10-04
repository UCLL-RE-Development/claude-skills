# The login theme

Starter: `assets/starter/src/theme/__THEME__/login/`. It covers the whole sequence: sign in, forgot
password, register, OTP entry, TOTP setup, update password, update profile, verify email, terms,
WebAuthn, recovery codes, device verification, x509, consent, error, info, page-expired and logout
confirm.

## One stylesheet covers ~30 pages, if you set it up right

`parent=base` in `theme.properties`, then **pin every `kc*Class` property to its own literal name**
(`kcInputClass=kcInputClass`). Load no PatternFly, no Bootstrap and no icon font. The cascade on
every page is then: browser defaults, then `styles.css`. There is nothing to override and nothing
to fight. The starter's `theme.properties` already holds the full map. **Do not "tidy" it into
PatternFly names.**

⚠️ **Base templates reference properties the theme editors omit.** There are about seventeen
(`kcFormButtonsClass`, `kcInputWrapperClass`, `kcLoginOTPListInputClass`, `kcTextareaClass`,
`kcRecoveryCodesList`, the `kcInputClassRadio*` / `kcInputClassCheckbox*` family, …). If they are
undeclared, they expand to the empty string and the element renders `class=""`. Reset-password,
OTP, TOTP setup, register, terms, WebAuthn and recovery codes then all quietly lose their layout.
The coverage audit finds these.

⚠️ Several arrive **through a local variable**: `<#assign classDiv=properties.kcInputClassRadio!>`
then `class="${classDiv}"`. Grepping the templates for `${properties.` inside a class attribute
misses them. The audit follows the indirection.

## Filling the starter

1. `:root` in `styles.css`: one value per `--p-*` token from the token sheet, with its source in
   the comment. Nothing else in the file should need a colour edit.
2. `@font-face` blocks: the real family and file names. Delete weights you do not use, and add a
   second family if headings differ.
3. `--p-gradient`: paste the app's or the design's real page ground, stop for stop, with source
   comments. `html` and `body` stay on the flat `--p-surface`, which equals the gradient's **last**
   stop, so overscroll does not flash a different tone. The gradient sits on `.kcLogin`
   (`min-height: 100dvh`), so it fills the viewport and stretches with a tall page instead of
   banding.
4. Shapes: `--p-radius*`, `--p-shadow*` and `--p-col` (card width) from the card, field and
   button components.
5. `x-brand-wordmark` (next section), `logo.svg`, and `brandName` in
   `messages_<locale>.properties`.
6. Run `contrast.mjs --css styles.css`, then fix the deviations and table them.

## The brand lock-up

- If the mark **carries its own lettering as paths**: `x-brand-wordmark=false`. Render only the
  image, with `alt="${msg("brandName")}"`.
- If the mark has **no lettering**: `x-brand-wordmark=true`. The template renders the mark plus a
  CSS-styled text wordmark in the brand font. **Do not bake words into the artwork as live text**,
  because `<img>` is sandboxed and no webfont reaches it.
- Prefer the project's real asset over recreating it. If the project only has raster, use raster
  and say why. Pick the largest clean source and check it is not an upscale that bleeds off its own
  edges.
- Match the `<img>` `width`/`height` attributes to the artwork's aspect ratio. Derive the aspect
  from the SVG **viewBox**, because declared `width`/`height` attributes sometimes contradict it.
- A mark drawn for a dark header band (pale lettering) can measure below 2:1 on a light card.
  Measure it.

## Traps that only show at runtime

- **`[hidden]` stops working.** It is a user-agent rule with the lowest possible weight, so any
  explicit `display` beats it. `.kcFormGroupClass` is `display: flex`, so anything hidden from
  script stays on screen. Ship `[hidden] { display: none !important; }` (the starter has it).
- **The password field and its reveal button are one control across a seam.** The input drops its
  inner border. On focus the ring runs round three sides, and the button closes the fourth in the
  resting colour unless you style the *group*.
  - ⚠️ **The error state needs its own rule.** Invalidity is `aria-invalid="true"` on the
    **input**, with no class on the group, so reach the group with `:has()`. Scope it
    `:not(:focus-within)`: `:has()` takes its argument's specificity and would otherwise beat the
    focus rule while the user types.
  - ⚠️ **And again in the read-only state.** The "signing in as …" field plus the restart button
    must be one tone. **Three states, three rules.** Whenever a rule changes how a field in a group
    looks, check that the button beside it follows.
- ⚠️ **`.kcInputGroup` has TWO shapes.** `login.ftl` and `register.ftl` put the input as a
  **direct** child. The template's `@username` macro wraps it in `.kcInputGroupItemClass`. Every
  rule touching the group must list both.
- **`.kcInputWrapperClass` wraps both "label + asterisk" and "input + error".** Infer the direction
  with `:has(> label)`, never from the asterisk. The asterisk is a bare **text node** and CSS
  cannot select it. Exception: the OTP device chooser is a flat run of radio+label pairs that needs
  `flex-direction: column`, or the devices lay out side by side at a third of the card width.
- **Base emits Bootstrap- and PatternFly-era names** (`.form-group`, `.control-label`,
  `.pficon-print`, `.btn-primary`, `.alert`). Neither framework is loaded, so these are unstyled
  hooks. Cover them, and draw icon glyphs as CSS masks so they inherit `currentColor`.
- **Declare each class once.** Declaring one per section and letting the later copy win is how a
  chevron prints twice as `»` and a hidden OTP radio comes back. Search the whole file before
  adding a rule.
- **A `*/` inside a CSS comment closes it early.** A path like `fonts/*/*.css` written in prose
  ends the comment and the rest parses as CSS. Check: strip comments, then assert no `/*` or `*/`
  remains.
- **Chrome paints its own pale yellow over autofilled inputs.** `background-color` is not honoured
  there; an inset `box-shadow` is.
- **Pin the colour scheme in CSS** (`color-scheme: light` on `html.kcHtmlClass`), not only with the
  `<meta>`. Measured in Chrome, the meta alone left the computed value at `normal`, and native
  controls stayed the wrong colour.

## Template decisions worth keeping

- **A design with its own copy per screen** (an eyebrow, an intro line, a brand letter per page):
  map Keycloak's page to the design screen once in the template (`pageId` exists on 26.x; guard it
  with `??` and fall back to the template name), then look up `<prefix><Screen>` message keys and
  `img/letter-<Screen>.svg`. A page can replace Keycloak's title through a `<prefix>Title.<pageId>`
  key. Footer links are a list of keys (help, privacy, accessibility…), each rendered only when set.
- **The eyebrow is Keycloak's page title**, not a tagline (when the design does not say otherwise). The theme draws password reset, OTP,
  update-password and twenty-odd other pages, and the page title is the only thing that says which
  one you are on.
- **The stock header renders the OIDC client name.** For a client with no display name that is the
  raw client id. Render it only if the realm serves clients other than this app.
- **`x-kte-color-mode=light`** makes `template.ftl` emit the light `color-scheme` meta and skip the
  dark class and the `prefers-color-scheme` script.
- **No `scripts=`** unless needed. If one is added: `scripts=` is emitted as a **classic** script in
  `<head>`, so it runs before the form is parsed. Guard on `DOMContentLoaded`; do not switch to
  `type="module"`, which only 26.7's `themeResources` model can express.

## Reshaping the page title, buttons and optional copy

- **Splitting the title** (e.g. a two-tone "**Welkom** *terug*"): capture the header nested content
  as markup, `<#assign t><#nested "header"></#assign>`, then work on `t?markup_string`. Some titles
  carry markup, such as the client logo on the consent page and a script on front-channel logout,
  so split only when the string has no `<` and fall back to the unsplit title otherwise.
- **The primary button is an `<input type="submit">`**, which cannot take `::before`/`::after`. An
  arrow icon goes in as a `background-image` (a `data:` SVG or a file in `img/`), with
  `padding-right` to clear it.
- **Optional message keys.** `msg("x")` returns the literal key `x` when the key is missing, so
  `?has_content` is always true. For copy a theme may or may not set (a banner, an eyebrow, footer
  links), compare against the key: `<#if msg("kteBanner") != "kteBanner">`. Keep that in one small
  macro.

## Messages

⚠️ **Only `messages_<locale>.properties` is ever read.** There is no suffix-less fallback file.
Overrides in `messages.properties` fail silently: the wordmark renders as the literal string
`brandName`, and footer links render as `<a href="imprintUrl">imprintLabel</a>`.

⚠️ **Double every apostrophe in a value**: `auto''s`, not `auto's`. Keycloak runs each message
through `java.text.MessageFormat`, where a single quote is the escape character and is swallowed.
Nothing warns you. Check before shipping copy: `grep -rn "^[^#].*'" src/theme/*/*/messages/`.
This applies to **your** bundles. Keycloak's own messages are already escaped.

Ship one bundle per realm locale, **and** tell the user that Keycloak serves English to everybody
until Internationalization is enabled on the realm, with their default locale set.

## Version-proofing built into the starter

- **`themeResources` first.** 26.7 introduced it and demoted `properties.styles` /
  `properties.scripts` to a fallback. The template reads the new model first. The renderer macros
  are defined **inline**, because `theme-resources.ftl` does not exist before 26.7 and FreeMarker
  throws on an unresolvable import.
- **Guard on the field, not its parent object.** `authenticationSession` exists where
  `authSessionIdHash` does not, so testing the object alone enters the block and then throws. A
  FreeMarker `InvalidReferenceException` makes **every page** answer HTTP 500.
- **`switchOrganizationEnabled??`** guards the "sign in to a different organization" control, so it
  stays inert on versions or realms without the feature.

## Organizations changes the shape of the login

With Organizations enabled, the realm uses the **identity-first** flow. Page one asks only for
username or email; the password is on a **second** page with the username field read-only beside
a "start over" button. A screenshot of page one proves less than it used to. The read-only
treatment must differ visibly from an editable field. If the palette's field fill equals the card,
use `--p-quiet`.

## Profile questions at registration

Use the declarative **User Profile** (Realm settings → User profile), not a custom form. Keep
option **values** as stable codes and put the wording in the theme's message bundles behind
`inputOptionLabelsI18nPrefix`. ⚠️ The User Profile has no conditional fields. An "Other → please
specify" field needs a small script. Render it **visible** and hide it from script, never the
reverse, and say that `required` is then DOM-only.
