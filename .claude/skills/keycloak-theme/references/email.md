# The email theme

Starter: `assets/starter/src/theme/__THEME__/email/`.

`parent=base` and **one file**: `email/html/template.ftl`. Each of Keycloak's ~18 mails is a single
line wrapped in that template's `emailLayout` macro. Overriding the macro therefore brands all of
them, including ones a later release adds. **Leave `text/` alone**: a plain-text alternative with
markup in it is worse than a plain one.

## Mail is not the web

- **No webfonts.** Outlook, the Gmail apps and most native clients ignore `@font-face`. Use a
  system-first stack and record it as a deliberate deviation.
- **Brand as type.** Remote images are blocked by default, `data:` URIs fare no better, and inline
  SVG is stripped by Gmail and Outlook. The starter draws a letter-spaced text wordmark with a rule
  under it, so there is nothing to block and no alt text to fall back to. See
  [self-contained.md](self-contained.md#mail-images-the-one-place-the-rule-bends) for the opt-in
  image path and why it needs the user's OK.
- **Tables and inline style.** A `<style>` block survives Gmail's web client but not several native
  clients, so everything load-bearing is an inline attribute on a table cell. Set backgrounds with
  **both** the `bgcolor` attribute and inline `background-color`; Outlook reads the attribute and
  ignores the property. Use no flexbox and no `gap`.
- **Colours are inline literals.** The comment block at the top of the template maps each literal
  to its `--p-*` token. Fill them from the same token sheet so the mail matches the login.

## ⚠️ Notes in the template go in `<#-- -->`, never `<!-- -->`

FreeMarker does not know HTML comments. A `<#if …>` written as **prose** inside `<!-- … -->` is
parsed as a real directive. Measured on 26.6.1: one such comment made **every mail** fail with
"Failed to template email" (`Encountered "</#macro>", but at this place only this can be closed:
"#if"`). Every login page still rendered, because the mail template is only compiled when a mail is
sent. HTML comments are also shipped inside every mail. Use FreeMarker comments for notes. Leave
Outlook's `<!--[if mso]>` conditional comments as they are. The self-contained checker flags this,
and `dev/preview.sh` sends a real mail so it shows up before deploy.

## A flat light ground, even for a tinted or gradient app

Outlook does not support CSS gradients, and clients in dark mode invert arbitrarily, so a tint is
the first thing they mangle. Use a flat near-white ground with dark ink. Inverted, it keeps the
same ratio.

## ⚠️ Outlook dark mode is a separate path, and it wins

| Client | Honours `prefers-color-scheme` / `color-scheme` meta | Answered by |
| --- | --- | --- |
| Apple Mail, Gmail web, Thunderbird | yes | the `@media` block |
| **Outlook** (new Outlook, outlook.com, mobile) | **no** | `[data-ogsc]` / `[data-ogsb]` selectors, partially |

Outlook ignores the media query and both metas and recolours the document itself, tagging what it
touched with `data-ogsc` (text) and `data-ogsb` (background). Those overrides reduce the blast
radius but do not prevent it. The real guarantee is that everything stays **legible when
inverted**; pixel-matching the light design in Outlook is not achievable. If you add a dark band
with white knocked-out logos, it is the load-bearing case, because a band flipped light hides all
of them at once.

## Copy

- The footer line is a **message key** (`themeEmailFooter`), not a literal. Keycloak renders the
  body in the recipient's locale, and a hard-coded line would put one language under copy written
  in another.
- `{0}` and the wordmark read the realm's **Display name**. Tell the user to set Realm settings →
  Display name to the brand, not the realm id. It is what tells a recipient the mail is genuine.
- The apostrophe-doubling rule from [login.md](login.md#messages) applies here too.

## Checking a received mail

| What the HTML source shows | Meaning |
| --- | --- |
| none of the theme's `theme-*` classes and none of its colours | the realm is not using the Email theme (a separate dropdown, easy to miss) |
| theme classes present, no `<img` | type-only, as designed (`x-mail-logo` and `assetBaseUrl` empty) |
| `<img` present, images broken | the image URL is not publicly reachable: Keycloak's hostname (`KC_HOSTNAME`) for `x-mail-logo`, or the external host for `assetBaseUrl` |

Use MailHog from the dev compose (`:8025`), and send the test mail from Realm settings → Email.
