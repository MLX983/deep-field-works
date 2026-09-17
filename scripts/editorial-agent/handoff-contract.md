# Future Editorial Agent handoff contract

This document defines a boundary for a future integration. It does not connect
the Editorial Agent to the bounded publishing processor, create an approval, or
authorize Loop 2 or publication.

## Boundary

The Editorial Agent produces a provisional editorial run and stops at
`awaiting-human-editorial-review`. Its result, draft, classifications, research,
and proposed connections remain recommendations. Model success, schema validity,
and editorial quality do not constitute approval.

A future handoff requires two separate records:

1. An immutable proposal generated from the completed Editorial Agent run.
2. A human decision bound to the proposal and its source fingerprints.

The publishing operator may consume the human-approved fields only after an
adapter validates both records. It must continue to honor the canonical bounded
publishing contracts and stop boundaries in
`docs/workflows/bounded-publishing-operator-runbook.md`.

## Proposal record

Proposed contract name: `dfw-editorial-handoff-proposal.v0`.

Required fields:

| Field | Purpose |
| --- | --- |
| `contractVersion` | Exact proposal contract identifier. |
| `runId` and `agentVersion` | Identify the preserved Editorial Agent run. |
| `runPath` | Absolute private path to the preserved run. |
| `issueNumber`, `sourceUrl`, `sourceBodySha256` | Bind the proposal to the intake source. |
| `repositoryCommit` | Record the repository state used by the experiment. |
| `resultPath`, `resultSha256` | Bind the structured recommendation. |
| `draftPath`, `draftSha256` | Bind the proposed prose without approving it. |
| `manifestPath`, `manifestSha256` | Bind runtime and model evidence. |
| `modelPolicy` and `fallbackOccurred` | Surface requested and actual phase runtimes. |
| `recommendationProposal` | A provisional mapping to the existing reviewed-recommendation fields. |
| `humanApprovalStatus` | Must be `pending` in an agent-created proposal. |

`recommendationProposal` may propose `disposition`, `suggestedArtifact`,
`primaryDomain`, `themeOrCluster`, `rationale`, `relatedMaterial`,
`researchRequirements`, `nextAction`, and `uncertaintyOrReviewFlag`. It must not
contain `reviewedBy`, `reviewedAt`, or an approved status.

Do not include private KB prose, unselected exemplar prose, prompts, model traces,
scratchpad entries, research-page captures, or hidden reasoning in the handoff.
Those artifacts remain available to the human reviewer by their bound run path.

## Human decision record

Proposed contract name: `dfw-editorial-human-decision.v0`.

It must contain the proposal path and SHA-256, repeat the source/result/draft
fingerprints, identify the reviewer and review time, and record one decision:
`approved`, `rejected`, or `revise`. An approved decision must include a complete
human-reviewed recommendation conforming to
`loop1-reviewed-recommendation.v1`; rejected and revise decisions must not.

The reviewer must compare the complete source, result, draft, selected context,
research basis, uncertainties, and model report. The reviewer owns every approved
recommendation field. A mechanical copy of the agent proposal is insufficient.

## Publishing adapter requirements

A future adapter must fail closed unless all fingerprints match, the source issue
is unchanged, the repository state satisfies the operator runbook, the decision
is explicitly approved, and `fallbackOccurred` is false. It must reject unknown
fields or contract versions and preserve both input records unchanged.

The current processor also requires a Loop 1 review packet and a
`backlog-loop1-review-envelope.v2` bound to the Loop 1 result and processing
commits. Until the canonical workflow is explicitly changed, an Editorial Agent
decision cannot replace those records. A future adapter would have to translate
the approved recommendation into the existing envelope only after the normal
Loop 1 binding values exist and a human confirms the translation.

The adapter must never publish directly, mutate the intake issue, infer approval
from silence, run beyond the operator's requested stop, or send a notification as
a side effect of handoff creation.
