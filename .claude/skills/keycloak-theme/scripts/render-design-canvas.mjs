#!/usr/bin/env node
// Turn a Claude Design canvas's artboards into plain HTML pages you can open
// and screenshot, so a theme build has a VISUAL reference, not just markup.
//
//   node render-design-canvas.mjs <project-dir> <out-dir> [<assets-dir>]
//
//   <project-dir>  the canvas's `project/` folder as read with the Artifact
//                  tool (holds *.dc.html and usually ds/<name>/tokens.css)
//   <out-dir>      where the .html pages go (tokens.css is copied beside them)
//   <assets-dir>   folder with the canvas's uploaded assets saved as <id>.<ext>
//                  (Artifact read with path=<asset id>, one call per asset);
//                  `/_blob/<id>` references are pointed there. Default:
//                  <project-dir>/..
//
// Each artboard is a Design Component page: its markup lives inside <x-dc>,
// its page-level CSS and font links inside <helmet>. Both are lifted into a
// static page; the component script is dropped. Inline styles, the design
// system's tokens.css and the webfont <link> carry the look, which is all a
// reference render needs. Then screenshot them:
//
//   node screenshot.mjs --light --full --width 1440 --height 960 \
//        --shot file:///<out>/Main.html <out>/png/Main.png ...
//
// Interactive artboards (state held in the component script) render in their
// initial state only.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';

const [src, out, assetsArg] = process.argv.slice(2);
if (!src || !out) {
    console.error('usage: node render-design-canvas.mjs <project-dir> <out-dir> [<assets-dir>]');
    process.exit(2);
}
const assets = resolve(assetsArg || join(src, '..'));
mkdirSync(out, { recursive: true });

// The canvas's design-system tokens, if installed.
let tokensHref = '';
const dsDir = join(src, 'ds');
if (existsSync(dsDir)) {
    for (const ns of readdirSync(dsDir)) {
        const css = join(dsDir, ns, 'tokens.css');
        if (existsSync(css)) { copyFileSync(css, join(out, 'tokens.css')); tokensHref = 'tokens.css'; break; }
    }
}

const assetFiles = existsSync(assets) ? readdirSync(assets) : [];
const assetPath = id => {
    const f = assetFiles.find(n => n.startsWith(id + '.'));
    return f ? relative(resolve(out), join(assets, f)).split('\\').join('/') : `MISSING-ASSET-${id}`;
};

let n = 0, missing = new Set();
for (const f of readdirSync(src).filter(f => f.endsWith('.dc.html'))) {
    const s = readFileSync(join(src, f), 'utf8');
    const helmet = (/<helmet>([\s\S]*?)<\/helmet>/.exec(s) || [, ''])[1];
    const body = (/<x-dc>([\s\S]*?)<\/x-dc>/.exec(s) || [, ''])[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
    const title = (/<title>([^<]*)/.exec(s) || [, f])[1];
    const lang = (/<html[^>]*lang="([^"]+)"/.exec(s) || [, 'en'])[1];
    const fix = t => t.replace(/\/_blob\/([0-9a-f]{32})/g, (_, id) => {
        const p = assetPath(id); if (p.startsWith('MISSING')) missing.add(id); return p;
    });
    writeFileSync(join(out, f.replace(/\.dc\.html$/, '.html')),
        `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${title}</title>` +
        (tokensHref ? `<link rel="stylesheet" href="${tokensHref}">` : '') +
        `${fix(helmet)}</head><body>${fix(body)}</body></html>`);
    n++;
}
console.log(`rendered ${n} artboard(s) into ${out}`);
if (missing.size) console.log(`missing assets (read them with the Artifact tool, path=<id>): ${[...missing].join(' ')}`);
