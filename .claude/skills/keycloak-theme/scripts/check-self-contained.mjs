#!/usr/bin/env node
// Self-containment gate for a Keycloak theme.
//
//   node check-self-contained.mjs <theme-dir> [--allow-email-remote-images]
//
//   <theme-dir> is src/theme/<Name> — the folder holding login/, account/,
//   email/ and/or admin/.
//
// The rule it enforces: every font, image and colour the theme needs at runtime
// lives INSIDE the theme (and so inside the jar). Nothing is fetched from a CDN,
// Google Fonts, or the app's own origin. Keycloak serves these pages from its
// own origin, often on another host than the app, so anything borrowed from the
// app 404s, and anything borrowed from a CDN is a third-party request on the
// login page and a dependency the theme cannot pin.
//
// Exits 1 on any ERROR, 0 otherwise. WARNs never fail the build.
//
// No dependencies: plain Node 18+.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, extname, sep } from 'node:path';

const args = process.argv.slice(2);
const allowEmailImages = args.includes('--allow-email-remote-images');
const root = args.find(a => !a.startsWith('--'));
if (!root || !existsSync(root) || !statSync(root).isDirectory()) {
    console.error('usage: node check-self-contained.mjs <src/theme/Name> [--allow-email-remote-images]');
    process.exit(2);
}
const themeRoot = resolve(root);

const errors = [];
const warns = [];
const err  = (f, line, msg) => errors.push(`${rel(f)}${line ? ':' + line : ''}  ${msg}`);
const warn = (f, line, msg) => warns.push(`${rel(f)}${line ? ':' + line : ''}  ${msg}`);
const rel  = f => relative(themeRoot, f).split(sep).join('/');

const TEXT = new Set(['.css', '.ftl', '.html', '.properties', '.json', '.js', '.mjs', '.svg', '.txt']);
const FONT = new Set(['.woff2', '.woff', '.ttf', '.otf', '.eot']);
const GENERIC_FONTS = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
    'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
    'inherit', 'initial', 'unset', 'revert', 'revert-layer',
]);
// Known third-party asset hosts. Any of these anywhere in the theme is an error,
// even in a comment-free context we did not otherwise parse.
const CDN = /\b(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|p\.typekit\.net|fonts\.bunny\.net|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|kit\.fontawesome\.com|use\.fontawesome\.com)\b/;
const PLACEHOLDER = /__[A-Z][A-Z0-9_]*__/g;

function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else out.push(p);
    }
    return out;
}

const files = walk(themeRoot);
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;
// Strip CSS comments but keep newlines, so line numbers survive.
const stripCssComments = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
// FreeMarker comments <#-- … --> and HTML comments.
const stripMarkupComments = s => s
    .replace(/<#--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
const stripPropComments = s => s.split('\n').map(l => (/^\s*[#!]/.test(l) ? '' : l)).join('\n');

const typeOf = f => rel(f).split('/')[0]; // login | account | email | admin
const fontBytes = {};

for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (FONT.has(ext)) {
        const t = typeOf(f);
        fontBytes[t] = (fontBytes[t] || 0) + statSync(f).size;
        if (ext !== '.woff2' && ext !== '.woff') warn(f, 0, `font is ${ext}; ship woff2 (smaller, every supported browser reads it)`);
    }
    if (!TEXT.has(ext)) continue;
    const raw = readFileSync(f, 'utf8');

    // ── 1. Unfilled starter placeholders ─────────────────────────────────────
    for (const m of raw.matchAll(PLACEHOLDER)) {
        err(f, lineOf(raw, m.index), `unfilled placeholder ${m[0]}`);
    }

    // ── 1b. Starter leftovers that are not placeholders but still mean "not done"
    if (/keycloak-theme skill'?s? STARTER/i.test(raw)) warn(f, 0, 'still carries the starter header — rewrite it to describe this theme (SKILL.md Step 4)');
    for (const m of raw.matchAll(/SOURCE:\s*\?/g)) warn(f, lineOf(raw, m.index), 'token without a source (SOURCE: ?) — name the project token or design variable, or mark DERIVED');

    // ── 2. Third-party asset hosts, anywhere outside comments ────────────────
    const code = ext === '.css' ? stripCssComments(raw)
               : ext === '.ftl' || ext === '.html' || ext === '.svg' ? stripMarkupComments(raw)
               : ext === '.properties' ? stripPropComments(raw)
               : raw;
    for (const m of code.matchAll(new RegExp(CDN, 'g'))) {
        err(f, lineOf(code, m.index), `third-party asset host ${m[0]} — download the file into resources/ instead`);
    }

    if (ext === '.ftl') checkFtlComments(f, raw);
    if (ext === '.css') checkCss(f, code);
    if (ext === '.ftl' || ext === '.html') checkMarkup(f, code);
    if (ext === '.svg') checkSvg(f, raw);
    if (ext === '.properties' && f.endsWith('theme.properties')) checkProps(f, code);
}

function resolveUrl(fromFile, url) {
    return resolve(dirname(fromFile), url.split(/[?#]/)[0]);
}

function checkCss(f, code) {
    // url(...) — must be data: or a relative path that exists inside the theme.
    for (const m of code.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
        const url = m[2].trim();
        const line = lineOf(code, m.index);
        if (url.startsWith('data:') || url.startsWith('#')) continue;
        if (/^(https?:)?\/\//i.test(url)) { err(f, line, `remote url(${url}) — embed the file in resources/`); continue; }
        if (url.startsWith('/')) { err(f, line, `root-relative url(${url}) resolves against Keycloak's origin, not the theme — use a path relative to this file`); continue; }
        const target = resolveUrl(f, url);
        // Deliberate exception: a path that resolves UP the theme inheritance
        // chain to the parent theme's own file (admin's Keycloak logo trick).
        // Marked on the same line so it is never accidental.
        if (/kc-inherit/.test(readFileSync(f, 'utf8').split('\n')[line - 1] || '')) continue;
        if (!target.startsWith(themeRoot)) { err(f, line, `url(${url}) points outside the theme`); continue; }
        if (!existsSync(target)) err(f, line, `url(${url}) — file does not exist`);
    }
    for (const m of code.matchAll(/@import\s+(?:url\()?\s*['"]?([^'");\s]+)/g)) {
        const url = m[1];
        if (/^(https?:)?\/\//i.test(url)) err(f, lineOf(code, m.index), `remote @import ${url}`);
    }

    // Fonts: the FIRST family of every stack must be embedded here or generic.
    const declared = new Set();
    for (const m of code.matchAll(/@font-face\s*{([^}]*)}/g)) {
        const fam = /font-family\s*:\s*([^;]+)/.exec(m[1]);
        if (fam) declared.add(unquote(fam[1]));
        if (!/src\s*:/.test(m[1])) err(f, lineOf(code, m.index), '@font-face without src');
        if (/\blocal\(/.test(m[1])) warn(f, lineOf(code, m.index), '@font-face uses local() — the visitor may get a different cut than the embedded file');
    }
    const stacks = [
        ...[...code.matchAll(/(?<![-\w])font-family\s*:\s*([^;}]+)/g)].filter(m => !insideFontFace(code, m.index)),
        ...code.matchAll(/--[\w-]*font[\w-]*\s*:\s*([^;}]+)/g),
    ];
    for (const m of stacks) {
        const first = m[1].split(',')[0].trim();
        if (!first || first.startsWith('var(')) continue;
        const name = unquote(first);
        if (GENERIC_FONTS.has(name.toLowerCase())) continue;
        if (declared.has(name)) continue;
        if (/^[-\w]*(mono|SFMono|Menlo|Consolas|Courier)/i.test(name) && /monospace/.test(m[1])) continue; // system mono stack is fine
        err(f, lineOf(code, m.index), `font "${name}" is used but has no @font-face in this stylesheet — embed it or put a generic family first`);
    }
}

function insideFontFace(code, idx) {
    const open = code.lastIndexOf('@font-face', idx);
    if (open < 0) return false;
    const close = code.indexOf('}', open);
    return idx < close;
}

function unquote(s) { return s.trim().replace(/^['"]|['"]$/g, '').trim(); }

function checkMarkup(f, code) {
    const isEmail = typeOf(f) === 'email';
    // Resources the page LOADS. Plain <a href> links are navigation, not assets.
    for (const m of code.matchAll(/<(img|link|script|source|video|audio|iframe)\b[^>]*?\b(src|href|srcset)\s*=\s*"([^"]*)"/gi)) {
        const [, tag, , url] = m;
        const line = lineOf(code, m.index);
        if (/^(https?:)?\/\//i.test(url)) {
            if (isEmail && tag.toLowerCase() === 'img' && allowEmailImages) { warn(f, line, `remote <img> ${url} (allowed by flag)`); continue; }
            err(f, line, `<${tag}> loads ${url} from outside the theme`);
        }
    }
    for (const m of code.matchAll(/style\s*=\s*"[^"]*url\(\s*['"]?(https?:)?\/\//gi)) {
        err(f, lineOf(code, m.index), 'inline style loads a remote url()');
    }
}

// ⚠️ FreeMarker does not know HTML comments: a `<#if …>` written as prose inside
// `<!-- … -->` is parsed as a real directive. Measured: one in the email
// template made every mail fail with "Failed to template email" while every
// login page still rendered. `${…}` in one is evaluated (and shipped). Use
// `<#-- … -->` for notes in templates; they are also stripped from the output.
// Outlook conditional comments (`<!--[if mso]>`) are left alone.
function checkFtlComments(f, raw) {
    for (const m of raw.matchAll(/<!--(?!\[)([\s\S]*?)-->/g)) {
        const inner = m[1];
        const at = lineOf(raw, m.index);
        if (/<\/?[#@]/.test(inner)) err(f, at, 'FreeMarker directive inside an HTML comment is EXECUTED — use <#-- … --> for notes');
        else if (/\$\{/.test(inner)) warn(f, at, '${…} inside an HTML comment is evaluated and sent to the browser/inbox — use <#-- … -->');
    }
}

function checkSvg(f, raw) {
    for (const m of raw.matchAll(/(?:xlink:)?href\s*=\s*"((?:https?:)?\/\/[^"]+)"/gi)) {
        err(f, lineOf(raw, m.index), `SVG references remote ${m[1]}`);
    }
    if (/@import|@font-face/.test(raw)) warn(f, 0, 'SVG pulls in fonts — an <img> is sandboxed and will not load them');
    if (/<text\b/.test(raw)) {
        warn(f, 0, 'SVG contains live <text>. Loaded through <img> it renders in the CLIENT\'s font, never the brand font — outline the lettering to paths, or render a CSS wordmark beside a lettering-free mark');
    }
}

function readProps(file) {
    if (!existsSync(file)) return {};
    return Object.fromEntries(stripPropComments(readFileSync(file, 'utf8')).split(/\r?\n/)
        .map(l => /^\s*([\w.-]+)\s*[=:]\s*(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].trim()]));
}

// Keycloak resolves a theme's resources up its parent chain: a child theme
// (parent=<OurBaseTheme>) serves the parent's css/js/img under its own URL.
// Follow `parent=` through sibling theme folders next to this one; a built-in
// parent (base, keycloak.v2, keycloak.v3) is not on disk and ends the chain.
function themeChain(type) {
    const chain = [themeRoot];
    let props = readProps(join(themeRoot, type, 'theme.properties'));
    while (props.parent) {
        const dir = resolve(themeRoot, '..', props.parent);
        if (!existsSync(join(dir, type)) || chain.includes(dir)) break;
        chain.push(dir);
        props = readProps(join(dir, type, 'theme.properties'));
    }
    return chain;
}
function resolveResource(type, rel) {
    return themeChain(type).some(dir => existsSync(join(dir, type, 'resources', rel)));
}

function checkProps(f, code) {
    const type = typeOf(f);
    const props = readProps(f);
    const chain = themeChain(type);
    const where = chain.length > 1 ? `${type}/resources/ (or its parent ${chain.slice(1).map(d => d.split(sep).pop()).join(' → ')})` : `${type}/resources/`;
    for (const key of ['logo', 'favIcon']) {
        const v = props[key];
        if (!v) continue;
        if (/^(https?:)?\/\//i.test(v)) { err(f, 0, `${key}=${v} is remote`); continue; }
        if (!resolveResource(type, v.replace(/^\//, ''))) err(f, 0, `${key}=${v} — no such file under ${where}`);
    }
    for (const key of ['styles', 'scripts']) {
        for (const v of (props[key] || '').split(/\s+/).filter(Boolean)) {
            if (/^(https?:)?\/\//i.test(v)) { err(f, 0, `${key} loads remote ${v}`); continue; }
            if (!resolveResource(type, v)) err(f, 0, `${key}=${v} — no such file under ${where}`);
        }
    }
    // A child theme REPLACES `styles=`, it does not append to the parent's.
    // Measured on 26.6.1: a child listing only its own env.css loses the whole
    // parent stylesheet.
    if (chain.length > 1 && props.styles) {
        const parentStyles = (readProps(join(chain[1], type, 'theme.properties')).styles || '').split(/\s+/).filter(Boolean);
        const own = props.styles.split(/\s+/);
        const lost = parentStyles.filter(s => !own.includes(s));
        if (lost.length) warn(f, 0, `styles= replaces the parent's list — the parent's ${lost.join(' ')} is not loaded here; list it before this theme's own sheets`);
    }
    // A mail logo served by Keycloak from this theme: must be in the theme, and
    // a format mail clients render in <img> (Gmail and Outlook drop SVG).
    if (type === 'email' && props['x-mail-logo']) {
        const v = props['x-mail-logo'];
        if (/^(https?:)?\/\//i.test(v)) err(f, 0, `x-mail-logo=${v} is remote — it must be a path inside email/resources/`);
        else if (!resolveResource(type, v)) err(f, 0, `x-mail-logo=${v} — no such file under ${where}`);
        else if (/\.svg$/i.test(v)) err(f, 0, `x-mail-logo=${v} is an SVG — Gmail and Outlook do not render SVG in mail; use a PNG`);
    }
    if (type === 'email' && props.assetBaseUrl) {
        const msg = `assetBaseUrl=${props.assetBaseUrl} — mail images are fetched from outside the theme`;
        // The opt-in is recorded IN the theme, so the decision travels with it
        // and the build needs no special flag: x-mail-images-hosted=true.
        const optedIn = allowEmailImages || props['x-mail-images-hosted'] === 'true';
        if (!optedIn) err(f, 0, msg + '; set x-mail-images-hosted=true in this file only after the user agreed to hosted mail images');
        else {
            warn(f, 0, msg + ' (opted in: x-mail-images-hosted)');
            // The images themselves must still live in the theme: email/resources/img
            // is the source of truth that gets published to assetBaseUrl.
            const imgDir = join(themeRoot, 'email', 'resources', 'img');
            if (!existsSync(imgDir)) err(f, 0, 'hosted mail images opted in, but email/resources/img/ is missing — keep the source PNGs in the theme and publish them to assetBaseUrl');
        }
    }
}

// ── Report ──────────────────────────────────────────────────────────────────
for (const [t, b] of Object.entries(fontBytes)) {
    if (b > 400 * 1024) warn(join(themeRoot, t), 0, `${(b / 1024).toFixed(0)} KB of fonts — every face is downloaded before the visitor has logged in; ship only the weights used`);
}
for (const t of ['login', 'account']) {
    if (existsSync(join(themeRoot, t)) && !fontBytes[t] && themeChain(t).length === 1) {
        warn(join(themeRoot, t), 0, 'no font files embedded — fine only if the stylesheet deliberately uses a system stack');
    }
}

for (const w of warns) console.log('WARN   ' + w);
for (const e of errors) console.log('ERROR  ' + e);
if (errors.length) {
    console.log(`\nself-contained check FAILED: ${errors.length} error(s), ${warns.length} warning(s)`);
    process.exit(1);
}
console.log(`self-contained check passed (${files.length} files, ${warns.length} warning(s))`);
