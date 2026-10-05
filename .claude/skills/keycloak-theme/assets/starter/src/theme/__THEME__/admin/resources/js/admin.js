/**
 * __BRAND__ admin console — keycloak-theme skill STARTER.
 *
 * This file is the keycloak-theme skill's starter, copied into the project.
 * Fill in BRAND_REALMS below only if the look must be limited to some realms;
 * left empty, it does nothing but the dark-class backstop.
 * Background and both admin modes: references/admin.md.
 *
 * ── 1. Keep PatternFly out of its dark theme ───────────────────────────────
 * `darkMode=false` in theme.properties removes index.ftl's inline script that
 * adds `pf-v5-theme-dark` from `prefers-color-scheme`. That is enough for the
 * shell, but not for the console: Realm settings → Themes (the built-in
 * quick-theme editor) adds the class ITSELF from the OS preference, unless the
 * realm attribute `darkMode` is "false" (measured in the 26.6.1 bundle). With
 * the class on, PatternFly's component-level dark rules — which ignore the
 * global tokens — repaint menus, toolbars and controls dark over this light
 * retint. So the class is stripped whenever it appears. Cost: that tab's dark
 * PREVIEW no longer previews dark. Fine for a single light cut.
 *
 * ── 2. Optional realm gate (OFF by default) ─────────────────────────────────
 * ⚠️ The admin theme is resolved from the realm you SIGN IN to — `master` for
 * almost every administrator — never from the realm picked in the realm list.
 * Setting adminTheme on master therefore restyles the console for EVERY realm
 * administered from there, and setting it on the product realm alone styles
 * nothing anyone sees (nobody signs in to the console there).
 *
 * If the console should wear the brand only while managing the product's
 * realm(s), list them in BRAND_REALMS. The managed realm is read from the SPA
 * route (`#/<realm>/…`) — the only thing that tracks the realm list — and:
 *   - <html> gets `kc-brand` (branded) or `kc-unbranded` (gate closed),
 *   - when closed, the theme's stylesheet is DISABLED (the stock look comes
 *     back in full; a full restyle cannot be hung off one class without
 *     prefixing every rule), and the logo <img>s are pointed back at Keycloak's
 *     own files. Those paths are deliberately not shipped by this theme, so
 *     they resolve up the inheritance chain to keycloak.v2's — no version in
 *     the URL. React re-renders restore `src` from `logo`, so it is
 *     re-asserted on every mutation, not set once.
 * ⚠️ These are REALM NAMES (the `realm` field, what the URL shows), not
 * display names. They are usually different strings (`acme_prod` vs "Acme"),
 * and comparing the route against a display name means the brand never shows.
 * The failure mode of the gate is stock Keycloak, which is the safe direction.
 */
const BRAND_REALMS = []; // e.g. ["acme_prod", "acme_test"] — empty = gate off, brand everywhere

const DARK = "pf-v5-theme-dark";
const root = document.documentElement;
// Resolved from this module's own URL, so no theme name or version is
// hard-coded: …/resources/<ver>/admin/<Theme>/js/admin.js → …/<Theme>/.
const THEME_BASE = new URL("../", import.meta.url).href;
// Every stylesheet this theme ships (css/admin.css, a dark variant's
// css/dark.css, an environment's css/env.css …), not only admin.css — the gate
// must switch them all off together, or a variant's overrides stay on.
const SHEET_DIR = new URL("css/", THEME_BASE).href;
const STOCK_LOGO = new URL("logo.svg", THEME_BASE).href; // masthead (keycloak.v2's)
const STOCK_ICON = new URL("icon.svg", THEME_BASE).href; // dashboard (keycloak.v2's)
const OWN_LOGO = new URL("img/logo.svg", THEME_BASE).href; // = `logo` in theme.properties

function managedRealm() {
    // #/smoke-preview/users/… → "smoke-preview". `#/` alone → the sign-in realm.
    const seg = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (seg) return decodeURIComponent(seg);
    try {
        return JSON.parse(document.getElementById("environment").textContent).realm;
    } catch {
        return null;
    }
}

function setSrc(img, src) {
    if (img && img.getAttribute("src") !== src) img.setAttribute("src", src);
}

function apply() {
    // Guarded: the observer watches `class`; removing an absent class can still
    // rewrite the attribute and wake the observer again, forever.
    if (root.classList.contains(DARK)) root.classList.remove(DARK);
    if (document.body?.classList.contains(DARK)) document.body.classList.remove(DARK);

    if (!BRAND_REALMS.length) return; // gate off: the theme applies everywhere
    const on = BRAND_REALMS.includes(managedRealm());
    if (root.classList.contains("kc-brand") !== on || root.classList.contains("kc-unbranded") === on) {
        root.classList.toggle("kc-brand", on);
        root.classList.toggle("kc-unbranded", !on);
    }
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        if (link.href.startsWith(SHEET_DIR) && link.disabled === on) link.disabled = !on;
    }
    // Closed: Keycloak's own files. Open again: React may not re-render the
    // <img>, so put the theme's logo back explicitly.
    setSrc(document.querySelector(".pf-v5-c-masthead__brand > img"), on ? OWN_LOGO : STOCK_LOGO);
    setSrc(document.querySelector("img.keycloak__dashboard_icon"), on ? OWN_LOGO : STOCK_ICON);
}

apply();
addEventListener("hashchange", apply);

new MutationObserver(apply).observe(root, {
    attributes: true,
    attributeFilter: ["class", "src"],
    childList: true,
    subtree: true,
});
