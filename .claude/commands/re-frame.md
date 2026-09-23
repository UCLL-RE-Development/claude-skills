You are working inside the RE-Frame framework — an in-house full-stack SPA framework built on native Web Components with no build step. Use the conventions below for every frontend task.

---

## Project structure

```
client/
├── core/               # Framework kernel (do not modify)
├── components/         # Reusable UI components
├── coreComponents/     # App-level structural components (pageWrapper)
├── pages/              # Route-level page components
├── dependencies/       # Injectable services (extend serviceBase)
├── utils/              # Stateless helper functions
├── libs/               # Third-party libraries (keycloak.js, socket.io.js)
├── style/              # global.css, light.css, theme.css
├── app.js              # Entry point — mounts app-Ƒ
├── app.config.js       # Runtime config (server, app, auth)
└── routes.config.js    # Route definitions
```

---

## Component lifecycle

```
constructor()          → shadow DOM attached, template cloned, bindings wired
compInit()             → override for pre-created logic (rarely needed)
connectedCallback()    → calls created()
created()              → main setup: inject services, subscribe, init state
bindingChanged(k,o,n)  → called on every [bind] change (DOM or programmatic)
destroyed()            → override for manual cleanup (timers, sockets, blob URLs)
disconnectedCallback() → auto-cancels requests, auto-unsubscribes observers
```

Only `created()` and `bindingChanged()` need to be overridden in normal usage.

---

## Creating a page

Pages live in `client/pages/<name>/`:

```
client/pages/mypage/
├── mypage.js
├── mypage.html
├── mypage.css
└── strings.js          (only if i18n needed)
```

**mypage.js**

```js
import { componentBase } from "../../core/componentBase.js";
import { define } from "../../core/functionalBase.js";
import { getPageFromModule } from "../../core/templating.js";

define("mypage-χ", class extends componentBase {
    async created() {
        await this.loadStyles(import.meta.url);
        await this.initI18N(import.meta.url);       // omit if no strings.js

        await this.injectRouter(this);              // injects router + bindRoutes in one call
        await this.inject("my-service-χ");

        this.items = await this.µMyService.getAll();
    }

    async bindingChanged(name, oldValue, newValue) {
        if (name === "search") { /* validate or derive */ }
    }

    async destroyed() {
        // clean up timers, sockets, blob URLs here
    }
}, await getPageFromModule(import.meta.url));
```

Register in `client/routes.config.js` before the `*` wildcard:

```js
{ path: "/mypage", component: "mypage-χ", title: "My Page" },
// require login only (no role check):
{ path: "/mypage", component: "mypage-χ", title: "My Page", authenticated: true },
// require a specific realm role:
{ path: "/mypage", component: "mypage-χ", title: "My Page", realmRole: ["user"] },
// URL param:
{ path: "/mypage/:id", component: "mypage-χ", title: "My Page" },
// nested:
{ path: "/mypage", component: "mypage-χ", children: [
    { path: "/detail", component: "mypage-detail-χ" }
]}
```

URL params are passed as attributes: `/mypage/:id` → `this.id`.

---

## Creating a component

Components live in `client/components/<name>/`. Same three files, but use `getTemplateFromModule` instead of `getPageFromModule`. Use `<slot>` for inner content.

**mycomponent.js**

```js
import { define } from "../../core/functionalBase.js";
import { componentBase } from "../../core/componentBase.js";
import { getTemplateFromModule } from "../../core/templating.js";

define("mycomponent-χ", class extends componentBase {
    async created() {
        await this.loadStyles(import.meta.url);
    }
}, await getTemplateFromModule(import.meta.url));
```

Use in a page template after importing the file:

```html
<script type="module" src="../../components/mycomponent/mycomponent.js"></script>
<mycomponent-χ></mycomponent-χ>
```

Only call `injectRouter` / `bindRoutes` if the component template contains `<a route="...">` elements.

---

## Creating a service

Services live in `client/dependencies/<name>.service.js`.

```js
import { define } from "../core/functionalBase.js";
import { serviceBase } from "../core/serviceBase.js";
import { throwIfServiceError } from "../utils/serviceUtils.js";

define("my-service-χ", class extends serviceBase {
    base = "/api/resource";

    async getAll({ signal } = {}) {
        const res = await this.get(this.base, { signal });
        throwIfServiceError(res, "Failed to load");
        return res.data;
    }

    async getById(id, { signal } = {}) {
        const res = await this.get(`${this.base}/${id}`, { signal });
        throwIfServiceError(res, "Failed to load");
        return res.data;
    }

    async create(body, { signal } = {}) {
        const res = await this.post(this.base, body, { signal });
        throwIfServiceError(res, "Failed to create");
        return res.data;
    }

    async update(id, body, { signal } = {}) {
        const res = await this.put(`${this.base}/${id}`, body, { signal });
        throwIfServiceError(res, "Failed to update");
        return res.data;
    }

    async remove(id, { signal } = {}) {
        const res = await this.delete(`${this.base}/${id}`, null, { signal });
        throwIfServiceError(res, "Failed to delete");
        return res.data;
    }
});
```

- Always accept `{ signal } = {}` as the last param — DI auto-injects the component's AbortSignal
- Always call `throwIfServiceError(res, "msg")` immediately after every HTTP call
- Return `res.data` directly — never the raw `{ data, error, response }` envelope
- For binary responses use `this.getBlob(urlPath, mimeType, { signal })` — returns a `Blob` or `null`
- Query params go in `{ params: { key: value } }`, never string-concatenated into the URL

Inject in a component:

```js
await this.inject("my-service-χ");
// available as: µ + PascalCase of tag name minus -χ
const items = await this.µMyService.getAll();
```

Naming: `example-service-χ` → `this.µExampleService`, `router-χ` → `this.µRouter`.

---

## Binding syntax

```html
<!-- two-way: prefer over this.find() for all DOM reads/writes -->
<input bind="username" />
<div bind="username"></div>
<textarea bind="notes"></textarea>
<select bind="role"></select>
<input type="checkbox" bind="active" />   <!-- boolean -->
<input type="file" bind="uploads" />      <!-- array of { name, size, type, lastModified, file } -->
<if-χ bind="isVisible"></if-χ>            <!-- sets value attribute — conditional rendering -->

<!-- button, a, span, g are ignored by the binding system -->
```

Element handles (auto-created for every `bind="key"`):

- `this.$key` — first element bound to `key`
- `this.$$.key` — array of all elements bound to `key`

Reading and writing — always use `this.bindings`:

```js
this.bindings.username = "Alice";        // updates DOM + triggers bindingChanged
const val = this.bindings.username;      // read the current value
const el  = this.$username;             // reference to the first bound DOM element

// this.username = "Alice"  ← WRONG: sets property only, DOM does not update
```

React to changes:

```js
async bindingChanged(name, oldValue, newValue) {
    if (name === "email") {
        const valid = newValue.includes("@");
        this.$emailError.style.display = valid ? "none" : "block";
    }
}
```

After dynamically inserting elements into the shadow DOM:

```js
this.updateBindings();        // re-scans [bind] attributes
this.updateEventBindings();   // re-scans [event] attributes
```

---

## Event bindings

Prefer `event=""` over `addEventListener` for all component interactions.

```html
<button event="click | onSave | username">Save</button>
<button event="click | onDelete | ${item.id}">Delete</button>
<input  event="focus | onFocus; blur | onBlur | fieldName" />
```

Syntax: `event="type | handlerName | param1, param2"`  
Multiple events on one element: separate with `;`

Param resolution order:

1. `'hello'` / `"hello"` → string literal
2. `true` / `false` → boolean
3. `42` → number
4. bare word → current value of `this.word`
5. anything else → raw string

The native `Event` is always appended as the last argument to the handler:

```js
onSave(username, nativeEvent) { /* ... */ }
```

---

## Navigation

Use `<a route="/path">` in templates — never plain `<a href>` or `window.location`.

```html
<a route="/users">Go to users</a>
```

```js
// In created():
await this.injectRouter(this);  // injects router AND calls bindRoutes in one step

// Programmatic navigation:
await this.µRouter.navigate("/path");

// After dynamic DOM update that adds [route] links:
this.µRouter.bindRoutes(this);

// Block a navigation (e.g. unsaved changes) — return/resolve false to cancel.
// Returns an unregister fn. The LeaveGuard util wraps this + beforeunload.
const removeGuard = this.µRouter.addNavigationGuard(
    async (url) => this.isDirty ? await this.confirmLeave() : true
);
```

---

## Observer / pub-sub

Never use `addEventListener` for cross-component communication — use `subscribe`/`notify`.

```js
// Subscribe (auto-unsubscribed on disconnect):
await this.subscribe("user-selected", (user) => {
    this.selectedName = user.name;
});

// Manual unsubscribe:
const unsub = await this.subscribe("channel", handler);
unsub();

// Publish:
this.notify("user-selected", { id: 123, name: "Alice" });
```

Built-in channels:

| Channel | Payload | Purpose |
|---------|---------|---------|
| `"theme"` | `"light"` \| `"dark"` | Theme switching |
| `"i18n"` | `"en"` \| `"nl"` \| ... | Language switching |
| `"routeChange"` | route object | Fired on every navigation |
| `"toast"` | `{ type, message, ... }` | Toast notifications — use `this.toast(...)` |
| `"dependency-provider"` | internal | DI system — do not use directly |

---

## i18n

**strings.js** (sibling to component file):

```js
export const STRINGS = {
    nl: { title: "Mijn Pagina", save: "Opslaan" },
    en: { title: "My Page",    save: "Save" },
};
```

**Template attributes:**

```html
<h1 data-i18n="title"></h1>
<input data-i18n-placeholder="searchPlaceholder" />
<button data-i18n-title="tooltipKey">Save</button>
<button data-i18n-aria-label="closeDialog" class="icon-btn"><svg>…</svg></button>
```

**Initialize in created():**

```js
await this.initI18N(import.meta.url);  // loads sibling strings.js
```

Switch language from anywhere:

```js
this.notify("i18n", "nl");
```

---

## Theming

```js
this.notify("theme", "dark");   // switch to dark theme
this.notify("theme", "light");  // switch to light theme
```

Use CSS variables in component stylesheets — never hardcode colours:

```css
:host { color: var(--text-primary); background: var(--surface); }
button { background: var(--primary); }
```

`loadStyles()` automatically subscribes to theme changes and swaps the theme stylesheet.

---

## UI primitives

App-owned standalone components in `client/components/` (`btn-χ`, `card-χ`). The toast stack and dialog
presets are app-shell components mounted by the page-wrapper — you don't place them.

```html
<!-- Button — variants: default | outline | secondary | ghost | danger (filled) | danger-outline;
     `icon` modifier (28×28 square); `size="sm"`; aria-label/title proxied to the inner <button>. -->
<btn-χ variant="ghost"  event="click | onCancel">Cancel</btn-χ>
<btn-χ variant="danger" event="click | onDelete | ${id}">Delete</btn-χ>
<btn-χ icon aria-label="Close"><svg>…</svg></btn-χ>

<!-- Content card — default slot = body; slot="actions" = footer actions. -->
<card-χ><p>Body</p><div slot="actions"><btn-χ>OK</btn-χ></div></card-χ>
```

```javascript
// Toasts — `toast-ɮ` ships mounted in the shell. Fire from any component:
this.toast("success", "Saved");
this.toast("error", "Failed", { title: "Oops", duration: 5000 });   // type: info|success|warning|error
// Default auto-dismiss = config.app.toastDuration (ms; 0 = sticky); a per-call `duration` overrides it.

// Dialogs — summonable, awaitable, rendered by the alert-Ƒ/confirm-Ƒ/prompt-Ƒ/dialog-Ƒ presets in the shell.
await this.dialog.alert("Saved");                                   // → void
const ok   = await this.dialog.confirm("Delete this item?");        // → boolean
const name = await this.dialog.prompt({ message: "Rename to:", defaultValue: "untitled" }); // → string | null
const pick = await this.dialog.custom({ buttons: [{ label: "Save", value: "save" }] });     // → button value
// For bespoke modal content: class extends modalBase (core/modalBase.js).
```

---

## Scaffold overrides

The app shell (`header`, `footer`, `toast`, and the shared `dialog` chrome) lives in
`coreComponents/scaffold/<role>/`. **Never edit core** — override it **per file** by dropping
files into the mirror path `components/scaffold/<role>/` (same filenames). Each part is
auto-detected and falls back to core independently; nothing to register.

```bash
# Scaffold the stubs with the `rf` CLI (run from /client; `npm link` once, or `node cli/rf.js …`):
rf override toast css            # restyle the toast only
rf override header strings       # relabel the header only
rf override footer js --glyph ə  # fork footer logic as footer-ə  (js needs --glyph/--tag)
rf override toast --glyph ə      # all parts; js tagged toast-ə
rf override dialog css           # restyle every dialog preset (css/html/strings only)
```

Manual rules (when not using the CLI): an override **`.js`** must `export const tag` with your
own glyph + `define()` it; a **toast** override must `subscribe("toast", …)` and render
`{ type, message, title?, duration? }`; **dialog** overrides are chrome-only (css/html/strings),
and an override `dialog.html` must keep the `.card` / `.dlg-*` hooks. Resolution: `core/templating.js`
→ `resolveScaffoldResource()` (used by `getTemplateFromModule` / `loadStyles` / `initI18N`) +
`coreComponents/core/pageWrapper/pageWrapper.js` for the JS entry/tag.

---

## Design tokens

Theme files (`style/light.css` + `dark.css`) expose CSS custom properties — never hardcode values. Alongside colours / spacing / typography, v4.2 adds:

```css
--z-base / --z-elevated / --z-sticky / --z-popover / --z-overlay / --z-toast  /* stacking scale */
--color-overlay-scrim     /* modal backdrop tint (theme-specific) */
--shadow-popover          /* elevation for modals / popovers */
--font-size-text-md       /* 0.95rem */
--font-size-text-2xs      /* 12px */
```

---

## Auth helpers

```js
import { isAuthenticated, hasClientRole, isSuperuser, isAuthDisabled } from "../../utils/authUtils.js";

isAuthDisabled()          // true when AUTH_ENABLED=false
isAuthenticated()         // true when logged in, or when auth disabled
isSuperuser()             // true when user has "superuser" realm role, or auth disabled
hasClientRole("editor")   // true when user has client role, or is superuser, or auth disabled
hasAnyClientRole(["a","b"]) // true when user has any of the listed client roles
```

Read Keycloak token claims directly:

```js
import { keycloak } from "../../core/auth.js";
const { name, preferred_username, email } = keycloak.tokenParsed;
```

Conditional rendering with `if-χ`:

```js
this.isLoggedIn = isAuthenticated();
```

```html
<if-χ bind="isLoggedIn">
    <a route="/protected">Protected</a>
</if-χ>
```

---

## Logging

Every component gets a named child logger automatically:

```js
this.log.trace("fine detail");
this.log.debug("debug info");
this.log.info("user navigated to", path);
this.log.warn("token missing");
this.log.error("failed to load", err);
```

Configure in `app.config.js`:

```js
config.app.logMode   = "debug";              // minimum level to show
config.app.logFilter = ["Router", "Auth"];   // whitelist by module name; null = show all
```

Change level at runtime in the browser console:

```js
window.__logger.setLevel("trace");
```

---

## Async helpers

**Cancel-stale-request (`serviceBase`)** — use *inside a service method* so a later call with the same label cancels the earlier one still in flight (search-as-you-type, tab switches, refetch-on-route-change):

```js
define("search-service-χ", class extends serviceBase {
    async search(q, { signal } = {}) {
        // a later search() supersedes the in-flight one; the prior promise resolves to undefined
        return this.runLatest("search", (sig) =>
            this.get("/api/search", { params: { q }, signal: sig }));
    }
});

// from the component:
this.results = await this.µSearchService.search(q);   // call repeatedly; the service dedupes
this.µSearchService.cancelLatest("search");           // explicit abort (e.g. a Cancel button)
```

`runLatest` resolves to `undefined` when superseded (no AbortError to catch). Services are singletons, so a `label` dedupes app-wide — thread the injected `{ signal }` into the request if you also need per-caller-teardown cancellation.

**Toast (`componentBase`)** — fire from any component; rendered by the default `toast-ɮ` stack mounted in the page-wrapper shell (no setup needed):

```js
this.toast("success", "Saved");       // publishes to the "toast" channel
this.toast("error", "Failed", { title: "Oops", duration: 5000 });
```

---

## Utilities

**`utils/serviceUtils.js`**

```js
throwIfServiceError(res, "fallback")   // throws if res.error is set — use after every HTTP call
parseServiceError(res, "fallback")     // returns error message string without throwing
```

**`utils/authUtils.js`** — see Auth helpers section above.

**`utils/domUtils.js`**

```js
isFullscreen()                    // boolean
enterFullscreen()                 // request fullscreen (cross-browser)
exitFullscreen()                  // exit fullscreen (cross-browser)
htmlStringToElement(htmlString)   // HTML string → DOM Element
splitCamelCaseToSentence(str)     // "userEmail" → "User Email"
```

**`utils/mappers.js`**

```js
stripCouchMeta(obj)          // removes _id, _rev, _deleted, id, rev from object
cleanData(data)              // stripCouchMeta for array or single object
dynamicSettingsMapper(arr)   // maps setting-type array to keyed object
```

**`utils/textUtils.js`**

```js
countWords(text)             // word count (\S+), null-safe
stripHtml(html)              // regex tag strip, preserves whitespace
htmlToText(html)             // DOM-based, collapses inter-tag whitespace
escapeHtml(s)                // standard 5-char escape
```

**`utils/dateUtils.js`**

```js
formatDate(value, { year, placeholder })    // dd/mm/yyyy; "—" for invalid input
formatRelativeTime(ts, { strings, locale }) // "just now" / "Nm ago" / "Nh ago" / locale date
```

**`utils/leaveGuard.js`** — `LeaveGuard` class: unsaved-changes prompt wiring a router navigation guard + `beforeunload`. `install()` / `uninstall()` / `settle(true|false)`.

**`utils/crossSegmentHistory.js`** — `CrossSegmentHistory` class: one undo/redo across N independent editors (delegates to each segment's own `undo()` / `redo()`).

---

## Key rules

- **Never** call `fetch` directly in a component — always go through a service
- **Never** instantiate a service with `new` — always `inject()`
- **Never** use `document.querySelector` — use `this.find()` / `this.findAll()` only when `bind=""` is not suitable
- **Never** use `addEventListener` for cross-component communication — use `subscribe`/`notify`
- **Never** use plain `<a href>` for SPA navigation — use `<a route="">` + `bindRoutes`
- **Never** add a bundler, transpiler, or build step
- **Prefer** `bind=""` over `this.find()` for all DOM reads/writes
- **Prefer** `event=""` over `addEventListener` for component interactions
- Always `await this.loadStyles(import.meta.url)` at the top of `created()`
- Always call `throwIfServiceError` immediately after every service HTTP call
- Tag names end in a **developer glyph** (a Unicode letter, not the letter x) — each developer owns one: `χ` Reinoud (U+03C7), `ɮ` Kenny (U+026E), `ʤ` Siegmund (U+02A4); core/app-shell uses `-Ƒ` (U+0191, "F" for Frame). Use your own glyph for new components — see the registry in CLAUDE.md
- Pages use `getPageFromModule`, components use `getTemplateFromModule`
- `throwIfServiceError` is imported from `utils/serviceUtils.js` (not `libs/`)
