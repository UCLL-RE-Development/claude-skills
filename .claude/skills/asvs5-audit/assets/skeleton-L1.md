# ASVS 5.0 Audit Report — <RUN-ID>

> OWASP Application Security Verification Standard **5.0.0** · target level **L1**

<!-- Fill every <…> placeholder. Keep every heading, table, column and row exactly as they
     are: that invariance is what lets two reports be laid side by side, including reports
     from different teams on different stacks. See references/report-spec.md. -->

## Scorecard

Fixed keys in a fixed order, so many reports can be aggregated mechanically:
`awk '/^```/{f=!f;next} f&&$1=="score"{print FILENAME,$2}' */report.md`

```
asvs_version   5.0.0
target_level   L1
run_id         <YYYY-MM-DD>-<revision>
date           <YYYY-MM-DD>
stack          <one line: ecosystem · frontend · identity · datastore · edge · deployment>
scope          70
pass           <n>
fail           <n>
partial        <n>
na             <n>
not_tested     <n>
coverage       <n.n>
score          <n.n>
verified_l1    <yes|no>
open_critical  <n>
open_high      <n>
open_medium    <n>
open_low       <n>
t1_coverage    <n.n>
t2_coverage    <n.n>
t3_coverage    <n.n>
```

## Run

| Field | Value |
| ----- | ----- |
| Run id | <YYYY-MM-DD>-<revision> |
| Date | <YYYY-MM-DD> |
| Target level | L1 |
| Revision | <commit sha, release tag or build id> — <clean, or: uncommitted changes present> |
| Branch | <branch, or a dash if not applicable> |
| Stack | <detected profile — see references/stack-profiles.md §5> |
| Test target | <base URL + environment, or: none — T2 items not testable> |
| Auth architecture | <self-implemented / framework-provided / delegated / mixed> |
| Auditor | <name> |
| Tooling used | <versions of any scanner or analyser used, or: none available> |
| Requirements scored | 70 |

## Scope decisions

<!-- One line per chapter or feature excluded, with the justification. Anything not listed
     here is in scope. -->

- <requirement or chapter> — <why its subject does not exist in this application>

## Verdict

| Level | Certification | Failing | Outstanding | Score | Coverage |
| ----- | ------------- | ------: | ----------: | ----: | -------: |
| L1 | <VERIFIED\|NOT VERIFIED> | <n> | <n> | <n.n%> | <n.n%> |

A level is verified only when **every** in-scope requirement at that level and below is
`PASS` or `N_A`. The score tracks progress between runs; it does not soften the verdict.

**Score <n.n%> at coverage <n.n%>** — <verified> of <applicable> applicable requirements were
actually verified. Read the two numbers together: a high score at low coverage means little.

## Totals

| Status | Count | Share of applicable |
| ---------- | ----: | ------------------: |
| PASS       | <n> | <n.n%> |
| FAIL       | <n> | <n.n%> |
| PARTIAL    | <n> | <n.n%> |
| NOT_TESTED | <n> | <n.n%> |
| N_A        | <n> | excluded |

### Open findings by severity

| Severity | Count |
| -------- | ----: |
| critical | <n> |
| high     | <n> |
| medium   | <n> |
| low      | <n> |

## Coverage by verification tier

Where the audit is thin. High T1 coverage with near-zero T2/T3 means the code was read but
the deployment and the configuration were never checked.

| Tier | Scope | Verified | Coverage | Score | Fail | Partial | N/A |
| ---- | ----: | -------: | -------: | ----: | ---: | ------: | --: |
| T1 code review + local tooling | 37 | <n> | <n.n%> | <n.n%> | <n> | <n> | <n> |
| T2 DAST / testing suites | 11 | <n> | <n.n%> | <n.n%> | <n> | <n> | <n> |
| T3 manual (docs, config, process) | 22 | <n> | <n.n%> | <n.n%> | <n> | <n> | <n> |

## By chapter

`Scope` is fixed for this level — do not change it. The other status columns must sum to it
on every row.

| Chapter | Scope | Pass | Fail | Part | N/A | Not tested | Coverage | Score |
| ------- | ----: | ---: | ---: | ---: | --: | ---------: | -------: | ----: |
| V1 Encoding and Sanitization | 8 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V2 Validation and Business Logic | 4 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V3 Web Frontend Security | 8 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V4 API and Web Service | 2 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V5 File Handling | 4 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V6 Authentication | 13 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V7 Session Management | 6 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V8 Authorization | 4 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V9 Self-contained Tokens | 4 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V10 OAuth and OIDC | 5 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V11 Cryptography | 3 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V12 Secure Communication | 3 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V13 Configuration | 1 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V14 Data Protection | 2 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| V15 Secure Coding and Architecture | 3 | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |
| **Total** | **70** | <n> | <n> | <n> | <n> | <n> | <n.n%> | <n.n%> |

## Open findings

Every `FAIL` and `PARTIAL`, most severe first, then by level, then by requirement id.
Requirement text is repeated here verbatim so the report stands alone for a reader who does
not have the catalog.

| Req | L | Tier | Sev | Status | Requirement | Evidence / note |
| --- | - | ---- | --- | ------ | ----------- | --------------- |
| <V0.0.0> | <L1> | <T1> | <high> | <FAIL> | <verbatim text from references/catalog.csv> | <file:line or command — what is wrong> |

## Not-tested queue

What remains. Not a pass and not a failure — grouped by tier so the blocker is obvious.

### T1 code review + local tooling — <n>

| Req | L | Blocked on |
| --- | - | ---------- |
| <V0.0.0> | <L2> | <the access, tool or answer needed to close it> |

### T2 DAST / testing suites — <n>

| Req | L | Blocked on |
| --- | - | ---------- |
| <V0.0.0> | <L2> | <the access, tool or answer needed to close it> |

### T3 manual (docs, config, process) — <n>

| Req | L | Blocked on |
| --- | - | ---------- |
| <V0.0.0> | <L2> | <the access, tool or answer needed to close it> |

## Scope exclusions (N/A)

Every `N_A` needs a justification. An unjustified exclusion is a coverage gap wearing a pass.

| Req | L | Tier | Justification |
| --- | - | ---- | ------------- |
| <V0.0.0> | <L2> | <T1> | <why this requirement's subject does not exist here> |

## Full results

Every in-scope requirement, in ASVS order. **This table is the machine-readable record** —
`diff` it against another run to see exactly what moved. Requirement text lives in
`references/catalog.csv`; only findings live here.

Status is one of `PASS` `FAIL` `PARTIAL` `N_A` `NOT_TESTED` — no other value.
Tier `T1+T2` means primary T1, confirmable by T2. The tier is a routing hint: if your
architecture lets you verify a row more directly, do that and say so in `Evidence`.

### V1 — Encoding and Sanitization

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V1.2.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V1.2.2  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V1.2.3  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V1.2.4  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V1.2.5  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V1.3.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V1.3.2  | L1 | T1    | NOT_TESTED |     |          |      |
| V1.5.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |

### V2 — Validation and Business Logic

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V2.1.1  | L1 | T3    | NOT_TESTED |     |          |      |
| V2.2.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V2.2.2  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V2.3.1  | L1 | T3+T2 | NOT_TESTED |     |          |      |

### V3 — Web Frontend Security

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V3.2.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V3.2.2  | L1 | T1    | NOT_TESTED |     |          |      |
| V3.3.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V3.4.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V3.4.2  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V3.5.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V3.5.2  | L1 | T2+T1 | NOT_TESTED |     |          |      |
| V3.5.3  | L1 | T1+T2 | NOT_TESTED |     |          |      |

### V4 — API and Web Service

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V4.1.1  | L1 | T2+T1 | NOT_TESTED |     |          |      |
| V4.4.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |

### V5 — File Handling

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V5.2.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V5.2.2  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V5.3.1  | L1 | T2+T1 | NOT_TESTED |     |          |      |
| V5.3.2  | L1 | T1+T2 | NOT_TESTED |     |          |      |

### V6 — Authentication

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V6.1.1  | L1 | T3    | NOT_TESTED |     |          |      |
| V6.2.1  | L1 | T3+T1 | NOT_TESTED |     |          |      |
| V6.2.2  | L1 | T3    | NOT_TESTED |     |          |      |
| V6.2.3  | L1 | T3    | NOT_TESTED |     |          |      |
| V6.2.4  | L1 | T3+T1 | NOT_TESTED |     |          |      |
| V6.2.5  | L1 | T3+T2 | NOT_TESTED |     |          |      |
| V6.2.6  | L1 | T3+T2 | NOT_TESTED |     |          |      |
| V6.2.7  | L1 | T3+T2 | NOT_TESTED |     |          |      |
| V6.2.8  | L1 | T3+T2 | NOT_TESTED |     |          |      |
| V6.3.1  | L1 | T3+T2 | NOT_TESTED |     |          |      |
| V6.3.2  | L1 | T3+T1 | NOT_TESTED |     |          |      |
| V6.4.1  | L1 | T3    | NOT_TESTED |     |          |      |
| V6.4.2  | L1 | T3+T2 | NOT_TESTED |     |          |      |

### V7 — Session Management

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V7.2.1  | L1 | T1    | NOT_TESTED |     |          |      |
| V7.2.2  | L1 | T1    | NOT_TESTED |     |          |      |
| V7.2.3  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V7.2.4  | L1 | T2+T1 | NOT_TESTED |     |          |      |
| V7.4.1  | L1 | T2+T1 | NOT_TESTED |     |          |      |
| V7.4.2  | L1 | T3+T2 | NOT_TESTED |     |          |      |

### V8 — Authorization

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V8.1.1  | L1 | T3    | NOT_TESTED |     |          |      |
| V8.2.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V8.2.2  | L1 | T2+T1 | NOT_TESTED |     |          |      |
| V8.3.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |

### V9 — Self-contained Tokens

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V9.1.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V9.1.2  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V9.1.3  | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V9.2.1  | L1 | T1+T2 | NOT_TESTED |     |          |      |

### V10 — OAuth and OIDC

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V10.4.1 | L1 | T3+T2 | NOT_TESTED |     |          |      |
| V10.4.2 | L1 | T2+T3 | NOT_TESTED |     |          |      |
| V10.4.3 | L1 | T3+T2 | NOT_TESTED |     |          |      |
| V10.4.4 | L1 | T3+T1 | NOT_TESTED |     |          |      |
| V10.4.5 | L1 | T3+T2 | NOT_TESTED |     |          |      |

### V11 — Cryptography

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V11.3.1 | L1 | T1    | NOT_TESTED |     |          |      |
| V11.3.2 | L1 | T1    | NOT_TESTED |     |          |      |
| V11.4.1 | L1 | T1    | NOT_TESTED |     |          |      |

### V12 — Secure Communication

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V12.1.1 | L1 | T2    | NOT_TESTED |     |          |      |
| V12.2.1 | L1 | T2    | NOT_TESTED |     |          |      |
| V12.2.2 | L1 | T2    | NOT_TESTED |     |          |      |

### V13 — Configuration

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V13.4.1 | L1 | T2+T1 | NOT_TESTED |     |          |      |

### V14 — Data Protection

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V14.2.1 | L1 | T1+T2 | NOT_TESTED |     |          |      |
| V14.3.1 | L1 | T1+T2 | NOT_TESTED |     |          |      |

### V15 — Secure Coding and Architecture

| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V15.1.1 | L1 | T3    | NOT_TESTED |     |          |      |
| V15.2.1 | L1 | T1+T3 | NOT_TESTED |     |          |      |
| V15.3.1 | L1 | T1+T2 | NOT_TESTED |     |          |      |

---

Produced with the `asvs5-audit` skill. Requirement text: OWASP ASVS 5.0.0.
