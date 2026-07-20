# Loop 1 — Intake Understanding

Experimental pipeline component that reads one intake issue and produces a provisional editorial understanding. Loop 1 does **not** mutate GitHub, publish content, or draft articles.

**Runner:** `scripts/loop1-intake-understanding.mjs`  
**Baseline:** `b7d2a11` — Add experimental Loop 1 intake understanding runner  
**Test status:** Manually evaluated on real backlog issues (#1, #18, #19, #27, #28) with intake cache; four manually reviewed editorial recommendation comments posted to #18, #19, #27, and #28. Loop 1 output is suitable for human review, not autonomous GitHub commenting.

## Purpose

Transform a single intake issue (Markdown) into a structured recommendation by:

1. Proposing an initial classification from the issue alone
2. Retrieving related local corpus material
3. Evaluating whether the proposal survives retrieved context
4. Emitting a clean Markdown result for human review

Loop 1 is a **recommendation generator**, not a publishing or issue-mutation step.

## Test inputs and temporary outputs

Use three distinct input/output layers. Do not commit real backlog bodies or personal metadata into the repository.

| Layer | Location | Use |
|-------|----------|-----|
| **Sanitized tracked fixtures** | `scripts/fixtures/intake-issues/` | Smoke tests, parser shape checks, CI-safe examples with fictional metadata only |
| **Cached real issues** | `/tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues/` | Manual evaluation on real backlog issues; read-only GitHub issue cache |
| **Local real fixture copies** | `/tmp/dfw-loop1-local-fixtures/` | Preserved copies of full real intake bodies moved out of the repo; not tracked |
| **Run outputs and traces** | `/tmp/loop1-*.md`, `/tmp/dfw-loop1-manual-eval-YYYYMMDD-HHMMSS/` | Result files, trace bundles, and evaluation run folders |

Tracked fixture for smoke testing: `scripts/fixtures/intake-issues/issue-001-minimal-seed.md`

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `--issue <path>` | yes | Path to one intake issue Markdown file |
| `--intake-cache <dir>` | no | Directory of cached intake issues (e.g. `/tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues`) |
| `--out <path>` | no | Write final Markdown result to this path (stdout still prints result) |
| `--trace` | no | Emit dry-run trace with proposal JSON, retrieval scores, and evaluation JSON |

**Issue format:** GitHub-issue cache Markdown or DFW intake body with `# Issue #N:` / `**Title:**` metadata and a `### Body` section.

**Retrieval corpus** (always scanned; active issue excluded):

- `src/content/articles`
- `src/content/field-notes`
- `src/content/checkpoints`
- `src/content/content-inbox/harvests`
- `scripts/fixtures/intake-issues`
- `--intake-cache` directory when provided

## Corpus Boundary Principle

Keep production editorial retrieval roots structurally clean.

Every file placed inside a production editorial retrieval root is eligible content. Documentation, tests, fixtures, administrative files, and other non-editorial artifacts should live outside those roots whenever repository structure can express the distinction.

Prefer correcting repository organization over adding retrieval filters or content-based exclusion rules. Retrieval scoring ranks eligible candidates; it should not determine whether a file belongs to the editorial corpus.

Use code-level exclusions only when repository structure cannot represent the boundary cleanly.

The tracked fixture directory and optional intake cache are explicit supporting inputs, not production editorial retrieval roots.

## Outputs

| Output | Location | Contents |
|--------|----------|----------|
| Final recommendation | stdout (and optional `--out`) | Markdown under `## Loop 1 Intake Understanding` |
| Trace bundle | stdout when `--trace` | Proposal JSON, top matches with scores, evaluation JSON, final Markdown |
| Temp model artifacts | `os.tmpdir()/dfw-loop1-*` | Ephemeral Codex last-message files; removed after each call |

**Temporary output locations:**

- Evaluation run folders: `/tmp/dfw-loop1-manual-eval-YYYYMMDD-HHMMSS/`
- Single-run results: `/tmp/loop1-<issue>-result.md` via `--out`
- Trace bundles: stdout with `--trace`, or saved under an evaluation folder by convention

The runner does not write results into the repository.

Downstream durable guidance uses the separate contract `docs/contracts/loop1-reviewed-recommendation.v1.schema.json` after human review. Loop 1 raw output is **not** that contract.

## Required environment / model access

| Requirement | Notes |
|-------------|-------|
| Node.js `>=22.12.0` | See `package.json` engines |
| Codex CLI | Invoked as `codex exec` in read-only sandbox mode |
| `CODEX_BIN` | Optional override; defaults to `/Applications/Codex.app/Contents/Resources/codex` or `codex` on PATH |
| Codex login + network | Model calls fail fast if CLI is unavailable |

No GitHub token is required. Loop 1 must not call the GitHub API.

## Commands

```bash
# Smoke test with sanitized tracked fixture (requires Codex for full run)
npm run loop:intake -- --issue scripts/fixtures/intake-issues/issue-001-minimal-seed.md

# Real backlog issue from intake cache (manual evaluation only)
npm run loop:intake -- \
  --issue /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues/0018-dfw-intake-skills-half-life.md \
  --intake-cache /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues

# Save result without trace noise
npm run loop:intake -- \
  --issue /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues/0019-dfw-intake-google-s-ard-standard.md \
  --intake-cache /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues \
  --out /tmp/loop1-0019-result.md

# Diagnostic run (includes retrieval scores and evaluator JSON)
npm run loop:intake -- \
  --issue /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues/0027-dfw-intake-loop-engineering-as-an-update-to-agile.md \
  --intake-cache /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues \
  --trace
```

## Retrieval behavior

1. Build lightweight candidates from Markdown: title, frontmatter, headings, excerpt, selected sections, issue metadata.
2. Tokenize with stop-word filtering; down-weight broad DFW terms (`archive`, `memory`, `cognitive`, etc.).
3. Score candidates against the active issue + provisional proposal tokens.
4. Boost intake-cache candidates on title, subject, labels, and issue number overlap.
5. Flag `likely-duplicate-or-self-source` when title/body similarity is high or email IDs match.
6. Return top **5** matches with score `> 0`.

Retrieval is local and deterministic. It does not call external search APIs.

## Evaluator behavior

Three model stages:

1. **Proposal** — classification before retrieval (`documentType`, `domainPath`, `theme`, `confidence`, `recommendedAction`, `rationale`, `openQuestions`)
2. **Evaluation** — `PASS`, `REVISE`, or `ESCALATE` with narrow checks: artifact inflation, duplication, stronger cluster, weak evidence, wrong domain, human intent needed
3. **Final** — only when result is `REVISE`; may fully replace proposal fields using `replacementGuidance`

| Result | Output path |
|--------|-------------|
| `PASS` | Deterministic formatter; no third generative revision |
| `ESCALATE` | Deterministic escalation template |
| `REVISE` | One allowed autonomous Markdown revision |

## Human review boundary

Loop 1 stops at **recommendation**. A human must:

- Review disposition, domain, artifact type, and related-material links
- Convert approved guidance into `loop1-reviewed-recommendation.v1` records
- Post GitHub comments manually when appropriate
- Decide whether to invoke Loop 2

**Prohibited without explicit human approval:**

- GitHub issue comments, labels, closes, or edits
- Publishing or canonical status changes
- Treating Loop 1 output as durable editorial guidance

## Known weaknesses

- **Metadata similarity noise** — shared intake scaffolding (`[DFW Intake]`, `issue`, `open`, etc.) can inflate retrieval matches across unrelated backlog items.
- **Wrong domain assignment** — disposition and artifact type can be sound while primary domain is misassigned; evaluator may not correct domain reliably.
- **Duplicate/cluster detection** — depends on evaluator correction; retrieval alone may surface related titles without proving editorial clustering.
- **Human review required** — recommendations must be reviewed before becoming durable issue guidance or Loop 2 input.

## Related contracts

- Reviewed output: `docs/contracts/loop1-reviewed-recommendation.v1.schema.json`
- Loop 2 target (design only): `docs/contracts/loop2-development-packet.v1.design.md`
