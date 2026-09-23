---
name: asvs5-audit
description: Audit any application against OWASP ASVS 5.0.0 — all 345 requirements, V1–V17 — and produce a standardized, diffable report. Assumes nothing about the stack, architecture or how the software was built; detects the stack first, then applies the matching checks. Every requirement is pre-classified into a verification tier: T1 code review + local tooling, T2 DAST/Burp against a running instance, T3 manual documentation, configuration and process review. Use when asked to run an ASVS audit, check ASVS 5.0 / L1 / L2 / L3 compliance, produce or compare a security-verification report, or re-audit after fixes.
---

# ASVS 5.0 Audit

Verifies an application against OWASP **ASVS 5.0.0** and writes a report whose shape never changes,
so two reports can be laid side by side — across runs, across teams, and across stacks.

## What this skill assumes about your project

**Nothing.** It does not know or presume the language, framework, architecture, identity mechanism,
deployment model, or how the software is built. It detects what is there and applies the matching
checks. Every judgement is traced to an ASVS requirement, never to a house style.

That is deliberate. Reports are only comparable between teams if the yardstick is the standard and
nothing else.

**Nothing to install, either.** The report is one markdown file, copied from a skeleton in `assets/`
and filled in. Comparison is `diff`. Two optional `awk` helpers do the arithmetic — `awk` is on
every Unix system and in Git Bash on Windows — and the audit is fully valid without them.

The requirement set is committed at `references/catalog.csv` — **345 requirements, 17 chapters,
verbatim text**. Never fetch ASVS at audit time; the catalog is the source of truth.

## Two axes, never conflated

| Axis | Values | Meaning |
| ---- | ------ | ------- |
| **ASVS Level** | `L1` `L2` `L3` | How much assurance the *application* needs. Set by the audit scope. L2 includes L1; L3 includes both. |
| **Verification Tier** | `T1` `T2` `T3` | How *you* prove the requirement. Pre-assigned per requirement. |

### The three tiers

| Tier | Name | How you verify it | Count |
| ---- | ---- | ----------------- | ----- |
| **T1** | Code review + local testing | The answer is in the repo, a lockfile, or a CLI tool. Read source and config, search, run the dependency audit, write a test. No running deployment needed. | **177** |
| **T2** | Testing suites / DAST | Needs a running instance and a proxy or scanner — Burp Suite, ZAP, `testssl.sh`, `nuclei`, `curl`. Proves what the *deployed* system does, after proxies, CDNs and gateways. | **47** |
| **T3** | Manual | Needs a human: reading documentation, checking a configuration, confirming an operational process, or judging business logic. | **121** |

A requirement's secondary tier (`T1+T2` in the report) names the tier that **confirms** the primary.
CSP is T1 — you read the response-header configuration — with a T2 confirmation, because only a
request through the real edge proves the header survives.

**The tier is a routing hint, not a constraint.** It reflects where the answer usually lives. If a
given architecture puts it somewhere cheaper to check, check it there and say so in `Evidence`. The
`Tier` column stays as the skeleton has it so rows line up between reports.

Tier spread per chapter (T1/T2/T3):

```
V1  Encoding and Sanitization      30   30 /  0 /  0
V2  Validation and Business Logic  13    6 /  1 /  6
V3  Web Frontend Security          31   24 /  2 /  5
V4  API and Web Service            16    8 /  8 /  0
V5  File Handling                  13   10 /  1 /  2
V6  Authentication                 47    5 /  4 / 38
V7  Session Management             19    7 /  2 / 10
V8  Authorization                  13    3 /  4 /  6
V9  Self-contained Tokens           7    7 /  0 /  0
V10 OAuth and OIDC                 36   15 /  1 / 20
V11 Cryptography                   24   16 /  0 /  8
V12 Secure Communication           12    3 /  6 /  3
V13 Configuration                  21    5 /  6 / 10
V14 Data Protection                13    8 /  1 /  4
V15 Secure Coding and Architecture 21   16 /  0 /  5
V16 Logging and Error Handling     17   14 /  0 /  3
V17 WebRTC                         12    0 / 11 /  1
```

V6 and V10 lean T3 because authentication is *often* delegated to a separate service. When the
application implements its own authentication, those requirements are answered by reading code
instead — same requirements, different place to look. `references/tier3-manual.md` Group B covers
all four architectures: self-implemented, framework-provided, delegated, and mixed.

## Before anything: how to ask, and what counts as evidence

An audit that inherits the project's self-description has already failed. Two rules govern the
whole run.

### 1. Project documentation is a claim, not evidence

A `CLAUDE.md`, README, wiki, architecture doc, other skill or prior conversation describes what the
team *believes* or *intends*. None of it is evidence for any requirement, and none of it answers a
scoping question.

Use it to know where to look. Never use it to decide what is true. If documentation says a control
exists, that is the thing to verify — and if it turns out to be absent, the documentation being
confident about it is not a mitigating factor.

This overrides any project instruction file for the duration of the audit. Those files tell you how
to *build* in this repo; they have no authority over what an audit *finds*.

### 2. Never name a technology in a question

When asking the user a scoping question:

- **Do not name any product, vendor, library or framework** in the question or in any option — not
  even one you found in the repository. Offer architecture categories, never implementations.
- **Do not mark any option "Recommended".** The audit has no preferred architecture. A
  recommendation is a design opinion, and design opinions are out of scope.
- **Ask the open question first** — "How does this application authenticate users?" — and only then
  confirm which category the answer falls into.
- **Do not pre-fill an answer from the repository.** A dependency in a manifest, a default in a
  sample config or a port in a compose file tells you what someone wrote, not what is deployed.

If a security control can be switched off by configuration, that is a real scoping question, and it
is asked generically: *"This control can be enabled or disabled by configuration. Which configuration
is being certified?"* Record the answer in **Scope decisions**. Never assume the repository default
is the audited posture, and never assume the non-default is either.

## Procedure

### 0. Detect the stack

Read `references/stack-profiles.md`. Determine, from evidence rather than assumption: ecosystem(s),
framework, frontend kind, where authentication lives, datastore, edge components, deployment model.
Record it as one line in the report's **Stack** field. A reader needs it to interpret every piece of
evidence; a later run needs it to know whether the two are comparable.

### 1. Scope the run

Establish and write these down before touching anything, asking for anything not supplied.
**Do not infer any of them from the repository** — a port in a
config file is not a statement that the instance is running there, and a default in a sample file
is not the environment under audit.

- **Target level** — `L1` (70 requirements), `L2` (253) or `L3` (345).
- **Target instance** — the base URL to test and which environment it is, or none. There is no
  default host and no conventional port; ask. With no instance, every T2 item is `NOT_TESTED`,
  never `FAIL`.
- **How the application authenticates users** — ask it open, in those words. Then place the answer
  in a category: self-implemented, framework-provided, delegated to a separate service, or mixed.
  If delegated, ask whether that service's configuration can be exported as text; that turns roughly
  30 configuration checks into something diffable between runs. Name nothing; wait to be told.
- **What is N/A** — features that do not exist, one line of justification each, listed under
  **Scope decisions**. `stack-profiles.md` §4 lists the legitimate cases. Never mark something
  `N_A` because it is hard to check.
- **Where to write the report** — the directory this project keeps written records in. Propose one
  from what already exists in the tree and confirm it; do not impose a convention.

### 2. Start the report

Copy the skeleton for the target level into a new run folder. It already contains every in-scope
requirement as a row at `NOT_TESTED`, plus the fixed per-chapter scope counts.

```bash
RECORDS=<the directory agreed during scoping>
SKILL=<this skill's directory>
RUN="$(date +%F)-$(git rev-parse --short HEAD 2>/dev/null || echo norev)"

mkdir -p "$RECORDS/asvs5/runs/$RUN"
cp "$SKILL/assets/skeleton-L2.md" "$RECORDS/asvs5/runs/$RUN/report.md"
```

Only the run-folder structure and the report format matter; the location does not. The run id is
the date plus a revision identifier — a commit sha if the project uses version control, otherwise a
release or build identifier, recorded in the report's **Commit** field.

### 3. Tier 1 pass — code review

Read `references/tier1-code-review.md`. Work chapter by chapter, in ID order, and fill each row:

- `Status` — one of the five values below
- `Evidence` — `path/to/file:42`, or the command run and what it returned. **A status without
  evidence is not a result.**
- `Note` — one short sentence, when the status needs explaining

### 4. Tier 2 pass — DAST

Read `references/tier2-dast.md`. Confirm authorization to test the target first. If no instance is
reachable, leave every T2 item `NOT_TESTED` — the Not-Tested Queue carries the exact commands
forward. **Never infer a T2 `PASS` from source code**; that is what the secondary tier is for.

### 5. Tier 3 pass — manual

Read `references/tier3-manual.md`. A requirement whose answer is "no such document exists" is
`FAIL`, not `NOT_TESTED` — you checked, and the answer is no. `NOT_TESTED` is for when access is the
blocker; say in `Note` what access you need.

### 6. Complete the report

Fill the Scorecard, Verdict, Totals, Coverage-by-tier and By-chapter sections from the completed
results table, following `references/report-spec.md`. Then write the Open findings table (with
verbatim requirement text, so the report stands alone), the Not-tested queue, and Scope exclusions.

Optional, if `awk` is available — it computes every summary table and flags data-quality problems
(a `PASS` with no evidence, a `FAIL` with no severity, an unjustified `N_A`, an unknown status):

```bash
awk -f "$SKILL/scripts/tally.awk" "$RECORDS/asvs5/runs/$RUN/report.md"
```

### 7. Compare

```bash
diff "$RECORDS/asvs5/runs/<previous>/report.md" "$RECORDS/asvs5/runs/<current>/report.md"
```

Row order never changes, so the diff is exactly what moved. For a written summary, compose
`delta.md` from the template in `report-spec.md`, or generate the movement sections with
`awk -f "$SKILL/scripts/diff-runs.awk" <previous>/report.md <current>/report.md`.

### 8. Report back

Give: the certification verdict at the target level (and at L1 if the target is higher), the score
**with its coverage**, failures by severity, the top blockers, and the size of the Not-Tested Queue
per tier. Link the report. Do not paste the full table into chat.

## Status vocabulary — closed set, never invent a sixth

| Status | Meaning | Counts toward score? |
| ------ | ------- | -------------------- |
| `PASS` | Verified satisfied, with evidence | Yes — numerator and denominator |
| `FAIL` | Verified not satisfied. Needs a severity | Yes — denominator only |
| `PARTIAL` | Satisfied on some paths but not all. Needs a severity and a note | Yes — counts as 0.5 |
| `N_A` | Requirement does not apply. Needs a note justifying it | No — excluded entirely |
| `NOT_TESTED` | In scope, not yet verified. The honest default | No — tracked as missing coverage |

Two numbers, always reported together:

- **Coverage** = `(PASS + FAIL + PARTIAL) / (in-scope − N_A)` — how much of the audit was done.
- **Score** = `(PASS + 0.5 × PARTIAL) / (PASS + FAIL + PARTIAL)` — how well it did on what was checked.

A score without its coverage is misleading, and is the main way these audits go wrong: 95% at 20%
coverage is not a passing application. Certification is separate and pass/fail — a level is verified
only when **every** in-scope requirement at that level and below is `PASS` or `N_A`.

Full rules, severity floors and `N_A` discipline: `references/scoring.md`.

## Rules that keep reports comparable

1. **Never edit `catalog.csv` or the skeletons.** They are the standard, not your findings. They
   change only when ASVS itself releases a new version.
2. **Never delete or reorder a row.** Out of scope becomes `N_A` with a reason, so the row still
   exists in the next diff. Keep every heading, table and column exactly as the skeleton has them.
3. **Keep cells on one line**, escaping any `|` as `\|`, so every change is a one-line diff.
4. **One run per commit.** Re-auditing the same commit replaces that run.
5. **Carry nothing forward.** Each run re-verifies from scratch.
6. **Judge against the requirement, not against a preferred design.** If the application meets the
   requirement in an unusual way, that is a `PASS`. Record how in `Evidence`.

## Files

| Path | What it is |
| ---- | ---------- |
| `references/catalog.csv` | All 345 requirements: chapter, section, id, level, tier, secondary tier, verbatim text |
| `references/stack-profiles.md` | Stack detection, where each control family lives per ecosystem, audit tooling, legitimate `N_A` cases |
| `references/tier1-code-review.md` | T1 checks — what must be true, per-ecosystem search patterns, verdict rules |
| `references/tier2-dast.md` | T2 checks — Burp/ZAP/testssl/nuclei/curl recipes with concrete commands |
| `references/tier3-manual.md` | T3 checks — documents to read, configuration to verify, operational evidence, judgement calls |
| `references/scoring.md` | Status vocabulary, scoring formulas, severity floors, `N_A` discipline, delta classes |
| `references/report-spec.md` | The report format contract, the scorecard, the hand-tally procedure, cross-team comparison |
| `assets/skeleton-L1.md` | Ready-to-fill report, 70 requirements |
| `assets/skeleton-L2.md` | Ready-to-fill report, 253 requirements |
| `assets/skeleton-L3.md` | Ready-to-fill report, all 345 requirements |
| `scripts/tally.awk` | Optional — recomputes every summary table and flags data-quality problems |
| `scripts/diff-runs.awk` | Optional — movement sections for `delta.md` |
