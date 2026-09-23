# Scoring, Status and Severity

The point of fixing these rules is comparability. Two runs are only comparable if both used the
same vocabulary, the same denominator and the same N/A discipline.

Everything here can be computed by hand — see `report-spec.md` for the worked procedure and the
arithmetic checks. `scripts/tally.awk` is an optional shortcut that needs nothing installed.

## Status vocabulary — closed set

| Status | Means | Requires |
| ------ | ----- | -------- |
| `PASS` | Verified satisfied | `evidence` |
| `FAIL` | Verified not satisfied | `evidence`, `severity` |
| `PARTIAL` | Satisfied on some paths but not all, or satisfied weakly | `evidence`, `severity`, `note` |
| `N_A` | Does not apply to this application | `note` justifying it |
| `NOT_TESTED` | In scope, not yet verified | `note` saying what is needed to close it |

There is no sixth value. No `UNKNOWN`, no `PASS*`, no `WONTFIX` — a decision not to fix is tracked
in the issue tracker, not in the audit. The requirement is still `FAIL`.

### Choosing between `PARTIAL` and `FAIL`

`PARTIAL` means the control exists and works somewhere. Use it when:
- The control covers most endpoints but demonstrably not all.
- The control is correct but weaker than the level demands (right algorithm, outdated parameters).
- The control is present in one environment and absent in the one being certified — and say which.

Use `FAIL` when the control is absent, bypassable, or fails on the path that matters. A control
that is 95% deployed but missing on the one unauthenticated endpoint is `FAIL`, not `PARTIAL` —
attackers use the gap, not the average.

### `N_A` discipline

`N_A` is the most abused status. It is legitimate only when the requirement's **subject does not
exist** in the application: no file upload, no WebRTC, no GraphQL, no LDAP.

It is never legitimate because:
- the control is hard to check → `NOT_TESTED`
- the control is someone else's responsibility → still in scope; verify their configuration (T3)
- the risk is accepted → `FAIL` with a low severity and a note
- the feature is not built *yet* → `N_A` only if it is also not deployed; note the re-check trigger

Every `N_A` needs a one-line justification in `note`. An `N_A` without one is treated as
`NOT_TESTED` by the report.

## The two numbers

Report them together, always:

```
Coverage = (PASS + FAIL + PARTIAL) / (in_scope − N_A)
Score    = (PASS + 0.5 × PARTIAL)  / (PASS + FAIL + PARTIAL)
```

- **Coverage** — how much of the audit was actually performed.
- **Score** — how well the application did on what was checked.

A score without its coverage is misleading, and that is the main way these audits mislead. 95% at
20% coverage is not a passing application; it is an audit that only looked at the easy chapters.
The report prints them as a pair everywhere, including per chapter and per tier.

**`in_scope`** = requirements whose ASVS level is ≤ the target level. Target `L2` means all L1 and
L2 requirements; L3 requirements are excluded from the denominator and shown separately as
informational.

## Certification statement

ASVS certification is pass/fail, not a percentage. The report states it plainly:

> **An application is verified at level N only when every in-scope requirement at level N and
> below is `PASS` or `N_A`.**

One `FAIL` at the target level means not verified. The percentage exists to track progress between
runs, not to soften that. The report prints both: the certification verdict, and the score for
trend-tracking.

When the target is L2, the report also prints the L1 verdict separately — L1 is usually reachable
first and makes a better near-term goal.

## Severity

Required on `FAIL` and `PARTIAL`. Start from the requirement's ASVS level as a floor, then adjust
for exploitability and impact **in this application**:

| Severity | Use when |
| -------- | -------- |
| `critical` | Directly exploitable for unauthenticated data access, authentication bypass, or code execution |
| `high` | Exploitable by an authenticated user for privilege escalation or cross-user data access; or any L1 failure |
| `medium` | Requires chaining, unusual conditions, or a specific user action; most L2 failures |
| `low` | Defense-in-depth gap with no direct exploit path; most L3 failures; documentation gaps with the control demonstrably in place |

Floors: an L1 failure is at least `high`. An L2 failure is at least `medium`. Adjust **upwards**
freely for real exploitability; adjust downwards only with the reason in `note`.

Missing documentation for a control that is verifiably implemented is `low`. Missing documentation
for a control that is *also* missing is scored at the control's severity — the absent document is
not the finding, the absent control is.

## Tiers do not affect scoring

A T3 `FAIL` counts exactly as much as a T1 `FAIL`. Tiers describe how to verify, not how much it
matters. The report breaks down coverage per tier so you can see *where* the audit is thin — the
common pattern is high T1 coverage and near-zero T2/T3, which means the audit read the code and
never checked the deployment or the identity provider.

## Deltas between runs

Classify every requirement's movement between runs (by hand, or with `scripts/diff-runs.awk`):

| Movement | Meaning |
| -------- | ------- |
| **Fixed** | `FAIL`/`PARTIAL` → `PASS` |
| **Regressed** | `PASS` → `FAIL`/`PARTIAL` — the highest-signal line in the whole report |
| **Newly tested** | `NOT_TESTED` → anything |
| **Lost coverage** | anything → `NOT_TESTED` — usually means a tool or environment was unavailable, not that anything changed |
| **Scope change** | to or from `N_A` — should be rare and always explained |
| **Unchanged** | no movement |

A regression with no corresponding code change usually means a *deployment* change (edge config,
IdP setting, dependency bump) — that is exactly the signal these runs exist to surface.
