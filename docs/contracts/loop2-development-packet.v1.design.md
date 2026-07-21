# loop2-development-packet.v1 — design specification

**Status:** design only — not implemented  
**Upstream:** approved `loop1-reviewed-recommendation.v1` + source issue + corpus context  
**Baseline dependency:** Loop 1 runner at `b7d2a11`

## Purpose

Loop 2 transforms editorial intent into a **development packet**: structured material a human editor (or a later drafting loop) can use to decide whether and how to develop a piece.

Loop 2 does **not** always produce a draft. It may conclude that research, combination, or more source verification is required first.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Source issue | yes | Full intake issue (Markdown or normalized issue record) |
| Approved Loop 1 recommendation | yes | `loop1-reviewed-recommendation.v1` with `humanApprovalStatus: approved` |
| Source-of-truth documents | yes | Relevant files under `docs/source-of-truth/` |
| Related backlog | no | Linked intake issues and open backlog items |
| Published corpus | no | Articles, field notes, checkpoints matching `relatedMaterial` |

## Output contract (proposed)

**Name:** `loop2-development-packet.v1`

```json
{
  "contractVersion": "loop2-development-packet.v1",
  "issueReference": {
    "number": 18,
    "title": "Skills half-life",
    "url": "https://github.com/MLX983/dfw-intake/issues/18"
  },
  "approvedArtifactType": "note",
  "primaryDomain": "Human-Machine Workflows",
  "theme": "AI skill adaptation",
  "workingTitle": "",
  "readerQuestion": "",
  "centralTension": "",
  "verifiedObservations": [],
  "inferences": [],
  "speculation": [],
  "developmentMaterial": [],
  "sourceRequirements": [],
  "evidenceGaps": [],
  "relatedMaterial": [],
  "recommendedStructure": [],
  "unresolvedQuestions": [],
  "draftReadiness": "ready",
  "nextAction": ""
}
```

### Field definitions

| Field | Description |
|-------|-------------|
| `issueReference` | Stable pointer to the source intake issue |
| `approvedArtifactType` | From reviewed recommendation `suggestedArtifact` |
| `primaryDomain` | Canonical DFW domain |
| `theme` | Theme or cluster label |
| `workingTitle` | Provisional title if development proceeds |
| `readerQuestion` | What a reader should learn or decide |
| `centralTension` | Core friction the piece would explore |
| `verifiedObservations` | Claims tied to verified sources or explicit issue observations |
| `inferences` | Reasonable interpretations not yet fully evidenced |
| `speculation` | Hypotheses explicitly marked provisional |
| `developmentMaterial` | Approved conceptual grounding with role, evidence posture, and source/review provenance; not verified evidence |
| `sourceRequirements` | Sources that must be verified or obtained before drafting |
| `evidenceGaps` | Missing proof, examples, or counterevidence |
| `relatedMaterial` | `{ reference, role, note? }` for backlog and published pieces |
| `recommendedStructure` | Ordered section or argument outline |
| `unresolvedQuestions` | Open questions blocking or shaping development |
| `draftReadiness` | Whether a draft pass is appropriate now |
| `nextAction` | Single concrete step for human or Loop 3 |

### `draftReadiness` values

| Value | Meaning |
|-------|---------|
| `ready` | Enough approved, source-grounded material to begin a constrained draft without inventing support |
| `research-required` | Source verification or field reporting must precede drafting |
| `combine-first` | Material should merge into an existing cluster before standalone development |
| `insufficient-material` | Observation exists but cannot yet support even a short note |
| `not-for-publication` | Preserve for archive/context only |

## Explicit non-goals

Loop 2 must not:

- Post GitHub comments or mutate issues
- Publish or change canonical status
- Emit retrieval scores, evaluator JSON, or model traces in the packet
- Guarantee draft output on every run

## Processing outline (future implementation)

1. Validate approved Loop 1 recommendation.
2. Load source issue and cited related material.
3. Pull applicable source-of-truth constraints (artifact types, voice, domain rules).
4. Separate observation / inference / speculation from issue body and verified sources.
5. Assess evidence gaps and combination opportunities.
6. Set `draftReadiness` from disposition + material sufficiency.
7. Emit packet only — drafting is a separate downstream step.

## Expected behavior examples

Derived from approved manual recommendations on issues #18, #19, #27, and #28.

### #18 — Skills half-life → `ready`

| Field | Expected shape |
|-------|----------------|
| `approvedArtifactType` | `note` |
| `draftReadiness` | `ready` |
| `centralTension` | Tool-specific skills decay before habits form; value migrates toward platform and governance layers |
| `evidenceGaps` | Measures for adaptation pace; proof distinguishing technique vs workflow vs judgment half-lives |
| `nextAction` | Outline a concise note with explicit observation/inference/speculation separation |

Rationale: Reviewed disposition is `develop independently` as a note; material is compact but sufficient for a bounded note draft after structuring.

### #19 — Google's ARD standard → `research-required`

| Field | Expected shape |
|-------|----------------|
| `approvedArtifactType` | `seed` (potential field report) |
| `draftReadiness` | `research-required` |
| `sourceRequirements` | Primary ARD announcement / specification; confirmation of authorization vs discovery scope |
| `evidenceGaps` | What the standard exposes, authorizes, and leaves to external governance |
| `nextAction` | Verify ARD sources before expanding beyond a seed |

Rationale: Reviewed disposition is `research before development`; field-report ambition is premature without verified sources.

### #27 — Loop engineering as an update to Agile → `combine-first`

| Field | Expected shape |
|-------|----------------|
| `approvedArtifactType` | supporting note or section within loop-engineering cluster |
| `draftReadiness` | `combine-first` |
| `relatedMaterial` | `#21` as primary cluster anchor |
| `recommendedStructure` | Possible Agile comparison section or counterpoint inside larger loop-engineering piece |
| `nextAction` | File Agile framing as subsection material for #21 cluster; do not open standalone draft |

Rationale: Reviewed disposition is `combine with existing material`; Agile analogy is supporting lens, not standalone artifact.

### #28 — Memory tools have a flaw → `combine-first`

| Field | Expected shape |
|-------|----------------|
| `approvedArtifactType` | `supporting seed` |
| `draftReadiness` | `combine-first` |
| `relatedMaterial` | `#20` as primary merge target |
| `evidenceGaps` | Whether cited source adds new evidence vs restates #20 |
| `nextAction` | Extract distinct examples from #28 for merge into #20 development |

Rationale: Reviewed disposition is `combine with overlapping material`; independent publication is not the near-term path.

## Open architecture decisions

1. **Packet storage** — git-tracked JSON under `docs/development-packets/`, intake-repo comment only, or `/tmp` for experiments?
2. **Source verification** — does Loop 2 fetch external URLs, or only flag `sourceRequirements` for humans?
3. **Corpus scope** — same roots as Loop 1 retrieval, or narrower domain-scoped slice?
4. **Combination semantics** — should `combine-first` emit merge instructions for a target issue/piece ID?
5. **Draft handoff** — is Loop 3 a separate "draft generator" that requires `draftReadiness: ready`, or a manual-only step for now?
6. **Recommendation drift** — how to mark packets `superseded` when a newer approved Loop 1 record exists?

## Relationship to other contracts

```
Intake issue (Markdown)
        ↓
Loop 1 runner → provisional Markdown (+ optional trace)
        ↓ human review
loop1-reviewed-recommendation.v1 (approved)
        ↓
Loop 2 (future) → loop2-development-packet.v1
        ↓ optional future Loop 3
Draft artifact in corpus
```
