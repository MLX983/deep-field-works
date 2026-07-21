# Loop 2 — Development Packet

Local runner that converts an approved Loop 1 recommendation and source intake issue into a structured `loop2-development-packet.v1` JSON packet.

**Runner:** `scripts/loop2-development-packet.mjs`  
**Schema:** `docs/contracts/loop2-development-packet.v1.schema.json`  
**Design:** `docs/contracts/loop2-development-packet.v1.design.md`

Loop 2 does **not** generate article prose, mutate GitHub, or implement Loop 3.

First-class packet generation currently supports the existing artifact
behavior plus structured grounding for `prototype-note`.

## Purpose

Produce a development packet that separates:

- verified observations
- inferences
- speculation
- evidence gaps
- combine or research requirements
- draft readiness

When `draftReadiness` is not `ready`, the runner writes the packet, prints a blocking condition, exits with code `2`, and stops.

## Inputs

| Argument | Required | Description |
|----------|----------|-------------|
| `--issue <path>` | yes | Source intake issue Markdown |
| `--recommendation <path>` | yes | Approved `loop1-reviewed-recommendation.v1` JSON |
| `--out-dir <path>` | yes | Output directory under `/tmp` |
| `--intake-cache <dir>` | no | Cached backlog issues for related-material retrieval |

## Outputs

| File | Contents |
|------|----------|
| `loop2-<n>-packet.json` | Full development packet |
| `loop2-<n>-summary.md` | Human-readable summary and blocking condition only |

No article prose is written.

## Prototype-note grounding

Loop 2 recognizes `prototype-note` and `prototype note`, and emits the canonical
artifact type `prototype-note`.

The source issue must provide every prototype field explicitly:

```md
## The design problem

Source-grounded problem statement.

## The interaction choice

Source-grounded design decision.

## How the control surface is grouped

### Group title

- Explicit item

## Design principles

- Explicit principle

## Current state

Explicit implementation or testing boundary.
```

The generated `prototypeNote` object copies these sections into:

- `designProblem`
- `interactionChoice`
- `interactionGroups`
- `designPrinciples`
- `currentState`

Loop 2 does not infer missing prototype details from the recommendation,
ordinary claims, related material, or generic defaults. If any required field,
group title, or group item is absent, Loop 2 exits with code `1`, names every
missing field, and writes neither a packet nor a summary.

## Test input layers

| Layer | Location | Use |
|-------|----------|-----|
| Sanitized tracked fixtures | `scripts/fixtures/intake-issues/`, `scripts/fixtures/loop1-recommendations/` | Smoke tests only |
| Real issue bodies | `/tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues/` | Manual evaluation |
| Reviewed recommendations | `/tmp/dfw-loop2-eval/recommendations/` | Approved Loop 1 JSON for #18, #19, #27, #28 |
| Run outputs | `/tmp/dfw-loop2-eval/runs/<issue>/` | Packet JSON and summaries |

## Commands

```bash
# Smoke test
npm run loop:packet -- \
  --issue scripts/fixtures/intake-issues/issue-001-minimal-seed.md \
  --recommendation scripts/fixtures/loop1-recommendations/issue-9001-minimal.json \
  --out-dir /tmp/dfw-loop2-smoke

# Sanitized prototype-note fixtures
npm run loop:packet:fixtures

# Manual evaluation example (#18)
npm run loop:packet -- \
  --issue /tmp/dfw-intake-issues-cache-20260710-124022/issues/0018-dfw-intake-skills-half-life.md \
  --recommendation /tmp/dfw-loop2-eval/recommendations/issue-0018.json \
  --intake-cache /tmp/dfw-intake-issues-cache-20260710-124022/issues \
  --out-dir /tmp/dfw-loop2-eval/runs/0018
```

## Retrieval behavior

Loop 2 retrieves from:

- `docs/source-of-truth/` summaries (always included)
- published and draft DFW corpus under `src/content/`
- cached backlog issues when `--intake-cache` is provided

Retrieval prefers content-bearing text from titles, excerpts, and body content. It down-weights broad metadata terms (`dfw`, `intake`, `issue`, `seed`, etc.) and does not rank primarily on labels or filenames.

Approved combine targets are selected by `combineTargetReference` and loaded
from the intake cache when available. For backward compatibility, a combine
disposition with exactly one `#N` related-material reference can still use that
unambiguous reference as its target. Other issue references remain related
material and do not imply combine intent.

## Draft readiness rules

Loop 2 does **not** map disposition directly to `draftReadiness`. Disposition is a hint; source sufficiency is assessed independently.

### Decision order

1. `not-for-publication` — operational or administrative material
2. `combine-first` — approved combine disposition with a resolved target
3. `research-required` — research disposition, unverified external claims, or verification flags
4. `insufficient-material` — thin source, partial sufficiency, or non-develop dispositions
5. `ready` — develop independently **and** `sourceSufficiency.status = sufficient` **and** no blockers

### `ready` requires

- Approved Loop 1 recommendation
- `sourceSufficiency.status = sufficient`
- No unresolved combine requirement
- No source verification blocker
- No drafting path that would require invented support

Reviewed next actions and review flags trigger `research-required` only when
they explicitly require research, verification, validation, evidence gathering,
sourcing, citations, factual support, or fact-checking. A standalone keyword or
conceptual discussion of verification is not enough.

Current-state cautions remain compatible with `ready` when the source is
otherwise sufficient. In particular, a review flag does not block merely
because it mentions a source, describes a prototype as proposed or untested,
preserves an evidence boundary, or warns against presenting unimplemented
behavior as observed fact. Explicit instructions such as “verify the cited
source before proceeding” or “additional evidence is needed” remain blockers.
Negated requirements such as “research is not required” do not block.

### `sourceSufficiency`

Every packet includes:

```json
{
  "sourceSufficiency": {
    "status": "sufficient | partial | insufficient",
    "reasons": [],
    "missingElements": []
  }
}
```

Assessed factors include: clear claim/question, artifact-type substance threshold, unverified external dependencies, central tension from source, combine requirement, and speculation risk.

| Reviewed disposition | Typical `draftReadiness` |
|----------------------|---------------------------|
| develop independently | `ready` only when source sufficiency is sufficient |
| research before development | `research-required` |
| combine with existing / overlapping material | `combine-first` |
| preserve as seed / defer / needs human judgment | `insufficient-material` |
| not for publication | `not-for-publication` |

### combine-first requirements

Packet must include `combinationPlan` with:

- `targetReference` (e.g. `#21`)
- `materialToCarryForward`
- `doNotStandalone: true`

The reviewed recommendation should provide `combineTargetReference` when more
than one issue appears in `relatedMaterial`. Exact issue references identify
artifacts; only the approved combine disposition and resolved target assign the
`combine-target` role.

### research-required requirements

Packet must include:

- `sourceRequirements`
- `evidenceGaps`
- `researchPlan.claimsRequiringVerification`
- `researchPlan.evidenceNeededForReady`

## Adversarial fixtures

Tracked under `scripts/fixtures/loop2-adversarial/`:

| Fixture | Expected `draftReadiness` |
|---------|---------------------------|
| thin body + develop independently | `insufficient-material` |
| unverified external + develop independently | `research-required` |
| bounded ready note | `ready` |
| approved combine disposition + `#21` target | `combine-first` |

Prototype-note fixtures additionally verify:

- schema-valid structured grounding
- canonical artifact-type output
- clear refusal when grounding is incomplete
- no packet or summary on grounding failure
- phrase-level review-flag readiness, including explicit negation

The readiness fixture suite also preserves existing non-prototype behavior for
ready, insufficient-material, and unverified-external cases.

## Known follow-up

Generated Loop 2 packets now use omission as the canonical representation when
no `blockingCondition` exists. Some legacy Loop 3 documentation and synthetic
Loop 4/5 fixtures still allow or contain `null`; current downstream consumers
accept both representations. Cleanup was intentionally deferred.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Packet produced; `draftReadiness: ready` |
| `2` | Packet produced; blocked before drafting |
| `1` | Validation or runtime error |

## Prohibitions

- No GitHub mutation
- No automatic issue fetching
- No article prose generation
- No Loop 3 implementation

## Related contracts

- Upstream: `loop1-reviewed-recommendation.v1`
- Output: `loop2-development-packet.v1`
