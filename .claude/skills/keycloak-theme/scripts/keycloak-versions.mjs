#!/usr/bin/env node
// Which Keycloak is current, and what changed in the pages a theme styles.
//
//   node keycloak-versions.mjs --check <production-version> [--verified <version>]
//        → latest release vs production (and vs the version the theme was
//          verified against, from its README); says what to do about the gap
//   node keycloak-versions.mjs --templates <version> <out-dir>
//        → pull that Keycloak image and extract its base login, email and
//          account templates into <out-dir>/<version>/ — what parent=base
//          renders on that version. Point the coverage audit at it:
//          node tools/audit-coverage.mjs <Theme> --base <out-dir>/<version>/theme/base/login
//   node keycloak-versions.mjs --diff <from> <to> <out-dir>
//        → extract both and list the templates that were added, removed or
//          changed between them: the pages a theme upgrade must re-check.
//
// Why: `parent=base` renders most of the sequence from the SERVER's templates,
// so a theme is only as verified as the Keycloak it was checked against
// (references/verify.md, "Version drift"). Run --check at the start of every
// build or update, and --diff before every Keycloak upgrade.
//
// Needs Node 18+ (fetch). --templates/--diff need Docker. No npm deps.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';

const args = process.argv.slice(2);
const sh = (cmd, a, opts = {}) => execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

const parse = v => (v || '').replace(/^v/, '').split(/[.-]/).slice(0, 3).map(n => parseInt(n, 10) || 0);
const cmp = (a, b) => { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

async function latestRelease() {
    // GitHub's "latest" release is the newest non-prerelease, non-draft one.
    const r = await fetch('https://api.github.com/repos/keycloak/keycloak/releases/latest',
        { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'keycloak-theme-skill' } });
    if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    const j = await r.json();
    return { version: j.tag_name.replace(/^v/, ''), date: (j.published_at || '').slice(0, 10), url: j.html_url };
}

function extract(version, outDir) {
    const dest = join(outDir, version);
    if (existsSync(join(dest, 'theme', 'base', 'login'))) return dest;
    mkdirSync(dest, { recursive: true });
    const image = `quay.io/keycloak/keycloak:${version}`;
    process.stderr.write(`pulling ${image} …\n`);
    sh('docker', ['pull', '-q', image], { stdio: ['ignore', 'pipe', 'inherit'] });
    const id = sh('docker', ['create', image]).trim();
    try {
        const jars = sh('docker', ['run', '--rm', '--entrypoint', 'sh', image, '-c', 'ls /opt/keycloak/lib/lib/main/ | grep -E "keycloak-themes-[0-9]"'])
            .trim().split('\n').filter(Boolean);
        if (!jars.length) throw new Error('no keycloak-themes jar in the image');
        const jar = join(dest, 'themes.jar');
        sh('docker', ['cp', `${id}:/opt/keycloak/lib/lib/main/${jars[0]}`, jar]);
        // base/login and base/email are what parent=base renders; keycloak.v2/v3
        // are listed for reference (their markup is React, not templates).
        sh('unzip', ['-q', '-o', jar, 'theme/base/login/*', 'theme/base/email/*', 'theme/base/account/*', '-d', dest]);
        rmSync(jar);
    } finally {
        try { sh('docker', ['rm', id]); } catch {}
    }
    return dest;
}

function walk(dir) {
    const out = [];
    for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) out.push(...walk(p)); else out.push(p);
    }
    return out;
}

const flag = name => { const i = args.indexOf(name); return i >= 0 ? args.slice(i + 1).filter(a => !a.startsWith('--')) : null; };

try {
    if (flag('--check')) {
        const [prod] = flag('--check');
        const verified = flag('--verified')?.[0];
        if (!prod) throw new Error('usage: --check <production-version> [--verified <version>]');
        const latest = await latestRelease();
        console.log(`production runs   ${prod}`);
        if (verified) console.log(`theme verified on ${verified}`);
        console.log(`latest release    ${latest.version}  (${latest.date})  ${latest.url}`);
        const behind = cmp(latest.version, prod);
        if (behind > 0) {
            const [lm, ln] = parse(latest.version), [pm, pn] = parse(prod);
            console.log(`\n⚠ production is behind the latest release (${lm !== pm ? 'MAJOR' : ln !== pn ? 'minor' : 'patch'} step).`);
            console.log('  Build and verify against PRODUCTION\'s version, and audit the latest too, so the');
            console.log('  upgrade does not surprise the theme:');
            console.log(`    node keycloak-versions.mjs --diff ${prod} ${latest.version} <dir>`);
        } else if (behind < 0) {
            console.log('\n(production is newer than GitHub\'s "latest" — a nightly or pre-release? Verify against production.)');
        } else {
            console.log('\nproduction is on the latest release.');
        }
        if (verified && cmp(verified, prod) !== 0) {
            console.log(`\n⚠ the theme was verified on ${verified}, production runs ${prod}: re-run the gates against ${prod}`);
            console.log(`    node keycloak-versions.mjs --diff ${verified} ${prod} <dir>`);
        }
    } else if (flag('--templates')) {
        const [version, out] = flag('--templates');
        if (!version || !out) throw new Error('usage: --templates <version> <out-dir>');
        const dest = extract(version, out);
        console.log(`base templates of ${version}: ${join(dest, 'theme', 'base', 'login')}`);
        console.log(`audit against it: node tools/audit-coverage.mjs <Theme> --base "${join(dest, 'theme', 'base', 'login')}"`);
    } else if (flag('--diff')) {
        const [from, to, out] = flag('--diff');
        if (!from || !to || !out) throw new Error('usage: --diff <from> <to> <out-dir>');
        const a = join(extract(from, out), 'theme', 'base'), b = join(extract(to, out), 'theme', 'base');
        const files = d => new Map(walk(d).map(p => [relative(d, p).split('\\').join('/'), p]));
        const fa = files(a), fb = files(b);
        const added = [...fb.keys()].filter(k => !fa.has(k));
        const removed = [...fa.keys()].filter(k => !fb.has(k));
        const changed = [...fb.keys()].filter(k => fa.has(k) && readFileSync(fa.get(k), 'utf8') !== readFileSync(fb.get(k), 'utf8'));
        const show = (label, list) => { console.log(`\n${label} (${list.length})`); for (const f of list.sort()) console.log(`  ${f}`); };
        console.log(`base templates ${from} → ${to}`);
        show('added', added); show('removed', removed); show('changed', changed);
        console.log(`\nNext: audit the theme against ${to} (coverage gate), re-check every page listed above`);
        console.log(`in the harness or live, and look at changed messages_*.properties keys the theme overrides.`);
        console.log(`  node tools/audit-coverage.mjs <Theme> --base "${join(b, 'login')}"`);
    } else {
        console.error('usage: --check <prod> [--verified <v>] | --templates <v> <dir> | --diff <from> <to> <dir>');
        process.exit(2);
    }
} catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
}
