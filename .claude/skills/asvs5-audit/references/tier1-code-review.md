# Tier 1 — Code Review & Local Testing (177 requirements)

The answer is in the repo, in a lockfile, or in the output of a CLI tool. No running deployment
required.

Read `stack-profiles.md` first to detect the stack. Patterns below are given per
ecosystem; run the ones that match. **If the stack is not among them, follow `stack-profiles.md`
§2c** — read each check's **Control** line, which states the requirement independently of any
language, and derive the search from the codebase's own idiom. `rg` is ripgrep — use the Grep tool where
available, and always exclude vendored/third-party trees (`node_modules`, `vendor`, `site-packages`,
`target`, `bin`, `obj`, `dist`, `.venv`) unless the requirement is specifically about dependencies.

**Working rule:** a T1 result needs a `file:line` or a command plus its output in `evidence`.
"Looks fine" is not evidence. When a requirement says "all X", enumerate X first — all routes, all
cookies, all queries, all outbound calls — and check every member. If you checked some, the honest
status is `PARTIAL`, not `PASS`.

**What is not evidence:** a `CLAUDE.md`, README, architecture document, code comment, commit
message or changelog stating that a control exists. Those are claims. Evidence is the code or
configuration that implements the control. A confident comment above an absent check is a finding,
not a mitigation.

---

## V1 — Encoding and Sanitization (30 T1)

### V1.1.1 — decode once, before validation · V1.1.2 — encode last, at the sink
**Control:** untrusted input is canonicalized exactly once and *before* validation; output encoding
happens as the final step before the interpreter, not early and not twice.

**Find it:**
- Node: `decodeURIComponent|decodeURI|unescape|Buffer\.from\(.*base64|atob\(`
- Python: `unquote|urllib\.parse\.unquote|base64\.b64decode|\.decode\(`
- JVM: `URLDecoder\.decode|Base64\.getDecoder`
- .NET: `HttpUtility\.UrlDecode|Uri\.UnescapeDataString|Convert\.FromBase64String`
- Go: `url\.QueryUnescape|url\.PathUnescape|base64\.`
- PHP: `urldecode|rawurldecode|base64_decode`
- Ruby: `CGI\.unescape|URI\.decode_www_form|Base64\.decode64`

**Verdict:** decoding *after* validation or sanitization is `FAIL` — it reopens what validation
closed. Two decode layers on one value is `FAIL`. For V1.1.2, encoding applied at assignment time
and again at render is `FAIL` (double-encoding corrupts data and hides bugs); encoding done by the
template engine at the sink is `PASS`.

### V1.2.1–V1.2.3 — context-correct output encoding (HTML / URL / JS-JSON)
**Control:** every dynamic value is encoded for the exact context it lands in.

**Find the dangerous sinks:**
- Browser JS: `innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.srcdoc|dangerouslySetInnerHTML|v-html|\[innerHTML\]`
- Template engines with escaping disabled: `\|safe|\{\{\{|<%==|raw\(|Html\.Raw|html_safe|\|raw|autoescape\s*(off|False)|MarkupSafe|Markup\(`
- URL building: `setAttribute\(\s*['"](href|src|action|formaction|xlink:href)|href\s*=\s*\{|url_for\(.*\+`
- JSON into a script context: `JSON\.stringify` inside a `<script>` block, `@Html.Raw(Json`,
  `json.dumps` inside a template

**Verdict:** a dynamic value reaching an HTML sink without encoding is `FAIL`. An auto-escaping
template engine used with escaping intact is `PASS` — but every `raw`/`safe` escape hatch must be
individually justified; one unjustified hatch is `PARTIAL`, one on user data is `FAIL`.
For V1.2.2, confirm only safe protocols can be produced: search for `javascript:` and `data:text/html`
and confirm any user-supplied URL is protocol-checked against an allowlist.
For V1.2.3, JSON embedded in HTML must additionally escape `<`, `>` and `&` — `JSON.stringify`
alone is `FAIL` inside a `<script>` block.

### V1.2.4 — database injection
**Control:** all queries parameterized, or built by an ORM/query builder that parameterizes.

**Find it:** search for query construction with interpolation.
- Node: `query\(|execute\(|\$queryRaw|createQueryBuilder` then `` rg '`.*\$\{' `` over those files
- Python: `cursor\.execute|\.raw\(|text\(|extra\(` then look for `%|\.format\(|f"` in the SQL
- JVM: `createQuery|createNativeQuery|Statement|prepareStatement` — `Statement` with `+` is the bug
- .NET: `FromSqlRaw|ExecuteSqlRaw|SqlCommand` with string concat
- Go: `db\.Query|db\.Exec` with `fmt\.Sprintf`
- PHP: `->query\(|mysqli_query|PDO::query` with `\.` or `"$`
- Ruby: `where\(".*#\{|find_by_sql|execute\(`
- NoSQL: Mongo `\$where|mapReduce|\$expr`, Couch `_design` view functions, Cypher/Redis/LDAP filters
  built by concatenation

**Verdict:** any SQL/NoSQL string assembled from input is `FAIL` even if input "looks validated" —
parameterization is the requirement. Identifiers (table/column names) cannot be parameterized;
those need an allowlist, and an unvalidated dynamic identifier is `FAIL`. Stored procedures are
explicitly in scope: check their bodies too.

### V1.2.5 — OS command injection
**Find it:** `child_process|exec\(|execSync|spawn|subprocess\.|os\.system|popen|Runtime\.getRuntime\(\)\.exec|ProcessBuilder|Process\.Start|exec\.Command|shell_exec|passthru|system\(|proc_open|\`|Open3|Kernel\.system`

**Verdict:** `PASS` requires an argument-array API (`execFile`, `spawn` without shell,
`subprocess.run([...], shell=False)`, `ProcessBuilder`, `exec.Command`) with no shell interpretation.
A shell string with any interpolation is `FAIL`. `shell=True` / `exec()` with input is `FAIL`.

### V1.2.6 — LDAP · V1.2.7 — XPath · V1.2.8 — LaTeX
**Find it:** an LDAP client, XPath evaluator (`XPath\.compile|selectNodes|xpath\(|lxml.*xpath`), or
LaTeX/PDF-from-TeX processor in the dependency manifest.
**Verdict:** absent from the dependency tree → `N_A` with that note, re-checked each run. Present →
`PASS` requires escaping/parameterization (LDAP special chars, XPath variable binding, LaTeX
`--shell-escape` disabled plus a command allowlist).

### V1.2.9 — regex metacharacter escaping · V1.3.12 — ReDoS
**Find it:** dynamic regex construction — `new RegExp\(|re\.compile\(.*[%+]|Pattern\.compile\(.*\+|regexp\.MustCompile\(.*\+|preg_match\(.*\$`
**Verdict (V1.2.9):** interpolating unescaped input into a pattern is `FAIL` — it is at minimum a
DoS and often a filter bypass. Use the ecosystem's quote/escape helper.
**Verdict (V1.3.12):** analyze *every* regex, literals included, for nested quantifiers over
overlapping classes (`(a+)+`, `(\w+\s?)*`, `(.*)*`). Tools: `safe-regex2`,
`eslint-plugin-security/detect-unsafe-regex`, `semgrep`, `regexploit`, `redos-detector`. A
catastrophic pattern applied to user input is `FAIL`.

### V1.2.10 — CSV / formula injection
**Find it:** `text/csv|\.csv|csv\.writer|CSVWriter|xlsx|openpyxl|PhpSpreadsheet|to_csv`
**Verdict:** no export feature → `N_A`. Present → `PASS` needs RFC 4180 quoting **and** a leading
`= + - @ \t \0` prefixed with a single quote. Quoting alone is `FAIL` — Excel still evaluates.

### V1.3.1 — HTML sanitization
**Control:** rich-text / WYSIWYG / Markdown-to-HTML output is sanitized by a maintained library
before rendering.
**Find it:** `DOMPurify|sanitize-html|bleach|nh3|OWASP.*HtmlSanitizer|Ganss\.Xss|bluemonday|HTMLPurifier|Loofah|Rails::Html`
alongside the editor/Markdown library (`prosemirror|tiptap|quill|ckeditor|tinymce|marked|markdown-it|commonmark`).
**Verdict:** stored rich text rendered without a sanitizer is `FAIL`. A *client-side* sanitizer only
is `PARTIAL` — the stored value is still hostile to any other consumer. Note the common trap: an
editor's schema restricts **authoring**, not the **rendering** of previously stored HTML.

### V1.3.2 — no dynamic code execution
**Find it:** `\beval\(|new Function\(|setTimeout\(\s*['"]|vm\.runIn|exec\(|compile\(|pickle\.loads|ScriptEngine|SpEL|#\{|Assembly\.Load|reflect|create_function|instance_eval|class_eval`
**Verdict:** any hit reachable from input is `FAIL`. Hits on literals only → `PASS` with the
locations listed as evidence.

### V1.3.3 — sanitize before a dangerous context
**Control:** values entering a risky sink are constrained to a safe character set and bounded length.
**Verdict:** read the shared validation helpers. A helper that only checks "non-empty" or
`typeof === 'string'` does not satisfy this — `PARTIAL` at best. `PASS` needs a per-context policy.

### V1.3.4 — SVG · V1.3.5 — Markdown / CSS / XSL / BBCode
**Find it:** `image/svg|\.svg|<use |xlink|xsl|XSLT|less\.render|sass\.compile|bbcode`
**Verdict:** user-supplied SVG rendered inline must have `<script>`, `<foreignObject>`, event
handlers and external references stripped — `FAIL` otherwise. App-controlled static assets are out
of scope; say so. User-supplied XSL is remote code execution in most engines: `FAIL` unless disabled.

### V1.3.6 — SSRF
**Control:** any outbound request whose destination is influenced by input validates protocol,
host, path and port against an allowlist, and re-validates after redirects (cross-ref V15.3.2).
**Find it:** `fetch\(|axios|http\.request|https\.request|requests\.|httpx|urllib|HttpClient|RestTemplate|WebClient|http\.Get|http\.Post|curl_|Net::HTTP|open-uri|createProxyMiddleware|proxy_pass`
**Verdict:** a destination derived from input without an allowlist is `FAIL`. A *denylist* of
internal ranges is `PARTIAL` — DNS rebinding and redirect chains defeat it. Also check cloud
metadata endpoints (`169.254.169.254`, `metadata.google.internal`) are unreachable. Confirm with T2.

### V1.3.7 — template injection
**Find it:** a template compiled from a non-literal — `Template\(|compile\(|render_template_string|Handlebars\.compile|new Function|Twig.*createTemplate|ERB\.new|Velocity|Freemarker`
**Verdict:** template *source* built from input is `FAIL` (SSTI → RCE in most engines). Data passed
into a static template is fine and is what `PASS` looks like.

### V1.3.8 — JNDI · V1.3.9 — memcache · V1.3.10 — format strings · V1.3.11 — SMTP/IMAP
**Find it:** `InitialContext|lookup\(|ldap://` · `memcache|Memcached` ·
`printf|String\.format|%s.*user|format!` with a non-literal format · `sendmail|smtplib|SmtpClient|Mail::|nodemailer|JavaMail`
**Verdict:** each is `N_A` when the corresponding capability is absent from the dependency tree —
state which. Present → `PASS` requires: JNDI names not from input and remote codebase disabled;
memcache keys/values escaped of CRLF; format string always a literal; mail headers stripped of
CR/LF (header injection) and recipients validated.

### V1.4.1–V1.4.3 — memory safety
**Control:** no stack/heap overflow, integer overflow, or use-after-free.
**Verdict:** for a managed runtime (Node, Python, JVM, .NET, Go, Ruby, PHP) with no unmanaged code,
`N_A` — but *prove* the absence first: check for native addons, FFI and unsafe blocks
(`node-gyp|\.node\b|ctypes|cffi|JNI|System\.loadLibrary|DllImport|unsafe\b|cgo|import "C"`).
If any exist, the requirements are live for that code: V1.4.1 bounded copies, V1.4.2 checked
arithmetic, V1.4.3 no double-free/dangling pointers. V1.4.2 also applies in managed languages
wherever a value is cast to a narrower integer type or used for allocation sizing.

### V1.5.1 — XXE
**Find it:** `DocumentBuilderFactory|SAXParser|XMLReader|XmlDocument|XmlTextReader|lxml|xml\.etree|xml2js|fast-xml-parser|libxml|Nokogiri|SimpleXML|DOMDocument`
**Verdict:** `PASS` requires external entities and DTD processing explicitly disabled
(`FEATURE_SECURE_PROCESSING`, `disallow-doctype-decl`, `XmlResolver = null`, `resolve_entities=False`,
`LIBXML_NONET`). Relying on a library's current default is `PARTIAL` — defaults change; the
requirement asks for a restrictive *configuration*. No XML parsing at all → `N_A`.

### V1.5.2 — safe deserialization
**Find it:** `pickle|marshal|yaml\.load\b|ObjectInputStream|readObject|BinaryFormatter|NetDataContractSerializer|TypeNameHandling|unserialize\(|Marshal\.load|YAML\.load\b|node-serialize|serialize-javascript`
**Verdict:** any of the known-insecure mechanisms above on untrusted data is `FAIL` — no mitigation
makes them acceptable, which is what the requirement's final sentence means. Safe formats (JSON,
`yaml.safe_load`, protobuf) with a type allowlist → `PASS`. JSON deserialized straight into a
domain model is a mass-assignment issue — score it at V15.3.3.

### V1.5.3 — parser consistency
**Control:** the same data type is parsed the same way everywhere in the request path.
**Verdict:** enumerate every parser for JSON, URL and multipart across edge → gateway → app.
Two different URL parsers on a path that makes a security decision (routing, authorization,
path matching) is `FAIL`. One parser end-to-end → `PASS`.

---

## V2 — Validation and Business Logic (6 T1)

### V2.2.1–V2.2.3 — input validation at a trusted layer
**Control:** every input is validated server-side against an allowlist of values, patterns and
ranges — not merely type-checked — and related fields are checked for mutual consistency.
**Find it:** enumerate routes, then enumerate validators, then diff the two lists.
- Node: `router\.(get|post|put|patch|delete)|app\.(get|post)|@(Get|Post|Put|Patch|Delete)\(`
- Python: `@app\.(route|get|post)|path\(|re_path\(|APIRouter`
- JVM: `@(Get|Post|Put|Patch|Delete)Mapping|@RequestMapping|@Path`
- .NET: `MapGet|MapPost|\[Http(Get|Post|Put|Delete)\]`
- Go: `r\.(Get|Post|Put|Delete)|mux\.Handle`
- PHP/Ruby: `Route::|#\[Route|resources :|get '|post '`

**Verdict:** a mutating route with no validator is `FAIL`. A validator that only checks type and
non-emptiness is `PARTIAL` at L1 and `FAIL` at L2+ — V2.2.1 requires allowlist validation for *all*
input above L1. V2.2.2: client-side validation is UX; if removing it changes what the server
accepts, `FAIL`. V2.2.3: cross-field consistency rules exist for any combined data (date ranges,
address components, quantity vs. stock) — none where the domain needs them is `FAIL`.

### V2.3.3 — transactional integrity
**Find it:** `BEGIN|COMMIT|ROLLBACK|transaction|@Transactional|TransactionScope|\.Begin\(\)|with conn\.begin`
**Verdict:** a business operation spanning multiple writes without a transaction — or with one that
does not roll back on the error path — is `FAIL`. Single-statement operations `PASS`. Cross-service
operations need a compensating/saga pattern; none is `FAIL`.

### V2.3.4 — locking for limited-quantity resources
**Find it:** `FOR UPDATE|SELECT .* LOCK|pessimistic|@Version|optimistic|SETNX|Redlock|advisory_lock|with_lock`
**Verdict:** no finite resource in the domain → `N_A`. Otherwise read-then-write with no lock,
unique constraint or version check is `FAIL` — that is a double-booking bug reachable by racing
two requests.

### V2.4.1 — anti-automation
**Control:** rate limiting / throttling / CAPTCHA on functions whose abuse causes exfiltration,
garbage data, quota exhaustion or cost.
**Find it:** `rate.?limit|throttl|slowdown|bucket|quota|captcha|recaptcha|turnstile`
**Verdict:** read the limiter's scope, key, window and any skip/exempt list. `PASS` requires it to
cover the expensive and auth-adjacent endpoints. Keyed on IP only, behind a proxy, with the proxy
not trusted correctly (cross-ref V15.3.4) means one shared bucket — `PARTIAL` or `FAIL`. An exempt
list containing an expensive endpoint is `PARTIAL`. Confirm the real behaviour with T2.

---

## V3 — Web Frontend Security (24 T1)

If the application serves no browser client, mark the chapter `N_A` once in scope with that
justification and move on.

### V3.2.1 — unintended content interpretation
**Control:** responses that are not documents cannot be rendered as documents — API JSON,
user-uploaded files and other raw resources requested directly.
**Verdict:** `PASS` requires `X-Content-Type-Options: nosniff` plus a correct non-renderable
`Content-Type`, and for user content one of: `Content-Disposition: attachment`, CSP `sandbox`, a
separate origin, or `Sec-Fetch-*` validation. Serving user uploads inline from the app origin is
`FAIL`. Check the static-file handler and any catch-all route cannot return HTML for an asset path.

### V3.2.2 — safe text rendering
**Find it:** the V1.2.1 sink list.
**Verdict:** text destined for display must go through `textContent`/`createTextNode` or an
auto-escaping binding. Check the framework's own binding layer first — a flaw there is systemic and
one finding covers the whole app.

### V3.2.3 — DOM clobbering
**Find it:** `document\.[a-zA-Z_]+\s*=|window\.[a-zA-Z_]+\s*=`, plus reliance on named-element
lookup (`document.foo`, `window.config`) and any `id`/`name` attribute set from user data.
**Verdict:** `PASS` needs explicit declarations, type checks before use of globals, and namespace
isolation. Deliberate globals are fine when declared and type-checked — list them as evidence.

### V3.3.1–V3.3.4 — cookie attributes
**Enumerate every cookie the stack sets**, not just the session cookie — app, framework, edge,
analytics: `Set-Cookie|res\.cookie|set_cookie|addCookie|Response\.Cookies|http\.SetCookie|setcookie\(|cookies\[`

| Req | Requires | Common failure |
| --- | -------- | -------------- |
| V3.3.1 | `Secure` **and** a `__Host-` or `__Secure-` name prefix | `Secure` set only when a prod flag is on — that is `PARTIAL`; certify the prod path and say so |
| V3.3.2 | `SameSite` chosen deliberately per cookie's purpose | Unset (browser defaults vary); `None` without justification |
| V3.3.3 | `__Host-` prefix — which also forbids `Domain` and forces `Path=/` | A `Domain` attribute that shares the cookie with subdomains unnecessarily |
| V3.3.4 | `HttpOnly` on anything not meant for scripts, and that value transferred *only* via `Set-Cookie` | The same session token also returned in a JSON body or readable header |

### V3.4.1–V3.4.8 — browser security headers
All from the security-headers middleware — read its configuration, then map each requirement.
Note which headers the *edge* adds or strips; that is why every item here carries `also=T2`.

| Req | Header | `PASS` requires |
| --- | ------ | --------------- |
| V3.4.1 | `Strict-Transport-Security` | `max-age` ≥ 31536000; `includeSubDomains` at L2+ |
| V3.4.2 | `Access-Control-Allow-Origin` | Fixed value, or `Origin` validated against an allowlist. **No CORS middleware at all is a `PASS`** for a same-origin app — record *which* case it is. Reflecting arbitrary `Origin`, or `*` with credentials or sensitive data, is `FAIL` |
| V3.4.3 | `Content-Security-Policy` | `object-src 'none'` **and** `base-uri 'none'` **and** an allowlist/nonce/hash. `unsafe-inline` in `script-src` without nonces is `FAIL`. Per-response nonces/hashes required at L3. CSP disabled in dev is acceptable only if prod is the certified environment — state the environment audited |
| V3.4.4 | `X-Content-Type-Options` | `nosniff` on every response |
| V3.4.5 | `Referrer-Policy` | Set explicitly, restrictive enough that paths/queries don't leak |
| V3.4.6 | CSP `frame-ancestors` | Present. **`X-Frame-Options` alone is `FAIL` under 5.0** — it is obsolete; the CSP directive is required |
| V3.4.7 | CSP `report-uri`/`report-to` | Present and pointing somewhere actually collected |
| V3.4.8 | `Cross-Origin-Opener-Policy` | `same-origin` or `same-origin-allow-popups` on document responses |

Any header disabled in the middleware options must carry a documented reason; undocumented
disabling is `PARTIAL`.

### V3.5.1 — CSRF · V3.5.3 — safe methods
**V3.5.1 control:** state-changing requests are proven to originate from the app — anti-forgery
token, or a required non-CORS-safelisted header.
**Find it:** `csrf|xsrf|X-Requested-With|anti.?forgery|SameSite|ValidateAntiForgeryToken|protect_from_forgery`
**Verdict:** decide per authentication mechanism, and this distinction *is* the requirement:
a request authenticated solely by an `Authorization: Bearer` header is inherently CSRF-resistant
(that header is not CORS-safelisted) → `PASS`; a request authenticated by an ambient cookie needs a
token or header check → `FAIL` without one. Applications accepting **both** must be judged on the
cookie path. `SameSite=Lax` alone is a defense-in-depth layer, not sufficient for V3.5.1.
**V3.5.3:** no state-changing operation may be reachable by `GET`/`HEAD`/`OPTIONS`. Check the route
enumeration from V2.2.1; any mutating `GET` is `FAIL`.

### V3.5.5 — postMessage
**Find it:** `postMessage|addEventListener\(\s*['"]message|onmessage`
**Verdict:** every application handler must check `event.origin` against an allowlist *and*
validate the message shape. Missing origin check is `FAIL`. Library-internal handlers (SDKs, SSO
iframes) are the library's responsibility — note them, don't score them.

### V3.5.6–V3.5.8 — XSSI and cross-origin resource loading
- V3.5.6: `callback=|jsonp` → any JSONP endpoint is `FAIL`.
- V3.5.7: no authorization-dependent data in a script-typed response. Check for per-user generated
  `.js` or config scripts; those are readable cross-origin.
- V3.5.8: authenticated non-document resources need `Cross-Origin-Resource-Policy` or `Sec-Fetch-*`
  validation. Absent → `FAIL` at L3.

### V3.6.1 — Subresource Integrity
**Find it:** external origins in markup — `<script|<link` with `https?://`, plus CDN hosts in CSP.
**Verdict:** zero external assets → `PASS`, evidenced by the empty search. Any external script or
stylesheet without `integrity=` + `crossorigin` is `FAIL` unless a documented decision justifies it.
Note that SRI requires the resource to be static and versioned — SRI on a mutable `@latest` URL is
still `FAIL`.

### V3.7.1 — supported client-side technology
**Find it:** `\.swf|flash|silverlight|<applet|ActiveXObject|NPAPI|nacl`
**Verdict:** any hit is `FAIL`. Clean → `PASS`.

### V3.7.2 — open redirect
**Find it:** `res\.redirect|redirect\(|RedirectToAction|http\.Redirect|location\.(href|assign|replace)\s*=|window\.open|Location: `
**Verdict:** a redirect target derived from input (`?next=`, `?returnUrl=`, `?redirect_uri=`) without
an allowlist of hostnames is `FAIL`. A relative-path-only check is `PARTIAL` — `//evil.com` and
`\/\/evil.com` are protocol-relative and defeat naive checks. Confirm with T2.

---

## V4 — API and Web Service (8 T1)

### V4.1.3 — intermediary headers not user-overridable
**Control:** `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Proto`, `X-User-*` and friends are set by
a trusted hop and cannot be spoofed by a client.
**Find it:** `trust proxy|TrustedProxies|ForwardedHeadersOptions|X-Forwarded|X-Real-IP|RemoteIpValve|USE_X_FORWARDED_HOST|remote_ip`
**Verdict:** the proxy-trust setting must name the actual number or addresses of trusted hops.
Trusting *all* proxies while exposed to the internet lets any client forge its IP → `FAIL`.
Trusting *none* while behind a proxy means every security decision uses the proxy's IP → `FAIL`
(and drags V2.4.1 and V15.3.4 down with it). Any application-meaningful header (`X-User-Id`,
`X-Tenant`) accepted from the client without stripping at the edge is `FAIL`.

### V4.1.5 — per-message signatures
**Verdict:** L3, and only for highly sensitive or multi-hop transactions. None in the domain →
`N_A` with that note; otherwise verify signature generation *and* verification both exist.

### V4.2.5 — over-long URIs and headers on outbound requests
**Control:** anything the app interpolates into an outbound URL or header is length-bounded.
**Verdict:** an unbounded user value concatenated into an outbound URL or cookie/`Authorization`
header is `FAIL` — it turns into a self-inflicted DoS when the receiver starts rejecting.

### V4.3.1–V4.3.2 — GraphQL
**Find it:** `graphql|apollo|ariadne|strawberry|graphene|HotChocolate|graphql-java`
**Verdict:** no GraphQL → `N_A` for both. Present: V4.3.1 needs depth limiting, complexity/cost
analysis, or a persisted-query allowlist — pagination alone is `FAIL`. V4.3.2 needs introspection
disabled in production; a public-API exception must be documented.

### V4.4.1–V4.4.4 — WebSocket
**Find it:** `WebSocket|socket\.io|ws://|wss://|SignalR|ActionCable|channels|gorilla/websocket|Hub<`

| Req | `PASS` requires | Common failure |
| --- | --------------- | -------------- |
| V4.4.1 | `wss://` everywhere, including the client's configured URL | A config that yields `ws://` in any non-local environment |
| V4.4.2 | Explicit `Origin` allowlist checked at handshake | Default-allow. The Origin header is **absent** for non-browser clients — decide and document whether that is accepted |
| V4.4.3 | If a dedicated token is used, it meets V7.2.2–V7.2.3 and V7.3/V7.4 | A long-lived token minted once and never expiring |
| V4.4.4 | The handshake validates the existing authenticated session before the upgrade | Accepting the upgrade then authenticating on the first message — pre-auth message handling is the bug. Also confirm per-connection identity comes from the *validated* token, never a client-supplied id |

---

## V5 — File Handling (10 T1)

**Scope first:** `multipart/form-data|multer|busboy|formidable|FileUpload|IFormFile|request\.files|MultipartFile|Rack::Multipart|move_uploaded_file|presigned`
No upload path and no download of user-influenced files → mark V5 `N_A` once. Uploads that go
directly to object storage via presigned URLs are still in scope — you still define what is accepted.

| Req | `PASS` requires | Note |
| --- | --------------- | ---- |
| V5.2.1 | An enforced maximum size on the upload path | Body-size limits on JSON often do **not** cover multipart — check the multipart limit specifically |
| V5.2.2 | Extension allowlist **and** content verification (magic bytes, image re-encode, type-specific parser) | Extension-only or `Content-Type`-only is `FAIL`; both are client-controlled |
| V5.2.3 | Uncompressed-size and file-count caps checked *before* extraction | Extract-then-check is `FAIL` |
| V5.2.4 | Per-user file count and storage quota | L3 |
| V5.2.5 | Symlinks in archives rejected, or an explicit link-target allowlist | L3 |
| V5.2.6 | Maximum pixel dimensions enforced before decode | L3; decode-then-check is still a pixel flood |
| V5.3.2 | Storage paths built from generated identifiers, never the client filename | If the client name must be kept, store it as metadata, not as the path |
| V5.3.3 | Decompression ignores embedded path components (zip slip) | L3 |
| V5.4.1 | A server-chosen filename in `Content-Disposition` | |
| V5.4.2 | RFC 6266 encoding of that filename | CR/LF or quotes in a filename is header injection |

V5.3.1 (uploads not executed server-side) is scored from T2.

---

## V6 — Authentication (5 T1)

**If the application implements its own authentication, most of V6 is code review, not T3.** The
catalog marks 38 of these T3 because delegation is the common case — that is a routing hint, not a
constraint. When the credential store, login flow, password policy, lockout, reset and MFA live in
this repo, verify them here from source and record the `file:line`; `tier3-manual.md` Group B lists
what each one requires, and the requirement text is identical either way.

The five below are the application's own responsibility in **every** architecture, including full
delegation.

### V6.3.4 — no undocumented authentication pathways
**Control:** every entry point that establishes identity enforces the same strength.
**Verdict:** enumerate all auth guards and all routes, then diff. Anything reachable without a
guard — a legacy endpoint, an internal/debug route, a webhook, a health endpoint returning data, a
secondary API-key path — is an undocumented pathway → `FAIL`. Compare client-side route guards
against server-side ones: a client guard with no server counterpart is `FAIL` here *and* at V8.3.1.

### V6.8.1 — identity not spoofable across identity providers
**Verdict:** the stored user key must be `(idp_id, subject)`, never email or username alone. With a
single IdP this is `PASS` if the key is the IdP subject; keying on email is `FAIL` as soon as a
second IdP or a self-registration path exists — and is a latent failure even before that.

### V6.8.2 — assertion signatures always validated
**Find it:** manual token handling that skips verification —
`jwt\.decode|decode\(.*verify\s*=\s*False|parseClaimsJwt|ValidateToken.*false|base64.*split\('\.'\)|JSON\.parse\(atob`
**Verdict:** client-side decoding for display is fine. A *server-side* authorization decision made
on a decoded-but-unverified token is `FAIL`. Confirm every token-accepting path routes through the
verifying library, including WebSocket handshakes and background jobs.

### V6.8.3 — SAML assertion replay
**Verdict:** SAML not in use → `N_A`. In use → `PASS` requires assertion-ID caching with
single-use enforcement inside the validity window; `NotOnOrAfter` alone is `FAIL`.

### V6.8.4 — authentication strength/recentness verified
**Verdict:** if any function requires MFA or recent authentication, the app must check the IdP's
`acr`/`amr`/`auth_time` (or SAML equivalents). No such function → `N_A` with that note. If the IdP
does not supply them, a documented fallback assuming the *weakest* mechanism is required — an
undocumented assumption of strong auth is `FAIL`.

---

## V7 — Session Management (7 T1)

| Req | `PASS` requires | Common failure |
| --- | --------------- | -------------- |
| V7.2.1 | Session/token verification server-side only | A client-side guard treated as the control |
| V7.2.2 | Dynamically generated tokens | A static API key or shared secret used as a user session |
| V7.2.3 | Reference tokens ≥128 bits from a CSPRNG | A custom id generator that weakens the framework default; sequential or timestamp-derived ids |
| V7.3.1 | An inactivity timeout, enforced server-side | A long absolute lifetime with no idle timeout satisfies V7.3.2 but **not** V7.3.1 — score them separately |
| V7.3.2 | An absolute maximum lifetime | A rolling/sliding session with no absolute cap is `FAIL` |
| V7.4.4 | Logout reachable from every authenticated view | Logout only in a menu that some views lack |
| V7.6.2 | Session creation requires explicit user action | Sessions written for anonymous visitors — check the "save uninitialized" style setting is off |

Timeouts enforced upstream of the app — by an identity service, a gateway or an auth framework —
still count, but verify the app honours them: it must re-check token expiry on every request rather
than caching identity indefinitely. Record both halves, the upstream setting and the app's handling.

---

## V8 — Authorization (3 T1)

### V8.2.1 — function-level access
**Verdict:** every route carries an explicit permission requirement. Use the V6.3.4 route/guard
diff. Deny-by-default (a global guard with explicit opt-outs) is stronger than allow-by-default
(per-route guards) — note which pattern is used, because allow-by-default makes every new route a
potential `FAIL`. If auth can be switched off by configuration, audit the switched-**on** path and
say so.

### V8.3.1 — enforced at a trusted layer
**Verdict:** any decision made only in client code, a hidden form field, or a client-supplied role
claim not validated server-side is `FAIL`.

### V8.3.3 — originating subject's permissions
**Verdict:** when a service calls another service on a user's behalf, the downstream decision must
use the user's identity, not the calling service's privileged credential. A service account with
broad rights used for user-triggered reads is `FAIL` — that is confused-deputy. No service-to-service
hop → `N_A`.

Ownership-check helpers are the *implementation* that V8.2.2 tests; read them here, but score
V8.2.2/V8.2.3 from the T2 probe — code can look correct and still be unreachable or bypassed.

---

## V9 — Self-contained Tokens (7 T1 — the whole chapter)

Applies whenever the app *consumes* a JWT/JWS/PASETO/SAML assertion, including when validation is
delegated to a library. `PASS` requires proving the delegation is complete and correctly
configured — "we use library X" is not evidence; the configuration is.

**Find it:** `jwt|jose|jsonwebtoken|pyjwt|nimbus|jjwt|System\.IdentityModel|golang-jwt|firebase/jwt|JWKS|jwks_uri|public.?key`

| Req | `PASS` requires | Common failure |
| --- | --------------- | -------------- |
| V9.1.1 | Every token path verifies signature/MAC before reading claims | A decode used "just for logging" that then feeds a decision |
| V9.1.2 | An explicit algorithm allowlist; `none` impossible; symmetric and asymmetric not both accepted without key-confusion controls | `algorithms` unset, so the library infers from the token's own header |
| V9.1.3 | Key material from pre-configured issuer sources only | Honouring `jku`/`x5u`/`jwk`/`kid` URLs from the token header — attacker supplies the key |
| V9.2.1 | `exp`/`nbf` enforced | Verification with expiry checks disabled, or a clock-skew allowance large enough to matter |
| V9.2.2 | Token type/purpose checked | Accepting an ID token, or a refresh token, where an access token is required |
| V9.2.3 | `aud` validated against this service | Audience unchecked — any token from the same issuer works, including one minted for a different client. Many IdPs omit `aud` unless configured, so this often needs an IdP-side fix too |
| V9.2.4 | Distinct audience restrictions when one key signs for several audiences | |

---

## V10 — OAuth and OIDC (15 T1)

These are the **client** and **resource-server** halves — the OAuth roles that normally live in
application code. The **authorization-server** half (V10.4, V10.6, V10.7) is listed as T3 because it
is usually someone else's service; if you run or self-host the authorization server, those become
code and config review in its repo instead. `N_A` the whole chapter only if no OAuth/OIDC is used
anywhere.

| Req | `PASS` requires |
| --- | --------------- |
| V10.1.1 | Tokens reach only components that need them. For a browser app: tokens never sent to third-party origins; a BFF pattern keeps access/refresh tokens server-side. Cross-ref V14.3.3 for where the token is stored |
| V10.1.2 | `state`, `nonce` and PKCE `code_verifier` generated per transaction from a CSPRNG and bound to the user-agent session — not reused, not derivable |
| V10.2.1 | PKCE (`S256`, never `plain`) or a verified `state` on the code flow. Verify it is enabled for **every** client in the repo — a value set for one client (e.g. an API-docs UI) does not cover the main app |
| V10.2.2 | With multiple authorization servers: `iss` returned and validated in both the authorization and token responses. Single AS → `N_A`, note it |
| V10.2.3 | Only the scopes actually needed are requested |
| V10.3.1 | Resource server validates audience — same evidence as V9.2.3 |
| V10.3.2 | Authorization decisions use `sub`/`scope`/`authorization_details` from the token, via the library's claim API |
| V10.3.3 | Users identified by non-reassignable claims — `iss`+`sub`. Keying on `email` or `preferred_username` is `FAIL`; both can be changed and reassigned |
| V10.3.4 | Required authentication strength/recentness checked against `acr`/`amr`/`auth_time`, or `N_A` if nothing requires it |
| V10.3.5 | Sender-constrained tokens (mTLS or DPoP). L3 only — `N_A` below an L3 target, `FAIL` at L3 if absent |
| V10.5.1 | ID-token `nonce` matched against the request nonce |
| V10.5.2 | User uniquely identified from `sub` within the issuer |
| V10.5.3 | Issuer URL exact-matched against the pre-configured value — metadata never self-asserts a different issuer |
| V10.5.4 | ID-token `aud` equals this client's `client_id` |
| V10.5.5 | Back-channel logout tokens typed `logout+jwt`, carrying `events`, carrying no `nonce`. Not used → `N_A` |

---

## V11 — Cryptography (16 T1)

**Find it first:** `crypto\.|hashlib|cryptography|javax\.crypto|System\.Security\.Cryptography|crypto/(aes|cipher|rand|sha)|openssl|sodium|OpenSSL::|bcrypt|argon2|scrypt|pbkdf2|Math\.random|random\.|rand\(`

If the search comes back empty — all crypto delegated to TLS, the IdP and the datastore — most of
V11 is `N_A`, but record the search as the evidence for that conclusion.

| Req | `PASS` requires | Common failure |
| --- | --------------- | -------------- |
| V11.2.1 | Platform/vetted libraries only | Hand-rolled primitives, or a "simple" XOR/obfuscation helper |
| V11.2.2 | Algorithms, key sizes and keys reconfigurable without code changes; data re-encryptable | Algorithm hard-coded at every call site |
| V11.2.3 | ≥128-bit security per primitive | RSA < 3072, ECC < 256 |
| V11.2.4 | Constant-time comparison for secrets, MACs and tokens | `==` / `===` / `String.equals` on a secret — use `timingSafeEqual`, `hmac.compare_digest`, `MessageDigest.isEqual`, `CryptographicOperations.FixedTimeEquals`, `subtle.ConstantTimeCompare` |
| V11.2.5 | Crypto failures fail closed and return undifferentiated errors | Distinct errors for "bad padding" vs "bad MAC" — a padding oracle |
| V11.3.1 | No ECB, no PKCS#1 v1.5, no static/zero IV | Default-mode APIs that silently mean ECB |
| V11.3.2 | AES-GCM, ChaCha20-Poly1305 or equivalent approved AEAD | |
| V11.3.3 | Authenticated encryption, or approved encryption + approved MAC | CBC with no MAC |
| V11.3.4 | IV/nonce unique per (key, message), generated appropriately for the mode | A reused GCM nonce — catastrophic, not theoretical |
| V11.3.5 | Encrypt-then-MAC when composing manually | MAC-then-encrypt |
| V11.4.1 | Approved hashes for cryptographic use; MD5/SHA-1 nowhere cryptographic | A non-cryptographic hash for cache keys or sharding is fine — state that in `note` |
| V11.4.3 | ≥256-bit output where collision resistance matters | SHA-1 in a signature path |
| V11.4.4 | Approved KDF with stretching when deriving keys from passwords | A bare hash used as a KDF |
| V11.5.1 | CSPRNG with ≥128 bits for anything unguessable | **Any non-cryptographic RNG in a security context is `FAIL`.** ASVS 5.0 states explicitly that UUIDs do **not** satisfy this — a UUIDv4 token is a finding |
| V11.6.1 | Approved algorithms and parameters for key generation and signatures | Weak or unverified key generation |

Password storage (V11.4.2) is T3 when delegated to an identity provider.

---

## V12 — Secure Communication (3 T1)

### V12.1.3 — mTLS client certificate validation
**Verdict:** mTLS not used → `N_A`. Used → the certificate chain and revocation must be validated
*before* the certificate identity is trusted for authentication or authorization.

### V12.3.1 — encrypted protocol on every connection
**Find it:** connection strings and scheme literals in configuration —
`redis://|amqp://|mongodb://|postgres(ql)?://|mysql://|http://|ldap://|sslmode|ssl=|useSSL|tls=|encrypt=|require_secure_transport`
**Verdict:** enumerate every inbound and outbound connection — database, cache, queue, object
storage, monitoring, log shipping, external APIs, admin access. Any plaintext scheme, or TLS
disabled by a setting, is `FAIL` unless the hop provably never leaves an encrypted boundary — and
that claim belongs in `note` as an explicit deployment assumption, cross-referenced to V12.3.3 (T3).
"It's on the internal network" is not by itself sufficient at L2.

### V12.3.2 — TLS clients validate certificates
**Find it:** `rejectUnauthorized|NODE_TLS_REJECT_UNAUTHORIZED|verify\s*=\s*False|CURLOPT_SSL_VERIFYPEER|InsecureSkipVerify|ServerCertificateValidationCallback|TrustAllCerts|X509TrustManager|allow_invalid_certificates|sslmode=disable`
**Verdict:** **any** disabled verification is an immediate `FAIL`, including in test helpers that
ship in the production artifact. Check Dockerfiles and CI config too.

---

## V13 — Configuration (5 T1)

### V13.2.1 — backend components authenticate
**Verdict:** service-to-service and service-to-datastore authentication should use individual
service accounts, short-lived tokens or certificates. Long-lived shared passwords or API keys are
`PARTIAL` at best — record the compensating control (network isolation, rotation) in `note`.
No authentication at all between components is `FAIL`.

### V13.2.3 — no default credentials
**Find it:** `rg -ni "admin:admin|root:root|password=password|changeme|:secret@|guest:guest|sa:|postgres:postgres|test:test"` across compose files, Helm charts, Terraform, Dockerfiles, CI config and docs.
**Verdict:** defaults reachable in production are `FAIL`. Defaults confined to a local dev compose
file that cannot reach prod are `PARTIAL` — and worth fixing, because they get copied.

### V13.2.6 — documented connection behaviour is what the code does
**Find it:** `pool|maxConnections|timeout|retry|backoff|circuit|maxRetries|deadline`
**Verdict:** every external connection needs a connect timeout, a request timeout, a bounded retry
count and backoff. Unbounded retries, or no timeout, is `FAIL` — that is a cascading-failure and
amplification bug. Requires reading the documentation too (cross-ref V13.1.3, T3).

### V13.3.1 — secrets not in source or build artifacts
**Run a history scan, not just a working-tree scan** — a removed secret is still in the objects:
```bash
gitleaks detect --no-banner --redact 2>/dev/null || trufflehog git file://. --only-verified
git log --all --diff-filter=A --name-only -- '*.env' '*.pem' '*.key' '*.p12' '*.pfx' | head -40
git ls-files | rg -i "\.env$|\.pem$|\.key$|\.p12$|\.pfx$|id_rsa|credential|secret"
```
Also check container images and build output do not bake secrets in (`ARG`/`ENV` in Dockerfiles,
`--build-arg` in CI).
**Verdict:** a secret in history is `FAIL` until rotated, regardless of the current tree. Secrets
supplied only as environment variables, with no vault or managed secret store, is `PARTIAL`
against V13.3.1's explicit "secrets management solution" wording at L2; `FAIL` at L3, which
requires hardware backing.

### V13.4.2 — debug modes disabled in production
**Find it:** `DEBUG|debug\s*=\s*[Tt]rue|APP_DEBUG|NODE_ENV|ASPNETCORE_ENVIRONMENT|developmentMode|detailedErrors|swagger|graphiql|actuator|django\.contrib\.admin|/__debug__`
**Verdict:** the gate must be **fail-closed**: features mount only when the environment *equals*
the development value. A gate of the form "mount unless environment equals production" is `FAIL` —
an unset or misspelled variable then exposes the feature. Read the actual comparison operator; this
is where the finding usually is. Check debug toolbars, profilers, API explorers, actuator/metrics
endpoints and verbose error pages.

---

## V14 — Data Protection (8 T1)

| Req | `PASS` requires | Common failure |
| --- | --------------- | -------------- |
| V14.2.1 | No sensitive data in URLs or query strings | A token, session id, password-reset code or PII in a query string — it lands in access logs, browser history and `Referer` |
| V14.2.2 | Sensitive responses not cached by server-side components, or purged after use | A CDN or reverse proxy caching an authenticated response; an in-memory cache keyed without the user |
| V14.2.3 | No sensitive data sent to third parties | Analytics, session replay, error reporters and tag managers that capture form fields, URLs or request bodies. Check the error reporter's scrubbing config specifically |
| V14.2.6 | Only the minimum fields returned; full values masked in the UI unless explicitly revealed | Returning whole records including internal flags, other users' identifiers, or soft-deleted rows |
| V14.2.8 | Metadata stripped from user-submitted files | EXIF GPS on uploaded photos. `N_A` without uploads |
| V14.3.1 | Client storage cleared on session termination | Token or profile left in storage after logout; consider `Clear-Site-Data`, and ensure client-side cleanup also runs when the server is unreachable |
| V14.3.2 | `Cache-Control: no-store` on responses carrying sensitive data | Default static-file caching applied to an authenticated response |
| V14.3.3 | No sensitive data in `localStorage`/`sessionStorage`/IndexedDB/cookies — session tokens are the stated exception | PII or a full profile cached client-side. Note SDK-managed storage (PKCE state, token cache) explicitly rather than ignoring it |

Find client storage with: `localStorage|sessionStorage|indexedDB|AsyncStorage|UserDefaults|SharedPreferences`.

---

## V15 — Secure Coding and Architecture (16 T1)

### V15.1.2 — SBOM · V15.2.1 — no overdue vulnerable components · V15.2.4 — dependency confusion
Run the ecosystem's audit and SBOM commands from `stack-profiles.md` §3 and paste the summary as
evidence — for V15.2.1 the tool output *is* the result.
- V15.1.2: the inventory must be **maintained** — a committed SBOM or a CI step that produces one.
  "We could generate one" is `FAIL`.
- V15.2.1: judged against the documented remediation window (V15.1.1, T3). No documented window
  means V15.1.1 fails and V15.2.1 should be judged against a stated assumption — record it.
  If the audit tool cannot run, this is `NOT_TESTED`, never `PASS`.
- V15.2.4: lockfiles committed with integrity hashes; registry/scope configuration pinned
  (`.npmrc`, `pip.conf`/index-url, `settings.xml`, `NuGet.config`, `GOPROXY`+`GONOSUMDB`,
  `Gemfile` source, `composer.json` repositories); no internal package name resolvable from a
  public registry. Mixed public/private registries without scope pinning is `FAIL`.

### V15.2.2 — availability defenses
**Verdict:** expensive operations need bounds — pagination caps, query timeouts, result-size limits,
async/queued processing for long work. A list endpoint that returns unbounded rows, or a
`limit` parameter the client controls without a ceiling, is `FAIL`.

### V15.2.3 — production contains only what it needs
**Verdict:** no test routes, sample data, seeders, fixtures, admin backdoors or commented-out debug
endpoints reachable at runtime. Check what the build/container actually ships, not just the repo.

### V15.3.1 — minimal field subset
**Verdict:** same evidence as V14.2.6. Explicit serializers/DTOs → `PASS`; returning the domain
object directly → `FAIL`.

### V15.3.2 — backend does not follow redirects
**Find it:** `redirect:\s*['"]|maxRedirects|followRedirect|allow_redirects|FollowRedirects|CheckRedirect|CURLOPT_FOLLOWLOCATION|instance_follow_redirects`
**Verdict:** most HTTP clients follow redirects by default. Server-side outbound calls need
following disabled unless intended — otherwise an SSRF allowlist check on the first URL is bypassed
by a redirect to an internal address. Unbounded following is `FAIL`.

### V15.3.3 — mass assignment
**Find it:** `\.\.\.req\.body|Object\.assign\(.*body|= req\.body\b|\*\*request\.(json|data)|ModelState|TryUpdateModel|BeanUtils\.copyProperties|\.update\(params|permit!|fill\(\$request->all`
**Verdict:** binding a whole request body to a model is `FAIL` unless immediately followed by an
explicit field allowlist. Look specifically for fields the client should never set: `role`,
`isAdmin`, `ownerId`, `tenantId`, `price`, `status`, `verified`, `createdAt`.

### V15.3.4 — original client IP used correctly
**Verdict:** depends entirely on V4.1.3. The IP used for rate limiting, logging and any security
decision must be the real client IP, derived from a trusted hop. Taking the left-most
`X-Forwarded-For` entry without trusting a fixed proxy count is `FAIL` — that value is
attacker-controlled.

### V15.3.5 — strict types and equality
**Find it:** loose equality in weakly typed languages — `[^=!]==[^=]|!=[^=]` in JS/PHP;
`Integer ==` reference comparison in Java; unchecked casts elsewhere.
**Verdict:** loose equality in a security decision (token compare, role check, id match) is `FAIL`.
Elsewhere it is `PARTIAL` with a note. Confirm validators assert the type before use — this is the
same check that makes V15.3.7 pass.

### V15.3.6 — prototype pollution
**Find it:** `__proto__|constructor\s*\[|prototype\s*\[|deepMerge|merge\(|extend\(|Object\.assign\(\{\}|lodash\.merge|set\(obj`
**Verdict:** JS/TS only (`N_A` elsewhere, with that note). Recursively merging request data into an
object literal is `FAIL`. Dictionaries keyed by user input should be `Map` or `Object.create(null)`.
Check transitive dependencies too — this class of bug usually arrives via a library.

### V15.3.7 — HTTP parameter pollution
**Verdict:** determine what the framework does with `?a=1&a=2` — array, first, last, or
comma-joined — and confirm every handler tolerates it. A handler that assumes a string and receives
an array can skip a check or throw. `PASS` requires validators to assert the type before use.
Also check duplicate parameters across sources (query vs body vs cookie) resolve predictably.

### V15.4.1–V15.4.4 — safe concurrency
L3. Single-threaded runtimes reduce but do not eliminate these — async interleaving still races.
- V15.4.1: shared mutable module/static state written during request handling.
- V15.4.2: TOCTOU — check-then-act on files, permissions or records without an atomic operation,
  optimistic-concurrency version check, or transaction. `exists()` then `open()`, or
  `checkAccess()` then `grant()`, is the pattern to find.
- V15.4.3: locks released in `finally`/`defer`, acquired in a consistent order, and owned by the
  module that owns the resource.
- V15.4.4: bounded parallelism — no unbounded `Promise.all`/thread-per-request over a
  user-controlled collection; fair scheduling via pools.

---

## V16 — Security Logging and Error Handling (14 T1)

| Req | `PASS` requires | Common failure |
| --- | --------------- | -------------- |
| V16.2.1 | Every entry carries when / where / who / what | No actor on the entry — without `who` there is no investigation |
| V16.2.2 | UTC, or an explicit offset, from a synchronized source | Local time with no offset; correlation across hosts becomes guesswork |
| V16.2.3 | Logs go only to documented sinks | Stray `console.log`/`print`/`System.out` bypassing the logger *and* its redaction. Enumerate them: `console\.(log\|error\|warn)\|print\(\|println\|System\.out\|fmt\.Print\|var_dump\|puts ` |
| V16.2.4 | A format the log processor can parse and correlate | Unstructured text when the pipeline expects structured events. Structured/JSON with a correlation id → `PASS` |
| V16.2.5 | Sensitive data never logged, or masked per its protection level | Logging full request bodies, `Authorization` headers, cookies, tokens, or query strings containing secrets. Check the redaction list actually covers the fields classified in V14.1.1 |
| V16.3.1 | Every authentication operation logged, success and failure, with the factor used | Only failures logged — successful-login history is what detects account takeover. If the IdP logs this, `PASS` requires those events to reach the same pipeline |
| V16.3.2 | Failed authorization logged (all decisions at L3) | A silent 403 |
| V16.3.3 | Documented security events and control-bypass attempts logged | Validation rejections, rate-limit triggers and ownership denials discarded |
| V16.3.4 | Unexpected errors and control failures logged, including backend TLS and dependency failures | |
| V16.4.1 | Log data encoded to prevent injection | A newline in a logged username forging log lines; structured logging largely solves this |
| V16.5.1 | Generic message to the caller; no stack trace, query, key or token in any response | The framework's default error page in production; a debug flag re-enabling details. Verify the condition is fail-closed |
| V16.5.2 | Graceful degradation when a dependency fails — circuit breaker, fallback, or a deliberate fail-closed stop | An unhandled dependency error surfacing as a 500 with details |
| V16.5.3 | Fails closed | A `catch` that swallows a validation or authorization error and continues — that is the fail-open condition the requirement names |
| V16.5.4 | A last-resort handler plus process-level handlers for uncaught exceptions and unhandled rejections | Async handlers not wrapped by the framework's error plumbing, so errors escape silently. Verify every async route is wrapped |
