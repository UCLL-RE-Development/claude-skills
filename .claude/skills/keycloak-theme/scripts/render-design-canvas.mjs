#!/usr/bin/env node
// Turn a Claude Design canvas's artboards into plain HTML pages you can open
// and screenshot, so a theme build has a VISUAL reference, not just markup.
//
//   node render-design-canvas.mjs <project-dir> <out-dir> [<assets-dir>]
//
//   <project-dir>  the canvas's `project/` folder as read with the Artifact
//                  tool (holds *.dc.html and usually ds/<name>/…)
//   <out-dir>      where the .html pages go (a ds tokens.css, if the canvas
//                  ships one, is copied beside them)
//   <assets-dir>   folder with the canvas's uploaded assets saved as <id>.<ext>
//                  (Artifact read with path=<asset id>, one call per asset);
//                  `/_blob/<id>` references are pointed there. Default:
//                  <project-dir>/..
//
// Each artboard is a Design Component page: its markup lives inside <x-dc>,
// its page-level CSS and font links inside <helmet>. Both are lifted into a
// static page; the component script is dropped. Then screenshot them:
//
//   node screenshot.mjs --light --full --width 1440 --height 960 \
//        --shot file:///<out>/Main.html <out>/png/Main.png ...
//
// ⚠️ Stylesheets in the page's own <head>, OUTSIDE <helmet>, are lifted too.
// A design system's component sheet sits there (Track and Grow:
// `<link rel="stylesheet" href="ds/tng/components/bundle.css">`); an earlier
// version kept only <helmet> and the renders lost every component rule (cards,
// fields, buttons). Relative hrefs are re-based so they still resolve from
// <out-dir>, and every artboard must have been read with its ds/ files.
//
// ⚠️ A canvas need not ship ds/<name>/tokens.css (Track and Grow had only
// tokens.json + components/bundle.css). It is linked only when it exists and
// the artboard does not already link it; otherwise the head's own sheets carry
// the look. The run says which.
//
// Webfont <link>s (Google Fonts) are kept: this is a reference render, not the
// theme. Offline, the page falls back to local fonts; swap the link for the
// embedded woff2 files if the shapes of the letters matter.
//
// Interactive artboards (state held in the component script) render in their
// initial state only.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const [src, out, assetsArg] = process.argv.slice(2);
if (!src || !out) {
    console.error('usage: node render-design-canvas.mjs <project-dir> <out-dir> [<assets-dir>]');
    process.exit(2);
}
const assets = resolve(assetsArg || join(src, '..'));
mkdirSync(out, { recursive: true });
const posix = p => p.split('\\').join('/');

// The canvas's design-system tokens.css, if one is installed. Not every canvas
// ships one.
let tokensHref = '', tokensSrc = '';
const dsDir = join(src, 'ds');
if (existsSync(dsDir)) {
    for (const ns of readdirSync(dsDir)) {
        const css = join(dsDir, ns, 'tokens.css');
        if (existsSync(css)) {
            copyFileSync(css, join(out, 'tokens.css'));
            tokensHref = 'tokens.css'; tokensSrc = posix(`ds/${ns}/tokens.css`);
            break;
        }
    }
}
console.log(tokensHref
    ? `design-system tokens: ${tokensSrc} (copied as tokens.css)`
    : 'no ds/*/tokens.css in this canvas: the artboards\' own stylesheets carry the look');

const assetFiles = existsSync(assets) ? readdirSync(assets) : [];
const assetPath = id => {
    const f = assetFiles.find(n => n.startsWith(id + '.'));
    return f ? posix(relative(resolve(out), join(assets, f))) : `MISSING-ASSET-${id}`;
};
// A relative URL in the artboard resolves against <project-dir>; re-base it
// onto <out-dir>. Absolute URLs, root paths (/_blob/…), data: and #frag stay.
const isRelative = u => !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(u);
const rebase = u => isRelative(u) ? encodeURI(posix(relative(resolve(out), resolve(src, decodeURI(u))))) : u;
const rebaseLinks = html => html.replace(/(<link\b[^>]*\bhref=")([^"]+)(")/gi, (_, a, u, b) => a + rebase(u) + b);

let n = 0, lifted = 0;
const missing = new Set(), unresolved = new Set();
for (const f of readdirSync(src).filter(f => f.endsWith('.dc.html'))) {
    const s = readFileSync(join(src, f), 'utf8');
    const helmet = (/<helmet>([\s\S]*?)<\/helmet>/.exec(s) || [, ''])[1];
    const body = (/<x-dc>([\s\S]*?)<\/x-dc>/.exec(s) || [, ''])[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
    const title = (/<title>([^<]*)/.exec(s) || [, f])[1];
    const lang = (/<html[^>]*lang="([^"]+)"/.exec(s) || [, 'en'])[1];
    // The page's own <head>: its stylesheet links and <style> blocks, in order.
    // Scripts (support.js, the component runtime) are dropped.
    const head = (/<head>([\s\S]*?)<\/head>/i.exec(s) || [, ''])[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
    const headCss = [...head.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>|<style\b[\s\S]*?<\/style>/gi)].map(m => m[0]);
    lifted += headCss.length;
    for (const tag of headCss) {
        const u = (/\bhref="([^"]+)"/.exec(tag) || [])[1];
        if (u && isRelative(u) && !existsSync(resolve(src, u))) unresolved.add(u);
    }
    const linksTokens = tokensSrc && [helmet, ...headCss].some(t => t.includes(tokensSrc));
    const fix = t => t.replace(/\/_blob\/([0-9a-f]{32})/g, (_, id) => {
        const p = assetPath(id); if (p.startsWith('MISSING')) missing.add(id); return p;
    });
    writeFileSync(join(out, f.replace(/\.dc\.html$/, '.html')),
        `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${title}</title>` +
        (tokensHref && !linksTokens ? `<link rel="stylesheet" href="${tokensHref}">` : '') +
        fix(rebaseLinks(headCss.join(''))) +
        `${fix(rebaseLinks(helmet))}</head><body>${fix(body)}</body></html>`);
    n++;
}
console.log(`rendered ${n} artboard(s) into ${out}` + (lifted ? `, ${lifted} stylesheet(s) lifted from <head> outside <helmet>` : ''));
if (unresolved.size) console.log(`stylesheets not found under ${src} (read them with the Artifact tool too): ${[...unresolved].join(' ')}`);
if (missing.size) console.log(`missing assets (read them with the Artifact tool, path=<id>): ${[...missing].join(' ')}`);
