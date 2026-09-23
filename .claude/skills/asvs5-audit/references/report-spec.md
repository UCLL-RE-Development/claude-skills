# Report Specification

The report is a single markdown file. **No tooling is required to produce, read, compare or check
it.** Everything below can be done by hand, and the skeletons in `assets/` already contain the
structure and every requirement row.

The format is fixed so that two runs can be placed side by side. `diff run-a/report.md
run-b/report.md` is the comparison — that works with `diff`, `git diff`, or any file-compare tool,
on any machine.

## Run layout

```
<anywhere the project keeps written records>/asvs5/
├── README.md                      # index of runs, newest first (one line per run)
└── runs/
    └── <YYYY-MM-DD>-<short-sha>/
        ├── report.md              # the audit — copied from assets/skeleton-L<n>.md and filled in
        └── delta.md               # optional: what moved since the previous run
```

The location carries no meaning and there is no required convention — put it where
the team will find it. What matters is the run folder per audit and the report format inside it.

Run id = date + short commit sha, e.g. `2026-09-21-a1b2c3d`. One run per commit; re-auditing the
same commit replaces that folder. If the project is not in version control, use the date plus a
release identifier and say so in the **Commit** field.

## The rule that makes it comparable

> **Keep every heading, every table, every column and every row in the order the skeleton has them.**

Fill in cells. Do not reorder, do not delete rows, do not add columns. A requirement that turns out
to be irrelevant becomes `N_A` with a justification — its row stays, so the next diff still lines
up. That is the whole trick; nothing else about the format is load-bearing.

### Section order — the contract

| # | Section | Contents |
| - | ------- | -------- |
| 1 | Title | `# ASVS 5.0 Audit Report — <run-id>` and the target level |
| 2 | **Scorecard** | Fixed machine-readable key/value block, for aggregation |
| 3 | **Run** | Run id, date, level, commit, branch, stack, test target, auth architecture, auditor, tooling, scope size |
| 4 | **Scope decisions** | Every exclusion with its justification |
| 5 | **Verdict** | Certification per level up to the target: VERIFIED / NOT VERIFIED, failing, outstanding, score, coverage |
| 6 | **Totals** | Counts and shares per status; open findings by severity |
| 7 | **Coverage by tier** | T1/T2/T3 — shows where the audit is thin |
| 8 | **By chapter** | One row per ASVS chapter, plus a Total row |
| 9 | **Open findings** | Every `FAIL` and `PARTIAL`, with verbatim requirement text |
| 10 | **Not-tested queue** | Grouped by tier, with the blocker for each |
| 11 | **Scope exclusions** | Every `N_A` with its justification |
| 12 | **Full results** | All in-scope requirements by chapter, in ID order — the section to diff |

Sections 9–11 are derived views of section 12. If they disagree, section 12 wins — it is the record.

## The Scorecard block

The report opens with a fenced block of fixed keys in a fixed order. It exists so that many
reports — across teams, stacks and quarters — can be aggregated mechanically without parsing prose
or markdown tables.

```
asvs_version   5.0.0
target_level   L2
run_id         2026-09-21-a1b2c3d
date           2026-09-21
stack          Python 3.12 / Django 5 · server-rendered · self-implemented auth · PostgreSQL · nginx · containers
scope          253
pass           123
fail           36
partial        9
na             15
not_tested     70
coverage       70.6
score          75.9
verified_l1    no
verified_l2    no
open_critical  0
open_high      36
open_medium    9
open_low       0
t1_coverage    68.7
t2_coverage    63.0
t3_coverage    76.6
```

Keys never change, never reorder, and never gain a unit suffix — `coverage` and `score` are bare
numbers, not percentages, so they sort and average correctly. Roll up a portfolio with:

```bash
for f in */runs/*/report.md; do
  awk -v F="$f" '/^```$/{c++;next} c==1 && ($1=="score"||$1=="coverage"||$1=="fail") {printf "%s ", $2}
                 END{print F}' "$f"
done
```

## Comparing reports across teams

Two reports are comparable because the **requirement IDs, the statuses and the formulas** are
identical everywhere. Stack, language and architecture do not affect any of those.

What you can compare directly:

- Per-requirement status — `V8.2.2` means the same thing in a Drupal site and a Spring service.
- Coverage — how thoroughly each team actually verified.
- Certification verdict — pass/fail at a level.
- Chapter profiles — which areas are weak across a portfolio.

What needs care:

- **Score without coverage.** A team at 95%/30% has done less work than one at 78%/90%. Always
  read the pair; the scorecard puts them adjacent for exactly this reason.
- **`N_A` counts.** A team with 60 exclusions is auditing a much smaller application — or is
  excluding things it should not. Scope exclusions are listed in full so this is checkable.
- **Tier coverage.** Two teams at the same score, one with `t2_coverage 0`, are not equivalent.
  The one that never tested the deployment has an unknown, not a pass.
- **Different target levels.** L1 and L2 reports are not comparable as scores. Compare the L1 row
  of both Verdict tables instead.

What is *not* a reason to discount a comparison: a different language, framework, CMS, cloud, or
way of building software. The standard is the same for all of them.

## The Full results table is the record

```
| Req     | L  | Tier  | Status     | Sev | Evidence | Note |
| ------- | -- | ----- | ---------- | --- | -------- | ---- |
| V1.2.4  | L1 | T1+T2 | FAIL       | high | src/db/query.py:88 | string-built SQL in report filter |
```

| Column | Rule |
| ------ | ---- |
| `Req`, `L`, `Tier` | Pre-filled from the catalog. Never edit |
| `Status` | Exactly one of `PASS` `FAIL` `PARTIAL` `N_A` `NOT_TESTED` |
| `Sev` | Required on `FAIL` and `PARTIAL`: `critical` `high` `medium` `low`. Empty otherwise |
| `Evidence` | `file:line`, or the command run and what it returned. Required on `PASS`/`FAIL`/`PARTIAL` |
| `Note` | One short sentence. Required on `N_A` (the justification) and on `NOT_TESTED` (the blocker) |

Keep cells on one line and avoid `|` inside them (escape as `\|`). That keeps every row greppable
and every diff a one-line change.

Requirement text is **not** in this table — it is in `references/catalog.csv`, and the full text of
anything that failed is repeated in the Open findings section, so the report still stands alone for
a reader who does not have the catalog.

### Only this section is parsed

Open findings, the Not-tested queue and Scope exclusions all repeat requirement ids in tables with
**different column layouts** — Open findings puts `Sev` before `Status`; the Not-tested queue has no
status column at all. Anything reading a report mechanically must therefore scope itself to the
`## Full results` heading and stop at the next level-2 heading. Both shipped helpers do this.

A tool that parses every `| V…` row in the file will read a severity as a status and produce
nonsense with confidence. If you write your own reader, scope it to the section, and check its
total against the `scope` key in the Scorecard — they must be equal.

## Computing the numbers by hand

Six counts per group, then two divisions. Count from the Full results table, one chapter at a time,
and write the per-chapter row as you go; the totals are then just column sums.

```
applicable = scope − N_A
verified   = PASS + FAIL + PARTIAL

Coverage = verified / applicable
Score    = (PASS + 0.5 × PARTIAL) / verified
```

Round to one decimal. `N_A` is excluded from both. `NOT_TESTED` lowers coverage and does not touch
the score.

**Checks that catch most arithmetic slips:**
- Every per-chapter row must satisfy `Pass + Fail + Part + N/A + Not tested = Scope`.
- The Total row must equal the column sums, and its `Scope` must match the pre-filled figure.
- Tier rows must sum to the same total as chapter rows.

**Verdict** per level: `VERIFIED` only when, for every requirement at that level and below,
`Status` is `PASS` or `N_A`. One `FAIL`, one `PARTIAL` or one `NOT_TESTED` means `NOT VERIFIED`.
`Failing` = `FAIL` + `PARTIAL`; `Outstanding` = `NOT_TESTED`.

For a target above L1, compute the L1 row from the L1 rows only — it is usually the reachable
near-term goal and is worth reporting separately.

## Optional helper (no install)

`scripts/tally.awk` recomputes every summary table from a filled report. `awk` is present on every
Unix system and in Git Bash on Windows — nothing to install.

```bash
awk -f "$SKILL/scripts/tally.awk" <run-dir>/report.md
```

It prints the Verdict, Totals, Coverage-by-tier and By-chapter tables ready to paste in, plus any
data-quality problems (a `PASS` with no evidence, a `FAIL` with no severity, an unjustified `N_A`,
an unknown status). It never edits the report.

`scripts/diff-runs.awk` compares two filled reports:

```bash
awk -f "$SKILL/scripts/diff-runs.awk" <old-run>/report.md <new-run>/report.md
```

It prints Regressed, Fixed, Newly tested, Lost coverage and Scope change — paste the output into
`delta.md`. If `awk` is unavailable, `diff old/report.md new/report.md` gives the same information
in raw form, and the summary can be written from that.

Neither script is required. They exist so nobody has to count 253 rows by hand twice.

## Writing `delta.md`

```markdown
# ASVS 5.0 Audit Delta — <old-run-id> → <new-run-id>

| Metric | <old> | <new> | Δ |
| ------ | ----: | ----: | -: |
| Score | | | |
| Coverage | | | |
| Pass / Fail / Partial / Not tested / N/A | | | |
| Certified | | | |

## Regressed (<n>)
<!-- PASS → FAIL/PARTIAL. The highest-signal section in the report. A regression with no matching
     code change points at a deployment, edge or identity-provider change. -->
| Req | L | Tier | From | To | Sev | What changed |

## Fixed (<n>)
## Newly tested (<n>)
## Lost coverage (<n>)          <!-- → NOT_TESTED: a tool or environment was unavailable -->
## Scope change (<n>)           <!-- to or from N_A: should be rare and always explained -->
```

Note any change to the target level, the stack profile or the tooling at the top — those make
scores not directly comparable, and a reader needs to know before reading the numbers.

## Maintaining the index

`<records-dir>/asvs5/README.md`, one line per run, newest first:

```markdown
| Run | Level | Score | Coverage | Fail | Partial | Not tested |
| --- | ----- | ----: | -------: | ---: | ------: | ---------: |
| [2026-09-21-a1b2c3d](runs/2026-09-21-a1b2c3d/report.md) | L2 | 74.3% | 71.1% | 32 | 22 | 68 |
```

This is the trend line — the thing people actually look at between audits.
