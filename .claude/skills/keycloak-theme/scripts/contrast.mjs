#!/usr/bin/env node
// WCAG 2.x contrast for a Keycloak theme's token sheet.
//
//   node contrast.mjs <fg> <bg>                 one pair:  node contrast.mjs "#2F487E" "#FAFCFF"
//   node contrast.mjs --css <styles.css>        every role pair the theme relies on, from :root
//   node contrast.mjs --css <parent.css> --css <child/env.css>   a child theme: later files override
//
// --css reads the `--p-*` tokens from every :root block of every file, resolves
// var(--p-…) one level deep, and checks the pairs below. Values it cannot
// resolve to a hex colour (color-mix, gradients) are reported as SKIP, not
// guessed. Exits 1 if any required pair fails.
//
// Why a script: app palettes are routinely fine at 14px body copy and fail at a
// 10px label or behind a 13px button label. The deviations table in the theme
// README must be MEASURED numbers, never estimates.

import { readFileSync } from 'node:fs';

function hexToRgb(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map(c => c + c).join('');
    if (h.length === 8) h = h.slice(0, 6);
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function lum([r, g, b]) {
    const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
export function ratio(fg, bg) {
    const a = lum(hexToRgb(fg)), b = lum(hexToRgb(bg));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const args = process.argv.slice(2);

if (args[0] !== '--css') {
    if (args.length !== 2 || !hexToRgb(args[0]) || !hexToRgb(args[1])) {
        console.error('usage: node contrast.mjs <#fg> <#bg>  |  node contrast.mjs --css <file.css>');
        process.exit(2);
    }
    const r = ratio(args[0], args[1]);
    console.log(`${args[0]} on ${args[1]}  ${r.toFixed(2)}:1  ${r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large/UI only' : 'FAIL'}`);
    process.exit(0);
}

// Every `--css <file>` given, in order, and every `:root` block in each: later
// declarations win, exactly as the cascade does. So a child theme is measured
// as `--css parent/styles.css --css child/env.css`.
const files = [];
for (let i = 0; i < args.length; i++) if (args[i] === '--css') files.push(args[++i]);
const tok = {};
for (const file of files) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const block of css.matchAll(/:root\s*{([\s\S]*?)}/g)) {
        for (const m of block[1].matchAll(/--(p-[\w-]+)\s*:\s*([^;]+);/g)) tok[m[1]] = m[2].trim();
    }
}
if (files.length > 1) console.log(`tokens merged from ${files.join(' → ')}`);
const val = name => {
    let v = tok[name];
    for (let i = 0; i < 3 && v && v.startsWith('var('); i++) v = tok[/var\(--([\w-]+)/.exec(v)?.[1]];
    return v && hexToRgb(v) ? v : null;
};

// [foreground, background, minimum, what it is]
const PAIRS = [
    ['p-text',        'p-canvas',     4.5, 'body copy on the card'],
    ['p-text-2',      'p-canvas',     4.5, 'secondary copy'],
    ['p-text-3',      'p-canvas',     4.5, 'labels, helper text (small!)'],
    ['p-text-3',      'p-quiet',      4.5, 'label on a read-only field'],
    ['p-text',        'p-surface',    4.5, 'copy on the page ground'],
    ['p-accent-text', 'p-canvas',     4.5, 'links'],
    ['p-accent-hi',   'p-canvas',     4.5, 'link :hover'],
    ['p-ink',         'p-accent',     4.5, 'text on an accent fill'],
    ['p-ink',         'p-accent-text',4.5, 'primary button label (the starter fills buttons with --p-accent-text)'],
    ['p-ink',         'p-accent-hi',  4.5, 'primary button :hover label'],
    ['p-alert-text',  'p-canvas',     4.5, 'error text'],
    ['p-ink',         'p-alert-text', 4.5, 'destructive button label'],
    ['p-online-text', 'p-canvas',     4.5, 'success text'],
    ['p-warn-text',   'p-canvas',     4.5, 'warning text'],
    ['p-border-mid',  'p-canvas',     3.0, 'field border (WCAG 1.4.11 non-text)'],
    ['p-focus',       'p-canvas',     3.0, 'focus indicator'],
    ['p-masthead-ink','p-masthead',   4.5, 'masthead text (account.css / admin.css)'],
    ['p-sidebar-ink',  'p-sidebar',   4.5, 'admin nav links (admin.css only)'],
    ['p-sidebar-ink-2','p-sidebar',   4.5, 'admin nav section titles (admin.css only)'],
    ['p-sidebar-accent','p-sidebar',  3.0, 'admin current-item marker (admin.css only)'],
    ['p-env-marker',   'p-sidebar',   3.0, 'environment current-item marker (environment variants)'],
];

// Ink per fill: on a DARK theme one ink cannot sit on every fill — a light
// hover fill (#8FD3F5) or a pink text colour used as a fill needs DARK ink. A
// theme declares that with `--<fill>-ink` (e.g. --p-accent-hi-ink: #232325),
// and the pair is then measured with that ink instead of --p-ink.
let failed = 0;
for (let [fg, bg, min, what] of PAIRS) {
    if (fg === 'p-ink' && `${bg}-ink` in tok) { fg = `${bg}-ink`; what += ' (declared ink for this fill)'; }
    const a = val(fg), b = val(bg);
    if (!(fg in tok) || !(bg in tok)) continue;
    if (!a || !b) { console.log(`SKIP  --${fg} on --${bg}  (not a plain hex: ${tok[fg]} / ${tok[bg]})`); continue; }
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  need ${min}  --${fg} ${a} on --${bg} ${b}  — ${what}`);
}
// Decorative-only tokens: print, so the README can say "rules only".
for (const t of ['p-alert', 'p-online', 'p-warn', 'p-text-faint']) {
    if (val(t) && val('p-canvas')) {
        const r = ratio(val(t), val('p-canvas'));
        if (r < 4.5) console.log(`note  ${r.toFixed(2).padStart(5)}:1  --${t} is too light to carry text on the canvas — use it for rules, outlines, icons, or as a FILL with dark ink measured on it (contrast.mjs <ink> <fill>)`);
    }
}
process.exit(failed ? 1 : 0);
