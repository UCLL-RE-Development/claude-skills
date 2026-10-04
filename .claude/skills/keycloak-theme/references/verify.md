# Verify it, do not eyeball it

Most traps in this skill are invisible in a static read of the CSS. A theme counts as done when
the gates below pass **and** it has been driven against a Keycloak pinned to production's version.

## The gates (all run by `build.sh`)

| Gate | Question it answers | Fails the build? |
| --- | --- | --- |
| `tools/check-self-contained.mjs` | Is every font, image and colour inside the theme? Any placeholder left? | **yes** |
| `tools/audit-coverage.mjs` | Does every class or id the base login templates emit have a rule? | **yes** (exits 0 with a message when no Keycloak is reachable) |
| nav drift check | Does `content.json` still list every tab this Keycloak offers? | warns |

Also run `scripts/contrast.mjs --css` on both stylesheets. The deviations table must quote its
numbers.

The coverage audit expands every `${properties.kcFoo}` in all base login templates through
`theme.properties`, including `<#assign>` indirection, and reports any class the stylesheet never
mentions. It ignores CSS comments (a name mentioned only in prose is not coverage) and
`type="hidden"` inputs.

## The harness: composition, not coverage

`tools/harness/index.html` holds the DOM the base templates emit for pages you cannot reach without
a live flow: OTP entry, TOTP setup, recovery codes, the authenticator picker and every alert tone.
It is wired to the real stylesheet by relative path, so you open it in a browser directly. The audit
proves each hook has a rule. The harness shows whether the rules **compose**: a submit button
ignoring its block class, or an icon nested inside a copy of itself. **Keep it a mirror of the
templates.** When `template.ftl` changes (a wordmark becomes an image), the harness changes too.

## Drive it for real

```bash
./dev/preview.sh <Name> [--master]   # Keycloak :8087, MailHog :8025 (KC_PORT / MAIL_PORT); prints every link; stays running
```

`preview.sh` does everything below: the compose up, a `<name>-preview` realm with every type the
theme has, a `tester` / `test` user, a PKCE-free `theme-preview` client so sign-in and register open
from a plain link, a real test mail, and the links. The compose file mounts `src/theme` with every
theme cache off, is **pinned to production's version**, and carries its own Compose project
`name:`.

⚠️ **Never let Compose name the project after the folder.** The folder is `dev/`, and so is every
other stack kept in a `dev/` folder. Compose then calls their containers "orphans", and `down`
removes the shared `dev_default` network their stopped containers point at; those containers then
fail to `docker start`. This happened. Hence `name:` in the compose file.

The manual equivalent, if you need to adjust something:

```bash
kc() { docker exec <container> /opt/keycloak/bin/kcadm.sh "$@"; }
kc config credentials --server http://localhost:8080 --realm master --user admin --password admin
kc create realms -s realm=theme-test -s enabled=true -s displayName="<Brand>" \
  -s loginTheme=<Name> -s accountTheme=<Name> -s emailTheme=<Name> \
  -s rememberMe=true -s resetPasswordAllowed=true -s registrationAllowed=true \
  -s internationalizationEnabled=true -s defaultLocale=<lang> -s 'supportedLocales=["<lang>","en"]' \
  -s sslRequired=NONE
#   add -s organizationsEnabled=true when production has Organizations on
kc create users -r theme-test -s username=tester -s enabled=true -s email=tester@theme.local \
  -s emailVerified=true -s firstName=Test -s lastName=User
kc set-password -r theme-test --username tester --new-password test
```

`rememberMe`, `resetPasswordAllowed` and `registrationAllowed` are on so those controls actually
appear. For pages behind authentication, give the realm a **username-only browser flow**; Keycloak
ships the authenticator, so there is no password to type.

**Submit pages with their error states forced**, not just load them: register (blank submit),
forgot password, the reset-sent confirmation, update password from the mailed link (mismatch),
the identity-first password step (read-only field), and the account console's Personal info,
Device activity and Organizations tabs. For each: no element with `class=""`, no horizontal
overflow, and contrast measured on the rendered page.

Look at the pages yourself with `scripts/screenshot.mjs`. It drives the local Edge or Chrome
headless over the DevTools protocol with no dependencies, can sign in, and can emulate a dark OS:

```bash
node <skill>/scripts/screenshot.mjs --light --shot "<a preview link>" shot.png [--shot <url> <png> …] \
     [--login tester:test] [--click "<selector>"] [--eval "getComputedStyle(…).color"] [--dark] [--full]
```

Then read the PNG. Read **computed styles** instead of trusting a screenshot when judging a value,
and
screenshot at a width the pane captures 1:1 when judging a 1px border. A hard seam in a gradient
right after a programmatic scroll is usually a partial repaint; re-screenshot before chasing it.

⚠️ **The browser caches theme resources even with server caching off.** When a change "does not
apply", reload the stylesheet with a cache-busting query before concluding anything:

```js
const l = [...document.querySelectorAll('link[rel=stylesheet]')].find(x => x.href.includes('.css'));
const u = new URL(l.href); u.searchParams.set('cb', Date.now()); l.href = u.toString();
```

## In design mode: compare against the design

Put the design's login frame (a Figma screenshot, or the Claude Design artifact) beside the rendered
page at the same width. Compare token by token: card radius, field height, label size, button
shape and the spacing rhythm. List every intentional difference (a structural limit, or a contrast
deviation) in the README's deviations table.

## Version drift is the failure mode to watch

`parent=base` means most of the sequence renders from the **server's** templates. The theme is only
as verified as the Keycloak it was checked against, and a dev container on an older release
silently tests different markup. Record the verified version in the README. **Before upgrading
Keycloak, audit the version you are upgrading TO**:

```bash
node <skill>/scripts/keycloak-versions.mjs --check <prod> --verified <readme version>   # latest vs prod
node <skill>/scripts/keycloak-versions.mjs --diff <prod> <target> <dir>                 # changed templates
node tools/audit-coverage.mjs <Theme> --base <dir>/<target>/theme/base/login            # coverage on target
```

Measured: 26.6.1 → 26.8.0 added `theme-resources.ftl` (the new resource model the starter template
already reads first) and changed 12 base templates. The UCLL themes stayed fully covered.
