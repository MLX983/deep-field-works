# Deep Field Works Development Backlog

This is the canonical durable register for deferred improvements to the Deep
Field Works publishing pipeline, tooling, retrieval, governance, editorial
quality, observability, and automation. It is not the content seed backlog and
must not duplicate open `MLX983/dfw-intake` issues.

## How to use this backlog

Use stable IDs in the form `DFW-BL-NNN`. Never renumber an existing item. Each
item records:

- ID and title
- category
- status
- priority
- where it was discovered
- problem or observation
- current safeguard
- desired improvement
- reason deferred
- dependencies or prerequisites
- validation criteria
- relevant issues, commits, or artifacts

Controlled vocabulary:

- **Status:** `proposed`, `accepted`, `planned`, `in progress`, `blocked`,
  `completed`, `declined`
- **Priority:** `critical`, `high`, `medium`, `low`
- **Category:** `safety`, `workflow`, `retrieval`, `editorial quality`,
  `governance`, `observability`, `automation`, `developer experience`,
  `technical debt`

An item may use more than one category when the boundary is material. Proposed
items require investigation before they can be planned.

## Backlog

### DFW-BL-001 — Detect high-confidence duplication earlier in Loop 1

- **Category:** retrieval, workflow
- **Status:** accepted
- **Priority:** medium
- **Discovered during:** real-backlog pilot, issue #28
- **Problem or observation:** The provisional Loop 1 proposal recommended
  research toward a field report even though retrieval ranked issue #20,
  “Memory systems need influence controls,” as a probable direct duplicate.
  The retrieval-informed evaluator later corrected the disposition to
  combine-first.
- **Current safeguard:** The evaluator independently checks duplication and
  stronger-cluster risks before Loop 2. No draft was created, and issue #20
  remained the explicit combine target.
- **Desired improvement:** Make the provisional proposal use strong retrieval
  evidence more directly. A high-confidence issue-level duplicate at rank one
  should cause the provisional stage to consider combine-first or emit a
  duplicate warning.
- **Reason deferred:** The evaluator already prevents unsafe standalone
  development. This is an efficiency and consistency improvement, not a
  blocking safety defect.
- **Dependencies or prerequisites:** Define a reliable distinction between
  issue-level duplication and strong thematic adjacency.
- **Validation criteria:**
  - A near-duplicate top-ranked issue produces a provisional combine
    recommendation or duplicate warning.
  - Strong thematic adjacency alone does not force combine-first.
  - The evaluator retains its independent duplicate assessment.
  - Existing standalone and cluster-adjacent fixtures do not regress.
- **Relevant references:** dfw-intake issues #28 and #20; “Storage Is Not
  Memory”; content-integrity hardening commit
  `c7afbc2caa0648061281a98745d9d2deeeeb4fd6`

### DFW-BL-002 — Ground structural decisions directly in source-of-truth documents

- **Category:** governance, retrieval
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** governance-boundary pilot, issue #6
- **Problem or observation:** Loop 1 correctly stopped a proposed new artifact
  type and collection, but its strongest retrieval results were corpus pieces
  rather than `content-schema.md` or `domain-structure.md`.
- **Current safeguard:** The evaluator recognizes structural language and
  escalates taxonomy changes for human judgment. Repository instructions also
  require source-of-truth review before structural changes.
- **Desired improvement:** Ground structural and taxonomy recommendations
  directly in the relevant source-of-truth documents.
- **Reason deferred:** The governance stop worked; the exact retrieval and
  citation scope has not been assessed.
- **Dependencies or prerequisites:** Investigate which decisions require which
  canonical documents and how that grounding should appear in Loop 1 output.
- **Validation criteria:** A structural proposal cites the relevant canonical
  constraints, does not invent a type or domain, and still stops for human
  approval.
- **Relevant references:** dfw-intake issue #6;
  `docs/source-of-truth/content-schema.md`;
  `docs/source-of-truth/domain-structure.md`

### DFW-BL-003 — Improve ranking of strong cluster anchors

- **Category:** retrieval
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** real-backlog pilots, issues #6 and #28
- **Problem or observation:** Loosely related material sometimes outranked a
  more useful cluster anchor. For issue #28, `context-inequality.md` ranked
  above “Storage Is Not Memory.”
- **Current safeguard:** The evaluator reviews the ranked set rather than
  accepting rank order as editorial authority.
- **Desired improvement:** Improve ranking quality when a known cluster anchor
  is more structurally relevant than a high-overlap but looser match.
- **Reason deferred:** Retrieval still surfaced the correct target and anchor;
  the failure modes and appropriate signals need formal assessment.
- **Dependencies or prerequisites:** Review more real retrieval traces and
  define what distinguishes an anchor from ordinary adjacency.
- **Validation criteria:** Representative anchor fixtures rank above loose
  adjacency without reducing direct-duplicate recall.
- **Relevant references:** issue #28 Loop 1 trace; issue #6 Loop 1 trace;
  “Storage Is Not Memory”

### DFW-BL-004 — Improve abstract but structurally valid drafts

- **Category:** editorial quality
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** end-to-end pilot, issue #12
- **Problem or observation:** A draft can pass structural and integrity checks
  while remaining overly abstract or using process-oriented language as
  reader-facing rationale.
- **Current safeguard:** Loop 4 can request a concrete example, and human
  editorial review remains required before publication.
- **Desired improvement:** Produce more concrete, reader-facing drafts without
  inventing evidence or broadening the approved scope.
- **Reason deferred:** The remaining weakness is editorial rather than a
  deterministic integrity defect, and its exact scope has not been assessed.
- **Dependencies or prerequisites:** Review accepted and rejected drafts to
  identify repeatable quality signals without turning style judgment into
  unsupported generation.
- **Validation criteria:** A focused fixture improves concreteness and removes
  process-oriented prose while preserving evidence posture, scope, and voice.
- **Relevant references:** dfw-intake issue #12; issue #12 regression
  artifacts; commit `c7afbc2caa0648061281a98745d9d2deeeeb4fd6`

### DFW-BL-005 — Add a manually invoked bounded backlog processor

- **Category:** automation, workflow, safety
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** bounded real-backlog pilots
- **Problem or observation:** Backlog issues are currently selected and run
  one at a time through manual commands.
- **Current safeguard:** Manual selection, isolated `/tmp` workspaces, explicit
  approval boundaries, and stage-specific stop conditions keep scope bounded.
- **Desired improvement:** Add a manually invoked processor that preserves
  bounded scope and all existing governance stops.
- **Reason deferred:** The pilot set must establish safe operating behavior
  before batch mechanics are planned.
- **Dependencies or prerequisites:** Investigate batch size, idempotency,
  resume behavior, failure isolation, and approval boundaries.
- **Validation criteria:** A bounded dry run processes only its explicit
  selection, stops correctly per issue, and performs no publication or issue
  mutation.
- **Relevant references:** issue #12, #6, and #28 pilot artifacts; Loop 3–5
  orchestration manifest contract

### DFW-BL-006 — Add automatic intake triggering after bounded processing is proven

- **Category:** automation, safety
- **Status:** proposed
- **Priority:** low
- **Discovered during:** publishing-pipeline planning
- **Problem or observation:** New email or issue events do not automatically
  initiate the pipeline.
- **Current safeguard:** Every run is manually selected and initiated.
- **Desired improvement:** Consider automatic new-email or new-issue
  triggering only after bounded backlog processing is proven safe.
- **Reason deferred:** Automatic triggers would expand operational risk before
  bounded processing, retry behavior, and human-review controls are validated.
- **Dependencies or prerequisites:** DFW-BL-005 and an investigation of event
  deduplication, failure handling, and authorization boundaries.
- **Validation criteria:** No trigger can bypass intake, development, human
  review, or publication gates; duplicate events do not create duplicate work.
- **Relevant references:** publishing workflow; bounded real-backlog pilots

### DFW-BL-007 — Improve local provider credential handling

- **Category:** developer experience, technical debt, safety
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** review-notification provider testing
- **Problem or observation:** Local provider configuration required an ad hoc
  temporary bridge file during operation.
- **Current safeguard:** Secrets remain outside the repository, provider sends
  fail closed when configuration is absent, and dry runs require no
  credentials.
- **Desired improvement:** Provide a clearer supported local configuration
  path without storing secrets in the repository.
- **Reason deferred:** Provider notification already fails safely; the
  supported local secret source and operating constraints need investigation.
- **Dependencies or prerequisites:** Assess the existing local runtime,
  deployment environment, and secret-management options.
- **Validation criteria:** Local provider tests work through documented
  configuration, secrets never enter tracked files or logs, and missing
  configuration still fails before delivery.
- **Relevant references:** review-notification fixture suite; real-provider
  smoke-test artifacts

### DFW-BL-008 — Improve operational run observability

- **Category:** observability, workflow
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** bounded pilots and orchestration testing
- **Problem or observation:** Stage artifacts contain stop reasons, warnings,
  retries, human-review boundaries, and notification results, but operators
  must inspect several files to understand a run or a future batch.
- **Current safeguard:** Per-stage logs, integrity fingerprints, orchestration
  manifests, notification ledgers, and explicit final reports preserve the
  necessary evidence.
- **Desired improvement:** Make batch status, stop reasons, retries,
  human-review boundaries, and notifications easier to inspect together.
- **Reason deferred:** Single-issue runs remain auditable; batch observability
  requirements should follow the bounded-processor design.
- **Dependencies or prerequisites:** DFW-BL-005 and an inventory of existing
  manifest, log, and ledger fields.
- **Validation criteria:** An operator can identify each selected issue’s
  current stage, stop reason, retry state, review need, and notification
  outcome without losing links to underlying artifacts.
- **Relevant references:** Loop 3–5 orchestration manifest; Loop 5 revision
  reports; review-notification ledger

## Maintenance rules

- Update this backlog whenever a meaningful deferred issue is discovered.
- Do not use it as a substitute for fixing a critical active defect.
- Keep completed items with their completion commit and outcome.
- Keep declined items with the reason they were declined.
- Reference the backlog ID in implementation work.
- Avoid duplicate entries; extend an existing item when appropriate.
- Changes to this document do not authorize implementation.
