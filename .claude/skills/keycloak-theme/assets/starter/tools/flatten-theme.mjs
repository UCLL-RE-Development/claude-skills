#!/usr/bin/env node
// Flatten a theme and its custom parents into ONE standalone theme folder.
//
//   node tools/flatten-theme.mjs <src/theme> <Name> <out-dir>
//        → <out-dir>/<Name>/<type>/…  with no dependency on any other custom theme
//
// In the source, environment variants are child themes (parent=<Base>): the
// shared layout lives once. A deployed jar must NOT depend on another jar —
// each one has to be movable and usable on its own — so the build flattens:
//
//   files       copied ancestor-first, the child's own files overwriting
//   *.properties concatenated ancestor-first (theme.properties AND every
//               messages_<locale>.properties): java.util.Properties keeps the
//               LAST value of a key, so the child still wins, exactly as
//               Keycloak's own inheritance would have resolved it
//   parent=     rewritten to the first parent that is NOT a theme in src/theme
//               (base, keycloak.v2, keycloak.v3 — built into every Keycloak)
//
// Run per type (login, account, email, admin) that the theme itself declares.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync, existsSync, utimesSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const [themesRoot, name, outDir] = process.argv.slice(2);
if (!themesRoot || !name || !outDir) {
    console.error('usage: node flatten-theme.mjs <src/theme> <Name> <out-dir>');
    process.exit(2);
}

const props = file => {
    const out = new Map();
    if (!existsSync(file)) return out;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([\w.-]+)\s*[=:]\s*(.*)$/.exec(line);
        if (m) out.set(m[1], m[2].trim());
    }
    return out;
};
const walk = dir => readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
});

const types = readdirSync(join(themesRoot, name)).filter(t => statSync(join(themesRoot, name, t)).isDirectory());
for (const type of types) {
    // The chain for this type: [child, parent, grandparent …], custom themes only.
    const chain = [join(themesRoot, name, type)];
    let builtinParent = props(join(chain[0], 'theme.properties')).get('parent');
    while (builtinParent && existsSync(join(themesRoot, builtinParent, type, 'theme.properties'))) {
        const dir = join(themesRoot, builtinParent, type);
        if (chain.includes(dir)) throw new Error(`parent cycle at ${builtinParent}`);
        chain.push(dir);
        builtinParent = props(join(dir, 'theme.properties')).get('parent');
    }

    const target = join(outDir, name, type);
    const merged = new Map();             // relative path → [source files, ancestor first]
    for (const dir of [...chain].reverse()) {
        for (const f of walk(dir)) {
            const rel = relative(dir, f).split('\\').join('/');
            const isProps = rel.endsWith('.properties');
            if (isProps) (merged.get(rel) ?? merged.set(rel, []).get(rel)).push(f);
            else merged.set(rel, [f]);    // a plain file: the nearest one wins
        }
    }
    for (const [rel, sources] of merged) {
        const dest = join(target, rel);
        mkdirSync(dirname(dest), { recursive: true });
        if (!rel.endsWith('.properties') || sources.length === 1 && chain.length === 1) {
            copyFileSync(sources.at(-1), dest);
        } else {
            // Ancestor first, child last: the child's keys win on load.
            let text = sources.map(s => `# ── from ${relative(themesRoot, s).split('\\').join('/')}\n${readFileSync(s, 'utf8').trimEnd()}\n`).join('\n');
            if (rel === 'theme.properties') {
                text = text.replace(/^\s*parent\s*[=:].*$/gm, '# (parent flattened into this theme)');
                text += `\n# Flattened by tools/flatten-theme.mjs: standalone, no custom parent.\nparent=${builtinParent || 'base'}\n`;
            }
            writeFileSync(dest, text);
        }
        // Keep the newest source mtime, so an unchanged tree packs identically.
        const newest = Math.max(...sources.map(s => statSync(s).mtimeMs)) / 1000;
        utimesSync(dest, newest, newest);
    }
    console.log(`  ${name}/${type}: ${chain.length > 1 ? `flattened ${chain.length} levels → parent=${builtinParent}` : 'standalone already'}`);
}
