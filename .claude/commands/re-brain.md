You are working inside the RE-Frame backend — an Express 5 server with Keycloak auth, CouchDB persistence, and a strict layered architecture. Use the conventions below for every task.

---

## Adding a new feature

A feature consists of four files, all sharing the same base name:

```
server/src/routes/<name>.routes.js
server/src/validators/<name>.validator.js
server/src/controllers/<name>.controller.js
server/src/services/<name>.service.js
```

Register the router in `server/src/routes/routes.js`:

```js
import { createNameRouter } from "./name.routes.js";
// inside createRoutes():
router.use("/name", await createNameRouter());
```

---

## Creating a route file

```js
import express from "express";
import { requireAuth, requireRealmRole } from "../utils/auth.js";
import { validate } from "../middleware/validate.js";
import { validateCreateName, validateUpdateName, validateNameId } from "../validators/name.validator.js";
import { createNameController } from "../controllers/name.controller.js";

const router = express.Router();
const ctrl = createNameController();

router.get("/",        requireAuth(),                             ctrl.getAll);
router.get("/:id",     requireAuth(), validate(validateNameId),  ctrl.getById);
router.post("/",       requireAuth(), validate(validateCreateName), ctrl.create);
router.put("/:id",     requireAuth(), validate(validateUpdateName), ctrl.update);
router.delete("/:id",  requireAuth(), validate(validateNameId),  ctrl.remove);

export default router;
```

Middleware order per route: `requireAuth()` → `requireRealmRole()` → `validate()` → `ctrl.method`.
`asyncHandler` is applied inside the controller factory — not in the route file.

---

## Creating a validator

Field helpers live in `src/validators/fields.js` — always import from there instead of repeating validation logic.

```js
import { requiredString, optionalString, requiredId } from "./fields.js";

export function validateCreateName(req) {
    return {
        body: {
            name: requiredString(req.body?.name, "name", { max: 100 }),
        },
    };
}

export function validateUpdateName(req) {
    const params = { id: requiredId(req.params?.id) };
    const body = {};
    if (req.body?.name !== undefined) body.name = requiredString(req.body.name, "name", { max: 100 });
    return { params, body };
}

export function validateNameId(req) {
    return { params: { id: requiredId(req.params?.id) } };
}
```

Available field helpers: `requiredString`, `optionalString`, `requiredId`, `requiredEmail`, `requiredPassword`, `requiredInt`, `requireBody`, `requireParamId`, `requiredArray`.

`requireBody(req)` asserts a JSON object body is present; `requireParamId(req)` asserts `req.params.id` is a non-empty string; `requiredArray(value, name)` asserts a non-empty array and returns it.

All helpers throw `AppError` with status 400 / code `"VALIDATION_ERROR"` on failure. `validate()` middleware stores the return value in `req.validated`.

---

## Creating a controller

```js
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { nameService } from "../services/name.service.js";

export function createNameController() {
    return {
        getAll: asyncHandler(async (req, res) => {
            const items = await nameService.getAll();
            res.json({ items });
        }),

        getById: asyncHandler(async (req, res) => {
            const { id } = req.validated.params;
            const item = await nameService.getById(id);
            if (!item) throw new AppError("Not found", { status: 404, code: "NOT_FOUND" });
            res.json({ item });
        }),

        create: asyncHandler(async (req, res) => {
            const item = await nameService.create(req.validated.body);
            res.status(201).json({ item });
        }),

        update: asyncHandler(async (req, res) => {
            const { id } = req.validated.params;
            const item = await nameService.update(id, req.validated.body);
            if (!item) throw new AppError("Not found", { status: 404, code: "NOT_FOUND" });
            res.json({ item });
        }),

        remove: asyncHandler(async (req, res) => {
            const { id } = req.validated.params;
            const deleted = await nameService.remove(id);
            if (!deleted) throw new AppError("Not found", { status: 404, code: "NOT_FOUND" });
            res.status(204).send();
        }),
    };
}
```

- Always read validated data from `req.validated` — never from `req.body` or `req.params` directly
- Wrap each handler with `asyncHandler()` inside the factory function — not in the route file
- Respond with a plain object `{ item }` or `{ items }` for success; errors propagate via `throw`

---

## Creating a service

Services contain business logic and call connectors. They know nothing about Express.

```js
import { AppError } from "../utils/app-error.js";
import { getCouchClient } from "../connectors/couchdb.connector.js";

const DB = "names";

const db = getCouchClient();

await db.ensureDatabase(DB);

export const nameService = {
    async getAll() {
        const docs = await db.find(DB, { _deleted: { $exists: false } });
        return docs.map(toItem);
    },

    async getById(id) {
        const doc = await db.getDoc(DB, id);
        return doc ? toItem(doc) : null;
    },

    async create(data) {
        const doc = await db.insertDoc(DB, { ...data, createdAt: new Date().toISOString() });
        return toItem(doc);
    },

    async update(id, patch) {
        const doc = await db.updateDoc(DB, id, patch);
        return doc ? toItem(doc) : null;
    },

    async remove(id) {
        return db.deleteDoc(DB, id);
    },
};

function toItem({ _id, _rev, _deleted, ...rest }) {
    return { id: _id, ...rest };
}
```

If CouchDB is not configured, provide an in-memory fallback using a `Map` (see `items.service.js` for the pattern).

---

## AppError

```js
import { AppError } from "../utils/app-error.js";

throw new AppError("Human-readable message", { status: 404, code: "NOT_FOUND" });
throw new AppError("Validation failed",       { status: 400, code: "VALIDATION_ERROR", details: { field: "name" } });
throw new AppError("Forbidden",               { status: 403, code: "FORBIDDEN" });
throw new AppError("Something went wrong",    { status: 500, code: "INTERNAL_ERROR" });
```

The global error handler in `middleware/error-handler.js` formats all `AppError` throws into:

```json
{ "ok": false, "error": { "code": "...", "message": "...", "details": null } }
```

Never call `res.status(500).json(...)` in controllers — always `throw`.

---

## Auth helpers

```js
import { requireAuth, requireRealmRole, requireClientRole, getUserFromReq } from "../utils/auth.js";

// In route definitions (asyncHandler is applied inside the controller factory, not here):
router.get("/",       requireAuth(),                             ctrl.getAll);
router.delete("/:id", requireAuth(), requireRealmRole("admin"),  ctrl.remove);

// In a controller, to read the caller's identity:
async function getProfile(req, res) {
    const user = getUserFromReq(req);
    // user: { authEnabled, isAuthenticated, userId, name, email, orgIds, realmRoles, isSuperuser, clientRoles }
    res.json({ ok: true, result: { user } });
}
```

All guards are no-ops when `AUTH_ENABLED=false` — always add them, never skip based on environment.

`getUserFromReq` returns a precomputed `isSuperuser` (true when the token carries the `superuser` realm role), so handlers can branch on it without repeating `realmRoles.includes("superuser")`.

---

## CouchDB connector

```js
import { getCouchClient } from "../connectors/couchdb.connector.js";

const db = getCouchClient();

await db.ensureDatabase("mydb");

const doc   = await db.getDoc("mydb", docId);          // null if not found
const docs  = await db.find("mydb", selector, fields, limit, skip);  // skip = pagination offset
const view  = await db.getView("mydb", "design", "view", { key: "..." });
const count = await db.getViewCount("mydb", "design", "view", { key });  // reduced _count value

await db.insertDoc("mydb", { field: "value" });
await db.updateDoc("mydb", docId, { field: "new" });   // shallow merge by default
await db.upsertDoc("mydb", "_design/foo", design);     // create-or-update at a fixed id
await db.deleteDoc("mydb", docId);

// Attachments
await db.upsertAttachment("mydb", docId, "file.pdf", "application/pdf", buffer);
const file = await db.getAttachmentWithMeta("mydb", docId, "file.pdf");  // { buffer, contentType }
await db.deleteAttachment("mydb", docId, "file.pdf", { rev });           // optional rev fast-path
// db.getAttachment(...) still returns a raw Buffer but is @deprecated — prefer getAttachmentWithMeta()
```

- 404 from `getDoc` returns `null` — convert to `AppError` in the controller, not the service
- 409 conflicts are retried automatically with fetch-then-merge
- All network errors use exponential backoff + jitter via the built-in `Retry` utility

---

## CouchDB document helpers (`db-helpers.js`)

Helpers for the "fetch a doc, check ownership, surface sensibly" pattern that authenticated CRUD services repeat. Import from `../utils/db-helpers.js`.

```js
import { getDocOrNull, canAccess, assertOwnership, stripCouchMeta } from "../utils/db-helpers.js";

const doc = await getDocOrNull(db, "mydb", id);          // null on 404, rethrow otherwise
assertOwnership(doc, { userId, isSuperuser }, "Order");  // throws 404 if missing, 403 if not owned
if (canAccess(doc, { userId, isSuperuser })) { /* ... */ }
return stripCouchMeta(doc);                              // { id, ... } — drops _id/_rev/_deleted
```

Pair `assertOwnership` with `getUserFromReq`'s `isSuperuser` for instance-level authorization.

---

## Logger

Create one logger per module — never share or pass loggers between files.

```js
import { Logger } from "../utils/logger.js";

const logger = new Logger("MyService");

logger.trace("fine detail");
logger.debug("dev info");
logger.info("normal operation");
logger.warn("recoverable issue");
logger.error("failure", err);
```

Log level is controlled by `LOG_LEVEL` env var (default: `info`). Levels: `error` < `warn` < `info` < `debug` < `trace`.

---

## Environment variables

Always read env vars through `src/config/env.js` — never use `process.env` directly.

```js
import { env } from "../config/env.js";

env.app.port
env.app.environment      // "dev" | "prod"
env.auth.enabled         // boolean
env.couchdb.url
env.couchdb.user
env.couchdb.pass
env.ai.backendUrl        // optional AI proxy backend URL ("" when unset)
env.swagger.title
```

To add a new variable:

1. Add it to the `.env` file
2. Parse it in `env.js` using `get()`, `toBool()`, or `toNumber()`
3. Export it on the `env` object

---

## Swagger docs

Add JSDoc `@swagger` comments directly above each route handler, inside the route file:

```js
/**
 * @swagger
 * /api/names:
 *   get:
 *     summary: Get all names
 *     tags: [Names]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of names
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:   { type: boolean, example: true }
 *                 result:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/Name' } }
 */
router.get("/", requireAuth(), asyncHandler(ctrl.getAll));
```

Define schemas in any route file under `components/schemas`. Swagger UI is only available in dev (`/docs`).

---

## JSDoc

Every exported function, service method, controller handler, and connector method must have a JSDoc block. This is mandatory — not optional.

**Validators** — document params and the validated shape returned:

```js
/**
 * @param {import('express').Request} req
 * @returns {{ body: { name: string, summary?: string } }}
 */
export function validateCreateName(req) { ... }
```

**Controller handlers** — document params only (return is always `Promise<void>`):

```js
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getAll(req, res) { ... }
```

**Service methods** — document params and return type precisely:

```js
/**
 * @param {string} id
 * @returns {Promise<Item | null>}
 */
async getById(id) { ... }

/**
 * @param {{ name: string, summary?: string }} data
 * @returns {Promise<Item>}
 */
async create(data) { ... }
```

**Connector / utility functions** — document params, return type, and any thrown errors:

```js
/**
 * @param {string} db
 * @param {string} id
 * @returns {Promise<object | null>} The document, or null if not found
 * @throws {AppError} On network or server error
 */
async getDoc(db, id) { ... }
```

**Factory functions** — document the shape of the returned object:

```js
/**
 * @returns {{ getAll: Function, getById: Function, create: Function, update: Function, remove: Function }}
 */
export function createNameController() { ... }
```

Rules:

- Use `@param`, `@returns`, and `@throws` — omit tags that don't apply
- Inline types are fine for simple shapes; use `@typedef` for complex types reused across files
- `@swagger` blocks in route files are separate from JSDoc — both are required

---

## Backend CLI

Use `rb g` to scaffold feature files instead of creating them by hand. Run from `/server`:

```bash
rb g feature orders                    # all four files + routes.js injection (in-memory, no auth)
rb g f orders                          # shorthand
rb g f orders --auth                   # add requireAuth() to all routes
rb g f orders --auth --couch           # CouchDB-backed service + auth
rb g f orders --auth --postgres        # PostgreSQL-backed service + auth

rb g route products                    # single file
rb g r products
rb g controller users
rb g c users
rb g service invoices
rb g s invoices
rb g validator items
rb g v items
```

Options:

- `--auth` — add `requireAuth()` to all route handlers (opt-in, off by default)
- `--couch` — generate service backed by CouchDB with in-memory fallback
- `--postgres` — generate service backed by PostgreSQL
- `--force` — overwrite existing files
- `--couch` and `--postgres` are mutually exclusive

The `feature` command creates all four files and injects the router import + `router.use()` into `src/routes/routes.js` automatically.

---

## PostgreSQL connector

Use `getPostgresClient()` when features need a relational store.

```js
import { getPostgresClient } from "../connectors/postgres.connector.js";

const db = getPostgresClient();

await db.ensureTable("orders", "id SERIAL PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()");

const rows   = await db.find("orders", { name: "Alice" }, { limit: 50, orderBy: "created_at DESC" });
const row    = await db.getById("orders", 42);
const newRow = await db.insert("orders", { name: "Bob" });
const upd    = await db.update("orders", 42, { name: "Bob Updated" });
const del    = await db.delete("orders", 42);

// Raw queries
const res = await db.query("SELECT * FROM orders WHERE id = $1", [id]);

// Transactions (auto-retried on serialization failures)
await db.transaction(async (client) => {
    await client.query("INSERT INTO orders (name) VALUES ($1)", ["Alice"]);
    await client.query("UPDATE stock SET qty = qty - 1 WHERE id = $2", [itemId]);
});

await db.end();  // graceful shutdown
```

Env vars required: `POSTGRES_URL`, `POSTGRES_SSL` (default `false`).
Both are always parsed by `env.js` — pass an empty string for `POSTGRES_URL` if Postgres is not used.

---

## Socket.IO

Socket.IO shares the HTTP server (no separate port). It's bootstrapped from `server.js` and exposes per-user push via `socket.connector.js`.

```js
import { initSocket, getSocket, emitToUser } from "../connectors/socket.connector.js";

// server.js — after creating the HTTP server:
const { app, sessionMiddleware } = await createApp();   // see breaking-change note below
const server = http.createServer(app);
initSocket(server, { sessionMiddleware });

// from any feature, push to one user's sockets (fail-soft — no-op until initialised):
emitToUser(userId, "notification", { title: "Done" });
```

- Per-user rooms are keyed by the Keycloak `sub` (`user:<sub>`), or `"anonymous"` when auth is off.
- The express-session middleware is bolted onto the handshake so each socket resolves its own user.
- **Breaking change (v4.2.0):** `createApp()` now returns `{ app, sessionMiddleware }` instead of the bare `app`. Update every caller's destructuring.

---

## Key rules

- **Never** read `req.body` or `req.params` directly in a controller — always use `req.validated`
- **Never** use `process.env` outside of `src/config/env.js`
- **Never** skip `asyncHandler()` — wrap each handler inside the controller factory; unhandled rejections crash the process
- **Never** swallow errors in controllers — always `throw` so the global handler formats the response
- **Never** put business logic in route files or controllers — controllers orchestrate, services decide
- **Prefer** `AppError` for all known failure states — random `Error` throws get a generic 500
- Always name files `<feature>.routes.js`, `<feature>.validator.js`, `<feature>.controller.js`, `<feature>.service.js`
- Always register new routers in `src/routes/routes.js`
- Controllers are factory functions — `createNameController()` returns an object of handlers
- Services are plain exported objects — never classes, never `new`
