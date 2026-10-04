# The account console

Starter: `assets/starter/src/theme/__THEME__/account/`.

`parent=keycloak.v3` is not a set of templates. It is a **PatternFly v5 React app**, with `index.ftl`
as a shell that hands it a JSON environment block. **Do not copy `index.ftl`**: it is generated
against one specific account-ui build and goes stale on the next upgrade. Four extension points do
the whole job:

| Extension point | Used for |
| --- | --- |
| `styles=css/account.css` | the retint. Loaded after the console's own CSS, so a plain `:root` wins |
| `scripts=js/shell.js` | the brand link target and the dark-mode backstop |
| `logo=img/logo.svg` | the masthead brand |
| `resources/content.json` | the nav |

## The retint is a token swap

PatternFly draws everything from `--pf-v5-global--*` custom properties. `account.css` maps the ~70
the console actually defines onto the shared `--p-*` palette. To change the theme you change the
`--p-*` values, not the mapping. If a new Keycloak version defines more, read the list **out of the
console's own stylesheet**. Do not recall it from memory.

The console's page ground is one step darker than its cards (`--p-surface` vs `--p-canvas`). It is
a full app shell whose whole layout is cards, and a card the colour of the page behind it
disappears. Keep it flat: a gradient behind a card grid reads as a bug, not as the brand.

## ⚠️ `darkMode=false`: the single most load-bearing line

`keycloak.v3` inherits `darkMode=true`. With that setting, the account-ui **bundle** stamps
`pf-v5-theme-dark` on `<html>` at runtime for any visitor whose OS prefers dark. PatternFly's
component-level dark rules ignore the global tokens, so that class repaints the masthead toolbar,
menus and controls over a light retint.

It is nasty for three reasons. Nothing in the served HTML shows it. It only affects **some**
visitors, so the console looks perfect on a light machine. And no amount of token work fixes it.
Set `darkMode=false`; `shell.js` also strips the class as a backstop. (Measured on 26.6.1.)

A theme that should be dark is a different job: add the class deliberately and retint the dark
component rules too.

## ⚠️ The light/dark family trap

`light-*` and `dark-*` do not mean light/dark mode, and they do not mean "a lighter shade". **They
name the ground the value is meant for:**

| Token | Stock | Means |
| --- | --- | --- |
| `Color--dark-100` | `#151515` | dark **ink**, for a light ground |
| `Color--light-100` | `#ffffff` | light **ink**, for a dark ground |
| `BackgroundColor--dark-100` | `#151515` | a **dark ground** |
| `BackgroundColor--light-100` | `#ffffff` | a **light ground** |

The two `Color` families are inverses. If you map both to dark ink, every component that opts into
the dark family breaks. Measured: the **domain chips on the Organizations tab** rendered as
dark-on-dark pills at 1:1. Tooltips and popovers pair `BackgroundColor--dark-100` with
`Color--light-100`, so those two must stay a legible pair.

## ⚠️ Status tokens: `--200` is the ink, `--100` is the icon and border tone

PatternFly's components take label text and alert titles from `--200`. Mapping a darkened
contrast fix onto `--100` fixes nothing. The "Current session" label stayed at 2.73:1 until the
mapping was flipped. Verify by re-measuring, not by reasoning.

## ⚠️ Border tokens: map by tone, not by number

Stock PatternFly v5 in the console: `BorderColor--100` `#d2d2d2`, `--200` `#8a8d90` (the **mid**
tone), `--300` `#f0f0f0` (the **lightest**), `--400` `#aaabac`. The numbers are not a light-to-dark
ramp. Map `--200` → `--p-border-mid` and `--300` → `--p-line`. The theme this skill was extracted
from had them swapped, so hairline separators drew in the strong field-border tone. Re-read the
values from the console's stylesheet after an upgrade.

## ⚠️ Form-control borders are not on the control

PatternFly draws them on two absolutely positioned pseudo-elements at `inset: 0`: `::before` (1px,
three sides) and `::after` (focus underline), both `border-radius: 0`. On a rounded control their
square corners sit over the real border, giving a doubled edge and a corner tick. They also differ
per state; `pf-m-disabled` drops `::before`.

Remove both and let the element's own border be the only one. **Then re-declare the validation
states** (`pf-m-warning` / `success` / `error`) on the element. They were drawn on that same
`::after` and would otherwise render as nothing. Note that the console marks a
**required-but-empty** field `pf-m-warning`, so the warning colour appears as a ring round an empty
field.

## ⚠️ A second, independent reason corners break

The console nests `<span class="pf-v5-c-form-control"><input></span>`, and the input's padding box
fills the wrapper exactly. An opaque input with `border-radius: 0` paints square corners over the
wrapper's curve. **The wrapper owns the ground; the inner control is transparent and inherits the
radius.** It hides well, because it is invisible on whichever control happens to be transparent.

## The masthead

- `--p-masthead` is the bar colour and `--p-masthead-ink` the text and icons on it. Both default to
  the accent and its ink, so a light masthead only needs those two changed. ⚠️ **The logo cut must contrast with it.** A navy mark on a
  navy bar leaves only the lettering visible while the silhouette dissolves. Ship a different cut
  for the account theme when needed. Changing the masthead colour means rechecking the logo, and
  vice versa.
- The masthead contains a `.pf-v5-c-toolbar` that paints its own background, so the bar looks
  unfilled except under the brand. Set it transparent, **scoped to the masthead**.
- The avatar is a bare `<svg>` inside no button and no link. It does nothing, so **hide it**.
  Styling it to look like the app's avatar button makes a dead element look clickable.
- The brand image's class is a CSS-modules hash that changes every build. Select it **structurally**:
  `.pf-v5-c-masthead__brand > img`. Size it by height; if the lock-up has knocked-out lettering,
  do not go below the size where the lettering closes up.
- A lettering-free mark needs the text wordmark back. Enable the commented
  `.pf-v5-c-masthead__brand::after` block in `account.css`.

## The brand link carries no URL

`logoUrl` can only hold a static absolute URL, which would hard-code the deployment's address.
Leave it unset. `shell.js` sets the href from `referrerUrl` in the environment block. Keycloak fills
that from the **Home URL** of the client in `?referrer=<clientId>` and validates it against that
client's redirect URIs. ⚠️ **Tell the user to set the Home URL on the web client.** It is the piece
people forget.

## Navigation: `content.json`

⚠️ The console **replaces** its nav with yours instead of merging. `content.json` must therefore be
a **full** copy of Keycloak's own (`theme/keycloak.v3/account/resources/content.json` inside the
account-ui jar), minus whatever you deliberately remove. **Ask the user what to remove**. A common
choice is "Applications". `build.sh`'s nav drift check compares it against the running Keycloak and
warns when an upgrade adds a tab.

## Organizations and account deletion

- The `organizations` nav entry is gated by Keycloak's `isViewOrganizationsEnabled`. Test with the
  realm's Organizations on, both empty and with a membership.
- Self-service delete takes **two** settings: Authentication → Required actions → *Delete Account*
  enabled, **and** the `delete-account` role on the `account` client. A role granted after sign-in
  only appears after the token is reissued (sign out and back in). The **Delete** button must fill
  with `--p-alert-text`, never with a decorative `--p-alert` that fails 4.5:1.
