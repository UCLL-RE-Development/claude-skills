# claude-skills

The team's shared Claude Code **slash commands** and **skills**. This README is the one place that
explains what is in here: what each thing does, when to use it, and how to add your own.

> If you add, rename or remove a command or skill, update this README in the same commit.

---

## At a glance

| Name | Type | Use it for | How to invoke |
| ---- | ---- | ---------- | ------------- |
| [`/onboard`](#onboard) | Command | First look at a RE-Frame codebase: summary of what it does, the stack, the structure and recent activity | `/onboard` |
| [`/re-frame`](#re-frame) | Command | Any **frontend / client** work in RE-Frame (pages, components, services, bindings) | `/re-frame <task>` |
| [`/re-brain`](#re-brain) | Command | Any **backend / server** work in RE-Frame (Express routes, validators, controllers, services) | `/re-brain <task>` |
| [`/build`](#build) | Command | Carrying out a written implementation plan, step by step | `/build <path-or-link-to-plan>` |
| [`/asvs5-audit`](#asvs5-audit) | Command + Skill | An OWASP ASVS 5.0.0 security audit that produces a standard report you can diff between runs | `/asvs5-audit [L1\|L2\|L3] [url] [t1]` |

---

## Commands vs. skills

| | **Command** (`.claude/commands/<name>.md`) | **Skill** (`.claude/skills/<name>/SKILL.md`) |
| --- | --- | --- |
| Triggered by | You type `/<name>` | Claude loads it by itself when the task matches its `description`, or you type `/<name>` |
| Size | One markdown file | A folder: `SKILL.md` plus `references/`, `assets/`, `scripts/` |
| Good for | Conventions, checklists, short procedures | Large procedures with reference data Claude should read only when it needs it |

Text you type after a command is passed in as `$ARGUMENTS`, e.g. `/build docs/plans/orders.md`.

---

## Installation

Pick one:

**Per project (recommended).** Copy `.claude/commands/` and `.claude/skills/` into the root of the
project repository. Everyone who clones that project gets them.

```bash
cp -r .claude/commands .claude/skills /path/to/your-project/.claude/
```

**Personal (every project on your machine).** Copy them into your user folder instead:

```bash
cp -r .claude/commands .claude/skills ~/.claude/
```

On Windows, `~/.claude` is `C:\Users\<you>\.claude`.

Restart Claude Code (or open a new session). Type `/` to check that the commands are listed.

---

## Command reference

### `/onboard`

**File:** [.claude/commands/onboard.md](.claude/commands/onboard.md)

Run this first in a fresh session on a RE-Frame project. Claude:

1. Lists all tracked files (`git ls-files`).
2. Reads `CLAUDE.md`, the architecture docs, the `re-frame` / `re-brain` conventions, the entry
   points, the config and the core models.
3. Checks `git status` and the last 10 commits.

**Output:** a short summary of what the project does, its tech stack, how it is organised, and the
current branch and recent activity.

**Rules it sets for the session:**

- Claude asks when something is unclear instead of guessing.
- Claude never commits unless you explicitly tell it to.
- Client work goes through `/re-frame`, server work goes through `/re-brain`. The **AiServer is out of
  scope.**

---

### `/re-frame`

**File:** [.claude/commands/re-frame.md](.claude/commands/re-frame.md)

The conventions for the **RE-Frame client**, our in-house SPA framework. It is built on native Web
Components and has **no build step**. Load it before any frontend task, e.g.
`/re-frame add a settings page with a theme toggle`.

**What it covers:**

- Project layout (`client/core`, `components`, `pages`, `dependencies`, `utils`, …)
- Component lifecycle (`created()`, `bindingChanged()`, `destroyed()`)
- Creating pages, components and services, plus registering routes in `routes.config.js`
- Two-way binding (`bind=""`), event binding (`event=""`), navigation (`<a route="">`)
- Observer / pub-sub, i18n (`strings.js`), theming, design tokens, UI primitives
- Scaffold overrides of header / footer / toast / dialog through the `rf` CLI
- Auth helpers, logging, async helpers, utilities

**Key rules (short version):**

- No direct `fetch` in components. Always use a service, and call `throwIfServiceError` after every call.
- Get services with `inject()`, never with `new`.
- Use `bind=""` instead of `this.find()`. Never use `document.querySelector`.
- Use `subscribe` / `notify` for cross-component communication, not `addEventListener`.
- Never add a bundler, transpiler or build step.
- **Tag names end in your developer glyph:**

  | Glyph | Owner |
  | ----- | ----- |
  | `χ` (U+03C7) | Reinoud |
  | `ɮ` (U+026E) | Kenny |
  | `ʤ` (U+02A4) | Siegmund |
  | `Ƒ` (U+0191) | Core / app shell |

  The full registry is in the project's `CLAUDE.md`. New team members: pick a glyph and add it there.

**CLI:** `rf` (run from `/client`). Example: `rf override toast css`.

---

### `/re-brain`

**File:** [.claude/commands/re-brain.md](.claude/commands/re-brain.md)

The conventions for the **RE-Frame server**: Express 5, Keycloak auth, CouchDB (with optional
PostgreSQL) and a strict layered architecture. Load it before any backend task, e.g.
`/re-brain add an orders endpoint with CRUD`.

**What it covers:**

- The four-file feature layout: `routes` → `validators` → `controllers` → `services`
- Middleware order: `requireAuth()` → `requireRealmRole()` → `validate()` → handler
- `AppError`, auth helpers, the CouchDB connector and `db-helpers.js`, the PostgreSQL connector
- Logger, environment variables (`src/config/env.js`), Swagger docs, JSDoc, Socket.IO

**Key rules (short version):**

- Controllers read `req.validated`, never `req.body` or `req.params`.
- `process.env` is only used in `src/config/env.js`.
- Every handler is wrapped in `asyncHandler()` inside the controller factory.
- Throw errors (preferably `AppError`) and let the global handler format them. Never swallow them.
- Business logic lives in services. Services are plain objects, never classes.

**CLI:** `rb` (run from `/server`). Scaffold features with it instead of writing the files by hand:

```bash
rb g f orders                    # all four files + router registration
rb g f orders --auth --couch     # with auth, CouchDB-backed
rb g f orders --auth --postgres  # with auth, PostgreSQL-backed
```

---

### `/build`

**File:** [.claude/commands/build.md](.claude/commands/build.md)

Carries out an implementation plan you wrote earlier (for example in plan mode, or as a markdown file).

```text
/build docs/plans/orders-feature.md
```

Claude reads the whole plan, does the tasks in order following the project's conventions, runs any
tests or validation steps the plan contains, and then reports:

- the tasks completed
- the files created or modified
- the test results
- any places it deviated from the plan, and why

Tip: for RE-Frame work, run `/onboard` (or `/re-frame` / `/re-brain`) first so the conventions are
loaded before building.

---

### `/asvs5-audit`

**Files:** [.claude/commands/asvs5-audit.md](.claude/commands/asvs5-audit.md) (entry point) and
[.claude/skills/asvs5-audit/](.claude/skills/asvs5-audit/) (the procedure and data)

Audits **any** application (it does not have to be RE-Frame) against **OWASP ASVS 5.0.0**, with all
345 requirements from V1 to V17. The report always has the same layout, so you can `diff` two runs
or compare results between teams.

**Arguments** (all optional, in any order):

| Argument | Meaning |
| -------- | ------- |
| `L1` / `L2` / `L3` | Target level: 70 / 253 / 345 requirements. If you have no preference, it uses L2. |
| a URL | A running instance to test. This enables the T2 (DAST) checks. |
| `t1` / `t1-only` | Code review only. T2 and T3 are marked `NOT_TESTED`. |

```text
/asvs5-audit L2 https://staging.example.com
/asvs5-audit L1 t1
```

**What to expect:**
1. **Scoping questions.** Claude asks for the level, the instance, how authentication works, what
   is N/A and where to write the report. It deliberately never suggests technologies or a
   "recommended" answer, so the audit can't be steered toward a preferred design.
2. **Three verification tiers:**
   - **T1:** code review and local tooling (177 requirements)
   - **T2:** DAST against a running instance with Burp, ZAP, testssl or nuclei (47 requirements)
   - **T3:** manual review of documentation, configuration and processes (121 requirements)
3. **Output:** `<records-dir>/asvs5/runs/<YYYY-MM-DD>-<commit>/report.md`, plus a `delta.md` when
   an earlier run exists.
4. **In chat:** the verdict, the **score together with its coverage**, failures by severity, the top
   blockers and the not-tested queue for each tier.

**Things to know:**

- Project docs (`CLAUDE.md`, README, wiki) are treated as **claims to verify**, not as evidence.
- Statuses are limited to `PASS`, `FAIL`, `PARTIAL`, `N_A` and `NOT_TESTED`. Without a running
  instance, T2 items stay `NOT_TESTED` and are never inferred from source.

- A level is certified only when **every** requirement at that level is `PASS` or `N_A`.
- Nothing to install. Optional `awk` helpers (`scripts/tally.awk`, `scripts/diff-runs.awk`) work in
  Git Bash on Windows.

- **Do not edit** `references/catalog.csv` or `assets/skeleton-*.md`. They are the standard.

Details: [SKILL.md](.claude/skills/asvs5-audit/SKILL.md) and the files in
[references/](.claude/skills/asvs5-audit/references/).

---

## Repository layout

```text
.claude/
├── commands/
│   ├── onboard.md          /onboard
│   ├── re-frame.md         /re-frame     (client conventions)
│   ├── re-brain.md         /re-brain     (server conventions)
│   ├── build.md            /build
│   └── asvs5-audit.md      /asvs5-audit  (entry point for the skill below)
└── skills/
    └── asvs5-audit/
        ├── SKILL.md        procedure, status vocabulary, scoring
        ├── references/     catalog (345 reqs), tier checklists, scoring, report spec
        ├── assets/         report skeletons for L1 / L2 / L3
        └── scripts/        optional awk helpers (tally, diff)
```

---

## Adding a new command or skill

1. **Command:** create `.claude/commands/<name>.md`. Start it with frontmatter so it shows up
   clearly in the `/` menu:

   ```markdown
   ---
   description: One line saying what it does
   argument-hint: [what to pass]
   ---
   ```

   Use `$ARGUMENTS` in the body wherever the user's input should go.

2. **Skill:** create `.claude/skills/<name>/SKILL.md` with `name` and `description` frontmatter.
   The description decides when Claude loads the skill automatically, so say *what* it does **and**
   *when* to use it. Put large reference material in `references/` and point to it from `SKILL.md`,
   so Claude reads it only when needed.

3. Add a row to the [At a glance](#at-a-glance) table and a section under
   [Command reference](#command-reference).

4. Open a PR. Someone else tries it once before it is merged.

**Naming:** use kebab-case and keep names short. Prefix project-specific items with the project
(`re-…`) so they don't collide with other people's personal commands.
