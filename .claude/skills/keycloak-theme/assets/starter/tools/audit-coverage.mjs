#!/usr/bin/env node
/**
 * Does the login theme's stylesheet actually cover every page Keycloak renders?
 *
 *   node tools/audit-coverage.mjs [<theme>] [--base <dir>] [--container <name>]
 *
 *   <theme>        theme directory under src/theme/. Optional when there is
 *                  exactly one — it is then detected.
 *   --base <dir>   an unpacked theme/base/login directory to read the base
 *                  templates from, instead of a running Keycloak.
 *   --container    the dev Keycloak container to read them from. Defaults to
 *                  $KC_CONTAINER, then "__CONTAINER__".
 *
 *   exit 0  every class and id is addressed — OR nothing could be audited (no
 *           Keycloak reachable and no --base), which is printed, never implied
 *   exit 1  gaps found (gates the build)
 *   exit 2  usage error: theme not found / ambiguous, --base dir missing
 *
 * `theme.properties` sets `parent=base`, so most of the login sequence is drawn
 * by Keycloak's own `base/login/*.ftl` inside our shell. Those templates write
 * their classes as `${properties.kcSomethingClass}`, which means a class can go
 * unstyled two different ways, neither of which is visible by reading our files:
 *
 *   1. the property is not declared in our theme.properties, so it expands to
 *      the empty string and the element renders `class=""`;
 *   2. it is declared, but styles.css never mentions the resulting name.
 *
 * Both shipped at some point. The first one had left seventeen properties
 * undeclared — reset-password, OTP entry, TOTP setup, update-password,
 * update-profile, register, terms, WebAuthn, recovery codes, device-verify and
 * x509 all lost their form layout, and nothing failed.
 *
 * So: expand every class token in every base template through our
 * theme.properties, then check the result against the stylesheet. Exits 1 when
 * anything is uncovered, so it can gate a build.
 *
 * The base templates come from a running Keycloak (read-only `docker cp` of its
 * themes jar), or from `--base <dir>` if you already have them unpacked. With
 * neither, the script says so and exits 0 rather than pretending it passed.
 */

import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const themesRoot = join(here, "..", "src", "theme");

const argOf = (name) => {
    const i = process.argv.indexOf(name);
    return i === -1 ? null : process.argv[i + 1];
};
const container = argOf("--container") ?? process.env.KC_CONTAINER ?? "__CONTAINER__";

// ── which theme ──────────────────────────────────────────────────────────────
// The first positional argument (anything that is neither a flag nor a flag's
// value), else the only directory under src/theme/.
const valueFlags = new Set(["--base", "--container"]);
const positional = process.argv.slice(2).filter((a, i, all) =>
    !a.startsWith("--") && !valueFlags.has(all[i - 1]));
let themeName = positional[0];
if (!themeName) {
    const found = existsSync(themesRoot)
        ? readdirSync(themesRoot).filter(d => statSync(join(themesRoot, d)).isDirectory())
        : [];
    if (found.length !== 1) {
        console.error(`  cannot detect the theme: ${found.length ? `several under src/theme (${found.join(", ")})` : "nothing under src/theme"}.`);
        console.error("  Pass its name: node tools/audit-coverage.mjs <theme>");
        process.exit(2);
    }
    themeName = found[0];
}
const themeDir = join(themesRoot, themeName, "login");
if (!existsSync(join(themeDir, "theme.properties"))) {
    console.error(`  ${join(themeDir, "theme.properties")} does not exist`);
    process.exit(2);
}

// ── the parent chain ─────────────────────────────────────────────────────────
// A child theme (parent=<another theme in src/theme>) inherits that theme's
// properties and resources: Keycloak merges properties down the chain and
// resolves css/img/js through it. Built-in parents (base, keycloak.v2) end the
// chain. Child first, parent last.
const readProps = (file) => {
    const out = new Map();
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z][\w.-]*)\s*=\s*(.*)$/);
        if (m) out.set(m[1], m[2].trim());
    }
    return out;
};
const chain = [themeDir];
for (let p = readProps(join(themeDir, "theme.properties")).get("parent"); p; ) {
    const dir = join(themesRoot, p, "login");
    if (!existsSync(join(dir, "theme.properties")) || chain.includes(dir)) break;
    chain.push(dir);
    p = readProps(join(dir, "theme.properties")).get("parent");
}
const resolveResource = (rel) => chain.map(d => join(d, "resources", rel)).find(f => existsSync(f));

/** Pull `theme/base/login/*.ftl` out of a running Keycloak. @returns {{dir:string,cleanup:()=>void}|null} */
function baseFromDocker() {
    const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    try {
        const running = sh("docker", ["ps", "--format", "{{.Names}}"]).split("\n").map(s => s.trim());
        if (!running.includes(container)) {
            console.log(`  skipped: container "${container}" is not running`);
            return null;
        }
        const jarPath = sh("docker", ["exec", container, "sh", "-c",
            "ls /opt/keycloak/lib/lib/main/*keycloak-themes*.jar"]).trim().split("\n")[0];
        const dir = mkdtempSync(join(tmpdir(), "kc-theme-base-"));
        sh("docker", ["cp", `${container}:${jarPath}`, join(dir, "themes.jar")]);
        sh("unzip", ["-q", "-o", join(dir, "themes.jar"), "theme/base/login/*", "-d", dir]);
        return { dir: join(dir, "theme", "base", "login"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
    } catch (err) {
        console.log(`  skipped: could not read the base templates (${err.message.split("\n")[0]})`);
        return null;
    }
}

const override = argOf("--base");
const source = override ? { dir: override, cleanup: () => {} } : baseFromDocker();
if (!source) {
    console.log("  Nothing audited. Start the dev Keycloak, or pass --base <dir>.");
    process.exit(0);
}
if (!existsSync(source.dir)) {
    console.error(`  ${source.dir} does not exist`);
    process.exit(2);
}

// ── theme.properties: kcFooClass -> the literal class names it expands to ────
// Merged down the chain: the parent's values first, each child overriding.
const props = new Map();
for (const dir of [...chain].reverse()) for (const [k, v] of readProps(join(dir, "theme.properties"))) props.set(k, v);

// ── the stylesheet, comments stripped ────────────────────────────────────────
// Comments are stripped so a name that only appears in prose — "we deliberately
// do not style .kcFoo" — never counts as coverage.
// Every sheet the theme loads (styles=, which a child REPLACES rather than
// extends), each resolved through the chain.
const sheets = (props.get("styles") || "css/styles.css").split(/\s+/).filter(Boolean);
const missingSheets = sheets.filter(s => !resolveResource(s));
if (missingSheets.length) {
    console.error(`  styles= lists ${missingSheets.join(", ")}, found in neither ${themeName} nor its parents`);
    process.exit(2);
}
if (chain.length > 1) console.log(`  parent chain: ${chain.map(d => d.split(/[\\/]/).at(-2)).join(" → ")}`);
const css = sheets.map(s => readFileSync(resolveResource(s), "utf8")).join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
const mentions = (selector) => css.includes(selector);

/**
 * Which tags does the stylesheet style at element level?
 *
 * Derived from the stylesheet rather than a hardcoded list, so the audit cannot
 * be quietly weakened by dropping a tag name into an allowlist here — which is
 * exactly what the throwaway version of this script did.
 *
 * A tag counts when it is the SUBJECT of some selector: the last compound, with
 * or without attributes and pseudo-classes. `input[type="text"]`,
 * `span.kcInputClass > input` and `a:focus-visible` all qualify; `.kcFoo` does
 * not. Matching only bare `form { … }` under-reports badly — every input rule in
 * a typical theme carries an attribute selector.
 */
const elementRules = new Set();
for (const fragment of css.split("}")) {
    const brace = fragment.indexOf("{");
    if (brace === -1) continue;
    for (const sel of fragment.slice(0, brace).split(",")) {
        const subject = sel.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean).pop();
        const tag = subject?.match(/^([a-z][a-z0-9]*)(?:[.:#[]|$)/);
        if (tag) elementRules.add(tag[1]);
    }
}

// ── walk every page ─────────────────────────────────────────────────────────
// Base's own `template.ftl` is excluded: this theme ships its own shell, so
// base's never renders and its markup is not ours to cover. Ours is scanned
// instead, from the theme directory — it is a page source like any other, and
// leaving it out would mean the shell's own classes went unchecked.
// Every .ftl the theme (or a parent in its chain) ships REPLACES base's page of
// the same name — the nearest one in the chain wins, as Keycloak resolves it.
const ours = new Map();
for (const dir of chain) {
    for (const f of readdirSync(dir).filter(f => f.endsWith(".ftl"))) {
        if (!ours.has(f)) ours.set(f, join(dir, f));
    }
}
const pages = [
    ...readdirSync(source.dir)
        .filter(f => f.endsWith(".ftl") && f !== "template.ftl" && !ours.has(f))
        .map(f => ({ name: f, path: join(source.dir, f) })),
    ...[...ours].map(([f, path]) => ({ name: `${f} (ours${path.startsWith(themeDir) ? "" : ", inherited"})`, path })),
];
const undeclared = new Set();
const missingClass = new Map();
const missingId = new Map();
const add = (map, key, page) => (map.get(key) ?? map.set(key, new Set()).get(key)).add(page);

/**
 * `<#assign classDiv=properties.kcInputClassRadio!>` — a property laundered
 * through a local variable, then written as `class="${classDiv}"`.
 *
 * This is not hypothetical tidiness. `user-profile-commons.ftl` does exactly
 * that for the six radio/checkbox option classes on EVERY version from 26.0.2
 * to 26.7.1, and because the class attribute then names a variable rather than
 * a property, the earlier version of this script could not see them at all: six
 * undeclared properties, silently reported as full coverage. Anything the
 * templates can indirect through, this has to follow.
 *
 * Assignments are file-local, so the map is rebuilt per page. A variable maps to
 * a SET of properties, not one: `user-profile-commons.ftl` assigns `classDiv`
 * twice — once in its radio branch, once in its checkbox branch — and keeping
 * only the last reported two of the six missing properties instead of all six.
 *
 * @param {string} src
 * @returns {Map<string, Set<string>>} local variable name -> property names
 */
function assignedProperties(src) {
    const map = new Map();
    for (const m of src.matchAll(/<#assign\s+([A-Za-z_]\w*)\s*=\s*properties\.([A-Za-z][\w-]*)\s*!?\s*>/g)) {
        (map.get(m[1]) ?? map.set(m[1], new Set()).get(m[1])).add(m[2]);
    }
    return map;
}

/**
 * Split a class attribute into candidate tokens, with FreeMarker DIRECTIVES
 * removed first — `<#if …>` and `</#if>` are control flow, not class names.
 *
 * Without this, splitting on whitespace turned
 *     class="${properties.kcFooClass!} <#if social.providers?size gt 3>${properties.kcBarClass!}</#if>"
 * into tokens including a bare `gt`, which looks exactly like a class name and
 * was reported as an unstyled class on three pages. It also glued `3>` onto the
 * following interpolation, hiding a real property reference.
 *
 * Interpolations are kept — they are what `expand()` resolves.
 *
 * Directives are removed WITHOUT leaving a space, because a class can be built by
 * concatenation across one:
 *     class="pf-m-<#if message.type = 'error'>danger<#else>${message.type}</#if>"
 * Substituting a space there invents a bare token `danger`; substituting nothing
 * yields `pf-m-danger${message.type}`, which is correctly ignored as unresolvable.
 * Any whitespace that mattered sits inside the directive body and survives.
 *
 * @param {string} value
 * @returns {string[]}
 */
function classTokens(value) {
    return value.replace(/<\/?#[^>]*>/g, "").split(/\s+/).filter(Boolean);
}

/**
 * One class token from a template -> the literal names it produces.
 *
 * @param {string} token
 * @param {Map<string, Set<string>>} assigned
 * @returns {string[]}
 */
function expand(token, assigned) {
    const fromProperty = (name) => {
        const value = props.get(name);
        if (value === undefined) { undeclared.add(name); return []; }
        return value.split(/\s+/).filter(Boolean);
    };

    const direct = token.match(/^\$\{properties\.([A-Za-z][\w-]*)[!}]/);
    if (direct) return fromProperty(direct[1]);

    // `${classDiv}` / `${classDiv!}` where classDiv came from a property. Every
    // branch that assigns it has to be checked, since any of them can be the one
    // that renders.
    const indirect = token.match(/^\$\{([A-Za-z_]\w*)\s*!?\}/);
    if (indirect && assigned.has(indirect[1])) {
        return [...assigned.get(indirect[1])].flatMap(fromProperty);
    }

    // Anything still carrying FreeMarker syntax is not a class name.
    return /^[A-Za-z][\w-]*$/.test(token) ? [token] : [];
}

for (const { name: page, path: pagePath } of pages) {
    // FreeMarker comments stripped first, for the same reason CSS comments are:
    // a class name discussed in prose is not a class name in the output. A
    // shell that documents the FontAwesome icon it REPLACED — `<i class="fa-sync-alt
    // fas">` — would otherwise have those two reported as unstyled, which is
    // exactly what happened before this line existed.
    const src = readFileSync(pagePath, "utf8").replace(/<#--[\s\S]*?-->/g, "");
    const assigned = assignedProperties(src);

    // ── Pass A: class coverage, independent of element boundaries ────────────
    // Every class attribute in the file, matched on its own. Deliberately not
    // folded into the element scan below, because FreeMarker directives live
    // INSIDE attributes:
    //     class="${classLabel}<#if attribute.readOnly> ${properties.kcFoo!}</#if>"
    // The `>` in that `<#if` truncates any `<tag …>` match, which silently
    // swallowed the two radio/checkbox label classes even after the indirection
    // above was handled.
    for (const attr of src.matchAll(/class\s*=\s*"([^"]*)"/g)) {
        for (const c of classTokens(attr[1]).flatMap((t) => expand(t, assigned))) {
            if (!mentions(`.${c}`)) add(missingClass, c, page);
        }
    }

    // ── Pass B: id coverage, element-scoped ─────────────────────────────────
    // An id has to be judged against the classes on the SAME element, so this
    // pass does need whole elements. The truncation above is harmless here:
    // an `id="…"` never contains a directive.
    for (const tag of src.matchAll(/<([a-z]+)\b([^>]*)>/g)) {
        const [, tagName, attrs] = tag;
        const classes = classTokens(attrs.match(/class\s*=\s*"([^"]*)"/)?.[1] ?? "")
            .flatMap((t) => expand(t, assigned));
        const id = attrs.match(/id\s*=\s*"([^"$<]*)"/)?.[1];

        // A hidden input has nothing to style — the user agent does not render
        // it. Fifteen of the ids in the login sequence are hidden form state
        // (WebAuthn blobs, the TOTP secret, credential ids); counting those as
        // gaps buries the ones that matter.
        const isHidden = tagName === "input" && /type\s*=\s*"hidden"/.test(attrs);

        // An id needs its own rule only when nothing else styles the element:
        // no styled class on it, and no element-level rule for its tag.
        if (id && !isHidden && !mentions(`#${id}`)) {
            const covered = classes.some(c => mentions(`.${c}`)) || elementRules.has(tagName);
            if (!covered) add(missingId, id, page);
        }
    }
}
source.cleanup();

// ── report ──────────────────────────────────────────────────────────────────
const report = (title, map) => {
    console.log(`\n${title} (${map.size}):`);
    for (const [name, seen] of [...map].sort()) {
        console.log(`   ${name}  ←  ${[...seen].sort().join(", ")}`);
    }
};

console.log(`theme: ${themeName}`);
console.log(`pages scanned: ${pages.length}`);
console.log(`element rules found in the stylesheets: ${[...elementRules].sort().join(", ") || "none"}`);

let failed = false;
if (undeclared.size) {
    failed = true;
    console.log(`\nproperties used by base templates but NOT declared in theme.properties (${undeclared.size}):`);
    for (const p of [...undeclared].sort()) console.log(`   ${p}`);
    console.log("   → these expand to class=\"\", so nothing can style them.");
}
if (missingClass.size) { failed = true; report("classes with no rule", missingClass); }
if (missingId.size) { failed = true; report("ids with no rule and no class/element fallback", missingId); }

if (failed) {
    console.log("\nFAIL — declare each missing property in login/theme.properties, then give every");
    console.log("class and id listed above a rule in login/resources/css/styles.css (an element");
    console.log("rule for the tag also covers an id). Re-run until this passes.");
    process.exit(1);
}
console.log("\nOK — every class and id the login sequence emits is addressed.");
