# Tier 2 — Testing Suites / DAST (47 requirements)

Requires a **running instance** and a proxy or scanner. These items prove what the deployed stack
actually does — after the reverse proxy, CDN, WAF and gateway have had their say. That is why they
are not T1: source code cannot tell you what survives the edge.

Stack-independent by construction — everything here happens over HTTP/TLS/UDP.

## Before you start

1. **Authorization.** Only test a target you are authorized to test. Record scope and window.
   Never point these at a third-party production service.
2. **Environment.** Test the environment you intend to certify. A `PASS` on a dev instance with
   CSP disabled is not a `PASS` for production — record the URL **and** the environment in the
   report's **Test target** field.
3. **Two accounts, two tenants.** Authorization testing (V8) is impossible with one user. Get
   `userA`, `userB` in the same tenant, and where multi-tenancy exists, a user in a second tenant.
4. **Tool versions** go in the report's **Tooling used** field — a scanner version change explains a
   delta that no code change explains.

**If no instance is reachable, every T2 item stays `NOT_TESTED`.** Do not infer a `PASS` from source
code — the `also=T1` column already records that the code was read. Guessing here is the single
biggest way these reports go wrong.

## Toolkit

| Tool | Use |
| ---- | --- |
| **Burp Suite** (Pro or Community) | Proxy, Repeater, Intruder; Pro adds Scanner. Extensions: **Autorize** (V8), **HTTP Request Smuggler** (V4.2), **Param Miner**, **JWT Editor**, **Turbo Intruder** |
| **OWASP ZAP** | Free alternative; `zap-baseline.py` / `zap-full-scan.py` are CI-friendly |
| **testssl.sh** / **sslyze** | Everything in V12.1–V12.2 |
| **nuclei** | Fast templated checks for V13.4 exposures |
| **ffuf** / **feroxbuster** | Content discovery for V13.4.3, V13.4.5, V13.4.7 |
| **curl** | Every single-shot check below; the reproducible evidence format |
| **sqlmap**, **dalfox** | Confirming T1 injection suspicions (score them at V1, not here) |

Record evidence as the **exact request and the response status + relevant headers**. A screenshot is
not diffable; a `curl` line and its output is.

---

## V2 — Anti-automation

### V2.4.2 [L3] — business flows require realistic human timing
Submit a multi-step flow programmatically with zero delay between steps.
```bash
# capture the flow in Burp, then replay the sequence back-to-back
```
`PASS` when the application rejects or challenges a flow completed faster than a human could.
Completing a checkout, registration or transfer in milliseconds, repeatedly, is `FAIL`.

---

## V3 — Web Frontend

### V3.3.5 [L3] — cookie name+value ≤ 4096 bytes
Authenticate, then measure every cookie at its largest (after a session accumulates state).
```bash
curl -sSik -c jar.txt <url> >/dev/null && awk '!/^#/ && NF {print length($6"="$7), $6}' jar.txt | sort -rn | head
```
`FAIL` if any cookie exceeds 4096 bytes — the browser silently drops it and the feature relying on
it breaks.

### V3.5.2 [L1] — CORS preflight cannot be bypassed
For each endpoint that relies on preflight for protection, try to reach it with a **simple** request
that triggers no preflight: method `GET`/`POST`/`HEAD` and `Content-Type` limited to
`application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`.
```bash
curl -si -X POST <url>/api/<sensitive> -H 'Content-Type: text/plain' \
     -H 'Origin: https://evil.example' --data '{"...":"..."}'
```
`PASS` when the request is rejected (unsupported content type, missing required header, or
`Origin` validated server-side). `FAIL` if it executes — CORS never blocked the *request*, only
the attacker's ability to read the response, and a state change has already happened.

---

## V4 — API and Web Service

### V4.1.1 [L1] — correct `Content-Type` with charset on every body
Crawl with the proxy, then review every distinct response type.
```bash
curl -sI <url>/api/<endpoint> | grep -i '^content-type'
```
`PASS` requires a type matching the actual body and a `charset` where applicable. Missing
`Content-Type`, or `text/html` on a JSON response, is `FAIL`. Check error responses and file
downloads too — they are the usual offenders.

### V4.1.2 [L2] — only user-facing endpoints redirect HTTP→HTTPS
```bash
curl -sI http://<host>/            # expect 301/308 for a browser-facing path
curl -sI http://<host>/api/health  # expect a refusal or no listener, NOT a redirect
```
`FAIL` if API endpoints transparently redirect — that silently hides clients sending secrets in
plaintext, which is exactly what the requirement is about.

### V4.1.4 [L3] — unused HTTP methods blocked
```bash
for m in GET POST PUT PATCH DELETE OPTIONS HEAD TRACE CONNECT PROPFIND; do
  printf '%-9s %s\n' "$m" "$(curl -s -o /dev/null -w '%{http_code}' -X "$m" <url>/api/<endpoint>)"
done
```
`PASS` when unsupported methods return 405/501. A 200 on a method the API does not implement is
`FAIL`; check `Allow` and CORS `Access-Control-Allow-Methods` agree with reality.

### V4.2.1–V4.2.4 [L2/L3] — HTTP message structure
Run **Burp HTTP Request Smuggler** against the target, covering CL.TE, TE.CL, TE.TE, and for
HTTP/2: H2.CL, H2.TE, CRLF injection into H2 header fields, and downgrade smuggling.
```bash
curl -sI --http2 <url> ; curl -sI --http3 <url> 2>/dev/null
```
- **V4.2.1** — any confirmed desync is `FAIL`. Test every distinct front-end/back-end pair; a CDN
  in front of a gateway in front of the app is two boundaries, not one.
- **V4.2.2** — responses whose `Content-Length` disagrees with the framing.
- **V4.2.3** — H2/H3 messages carrying connection-specific headers (`Transfer-Encoding`,
  `Connection`, `Keep-Alive`, `Upgrade`) accepted or emitted.
- **V4.2.4** — H2/H3 accepting CR, LF or CRLF inside header names or values.

These four need a real deployment including the edge. Against a bare local dev server the result is
`NOT_TESTED`, not `PASS` — say so in `note`.

### V4.3.2 [L2] — GraphQL introspection disabled in production
```bash
curl -s <url>/graphql -H 'Content-Type: application/json' \
     -d '{"query":"{__schema{types{name}}}"}' | head -c 300
```
A schema in the response is `FAIL` unless the API is documented as public. Also try `__type`,
field suggestions in error messages ("Did you mean…"), and GET-based queries.

---

## V5 — File Handling

### V5.3.1 [L1] — uploaded files not executed server-side
Upload a benign file whose extension maps to a server-side handler for the stack
(`.php`, `.jsp`, `.aspx`, `.py`, `.rb`, `.cgi`, `.phtml`, `.svg`, `.html`), then request it directly.
Also try double extensions (`x.jpg.php`), null bytes, trailing dots/spaces, and case variation.
```bash
curl -s <url>/uploads/<name>.php | head
```
`PASS` when the file is served as an inert download or not served at all. Any evidence of
execution — or of rendering as HTML from the app origin — is `FAIL` (the HTML case is stored XSS,
also V3.2.1).

---

## V6 — Authentication

### V6.3.8 [L3] — no user enumeration
Compare responses for a **valid** vs **invalid** identifier across login, registration, forgot
password and any "check availability" endpoint. Compare **status code, body, headers and timing**.
```bash
for u in "<an-identifier-that-exists>" "<an-identifier-that-does-not>"; do
  curl -s -o /dev/null -w "$u %{http_code} %{time_total}\n" -X POST <url>/login \
       -H 'Content-Type: application/json' -d "{\"username\":\"$u\",\"password\":\"wrong\"}"
done
```
Repeat ~50× per identifier and compare distributions — a single sample proves nothing. Any reliable
distinguisher, including a consistent timing gap from password hashing only on valid users, is `FAIL`.

### V6.5.1 [L2] — OTP / lookup secret / TOTP usable only once
Authenticate with a valid code, then replay the same code.
`PASS` when the second attempt is rejected. Also confirm a code is invalidated after a *failed*
full attempt and cannot be used in a different session.

### V6.6.2 [L2] — out-of-band codes bound to their originating request
Start authentication in session A and in session B. Use A's code in B's session.
`FAIL` if it is accepted — codes must be bound to the request that generated them.

### V6.6.3 [L2] — out-of-band codes rate-limited
Brute-force the code space with Burp Intruder / Turbo Intruder.
`PASS` when attempts are limited per code, per user and per session, and the code is invalidated
after a small number of failures. Confirm the limit is not resettable by requesting a new code —
that is the usual bypass.

---

## V7 — Session Management

### V7.2.4 [L1] — new session token on authentication (session fixation)
```bash
curl -si -c pre.txt  <url>/login   # capture pre-auth session id
# authenticate reusing pre.txt
curl -si -b pre.txt -c post.txt -X POST <url>/login -d '...'
diff <(grep -i session pre.txt) <(grep -i session post.txt)
```
`PASS` when the identifier changes on authentication **and** the pre-auth session is invalidated.
An unchanged id is session fixation — `FAIL`. Re-test on re-authentication and on step-up.

### V7.4.1 [L1] — termination really terminates
Capture an authenticated request, log out, replay it verbatim.
```bash
curl -si -b session.txt <url>/api/<authenticated-endpoint>   # after logout
```
`PASS` on 401/403. A 200 is `FAIL`. With self-contained tokens, check both the access token and the
refresh token — a revoked session whose refresh token still mints new access tokens is `FAIL`.
Repeat for expiry as well as explicit logout.

---

## V8 — Authorization

The highest-value T2 work. **Burp Autorize** automates most of it: log in as `userA`, browse the
whole application, then let Autorize replay every request with `userB`'s and with no credentials.

### V8.2.2 [L1] — data-specific access (IDOR / BOLA)
For every endpoint taking an object identifier, request `userB`'s object as `userA`.
```bash
curl -si -H "Authorization: Bearer $A_TOKEN" <url>/api/orders/<userB_order_id>
```
`PASS` only on 403/404 for every object type. **One accessible object is `FAIL` for the requirement** —
do not average across endpoints. Cover non-obvious identifiers too: exports, attachments, print
views, search filters, bulk endpoints, `include`/`expand` parameters, and identifiers in the body
rather than the path. Try sequential, UUID-guessed and previously-valid-now-deleted ids.

### V8.2.3 [L2] — field-level access (BOPLA)
Two directions, both required:
- **Read** — does the response contain fields this role must not see (`role`, `internalNotes`,
  `salary`, `ssn`, other users' identifiers)? Check `?fields=`/`?include=`/GraphQL selections.
- **Write** — can a field the client should never set be written? Add `role`, `isAdmin`, `ownerId`,
  `tenantId`, `price`, `status`, `verified` to an update body and re-read the object.
```bash
curl -si -X PATCH -H "Authorization: Bearer $A_TOKEN" -H 'Content-Type: application/json' \
     -d '{"name":"x","role":"admin","ownerId":"<userB>"}' <url>/api/users/<userA_id>
```
`FAIL` if the privileged field is persisted, even when the response does not echo it — always
re-read. (The code-side counterpart is V15.3.3.)

### V8.3.2 [L3] — authorization changes apply immediately
Revoke a role or permission while a session/token is live, then replay a request that needed it.
`PASS` when it is refused promptly. With self-contained tokens there is an inherent window until
expiry — `PASS` requires a documented mitigating control (short lifetimes plus introspection, a
revocation list, or alerting and reversal), which the requirement names explicitly.

### V8.4.1 [L2] — cross-tenant isolation
As a user in tenant 1, attempt every operation against tenant 2's identifiers — direct ids, tenant
headers, tenant path segments, subdomain swaps, and bulk/report/export endpoints. Any leakage or
mutation across tenants is `FAIL`. Single-tenant application → `N_A`.

---

## V10 — OAuth

### V10.4.2 [L1] — authorization code single-use
Capture a `code` at the redirect, exchange it, then exchange the identical code again.
```bash
curl -si -X POST <as>/token -d 'grant_type=authorization_code' -d "code=$CODE" \
     -d "client_id=$CID" -d "redirect_uri=$RURI" -d "code_verifier=$VERIFIER"
```
`PASS` when the second exchange fails **and** tokens issued from the first are revoked. Acceptance
of a replayed code is `FAIL`. Other authorization-server settings are T3 — verify them from the
IdP configuration rather than by attack.

---

## V12 — Secure Communication

One tool covers V12.1.1, V12.1.2, V12.1.4, V12.2.1 and V12.2.2:
```bash
testssl.sh --protocols --cipher-per-proto --headers --vulnerable --severity LOW <host>:443
# or
sslyze --regular <host>:443
```

| Req | `PASS` requires | `FAIL` on |
| --- | --------------- | --------- |
| V12.1.1 [L1] | TLS 1.2 and/or 1.3 only, 1.3 preferred | SSLv3, TLS 1.0, TLS 1.1 enabled |
| V12.1.2 [L2] | Recommended suites, strongest preferred; **forward secrecy only at L3** | RC4, 3DES, CBC-mode legacy suites, NULL/EXPORT, static RSA key exchange at L3 |
| V12.1.4 [L3] | OCSP stapling enabled (`testssl.sh` reports "OCSP stapling: offered") | Not offered |
| V12.1.5 [L3] | Encrypted Client Hello enabled | ECH absent |
| V12.2.1 [L1] | TLS on every external-facing endpoint, no plaintext fallback | A listener serving the application over plain HTTP |
| V12.2.2 [L1] | Publicly trusted certificate, valid chain, correct hostname, not expired | Self-signed or private CA on an external-facing service; name mismatch; missing intermediates |

Test **every** external hostname — app, API, auth, static/CDN, WebSocket, admin. One weak host is
`FAIL` for the requirement; name it in `note`.

---

## V13 — Unintended Information Leakage

`nuclei -t http/exposures/ -u <url>` covers much of this; verify hits by hand.

| Req | Probe | `FAIL` on |
| --- | ----- | --------- |
| V13.4.1 [L1] | `curl -si <url>/.git/HEAD` ; also `/.git/config`, `/.svn/entries`, `/.hg/`, `/.DS_Store`, `/.env`, `/.well-known/security.txt` | Any 200 with real content — `/.git/` is full source disclosure |
| V13.4.3 [L2] | `curl -si <url>/assets/` `<url>/uploads/` `<url>/static/` | An index listing where none is intended |
| V13.4.4 [L2] | `curl -si -X TRACE <url>` | Anything other than 405/501; a 200 echoing the request |
| V13.4.5 [L2] | Probe `/docs`, `/swagger`, `/openapi.json`, `/api-docs`, `/graphql`, `/graphiql`, `/metrics`, `/actuator/**`, `/health/detail`, `/debug/pprof`, `/.well-known/*` | Reachable unauthenticated when not explicitly intended. A health endpoint returning versions or dependency state is also V13.4.6 |
| V13.4.6 [L3] | `curl -sI <url> \| grep -iE 'server\|x-powered-by\|x-aspnet\|x-generator'`; plus error-page banners and version strings in JS bundles | Detailed product versions disclosed |
| V13.4.7 [L3] | `ffuf -u <url>/FUZZ -w extensions.txt` for `.bak .old .orig .swp .config .yml .sql .log .zip ~` | Any non-served extension returned |

---

## V14 — Data Protection

### V14.2.5 [L3] — web cache deception
Request an authenticated page with an appended fake static path/extension, then fetch the same URL
unauthenticated and see whether the cache serves the first user's content.
```bash
curl -si -b session.txt '<url>/account/profile/nonexistent.css'
curl -si                '<url>/account/profile/nonexistent.css'   # second request: no session
```
`PASS` when the origin returns 404/302 for the non-existent path and the response is not cached.
Serving the profile — and then serving it again to an anonymous request — is `FAIL`. Repeat with
`.js`, `.jpg`, `.json` and a trailing `;.css`, and check `X-Cache`/`Age`/`CF-Cache-Status`.

---

## V17 — WebRTC (11 T2)

`N_A` unless the application operates TURN, media or signaling servers. If it does:

| Req | Test |
| --- | ---- |
| V17.1.1 [L2] | Allocate a TURN relay and request connections to reserved ranges (RFC 1918, loopback, link-local `169.254/16`, multicast, `::1`, `fc00::/7`). Any relay to a reserved address is `FAIL` — the TURN server is an SSRF proxy into the internal network |
| V17.1.2 [L3] | Open a large number of allocations/ports from authorized users; `FAIL` on exhaustion or loss of service |
| V17.2.2 [L2] | Enumerate DTLS versions, cipher suites and the DTLS-SRTP protection profile; weak or legacy suites are `FAIL` |
| V17.2.3 [L2] | Inject RTP into an established session without valid SRTP authentication; acceptance is `FAIL` |
| V17.2.4 [L2] | Fuzz malformed SRTP packets; a crash or stall is `FAIL` |
| V17.2.5 [L3] | Flood SRTP from legitimate users; loss of service is `FAIL` |
| V17.2.6 [L3] | Check the media server against the DTLS `ClientHello` race condition, by version or by test |
| V17.2.7 [L3] | Same flood while recording is active |
| V17.2.8 [L3] | Present a DTLS certificate whose fingerprint does not match the SDP `a=fingerprint`; the stream must terminate |
| V17.3.1 [L2] | Flood signaling messages; `PASS` requires signaling-level rate limiting that keeps legitimate traffic flowing |
| V17.3.2 [L2] | Send malformed signaling messages (oversized, truncated, integer edge cases); a crash is `FAIL` |
