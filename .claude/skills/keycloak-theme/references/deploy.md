# Deliverables, deploy steps and the theme README

## Deliverables

- The theme tree, a working `build.sh`, and the built jars: **`dist/<Name>.jar`, one per theme,
  each standalone.** Every jar carries its own descriptor and everything it renders, and depends
  on no other jar, so it can be deployed, moved to another server, rolled back or removed on its
  own. Themes that inherit from a base in the source (environment variants) are flattened into
  their jar by `tools/flatten-theme.mjs`: the base's files and properties are merged in and
  `parent=` points at Keycloak's built-in theme. The base itself is source-only and gets no jar.
- `dev/keycloak-compose.yaml`, pinned to production's version.
- `tools/check-self-contained.mjs`, `tools/audit-coverage.mjs` and `tools/harness/index.html`,
  all passing.
- A **README next to the theme** (outline below). The traps are invisible in the code; the README
  is where they survive.

Do not commit unless asked. **Never apply a realm configuration to production.** Produce it,
verify it locally, and hand it over.

## Deploy checklist (copy into the README)

1. Copy `dist/<Name>.jar` (only the jars this server needs; each stands alone) into
   `/opt/keycloak/providers/`, then **restart**. Two jars must never declare the same theme name.
   Remove an old jar of the same theme before copying in a new one. Production caches themes,
   so a running server does not pick up a replaced jar. If the server starts with `--optimized`, a
   new provider jar is ignored until `kc.sh build` is re-run.
2. **Realm settings → Themes**: set *Login*, *Account* **and** *Email* to `<Name>`. Email is a
   separate dropdown and easy to miss; with it unset the mails are stock while the login page looks
   perfect.
3. ⚠️ **A client can override the realm's login theme.** If the login page still looks stock,
   check Clients → `<web-client>` → Settings → *Login theme*. It looks exactly like the jar did not
   deploy.
4. **Clients → `<web-client>` → Settings → Home URL**: the account console's brand links there.
5. **Realm settings → General → Display name**: the brand, not the realm id. The mails print it.
6. **Realm settings → Localization**: Internationalization on, with the default and supported
   locales. Without it, everybody gets English.

To confirm which theme a live login page is using, without a browser:

```bash
curl -s "https://<kc-host>/realms/<realm>/protocol/openid-connect/auth?client_id=<web-client>&response_type=code&scope=openid&redirect_uri=<encoded-redirect>&state=x" \
  | grep -o 'href="/resources/[^"]*css/styles.css"'
```

## Theme README outline

1. **What it covers.** The types built (and why there is no `admin` type, if there is none).
2. **Look.** The token source (the project files, or the design link plus the date it was read),
   light or dark and why, and the page ground.
3. **Token sheet.** Every `--p-*` value with its Source (the project token name, the design
   variable name, `DERIVED`, or `DEVIATION`) and its measured contrast.
4. **Contrast deviations table.** Role | source value | measured | used instead | measured.
5. **Embedded assets.** The font files and weights (and the licence for a third-party font), the
   logo cuts per type and why, the favicon, and the email being type-only (or the `assetBaseUrl`
   exception the user agreed to).
6. **Layout** of the tree.
7. **Build, Deploy** (the checklist above), and **Developing on it** (the compose file and the
   throwaway realm).
8. **Checking a change.** The three gates, the harness, and driving it.
9. **Every ⚠️ from the references that applied** to this theme.
10. **Verified against Keycloak `<version>`**, plus the version-drift warning.
