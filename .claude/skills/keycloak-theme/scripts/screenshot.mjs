#!/usr/bin/env node
// Screenshot pages with the local Edge / Chrome, headless, over the DevTools
// protocol. No npm dependencies: Node 22+ (global WebSocket).
//
//   node screenshot.mjs --shot <url> <out.png> [--shot <url> <out.png> …]
//                       [--login user:pass] [--width 1440] [--height 900]
//                       [--dark] [--full] [--wait 2500]
//
//   --shot    a page and where to save it. Repeatable; shots share one browser
//             session, so after --login every later shot is signed in.
//   --click   after the preceding --shot loads, click this CSS selector before
//             capturing (repeatable; e.g. open a kebab menu, then a dialog)
//   --login   when a Keycloak sign-in form (#username / #password) appears,
//             fill it and submit. Handles the identity-first two-step form.
//   --dark    emulate prefers-color-scheme: dark (checks darkMode=false holds)
//   --light   emulate prefers-color-scheme: light. Without --dark/--light the
//             headless browser inherits the OS setting.
//   --full    capture the whole page, not just the viewport
//   --stay    after --login, shoot the page Keycloak lands on (OTP, a required
//             action, consent) instead of re-opening the --shot URL
//   --eval    after the preceding --shot loads, print a JS expression's value,
//             e.g. "getComputedStyle(document.querySelector('#kc-login')).backgroundColor"
//   --wait    ms to let an SPA settle after load (account/admin consoles)
//
// Finds the browser in the usual places on Windows, macOS and Linux, or
// uses $BROWSER.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const shots = [];
const opt = { width: 1440, height: 900, wait: 2500, dark: false, light: false, full: false, login: null };
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--shot') shots.push({ url: argv[++i], out: argv[++i] });
    else if (a === '--click') { if (shots.length) (shots.at(-1).clicks ??= []).push(argv[++i]); else i++; }
    else if (a === '--eval') { if (shots.length) (shots.at(-1).evals ??= []).push(argv[++i]); else i++; }
    else if (a === '--login') opt.login = argv[++i];
    else if (a === '--width') opt.width = +argv[++i];
    else if (a === '--height') opt.height = +argv[++i];
    else if (a === '--wait') opt.wait = +argv[++i];
    else if (a === '--dark') opt.dark = true;
    else if (a === '--light') opt.light = true;
    else if (a === '--full') opt.full = true;
    else if (a === '--stay') opt.stay = true;
    else { console.error(`unknown argument ${a}`); process.exit(2); }
}
if (!shots.length || shots.some(s => !s.url || !s.out)) {
    console.error('usage: node screenshot.mjs --shot <url> <out.png> [...] [--login user:pass] [--dark] [--full]');
    process.exit(2);
}

function findBrowser() {
    const c = [
        process.env.BROWSER,
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
        '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium',
    ].filter(Boolean);
    const hit = c.find(p => existsSync(p));
    if (!hit) { console.error('no Edge/Chrome/Chromium found — set $BROWSER'); process.exit(2); }
    return hit;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'kc-shot-'));
const browser = spawn(findBrowser(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', `--user-data-dir=${profile}`, '--remote-debugging-port=0',
    `--window-size=${opt.width},${opt.height}`, 'about:blank',
], { stdio: 'ignore' });

let ws, nextId = 0;
const pending = new Map();
const listeners = [];
function send(method, params = {}, sessionId) {
    const id = ++nextId;
    ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((res, rej) => pending.set(id, { res, rej, method }));
}
function once(method, sessionId, timeout = 20000) {
    return new Promise(res => {
        const l = { method, sessionId, res };
        listeners.push(l);
        setTimeout(() => { const i = listeners.indexOf(l); if (i >= 0) { listeners.splice(i, 1); res(null); } }, timeout);
    });
}

async function main() {
    // The browser writes its port and ws path here once it is listening.
    const portFile = join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100);
    const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');
    ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) {
            const p = pending.get(m.id); pending.delete(m.id);
            m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result);
        } else if (m.method) {
            for (const l of [...listeners]) {
                if (l.method === m.method && (!l.sessionId || l.sessionId === m.sessionId)) {
                    listeners.splice(listeners.indexOf(l), 1); l.res(m.params);
                }
            }
        }
    };

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, s);
    await send('Runtime.enable', {}, s);
    await send('Emulation.setDeviceMetricsOverride', { width: opt.width, height: opt.height, deviceScaleFactor: 1, mobile: false }, s);
    // Without either flag the page sees the OS preference (a dark-mode machine
    // makes every "default" run a dark-preference run).
    if (opt.dark || opt.light) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: opt.dark ? 'dark' : 'light' }] }, s);

    const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, s)).result?.value;

    async function go(url) {
        // A hash-only change inside an SPA (#/realm/users → #/realm/clients) is a
        // same-document navigation: it fires navigatedWithinDocument and never
        // loadEventFired, so waiting for the load event alone stalls 20s.
        const loaded = Promise.race([once('Page.loadEventFired', s), once('Page.navigatedWithinDocument', s)]);
        await send('Page.navigate', { url }, s);
        await loaded;
        await sleep(opt.wait);
    }

    // Keycloak's sign-in: fill whatever of #username / #password is on the page
    // and submit. Identity-first realms show them on two consecutive pages.
    // ⚠️ Only on the SIGN-IN form (#kc-form-login), and only until the session
    // is signed in. An earlier version filled any page with a #password field —
    // it silently changed a test user's password on update-password and cleared
    // their required action.
    let signedIn = false;
    async function signInIfAsked() {
        if (!opt.login || signedIn) return;
        const [user, pass] = opt.login.split(':');
        for (let step = 0; step < 3; step++) {
            const state = await evaluate(`(() => {
                const form = document.querySelector('#kc-form-login');
                const u = form && form.querySelector('#username'), p = form && form.querySelector('#password');
                if (!u && !p) return 'none';
                const set = (el, v) => { if (!el || el.readOnly) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
                set(u, ${JSON.stringify(user)}); set(p, ${JSON.stringify(pass)});
                const f = (p || u).form; (f.querySelector('[type=submit]') || f).click ? (f.querySelector('[type=submit]') ? f.querySelector('[type=submit]').click() : f.submit()) : f.submit();
                return 'submitted';
            })()`);
            if (state === 'none') { if (step > 0) signedIn = true; return; }
            await once('Page.loadEventFired', s, 15000);
            await sleep(opt.wait);
        }
    }

    for (const shot of shots) {
        await go(shot.url);
        const before = signedIn;
        await signInIfAsked();
        // After sign-in Keycloak lands on its own redirect target; an SPA hash
        // route (#/realm/users) is not always preserved, so go again — unless
        // --stay: then the page AFTER sign-in is the shot (OTP, a required
        // action, consent), and navigating again would restart that flow.
        const here = await evaluate('location.href');
        if (!opt.stay && !before && signedIn && here !== shot.url) await go(shot.url);
        // --click: open a menu / modal before capturing (CSS selector, in order).
        for (const sel of shot.clicks ?? []) {
            const hit = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
            if (!hit) console.error(`--click: nothing matches ${sel}`);
            await sleep(Math.min(opt.wait, 1500));
        }
        // --eval: print the value of a JS expression in the page, e.g. a
        // computed style — verify.md: measure, do not trust the screenshot.
        for (const expr of shot.evals ?? []) {
            const v = await evaluate(`(() => { try { return JSON.stringify(eval(${JSON.stringify(expr)})); } catch (e) { return 'ERROR ' + e.message; } })()`);
            console.log(`eval ${expr}\n  = ${v}`);
        }
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: opt.full }, s);
        mkdirSync(dirname(resolve(shot.out)), { recursive: true });
        writeFileSync(shot.out, Buffer.from(data, 'base64'));
        console.log(`saved ${shot.out}  (${await evaluate('document.title')})`);
    }
}

main()
    .catch(e => { console.error(e.message); process.exitCode = 1; })
    .finally(async () => {
        try { ws?.close(); } catch {}
        browser.kill();
        await sleep(300);
        try { rmSync(profile, { recursive: true, force: true }); } catch {}
    });
