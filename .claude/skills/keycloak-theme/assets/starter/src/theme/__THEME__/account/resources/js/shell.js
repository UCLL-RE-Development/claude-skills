/**
 * __BRAND__ account console — keycloak-theme skill STARTER.
 *
 * This file is the keycloak-theme skill's starter, copied into the project.
 * Nothing in it needs filling in: it carries no project URL on purpose — the
 * brand link comes from realm configuration (the Home URL on
 * __WEB_CLIENT_ID__). Background and procedure: references/account.md.
 *
 * Two corrections to the account console's shell, both of which have to run in
 * the page because `index.ftl` belongs to keycloak.v3 and is deliberately not
 * copied (see theme.properties).
 *
 * ── 1. Keep PatternFly out of its dark theme ───────────────────────────────
 * `darkMode=false` in theme.properties is what actually turns this off, and on
 * 26.6.1 it is enough on its own. This is the backstop.
 *
 * It is worth having one because of how the class arrives: the account-ui
 * BUNDLE adds it at runtime from `prefers-color-scheme`, so there is nothing in
 * the served HTML to notice, and it only happens for visitors whose OS is in
 * dark mode. If a release ever stops honouring the property, the failure is a
 * console painted half dark for some people and perfect for whoever is testing.
 *
 * PatternFly's component-level dark rules ignore the global tokens entirely,
 * so no amount of token overriding in account.css substitutes for removing it.
 *
 * ── 2. The brand link ──────────────────────────────────────────────────────
 * The console renders `<a class="pf-v5-c-masthead__brand" href={logoUrl}>`, and
 * `logoUrl` can only come from theme.properties — a static, per-deployment
 * absolute URL. Measured in the bundle:
 *     const a = e.logoUrl ? e.logoUrl : "/";
 * `referrerUrl` is read only for the separate "Back to <app>" toolbar link, so
 * the brand cannot see it on its own.
 *
 * But `referrerUrl` is exactly the value we want, and Keycloak derives it from
 * configuration the realm already maintains: arriving at the console as
 * `?referrer=<clientId>` makes Keycloak fill it from that client's **Home URL**
 * (rootUrl + baseUrl). Verified against 26.0.2:
 *
 *     ?referrer=__WEB_CLIENT_ID__                                  → the client's Home URL
 *     ?referrer=__WEB_CLIENT_ID__&referrer_uri=<a registered URI>  → that URI
 *     ?referrer=__WEB_CLIENT_ID__&referrer_uri=https://evil...     → "" (dropped)
 *
 * That last row is the safety property: Keycloak validates `referrer_uri`
 * against the client's registered redirect URIs and blanks it when it does not
 * match, so this cannot be used to point the brand at somebody else's site.
 * Whatever arrives in `referrerUrl` has already been through that check.
 *
 * keycloak-js's `createAccountUrl()` appends the `referrer` parameter, and that
 * is what the app should call for its Profile / Account link. When it is absent
 * — someone opened the console directly — this falls back as described in
 * brandHref() rather than guessing an app URL.
 */
const DARK = "pf-v5-theme-dark";
const root = document.documentElement;

function brandHref() {
    const el = document.getElementById("environment");
    if (!el) return null;
    let env;
    try {
        env = JSON.parse(el.textContent);
    } catch {
        return null;
    }

    // Keycloak encodes a fragment as _hash_ — the same unwrapping the console's
    // own back-link does.
    if (env.referrerUrl) return String(env.referrerUrl).replace("_hash_", "#");

    // No referrer: somebody opened the console directly, so there is no app to
    // go back to. Keycloak's default here is "/", which resolves to the Keycloak
    // ROOT — an admin welcome page, and a confusing place to land an end user.
    // The console's own base is the honest answer: it reloads where they already
    // are. `logoUrl` still wins over both when set in theme.properties.
    return env.logoUrl ? null : (env.baseUrl || null);
}

const HREF = brandHref();

function apply() {
    // Guarded: this observer watches `class`, and removing a class that is not
    // there still rewrites the attribute on some engines — which would wake the
    // observer again, forever.
    if (root.classList.contains(DARK)) root.classList.remove(DARK);
    if (document.body?.classList.contains(DARK)) document.body.classList.remove(DARK);

    if (!HREF) return;
    const brand = document.querySelector("a.pf-v5-c-masthead__brand");
    // React rebuilds the masthead on navigation and restores href from logoUrl,
    // so this is re-asserted rather than set once. Guarded for the same
    // observer-loop reason as above.
    if (brand && brand.getAttribute("href") !== HREF) brand.setAttribute("href", HREF);
}

apply();

// One observer for both jobs. Watching the whole subtree is what catches the
// masthead being re-rendered; `attributes` on the root catches the dark class
// being re-applied — the bundle reacts to `prefers-color-scheme` changing,
// which can happen while the page is open.
new MutationObserver(apply).observe(root, {
    attributes: true,
    attributeFilter: ["class", "href"],
    childList: true,
    subtree: true,
});
