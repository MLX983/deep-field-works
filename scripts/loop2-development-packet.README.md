# Loop 2 — Development Packet

Local runner that converts an approved Loop 1 recommendation and source intake issue into a structured `loop2-development-packet.v1` JSON packet.

**Runner:** `scripts/loop2-development-packet.mjs`  
**Schema:** `docs/contracts/loop2-development-packet.v1.schema.json`  
**Design:** `docs/contracts/loop2-development-packet.v1.design.md`

Loop 2 does **not** generate article prose, mutate GitHub, or implement Loop 3.

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

Pinned combine targets from `relatedMaterial` (`#21`, `#20`) are loaded from the intake cache when available.

## Draft readiness rules

Loop 2 does **not** map disposition directly to `draftReadiness`. Disposition is a hint; source sufficiency is assessed independently.

### Decision order

1. `not-for-publication` — operational or administrative material
2. `combine-first` — combine disposition, named `#N` destination, or duplicate cluster override
3. `research-required` — research disposition, unverified external claims, or verification flags
4. `insufficient-material` — thin source, partial sufficiency, or non-develop dispositions
5. `ready` — develop independently **and** `sourceSufficiency.status = sufficient` **and** no blockers

### `ready` requires

- Approved Loop 1 recommendation
- `sourceSufficiency.status = sufficient`
- No unresolved combine requirement
- No source verification blocker
- No drafting path that would require invented support

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
| duplicate cluster + `#21` target | `combine-first` |

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
