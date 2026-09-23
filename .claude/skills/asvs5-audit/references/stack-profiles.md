# Stack Profiles

The ASVS requirements are stack-independent; only the *evidence locations* change. Profile the
stack first, then read `tier1-code-review.md` with the right dialect in hand.

Record the detected profile in the report's **Stack** metadata field. Two runs are only comparable if they
profiled the same stack, and a reader needs to know which grep dialect produced the evidence.

## 1. Detect

```bash
ls package.json requirements.txt pyproject.toml Pipfile pom.xml build.gradle build.gradle.kts \
   go.mod Cargo.toml composer.json Gemfile *.csproj *.sln mix.exs pubspec.yaml 2>/dev/null
```

| Marker | Ecosystem | Typical server frameworks |
| ------ | --------- | ------------------------- |
| `package.json` | Node / TypeScript | Express, Fastify, NestJS, Koa, Hapi, Next.js, Remix |
| `requirements.txt`, `pyproject.toml`, `Pipfile` | Python | Django, Flask, FastAPI, Starlette, Pyramid |
| `pom.xml`, `build.gradle` | JVM | Spring Boot, Quarkus, Micronaut, Jakarta EE, Ktor |
| `*.csproj`, `*.sln` | .NET | ASP.NET Core, Minimal APIs |
| `go.mod` | Go | net/http, Gin, Echo, Fiber, Chi |
| `composer.json` | PHP | Laravel, Symfony, Slim |
| `Gemfile` | Ruby | Rails, Sinatra |
| `Cargo.toml` | Rust | Actix, Axum, Rocket |
| `mix.exs` | Elixir | Phoenix |

Multi-service repos have several. Profile each service separately and audit the union — a
requirement is `PASS` only if **every** service satisfies it. Note which service failed.

Also record, because they change many answers:

- **Frontend**: SPA (React/Vue/Angular/Svelte/Web Components), server-rendered templates, mobile, or API-only.
  API-only makes most of V3 `N_A`; say so once, in scope, rather than 31 times.
- **Identity**: self-implemented, framework-provided, delegated to an external identity service, or
  mixed. This is the single biggest branch in the audit — it decides how all ~58 authentication and
  authorization requirements get verified. Self-implemented means reading code; delegated means
  reading that service's configuration. See `tier3-manual.md` Group B.
- **Datastore**: SQL, document, KV, none.
- **Edge**: reverse proxy, CDN, WAF, API gateway, service mesh. These frequently *add or strip* the
  headers V3.4 asks about, which is exactly why those items carry `also=T2`.
- **Deployment**: container, serverless, VM, PaaS. Serverless changes V13 and V15.4 substantially.

## 2. Where each control family lives

| Control family | Node | Python | JVM | .NET | Go | PHP | Ruby |
| -------------- | ---- | ------ | --- | ---- | -- | --- | ---- |
| Route table | `app.use/router.*`, `@Controller` | `urls.py`, `@app.route`, `APIRouter` | `@RequestMapping`, `@Path` | `MapGet`, `[Route]` | `mux.Handle`, `r.GET` | `routes/*.php`, `#[Route]` | `config/routes.rb` |
| Response headers | `helmet()`, `res.set` | `SecurityMiddleware`, `@app.after_request` | `SecurityFilterChain`, `HttpSecurity.headers` | `UseHsts`, `UseSecurityHeaders` | middleware `w.Header().Set` | `Middleware`, `header()` | `config.action_dispatch.default_headers` |
| Session / cookies | `express-session`, `cookie-session` | `SESSION_COOKIE_*` settings | `server.servlet.session.cookie.*` | `CookieAuthenticationOptions` | `http.Cookie` | `session.cookie_*`, `config/session.php` | `config.session_store` |
| Query layer | `pg`, Prisma, TypeORM, Mongoose | ORM, `psycopg`, SQLAlchemy | JPA, JDBC, MyBatis | EF Core, Dapper | `database/sql`, sqlx | Eloquent, Doctrine, PDO | ActiveRecord |
| Templating / output | JSX, `innerHTML`, Handlebars | Jinja2, DTL | Thymeleaf, JSP | Razor | `html/template` | Blade, Twig | ERB |
| Validation | Zod, Joi, `class-validator` | pydantic, marshmallow, forms | Bean Validation | DataAnnotations, FluentValidation | `validator` tags | FormRequest, Assert | strong params |
| Config / secrets | `process.env`, config module | `settings.py`, `os.environ` | `application.yml` | `appsettings.json` | `os.Getenv` | `.env`, `config/*` | `credentials.yml.enc` |
| Logging | pino, winston | `logging` | SLF4J/Logback | `ILogger` | `slog`, zap | Monolog | `Rails.logger` |
| Error handling | error middleware | exception handlers | `@ControllerAdvice` | exception middleware | recover middleware | Handler | `rescue_from` |
| Crypto | `node:crypto` | `cryptography`, `hashlib` | JCA | `System.Security.Cryptography` | `crypto/*` | `sodium`, `openssl` | `OpenSSL` |

## 2b. CMS and opinionated frameworks

When the application is built on a CMS or a batteries-included framework, most controls are
*configuration*, not code. Audit the configuration and the custom extensions — the core is upstream
code you did not write and cannot fix, so a core CVE is a V15.2.1 finding, not a V1 finding.

| Stack | Where the answers are | Watch for |
| ----- | --------------------- | --------- |
| **Drupal** | `settings.php` (trusted_host_patterns, `$settings['update_free_access']`, reverse-proxy), `services.yml` (session cookie, CORS), `core/modules/user` permissions grid, `composer.json`/`composer.lock`, `/admin/reports/status`, `/admin/modules` | `drush pm:security` for V15.2.1. Custom modules are where injection lives — grep `db_query`, `\Drupal::database()->query`, `->fetchAll` for concatenation, and `#markup`, `Markup::create` or a `raw` filter in Twig for V1.2.1. `/admin` reachable unauthenticated is V13.4.5. File permissions on `sites/default/files` for V5.3.1 |
| **WordPress** | `wp-config.php` (salts, `DISALLOW_FILE_EDIT`, `WP_DEBUG`), roles/capabilities, plugin and theme inventory | `wpscan` for V15.2.1. `$wpdb->query` without `prepare()` is V1.2.4. Missing `check_admin_referer`/nonces is V3.5.1. `/wp-json/wp/v2/users` enumeration is V6.3.8 |
| **Spring Boot** | `application.yml`/`.properties`, `SecurityFilterChain` config, `@PreAuthorize` coverage, actuator exposure | `management.endpoints.web.exposure.include` is V13.4.5. `.csrf().disable()` is V3.5.1 unless the API is token-only. `permitAll()` matchers are V8.2.1. `mvn dependency-check` for V15.2.1 |
| **Laravel / Symfony** | `config/*.php`, `.env`, middleware groups, `security.yaml`, voters/policies | `APP_DEBUG=true` in prod is V13.4.2. `$fillable`/`$guarded` and `->fill($request->all())` are V15.3.3. `{!! !!}` in Blade is V1.2.1 |
| **Rails** | `config/environments/production.rb`, `config/initializers/*`, `strong_parameters`, Pundit/CanCan | `brakeman` covers much of V1 and V15.3. `html_safe`/`raw` is V1.2.1. `protect_from_forgery` is V3.5.1 |
| **Django** | `settings.py` (`DEBUG`, `ALLOWED_HOSTS`, `SECURE_*`, `SESSION_COOKIE_*`, `CSRF_*`), permission classes | `python manage.py check --deploy` answers a dozen V3.3/V3.4/V13.4 items in one command — run it first |
| **.NET** | `appsettings.json`, `Program.cs` middleware order, `[Authorize]` coverage, Data Protection key ring | Middleware **order** matters: authorization registered after the endpoint is V8.2.1 |

For any of these, the rule stands: a control the platform provides still has to be *verified as
enabled*. "Framework X handles CSRF" is not evidence; the configuration line that enables it is.

## 2c. When the stack is not listed

The tables above are conveniences, not the scope. Clojure, Scala, Haskell, Perl, Erlang, Dart,
Kotlin Multiplatform, Salesforce Apex, ABAP, ServiceNow, a low-code platform, an embedded system,
a mobile-only app — none are listed, and all are auditable. ASVS requirements describe **controls**,
not syntax.

**Most of the audit needs no language knowledge at all.** All 47 T2 requirements are HTTP, TLS and
protocol-level. Nearly all 121 T3 requirements are documentation, configuration and process. That
is **168 of 345** — roughly half the standard, and more than half of an L2 scope — verifiable on a
stack you have never seen.

For the T1 half, derive the patterns instead of looking them up:

1. **Find the six anchors.** Every server-side stack has them, whatever it calls them: the
   dependency manifest, the request entry points, the data-access layer, the output/rendering layer,
   the configuration source, and the authentication layer. Locate those six files or packages first;
   everything in `tier1-code-review.md` hangs off them.
2. **Read a control's "Control:" line, not its pattern list.** The patterns are examples of that
   control in seven ecosystems. "All queries are parameterized" is the requirement; how the stack
   spells it is a detail you can find in its own documentation or by reading one example.
3. **Let the codebase teach you the idiom.** Find one known-correct instance — one parameterized
   query, one authorization check, one template render — then search for the shape of it and for
   everything that deviates. Deviations are where findings live.
4. **Use language-agnostic tooling.** Secret scanning works on any repo. So does reviewing the
   dependency manifest against a vulnerability database, even by hand. `semgrep` supports many
   languages beyond those tabled, and its generic pattern mode works on anything.
5. **Say what you did.** Put "search patterns derived for <stack>; no tabled profile" in the
   report's **Tooling used** field. A reader then knows the T1 evidence came from first principles,
   and the next run can reuse it.

If a control genuinely has no analogue in the stack — no HTML rendering in a pure message consumer,
no cookies in a CLI-driven service — that is `N_A` with the reason, exactly as §4 describes. It is
not `N_A` because the ecosystem is unfamiliar.

## 3. Local tooling per ecosystem (T1)

| Purpose | Node | Python | JVM | .NET | Go | PHP | Ruby |
| ------- | ---- | ------ | --- | ---- | -- | --- | ---- |
| Vulnerable deps (V15.2.1) | `npm audit --audit-level=high` / `pnpm audit` / `yarn npm audit` | `pip-audit` / `safety check` | `mvn org.owasp:dependency-check-maven:check` / `gradle dependencyCheckAnalyze` | `dotnet list package --vulnerable --include-transitive` | `govulncheck ./...` | `composer audit` | `bundle audit` |
| SBOM (V15.1.2) | `npm sbom --sbom-format cyclonedx` | `cyclonedx-py` | `cyclonedx-maven-plugin` | `dotnet CycloneDX` | `cyclonedx-gomod` | `cyclonedx-php` | `cyclonedx-ruby` |
| Static analysis | `eslint-plugin-security`, `semgrep` | `bandit`, `semgrep` | `spotbugs`+`find-sec-bugs`, `semgrep` | `security-code-scan`, `semgrep` | `gosec`, `staticcheck` | `psalm`/`phpstan`, `semgrep` | `brakeman` |

Ecosystem-independent:

- **Secret scanning (V13.3.1)** — `gitleaks detect` or `trufflehog git file://.`; both scan history,
  which is the part that matters.
- **Registry provenance (V15.2.4)** — the lockfile plus the registry config: `.npmrc`, `pip.conf`,
  `settings.xml`, `NuGet.config`, `GOPROXY`/`GONOSUMDB`, `composer.json` repositories, `Gemfile` source.

**`semgrep --config=p/owasp-top-ten --config=p/secrets` covers every ecosystem above** and is the
single best T1 accelerator when available. Its output is evidence; paste the rule id and location.

Absence of a tool is not a `PASS`. If `npm audit` cannot run, V15.2.1 is `NOT_TESTED`, not `PASS`.

## 4. Chapters that commonly go N/A

Decide these once during scoping and record the justification once:

| Chapter / section | `N_A` when | Do **not** mark N/A because |
| ----------------- | ---------- | --------------------------- |
| V1.4 (memory safety) | Managed runtime with no native modules/FFI/unsafe blocks | "It's probably fine" — check for native addons, JNI, `unsafe`, cgo, P/Invoke first |
| V1.2.6–V1.2.8 (LDAP/XPath/LaTeX) | No such processor in the dependency tree | You didn't look at transitive deps |
| V3 (most) | API-only service with no browser client | A browser client exists but is a separate repo — then it is out of *this* audit's scope, which is a scope note, not N/A |
| V4.3 (GraphQL) | No GraphQL endpoint | A GraphQL endpoint exists but is undocumented |
| V4.4 (WebSocket) | No WebSocket/SSE endpoint | Long-polling exists — that's V4.1, still in scope |
| V5 (File Handling) | No upload **and** no download of user-influenced files | Uploads go to a third party — you still own validation of what you accept |
| V6, V10 | Never fully N/A if users authenticate. Delegated ≠ absent: the *configuration* is still in scope | "Our identity provider handles it" — that is a verification you still have to perform, not an exemption |
| V11 (Cryptography) | App performs no crypto of its own, all delegated to TLS/IdP/DB | You found `crypto` imports and skipped them |
| V17 (WebRTC) | No TURN/media/signaling server | — |

## 5. Record what you found

Write the detected profile into the report's **Stack** field as a single line — ecosystem,
framework, frontend kind, identity architecture, datastore, edge, deployment. For example:

```
Python 3.12 / Django 5 · server-rendered templates · self-implemented auth · PostgreSQL · nginx + Cloudflare · containers
Java 21 / Spring Boot 3 · API-only · delegated identity · Oracle · API gateway · Kubernetes
PHP 8.3 / Drupal 11 · CMS · framework auth + SSO module · MariaDB · Varnish + nginx · VMs
```

This is not decoration. A reader needs it to interpret every piece of evidence in the report, and
a later run needs it to know whether the two are comparable. If the stack line changed between runs,
say so in the delta — a score movement may be a migration, not a fix.

Nothing else about the project is assumed, recorded or required. This skill verifies ASVS
requirements; it holds no opinion about how the application should be built.
