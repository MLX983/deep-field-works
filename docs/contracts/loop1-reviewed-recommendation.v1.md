# loop1-reviewed-recommendation.v1

Human-reviewed editorial recommendation produced **after** Loop 1 intake understanding. This is the durable handoff record for Loop 2 and manual GitHub guidance.

Machine schema: `loop1-reviewed-recommendation.v1.schema.json`

## Scope

**Include only fields useful to downstream processing:**

| Field | Required | Notes |
|-------|----------|-------|
| `contractVersion` | yes | Always `loop1-reviewed-recommendation.v1` |
| `issueNumber` | yes | Intake repo issue number |
| `disposition` | yes | Reviewed editorial stance |
| `suggestedArtifact` | yes | Smallest adequate artifact or supporting role |
| `primaryDomain` | yes | One canonical DFW domain |
| `themeOrCluster` | no | Omit when unset |
| `rationale` | yes | 1–2 concise sentences |
| `relatedMaterial` | no | Array of `{ reference, note? }`; omit when empty |
| `nextAction` | yes | One concrete step |
| `uncertaintyOrReviewFlag` | no | Omit when none |
| `humanApprovalStatus` | yes | `pending`, `approved`, `rejected`, or `superseded` |
| `reviewedAt` | no | Set when approved or superseded |
| `reviewedBy` | no | Optional reviewer label |
| `sourceLoop1Run` | no | Optional run label; not a trace |

## Explicitly excluded

Do not store in this contract:

- Retrieval scores or ranked match lists
- Matched terms
- Evaluator `PASS` / `REVISE` / `ESCALATE` diagnostics or `checks` objects
- Copied intake body or HTML
- Model prompts, traces, or raw Loop 1 Markdown

## Disposition vocabulary

Reviewed dispositions observed in the manual trial:

- `develop independently`
- `research before development`
- `combine with existing material`
- `combine with overlapping material`

Additional allowed values for edge cases: `preserve as seed`, `defer`, `needs human judgment`, `not for publication`.

## GitHub comment mapping

Manual GitHub comments may use this Markdown structure; the v1 contract is the normalized JSON equivalent:

```md
## Editorial recommendation

**Disposition:** …
**Suggested artifact:** …
**Primary domain:** …
**Theme / cluster:** …

**Rationale:** …

**Related material:** …

**Next action:** …

**Review flag:** …
```

Omit empty sections in comments. Populate `uncertaintyOrReviewFlag` only when meaningful.

## Example records (approved manual trial)

### Issue #18

```json
{
  "contractVersion": "loop1-reviewed-recommendation.v1",
  "issueNumber": 18,
  "disposition": "develop independently",
  "suggestedArtifact": "note",
  "primaryDomain": "Human-Machine Workflows",
  "themeOrCluster": "AI skill adaptation",
  "rationale": "The distinction is useful and compact, but the evidence is not developed enough for an essay. A short note can preserve the idea without overstating it.",
  "nextAction": "Develop a concise note defining what \"skills half-life\" means in AI-supported work and identify what evidence would strengthen or weaken the claim.",
  "uncertaintyOrReviewFlag": "Keep observation, inference, and speculation clearly separated.",
  "humanApprovalStatus": "approved"
}
```

### Issue #19

```json
{
  "contractVersion": "loop1-reviewed-recommendation.v1",
  "issueNumber": 19,
  "disposition": "research before development",
  "suggestedArtifact": "seed, with potential to become a field report",
  "primaryDomain": "Human-Machine Workflows",
  "themeOrCluster": "agent discovery and governance",
  "rationale": "The signal may illustrate the difference between discovering available agent capabilities and authorizing their use. The source and implementation details should be verified before treating it as a field report.",
  "relatedMaterial": [
    {
      "reference": "agent authority, governance, permissions, and control surfaces",
      "note": "Connect to existing corpus themes."
    }
  ],
  "nextAction": "Verify the ARD announcement and document what the standard actually exposes, what it authorizes, and what governance remains outside the protocol.",
  "uncertaintyOrReviewFlag": "Confirm whether ARD governs authorization or only capability discovery before developing the piece.",
  "humanApprovalStatus": "approved"
}
```

### Issue #27

```json
{
  "contractVersion": "loop1-reviewed-recommendation.v1",
  "issueNumber": 27,
  "disposition": "combine with existing material",
  "suggestedArtifact": "supporting note or section within the loop-engineering cluster",
  "primaryDomain": "Human-Machine Workflows",
  "themeOrCluster": "agent evaluation and loop engineering",
  "rationale": "The Agile comparison may be useful, but the issue does not yet justify a separate standalone piece. Its stronger role is to extend the existing loop-engineering material with a process and evaluation lens.",
  "relatedMaterial": [
    { "reference": "#21", "note": "existing loop-engineering material" }
  ],
  "nextAction": "Preserve the Agile framing as a possible section or counterpoint when the larger loop-engineering piece is developed.",
  "uncertaintyOrReviewFlag": "Human judgment is still needed on whether the Agile comparison clarifies the model or forces an analogy that is too broad.",
  "humanApprovalStatus": "approved"
}
```

### Issue #28

```json
{
  "contractVersion": "loop1-reviewed-recommendation.v1",
  "issueNumber": 28,
  "disposition": "combine with overlapping material",
  "suggestedArtifact": "supporting seed",
  "primaryDomain": "Cognitive Infrastructure",
  "themeOrCluster": "memory governance",
  "rationale": "This substantially overlaps the existing memory-system material and is more useful as supporting evidence than as an independent piece.",
  "relatedMaterial": [
    { "reference": "#20", "note": "primary related issue" }
  ],
  "nextAction": "Preserve the distinct evidence or examples from this issue and merge them into #20 when that material is developed.",
  "uncertaintyOrReviewFlag": "Verify that the supporting source adds evidence rather than merely restating the same claim.",
  "humanApprovalStatus": "approved"
}
```

## Prohibitions

- No GitHub comment automation is defined by this contract.
- `humanApprovalStatus: approved` is required before Loop 2 ingestion.
