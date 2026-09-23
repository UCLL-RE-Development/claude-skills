# Tier 3 — Manual Verification (121 requirements)

Needs a human: a document to read, a configuration console to open, a process to confirm, or a
judgement about business logic. No grep and no scanner will answer these.

Four kinds of work, each with its own discipline:

| Group | What it is | Count |
| ----- | ---------- | ----- |
| **A. Documentation** | "Verify that the documentation defines…" — the artifact either exists or it does not | ~35 |
| **B. Authentication & authorization configuration** | Settings in whatever issues and validates credentials | ~58 |
| **C. Process & operations** | Key management, log handling, secret rotation, network policy, least privilege | ~20 |
| **D. Business-logic judgement** | Requires understanding what the application is *for* | ~8 |

---

## The rule that decides most of these

> **A missing document is `FAIL`, not `NOT_TESTED`.**

`NOT_TESTED` means *you could not check*. If you looked for the documentation and it does not
exist, you checked and the answer is no. ASVS states these as requirements precisely because an
undocumented control cannot be verified, operated or handed over.

Use `NOT_TESTED` only when access is the blocker: no admin console, no ops contact, no answer yet.
Record in `note` exactly what you need, so the next run can close it.

---

## Group A — Documentation requirements

Each of these asks for a written artifact. Look in `docs/`, the wiki, ADRs, the README, Confluence,
the threat model. For each: does it exist, is it current, is it specific enough to verify against?

Score `PASS` only when the document is **specific and current**. A generic policy that says
"inputs shall be validated" does not define validation rules — that is `PARTIAL` at best.
Record the document path or URL in `evidence`.

| Req | L | The document must define |
| --- | - | ------------------------ |
| V2.1.1 | 1 | Input validation rules — expected structure per data item (formats, internal formats) |
| V2.1.2 | 2 | How combined data items are checked for logical/contextual consistency |
| V2.1.3 | 2 | Business logic limits and validations, per-user and global |
| V3.1.1 | 3 | Browser security features the app requires (HTTPS, HSTS, CSP), and the behaviour when absent |
| V5.1.1 | 2 | Permitted file types, extensions, max size (including unpacked), and how files are made safe |
| V6.1.1 | 1 | How rate limiting, anti-automation and adaptive response defend against credential stuffing and brute force — including how malicious account lockout is prevented |
| V6.1.2 | 2 | The context-specific word list banned from passwords (org, product, system, project, department names) |
| V6.1.3 | 2 | Every authentication pathway, with the controls and strength enforced on each |
| V7.1.1 | 2 | Inactivity timeout and absolute session lifetime, with justification for deviations from NIST SP 800-63B |
| V7.1.2 | 2 | How many concurrent sessions per account, and what happens at the limit |
| V7.1.3 | 2 | All systems creating/managing sessions in the federated ecosystem, and how lifetimes and termination are coordinated |
| V8.1.1 | 1 | Function-level and data-specific access rules, by consumer permission and resource attribute |
| V8.1.2 | 2 | Field-level read and write restrictions, including state-dependent rules |
| V8.1.3 | 3 | Environmental/contextual attributes used in security decisions (time, location, IP, device) |
| V8.1.4 | 3 | How those factors feed decisions — attributes, risk thresholds, and actions (allow/challenge/deny/step-up) |
| V11.1.1 | 2 | Key management policy and lifecycle against a standard such as NIST SP 800-57, including that keys are not overshared |
| V11.1.2 | 2 | Cryptographic inventory — every key, algorithm and certificate, where each may and may not be used, and what data each may protect |
| V11.1.3 | 3 | Crypto discovery mechanisms that find all encryption, hashing and signing in the system |
| V11.1.4 | 3 | A maintained inventory plus a migration path to new standards, including post-quantum |
| V13.1.1 | 2 | All communication needs — external services relied upon, and any case where a user supplies a destination |
| V13.1.2 | 3 | Max concurrent connections per service and behaviour at the limit |
| V13.1.3 | 3 | Resource-management strategy per external system: release, timeouts, failure handling, retry limits/delays/back-off |
| V13.1.4 | 3 | Which secrets are security-critical and their rotation schedule |
| V14.1.1 | 2 | All sensitive data identified and classified into protection levels — including merely-encoded data such as Base64 and JWT payloads — taking applicable privacy regulation into account |
| V14.1.2 | 2 | Per protection level: encryption, integrity, retention, logging rules, access control over logs, database encryption, privacy technologies |
| V15.1.1 | 1 | Risk-based remediation time frames for vulnerable third-party components, and for updating libraries generally |
| V15.1.3 | 2 | Time-consuming / resource-demanding functionality, and how availability is protected |
| V15.1.4 | 3 | Which third-party libraries are considered "risky components" |
| V15.1.5 | 3 | Where "dangerous functionality" is used in the application |
| V16.1.1 | 2 | Logging inventory per stack layer: what is logged, formats, storage, use, access control, retention |

Two documentation items sit outside this table because they pair with an implementation check:
**V2.3.2** (limits implemented *per the documentation*) and **V14.2.4** (controls implemented *per
the documentation*) — both `FAIL` automatically if the corresponding document does not exist, since
there is nothing to implement against.

---

## Group B — Authentication and authorization configuration

**First, establish where the controls actually live.** This one fact determines how you verify all
~58 requirements below, and it is the most common thing an ASVS audit gets wrong.

| Architecture | Where the answer is | How to verify |
| ------------ | ------------------- | ------------- |
| **Self-implemented** — the application owns the credential store and the login flow | The repo | **Read the code.** Password policy, lockout, reset flow, MFA, token issuance are all in source. Put the `file:line` in `Evidence` |
| **Framework-provided** — an auth package with its own settings | Config files in the repo | Read the configuration *and* confirm it is applied. A default you never set is still your setting |
| **Delegated to an external identity service** | That service's configuration | Export the config, or open the console. Not the repo |
| **Mixed** — e.g. delegated login plus a local API-key path | Both | Audit **both**, and score the weakest. A second credential path is also V6.3.4 |

### If identity is self-implemented or framework-provided

These become code review. The catalog marks them T3 because delegation is the common case — that
tier is a **routing hint, not a constraint**. Verifying by reading source is cheaper and stronger,
so do that, record the `file:line`, and note the architecture in the report's **Stack** field so a
reader understands why V6 evidence is all file references.

Leave the `Tier` column as the skeleton has it. It is pre-filled so rows line up between runs; the
verification method belongs in `Evidence`, not in a rewritten column.

### If identity is delegated

> **Get a configuration export first.** Most identity services can dump their configuration as
> text — a realm, tenant, directory-policy or client export. That turns ~30 of these from
> console-clicking into reviewable text you can diff between runs, and makes the evidence
> reproducible instead of a screenshot. Ask for it during scoping; it is the highest-leverage input
> to this audit.
>
> Look for an admin CLI, a management API, or a Terraform/Pulumi/Ansible definition of the identity
> configuration. Infrastructure-as-code is the best case — the configuration is already in a repo,
> already versioned, and already diffable.
>
> If neither an export nor console access is available, these are `NOT_TESTED` — record which access
> you need so the next run can close it. Never assume a vendor default is correct: defaults change
> between versions and most are tuned for easy onboarding, not for L2.

Whichever architecture applies, the requirement text is unchanged — only where you look changes.
Read each row below as "verify that this is true", not "verify that this console checkbox is set".

### B1 — Password policy (V6.2.1–V6.2.12)

| Req | L | Setting to verify |
| --- | - | ----------------- |
| V6.2.1 | 1 | Minimum length ≥ 8 (15 strongly recommended) |
| V6.2.2 | 1 | Users can change their own password |
| V6.2.3 | 1 | Password change requires the current password |
| V6.2.4 | 1 | New passwords checked against at least the top 3000 matching the policy |
| V6.2.5 | 1 | **No composition rules** — no required upper/lower/digit/special. Enabled complexity rules are a `FAIL`, which surprises people; ASVS 5.0 follows NIST here |
| V6.2.6 | 1 | Password fields masked, with an optional reveal |
| V6.2.7 | 1 | Paste, browser helpers and password managers permitted — no `autocomplete="off"`, no paste blocking |
| V6.2.8 | 1 | Password verified exactly as submitted — no truncation, no case folding, no trimming |
| V6.2.9 | 2 | At least 64 characters permitted |
| V6.2.10 | 2 | **No periodic forced rotation.** A 90-day expiry policy is a `FAIL` |
| V6.2.11 | 2 | The V6.1.2 context word list actually enforced |
| V6.2.12 | 2 | Breached-password check (HIBP or equivalent) at registration and change |

### B2 — General authentication (V6.3.1–V6.3.7)

| Req | L | Verify |
| --- | - | ------ |
| V6.3.1 | 1 | Brute-force / credential-stuffing controls enabled and configured as V6.1.1 documents |
| V6.3.2 | 1 | No default accounts present or enabled — review the user list, including service and break-glass accounts |
| V6.3.3 | 2 | MFA, or a documented combination of single factors, required for access. At L3 one factor must be phishing-resistant hardware (FIDO2/WebAuthn) with a user-initiated action |
| V6.3.5 | 3 | Users notified of suspicious attempts — new location/client, partial MFA success, success after failures, long inactivity |
| V6.3.6 | 3 | **Email not used as an authentication factor** — magic links and email OTP are a `FAIL` at L3 |
| V6.3.7 | 3 | Users notified after credential, username or email changes |

### B3 — Factor lifecycle and recovery (V6.4.1–V6.4.6)

| Req | L | Verify |
| --- | - | ------ |
| V6.4.1 | 1 | Initial passwords / activation codes randomly generated, policy-compliant, short-lived, single-use, and cannot become the long-term password |
| V6.4.2 | 1 | No password hints and no knowledge-based "secret questions" |
| V6.4.3 | 2 | Password reset does not bypass MFA |
| V6.4.4 | 2 | Losing a factor requires identity proofing at enrollment strength |
| V6.4.5 | 3 | Expiring mechanisms send renewal reminders with enough lead time |
| V6.4.6 | 3 | Admins can trigger a reset but cannot set or learn the user's password |

### B4 — Multi-factor mechanics (V6.5.2–V6.5.8, V6.6.1, V6.6.4)

| Req | L | Verify |
| --- | - | ------ |
| V6.5.2 | 2 | Stored lookup secrets below 112 bits of entropy hashed with an approved password hash and a 32-bit salt |
| V6.5.3 | 2 | Lookup secrets, OOB codes and TOTP seeds from a CSPRNG |
| V6.5.4 | 2 | Lookup secrets and OOB codes ≥ 20 bits of entropy |
| V6.5.5 | 2 | Lifetimes bounded — OOB requests ≤ 10 minutes, TOTP ≤ 30 seconds |
| V6.5.6 | 3 | Any factor, including a physical device, can be revoked on loss or theft |
| V6.5.7 | 3 | Biometrics only as a secondary factor alongside possession or knowledge |
| V6.5.8 | 3 | TOTP validated against a trusted time source, never client-supplied |
| V6.6.1 | 2 | PSTN/SMS OTP only for previously validated numbers, with stronger alternatives offered and risks disclosed. **At L3, phone and SMS must not be available at all** |
| V6.6.4 | 3 | Push-notification MFA rate-limited against push bombing; number matching preferred |

### B5 — Cryptographic authentication (V6.7.1–V6.7.2)

| Req | L | Verify |
| --- | - | ------ |
| V6.7.1 | 3 | Certificates used to verify authentication assertions are stored so they cannot be modified |
| V6.7.2 | 3 | Challenge nonce ≥ 64 bits, statistically unique or unique over the device lifetime |

### B6 — Session behaviour owned by the IdP or the admin UI (V7.4.2, V7.4.3, V7.4.5, V7.5.1–V7.5.3, V7.6.1)

| Req | L | Verify |
| --- | - | ------ |
| V7.4.2 | 1 | Disabling or deleting an account terminates all its active sessions — test it, do not assume |
| V7.4.3 | 2 | After a credential or MFA change, the user is offered termination of all other sessions |
| V7.4.5 | 2 | Administrators can terminate sessions for one user or for all users |
| V7.5.1 | 2 | Full re-authentication required before changing email, phone, MFA settings or recovery data |
| V7.5.2 | 2 | Users can view their active sessions and terminate any or all, after re-authenticating with at least one factor |
| V7.5.3 | 3 | Step-up authentication before highly sensitive transactions |
| V7.6.1 | 2 | Session lifetime and termination between relying party and IdP behave as documented, including forced re-authentication at the maximum interval |

### B7 — Authorization server / OpenID Provider (V10.4.*, V10.6.*, V10.7.*)

Verified from the AS configuration, per client.

| Req | L | Verify |
| --- | - | ------ |
| V10.4.1 | 1 | Redirect URIs validated against a per-client allowlist by **exact string comparison** — any wildcard, prefix match or open path segment is `FAIL` |
| V10.4.3 | 1 | Authorization code lifetime ≤ 10 minutes (≤ 1 minute at L3) |
| V10.4.4 | 1 | Only the grants a client needs are enabled. **Implicit (`token`) and Resource Owner Password Credentials (`password`) must be disabled** |
| V10.4.5 | 1 | Refresh-token replay mitigated for public clients — sender-constraining preferred; rotation acceptable at L1/L2 only if the used token is invalidated and reuse revokes the whole chain |
| V10.4.6 | 2 | PKCE required for the code grant; `code_challenge` mandatory; `plain` rejected; `code_verifier` validated |
| V10.4.7 | 2 | Unauthenticated dynamic client registration either disabled, or metadata validated with explicit user consent and warning |
| V10.4.8 | 2 | Refresh tokens have an absolute expiration even with sliding renewal |
| V10.4.9 | 2 | Users can revoke refresh and reference tokens through the AS UI |
| V10.4.10 | 2 | Confidential clients authenticate on backchannel requests (token, PAR, revocation) |
| V10.4.11 | 2 | Only required scopes assigned per client |
| V10.4.12 | 3 | `response_mode` restricted per client |
| V10.4.13 | 3 | Code grant always paired with Pushed Authorization Requests |
| V10.4.14 | 3 | Only sender-constrained tokens issued (mTLS-bound or DPoP) |
| V10.4.15 | 3 | `authorization_details` provably from the client backend (PAR or JAR) |
| V10.4.16 | 3 | Strong client authentication — `tls_client_auth`, `self_signed_tls_client_auth` or `private_key_jwt`. A client secret is `FAIL` at L3 |
| V10.6.1 | 2 | Response modes limited to `code`, `ciba`, `id_token`, or `id_token code`; `token` (implicit) disabled |
| V10.6.2 | 2 | Forced-logout DoS mitigated by explicit user confirmation or `id_token_hint` validation |
| V10.7.1 | 2 | User consent obtained per authorization request; always prompted when client identity is not assured |
| V10.7.2 | 2 | Consent screen states the authorizations requested, the application identity, and the lifetime |
| V10.7.3 | 2 | Users can review, modify and revoke granted consents |

### B8 — Password storage (V11.4.2)
Verify the IdP's (or your own) password hashing algorithm and parameters: Argon2id, scrypt, bcrypt
or PBKDF2 with current-guidance parameters. Record the algorithm **and its cost parameters** — a
correct algorithm with 2010-era parameters is `PARTIAL`. Legacy unsalted or fast hashes are `FAIL`.

---

## Group C — Process and operations

Answered by the platform/ops team, the infrastructure-as-code repo, or the cloud console. Ask for
evidence — a Terraform file, a policy document, a console screenshot — not an assurance.

| Req | L | Verify |
| --- | - | ------ |
| V3.5.4 | 2 | Separate applications on separate hostnames, so same-origin policy and host-scoped cookies actually isolate them. Multiple apps under one hostname on different paths is `FAIL` |
| V3.7.4 | 3 | The top-level domain is on the HSTS preload list — check `hstspreload.org` and the `preload` directive |
| V5.4.3 | 2 | Files from untrusted sources scanned by antivirus before being served |
| V11.5.2 | 3 | The RNG remains secure under heavy demand — entropy source, no blocking-to-weak fallback, container/VM entropy at boot |
| V11.7.1 | 3 | Full memory encryption protects data in use (confidential computing, SEV/TDX/SGX) |
| V11.7.2 | 3 | Data minimization during processing; data re-encrypted immediately after use |
| V12.3.3 | 2 | TLS (or equivalent) on all internal service-to-service HTTP, with no plaintext fallback. This is the ops-side counterpart to V12.3.1 |
| V12.3.4 | 2 | Internal TLS uses trusted certificates; self-signed or internal CAs pinned to specific trusted CAs, not blanket trust |
| V12.3.5 | 3 | Strong mutual authentication between internal services — mTLS/PKI resistant to replay; a service mesh is the usual answer |
| V13.2.2 | 2 | Backend components run with least privilege — database roles, cloud IAM, OS accounts. A single superuser DB account for the app is `FAIL` |
| V13.2.4 | 2 | An allowlist defines the external resources the application may reach (egress policy at app, server, firewall or mesh layer) |
| V13.2.5 | 2 | The web/application server itself is restricted to an allowlist of destinations it can request or load from |
| V13.3.2 | 2 | Access to secrets follows least privilege — who and what can read each secret |
| V13.3.3 | 3 | Cryptographic operations performed inside an isolated module (HSM, KMS, vault) so key material never leaves it |
| V13.3.4 | 3 | Secrets configured to expire and rotate on the V13.1.4 schedule — and evidence that rotation has actually happened |
| V14.2.7 | 3 | Retention classification enforced: outdated data deleted automatically or on schedule |
| V15.2.5 | 3 | Extra protection around documented dangerous functionality and risky components — sandboxing, containerization, network isolation |
| V16.4.2 | 2 | Logs protected from unauthorized access and from modification — append-only or WORM storage, restricted read access |
| V16.4.3 | 2 | Logs transmitted securely to a logically separate system, so a breach of the app does not compromise its logs |
| V17.2.1 | 2 | DTLS certificate keys managed under the V11.1.1 key policy |

---

## Group D — Business-logic judgement

Requires understanding what the application is for. Read the documentation from Group A, walk the
flows, and reason about abuse. Where the flow can also be exercised, confirm with T2 — but the
judgement of *what should be allowed* is the requirement.

| Req | L | Verify |
| --- | - | ------ |
| V2.3.1 | 1 | Flows process only in the expected sequential order for the same user, with no step skipping. Identify every multi-step flow, then try to reach step 3 without step 2 |
| V2.3.2 | 2 | The limits documented in V2.1.3 are actually enforced — per-user and global. Undocumented limits cannot pass; `FAIL` |
| V2.3.5 | 3 | High-value flows require multi-user approval (large transfers, contract approval, classified access, safety overrides). None in the domain → `N_A` with that note |
| V8.2.4 | 3 | Adaptive controls using environmental/contextual attributes are implemented as V8.1.3–V8.1.4 document, both at session start and during a session |
| V8.4.2 | 3 | Administrative interfaces use layered security — continuous identity verification, device posture, contextual risk. Network location alone must not be the authorization basis |
| V14.2.4 | 2 | The protection-level controls documented in V14.1.2 are implemented for each classified data item. No classification → `FAIL`, dependent on V14.1.1 |
| V3.7.3 | 3 | The user is warned, with the option to cancel, before navigating to a URL outside the application's control |
| V3.7.5 | 3 | The application behaves as V3.1.1 documents when the browser lacks an expected security feature |
