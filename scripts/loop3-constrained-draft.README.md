# Loop 3 — Constrained Drafting

Local runner that accepts only an approved, schema-valid Loop 2 development packet and produces a first DFW draft for human review.

**Runner:** `scripts/loop3-constrained-draft.mjs`  
**Report schema:** `docs/contracts/loop3-drafting-report.v1.schema.json`  
**Baseline:** `ff4e6f1` — Harden Loop 2 readiness with source-sufficiency assessment

Loop 3 does **not** research, resolve evidence gaps, combine clusters, decide publication readiness, mutate GitHub, or publish.

## Hard entry gate

Refuses to draft unless **all** are true:

| Check | Requirement |
|-------|-------------|
| `draftReadiness` | `ready` |
| `sourceSufficiency.status` | `sufficient` |
| Loop 1 recommendation | `humanApprovalStatus: approved` (via `--recommendation`) |
| `blockingCondition` | absent / null |
| `sourceRequirements` | empty |
| Artifact type | `note`, `field-report`, or `prototype-note` only |

On refusal: clear blocking message, no article prose, exit code `2`.

## Supported artifact types (MVP)

| Type | Template sections |
|------|-------------------|
| **note** | title, opening observation/question, why it may matter, current interpretation, open question |
| **field-report** | title, the signal, why it may matter, deeper tension, what is not being said, what to watch next |
| **prototype-note** | title, design problem, interaction choice, grouped controls, why it matters, current state, remaining questions |

Essays and other artifact types are **rejected explicitly**.

## Future enhancement: Extend Loops 3–5 for prototype-note, concept, and essay artifacts

Current first-class drafting and evaluation support began with `note` and
`field-report`. The planned expansion adds `prototype-note`, `concept`, and
`essay` with distinct drafting structures, required and optional sections,
length guidance, grounding requirements, Loop 4 evaluation criteria, Loop 5
revision boundaries, type-specific fixtures, and full-page preview behavior.

Implementation order is `prototype-note` → `concept` → `essay`. A
`prototype-note` records a specific screen, interaction, state, design choice,
or proposed prototype behavior. A `concept` defines durable reusable vocabulary
or a framework. An `essay` develops a larger sourced argument with a reader
question, central tension, evidence, counterargument, and durable takeaway.

This section is the roadmap for all three types. `prototype-note` is the first
implemented expansion; `concept` and `essay` remain roadmap-only and must not
inherit the prototype-note structure by default.

## Inputs

| Argument | Required | Description |
|----------|----------|-------------|
| `--packet <path>` | yes | Loop 2 `loop2-development-packet.v1` JSON |
| `--issue <path>` | yes | Source intake issue Markdown |
| `--recommendation <path>` | yes | Approved `loop1-reviewed-recommendation.v1` JSON |
| `--out-dir <path>` | yes | Output directory (use `/tmp`) |
| `--related-dir <dir>` | no | Extra related material for claim validation |

## Outputs

| File | When |
|------|------|
| `loop3-<n>-draft.md` | Gate passed + validation passed |
| `loop3-<n>-draft-report.json` | Always on success |
| `loop3-<n>-gate-blocked.json` | Hard gate refusal |
| `failed/loop3-<n>-draft.md` | Validation failed |
| `failed/loop3-<n>-draft-report.json` | Validation failed |

Successful and failed drafting reports fingerprint the exact packet, issue, recommendation, and generated draft bytes with lowercase SHA-256 values. Gate-blocked reports fingerprint their three inputs but have no generated-draft hash. Downstream loops reject legacy reports that lack these fingerprints.

## Threat model

These are **content-integrity fingerprints**, not cryptographic immutability or tamper-proof provenance.

The hashes detect accidental edits, stale inputs, substituted files, and ordinary same-path mutation.

The Loop 4 sidecar detects changes to the evaluation JSON when the sidecar has not also been regenerated.

The mechanism does not defend against an actor deliberately modifying an artifact and recomputing all associated hashes or sidecars.

Stronger tamper resistance would require anchoring hashes in trusted external state such as a Git commit, signed manifest, or append-only ledger.

## Frontmatter convention

Drafts include required DFW frontmatter:

- `title`, `description`, `draft: true`, `documentType`, `theme`, `status: draft`
- `sourceNote`, `domainPath`, `relatedPieces`, `canonical: false`
- `draftDate` — internal draft generation date (`YYYY-MM-DD` at run time)
- `pubDate` — **omitted** from Loop 3 outputs; set only when a piece is publication-ready

## Drafting behavior

Deterministic template assembly from packet fields only:

- verified observations
- approved inferences
- explicitly marked speculation
- related material references (metadata only unless `--related-dir` loaded)

Does **not** invent sources, quotes, statistics, company facts, implementation details, or examples absent from the packet.

`relatedPieces` accepts only explicitly approved stable content slugs or repository-relative content identifiers. Temporary paths, intake/cache filenames, local absolute paths, raw issue-body paths, and GitHub issue references are rejected. When no stable related piece is approved, the runner emits `relatedPieces: []`.

Descriptions are derived from the packet's central distinction, observation, and significance. If a generated body is below the canonical target range (200–600 words for a note; 500–1,200 for a field report), the runner keeps the bounded draft, adds a non-blocking scaffold warning to the report, and does not pad it.

## Anti-invention validation

Post-generation checks:

- factual sentences must overlap allowed claim corpus
- speculation labeled in draft body
- unresolved questions and evidence gaps preserved
- no silent satisfaction of `sourceRequirements`
- no unsupported named entities, statistics, or quotations

Validation failure → draft preserved under `failed/`, run marked failed, exit `1`.

## Commands

```bash
# Sanitized ready note fixture
npm run loop:draft -- \
  --packet scripts/fixtures/loop3/packet-ready-note.json \
  --issue scripts/fixtures/loop3/issue-ready-note.md \
  --recommendation scripts/fixtures/loop3/recommendation-ready-note.json \
  --out-dir /tmp/dfw-loop3-smoke/ready

# Sanitized prototype-note fixture
npm run loop:draft:fixtures

# Real evaluation (#18)
npm run loop:draft -- \
  --packet /tmp/dfw-loop2-precommit/reg/0018/loop2-18-packet.json \
  --issue /tmp/dfw-intake-issues-cache-20260710-124022/issues/0018-dfw-intake-skills-half-life.md \
  --recommendation /tmp/dfw-loop2-eval/recommendations/issue-0018.json \
  --out-dir /tmp/dfw-loop3-eval/0018
```

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Draft produced and validation passed |
| `2` | Hard gate blocked — no prose |
| `1` | Validation failed or runtime error |

## Prohibitions

- No GitHub fetch or mutation
- No publication
- No editorial revision loop
- No Loop 3 research or cluster resolution
