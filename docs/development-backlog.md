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
- relevant issues, commits, tests, or artifacts

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
- **Discovered during:** real-backlog pilots, issues #16 and #28
- **Problem or observation:** Loosely related material sometimes outranked a
  more useful cluster anchor. For issue #28, `context-inequality.md` ranked
  above “Storage Is Not Memory.”
- **Current safeguard:** The evaluator reviews the ranked set rather than
  accepting rank order as editorial authority.
- **Desired improvement:** Improve ranking quality when a known cluster anchor
  is more structurally relevant than a high-overlap but looser match.
- **Reason deferred:** Retrieval still surfaced the correct target and anchor;
  the failure modes and appropriate signals need formal assessment.
- **Dependencies or prerequisites:** Review more real retrieval traces,
  including cached-issue and repository candidates, and define what
  distinguishes an anchor from ordinary adjacency.
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
  reader-facing rationale. The issue #12 run also showed that meaningful
  evidence gaps may be omitted and that a concrete example can be necessary
  even when none is present in approved material.
- **Current safeguard:** Loop 4 can request a concrete example, and human
  editorial review remains required before publication.
- **Desired improvement:** Improve conceptual development, reader orientation,
  prose naturalness, visible uncertainty, and concrete-example handling
  without inventing evidence or broadening the approved scope. Distinguish
  optional examples from required ones and keep human requests narrow.
- **Reason deferred:** The remaining weakness is editorial rather than a
  deterministic integrity defect, and its exact scope has not been assessed.
- **Dependencies or prerequisites:** Review accepted and rejected drafts to
  identify repeatable quality signals, decide which gaps belong in public
  prose, and determine when approved material can supply an example.
- **Validation criteria:** Focused fixtures improve concreteness and remove
  process-oriented prose while preserving evidence posture, meaningful
  uncertainty, scope, and voice. Missing required examples still produce a
  grounded human request rather than invented material.
- **Relevant references:** dfw-intake issue #12; issue #12 regression
  artifacts; commit `c7afbc2caa0648061281a98745d9d2deeeeb4fd6`

### DFW-BL-005 — Add a manually invoked bounded backlog processor

- **Category:** automation, workflow, safety
- **Status:** in progress
- **Priority:** medium
- **Discovered during:** bounded real-backlog pilots
- **Problem or observation:** Backlog issues are currently selected and run
  one at a time through manual commands.
- **Current safeguard:** The implemented command requires an explicit limit,
  isolates issue and run workspaces, uses fingerprint-bound Loop 1 approval
  envelopes, records original and resume processor commits separately,
  preserves stable nondraft stops, and defaults notification to dry run. It
  has no scheduler, GitHub mutation, or publication path.
- **Desired improvement:** Add a manually invoked processor that preserves
  bounded scope and all existing governance stops. Investigate durable state,
  source fingerprints, strict limits, retries, concurrency claims,
  stale-claim recovery, resumability, terminal statuses, prioritization,
  cost/throughput controls, and review-capacity limits as parts of this parent
  item.
- **Reason deferred:** The bounded implementation, dual-commit resume fix,
  issue #1 nondraft resume, idempotent replay, and review-capacity validation
  are complete. Status remains in progress because the required direct
  read-only GitHub acquisition validation could not run in the current
  environment: the `gh` executable is not installed, so authentication and
  repeated direct dry-runs remain unverified.
- **Dependencies or prerequisites:** Define states including awaiting Loop 1
  review, combine-first, governance stop, waiting for human, retriable failure,
  terminal failure, completed notification, and changed source. Define an
  initial deterministic selection rule before exploring editorial priority.
- **Validation criteria:** A bounded dry run processes only its explicit
  selection, isolates each issue, resumes safely from recorded boundaries,
  respects cost and review-capacity limits, and performs no publication or
  issue mutation.
- **Relevant references:** issue #12, #6, and #28 pilot artifacts; Loop 3–5
  orchestration manifest contract; `scripts/backlog-process.mjs`;
  `scripts/backlog-process.README.md`; `backlog-registry.v2` and
  `backlog-loop1-review-envelope.v2` contracts;
  `npm run backlog:process:fixtures`

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
- **Desired improvement:** Make selected and skipped issues, source and
  processing fingerprints, dispositions, artifact paths, stop reasons,
  retries, failure categories, human-review boundaries, recommended actions,
  and notification state easier to inspect together.
- **Reason deferred:** Single-issue runs remain auditable; batch observability
  requirements should follow the bounded-processor design.
- **Dependencies or prerequisites:** DFW-BL-005 and an inventory of existing
  manifest, log, and ledger fields.
- **Validation criteria:** An operator can identify each selected issue’s
  current stage, stop reason, retry state, review need, and notification
  outcome without losing links to underlying artifacts.
- **Relevant references:** Loop 3–5 orchestration manifest; Loop 5 revision
  reports; review-notification ledger

### DFW-BL-009 — Formalize the Loop 1 reviewed-recommendation boundary

- **Category:** governance, safety, workflow
- **Status:** proposed
- **Priority:** high
- **Discovered during:** bounded real-backlog pilots
- **Problem or observation:** Pilot operators created reviewed-recommendation
  JSON after interpreting the Loop 1 proposal and evaluator. The contract
  requires `humanApprovalStatus: approved`, but the operational boundary
  between automated recommendation and human approval is not yet a complete
  workflow.
- **Current safeguard:** Loop 2 and Loop 3 require an approved reviewed
  recommendation. Pilot runs stop rather than silently treating human silence
  as approval.
- **Desired improvement:** Define what Loop 1 may decide, what the evaluator
  may recommend, what requires human approval, who creates the reviewed
  record, and how processing resumes.
- **Reason deferred:** This is an architectural governance decision; the
  current manual boundary remains safe.
- **Dependencies or prerequisites:** Reconcile the Loop 1 recommendation
  contract with the future bounded processor and human-review workflow.
- **Validation criteria:** A run without explicit approval stops at an
  unambiguous review state, records no fabricated approval, and resumes only
  from a matching reviewed recommendation.
- **Relevant references:** `loop1-reviewed-recommendation.v1`; Loop 2 and Loop
  3 approval gates; issue #6, #12, and #28 pilot artifacts

### DFW-BL-010 — Improve precision and role labeling of Loop 2 related material

- **Category:** retrieval, workflow
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** issue #28 combine-first pilot
- **Problem or observation:** Loop 2 can retain broadly related backlog entries
  that do not materially affect readiness, evidence, combination, or drafting.
- **Current safeguard:** Explicit combine targets and reviewed relationship
  roles remain authoritative; weak entries did not replace issue #20 or alter
  the stop decision.
- **Desired improvement:** Distinguish direct duplicates, combine targets,
  cluster anchors, supporting evidence, thematic adjacency, and retrieval
  noise more precisely.
- **Reason deferred:** Existing role and target safeguards are safe; the
  threshold for retaining weaker relations needs investigation.
- **Dependencies or prerequisites:** Review real Loop 2 packets and define
  editorially meaningful role and inclusion criteria.
- **Validation criteria:** Fixtures preserve explicit targets and useful
  anchors while excluding or labeling non-contributing retrieval noise.
- **Relevant references:** issue #28 Loop 2 packet; commit `bba561d`; related
  material fixtures

### DFW-BL-011 — Distinguish notification delivery and configuration states

- **Category:** observability, developer experience
- **Status:** completed
- **Priority:** medium
- **Discovered during:** issue #12 notification smoke test
- **Problem or observation:** Operators needed to distinguish missing
  configuration, provider failure, uncertain delivery, duplicate suppression,
  and successful delivery.
- **Current safeguard:** The notification command now fails before delivery
  when configuration is missing, records provider outcomes, suppresses
  successful duplicates, preserves retriable failures, and does not
  automatically retry uncertain in-flight attempts.
- **Desired improvement:** Completed: expose these states deterministically in
  notification plans, results, and ledger behavior.
- **Reason deferred:** No longer deferred; retained as regression history.
- **Dependencies or prerequisites:** Secure local credential loading remains
  open in DFW-BL-007.
- **Validation criteria:** Notification fixtures cover missing configuration,
  provider success, retriable failure, delivery uncertainty, duplicate
  suppression, and concurrent invocation.
- **Relevant references:** commit `c90cfd9`; `notify:review:fixtures`;
  `scripts/notify-review.README.md`

### DFW-BL-012 — Create stable issue-source snapshots

- **Category:** workflow, observability
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** bounded pilots using copied issue caches
- **Problem or observation:** Pilots reused read-only issue snapshots from
  earlier temporary workspaces. Command logs and hashes made them auditable,
  but the acquisition process is not durable.
- **Current safeguard:** Isolated caches, source URLs, command logs, and
  SHA-256 hashes preserve pilot provenance.
- **Desired improvement:** Define a snapshot record for source repository,
  fetch time, issue state and number, URL, source fingerprint, and batch
  identity.
- **Reason deferred:** Manual snapshots are sufficient for bounded pilots; the
  durable form should align with DFW-BL-005 and DFW-BL-020.
- **Dependencies or prerequisites:** Decide retention location and processing
  state boundaries without mutating GitHub.
- **Validation criteria:** A repeated run can prove which issue version it
  used and detect source changes before resuming.
- **Relevant references:** issue #6, #12, and #28 pilot caches and command logs

### DFW-BL-013 — Improve Codex sandbox and state-database ergonomics

- **Category:** developer experience, technical debt
- **Status:** proposed
- **Priority:** low
- **Discovered during:** issue #16 and issue #12 Loop 1 operations; DFW-BL-005
  bounded-processor validation
- **Problem or observation:** A sandboxed Loop 1 command could not initialize
  the existing Codex state database; the unchanged command succeeded with
  approved access.
- **Current safeguard:** Failure occurs before a proposal or partial workflow
  result is produced, and an approved rerun is explicit. The bounded processor
  records this as a retriable per-issue failure, releases the claim, preserves
  the failed workspace, and can retry without stopping later selected issues.
- **Desired improvement:** Determine whether workflow commands can avoid
  implicit Codex-local state dependencies or clearly document required access.
- **Reason deferred:** Approved reruns are reliable and the failure is
  operational rather than a content-integrity defect.
- **Dependencies or prerequisites:** Identify which Loop 1 runtime operations
  require Codex state and which can remain sandbox-local.
- **Validation criteria:** The command either runs within documented
  permissions or fails with a precise preflight message before model work.
- **Relevant references:** issue #16 pilot; issue #12 regression rerun logs;
  DFW-BL-005 operational validation workspace

### DFW-BL-014 — Preserve human-input request provenance

- **Category:** safety, observability
- **Status:** completed
- **Priority:** high
- **Discovered during:** issue #12 end-to-end pilot
- **Problem or observation:** Loop 5 emitted an example request containing
  language from an unrelated skills-half-life scenario.
- **Current safeguard:** Requests now contain the active issue number and exact
  active Loop 4 instruction. Missing grounding blocks safely, and review
  notifications carry the grounded request.
- **Desired improvement:** Completed: make every request traceable to the
  active evaluation and reject ungrounded requests.
- **Reason deferred:** No longer deferred; retained as content-integrity and
  regression history.
- **Dependencies or prerequisites:** None for the completed boundary.
- **Validation criteria:** Loop 5 and issue #12 regression fixtures reject
  missing grounding and prevent unrelated fixture language across repeated and
  parallel runs.
- **Relevant references:** commit
  `c7afbc2caa0648061281a98745d9d2deeeeb4fd6`;
  `loop:revise:fixtures`; `loop:issue12:regression`

### DFW-BL-015 — Protect reader-facing prose from intake metadata

- **Category:** safety, workflow
- **Status:** completed
- **Priority:** high
- **Discovered during:** issue #12 end-to-end pilot
- **Problem or observation:** Intake frontmatter and transport metadata entered
  Loop 2 development material and then reader-facing Loop 3 prose.
- **Current safeguard:** Loop 2 strips structurally identified intake metadata,
  YAML preambles, and transport headers while preserving legitimate quoted or
  fenced discussion.
- **Desired improvement:** Completed for the current GitHub email-intake
  format. Any future ingestion source must prove an equivalent structural
  boundary before use.
- **Reason deferred:** No longer deferred for current inputs; retained as
  regression history rather than as authorization for new ingestion work.
- **Dependencies or prerequisites:** Future sources should extend this item
  only after their structure is known.
- **Validation criteria:** Regression fixtures exclude structural metadata,
  preserve Markdown prose, and retain legitimate quoted metadata discussion.
- **Relevant references:** commit
  `c7afbc2caa0648061281a98745d9d2deeeeb4fd6`;
  `loop:issue12:regression`

### DFW-BL-016 — Extend supported-inquiry extraction conservatively

- **Category:** editorial quality, workflow
- **Status:** proposed
- **Priority:** low
- **Discovered during:** issue #12 defect hardening
- **Problem or observation:** The fabricated title-plus-domain question was
  removed, but meaningful tensions may also appear as declarative statements
  rather than explicit questions.
- **Current safeguard:** Only supported source inquiries are carried forward;
  absent support omits the question and Open Question section.
- **Desired improvement:** Investigate conservative recognition of declarative
  tensions without turning statements into unsupported questions.
- **Reason deferred:** The unsafe fallback is fixed; broader extraction quality
  needs evidence from real sources.
- **Dependencies or prerequisites:** Collect representative declarative
  tensions and define when they function as unresolved inquiry.
- **Validation criteria:** Supported tensions are preserved, title-plus-domain
  tautologies remain rejected, and absent support produces no fabricated prose.
- **Relevant references:** commit
  `c7afbc2caa0648061281a98745d9d2deeeeb4fd6`; issue #12 regression fixture

### DFW-BL-017 — Improve provisional artifact and domain classification

- **Category:** workflow, editorial quality
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** issue #6, #12, and #28 pilots
- **Problem or observation:** Provisional proposals inflated issue #12 toward a
  field report, assigned issue #6 an unnecessary secondary domain, and
  recommended field-report research with multiple domains for issue #28 before
  evaluator correction.
- **Current safeguard:** The evaluator corrects artifact inflation, domain
  overreach, and unsafe research or development recommendations before Loop 2.
- **Desired improvement:** Make provisional classification more conservative
  about field reports, multidomain assignments, and research recommendations.
- **Reason deferred:** The independent evaluator currently prevents unsafe
  development.
- **Dependencies or prerequisites:** Review corrected pilot classifications
  and define signals appropriate to the provisional stage.
- **Validation criteria:** Pilot-derived fixtures produce the smallest
  plausible artifact and one justified primary domain while preserving
  evaluator independence.
- **Relevant references:** issue #6, #12, and #28 Loop 1 traces

### DFW-BL-018 — Distinguish conceptual, normative, speculative, and empirical claims

- **Category:** editorial quality, retrieval
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** intake and Loop 2 pilots
- **Problem or observation:** Conceptual or normative statements can resemble
  empirical claims and create unnecessary research requirements or overstate
  evidence.
- **Current safeguard:** Reviewed recommendations and Loop 2 evidence posture
  distinguish verified observations, inference, mechanism, hypothesis, and
  speculation in several tested paths.
- **Desired improvement:** Investigate a clearer claim-role boundary including
  empirical claims and normative proposals.
- **Reason deferred:** Several false research blockers were already fixed, but
  the broader classification scope is not formally assessed.
- **Dependencies or prerequisites:** Gather examples such as nutrition-label
  user needs, chatbot-to-harness progression, and claims about ordinary users.
- **Validation criteria:** Fixtures route empirical claims to verification,
  retain conceptual and normative proposals without false research blockers,
  and keep speculation visible.
- **Relevant references:** commits `1331234`, `d309019`, `e3b4132`; Loop 2
  evidence-posture fixtures

### DFW-BL-019 — Improve handling of named-product catalysts

- **Category:** editorial quality, retrieval
- **Status:** proposed
- **Priority:** low
- **Discovered during:** candidate review, issue #30
- **Problem or observation:** A named product may be evidence, a catalyst for a
  broader conceptual observation, or a source of unsupported product-strategy
  extrapolation.
- **Current safeguard:** Issue #30 was deferred rather than selected as the
  full-path pilot.
- **Desired improvement:** Distinguish documented product facts, conceptual
  catalysts, unsupported extrapolation, and product-strategy claims.
- **Reason deferred:** The issue was not processed far enough to establish a
  confirmed defect.
- **Dependencies or prerequisites:** Review named-product seeds and identify
  which facts require current primary sources.
- **Validation criteria:** A fixture preserves the broader hypothesis without
  presenting product facts or strategy claims beyond approved evidence.
- **Relevant references:** dfw-intake issue #30

### DFW-BL-020 — Define a controlled merge workflow for combine-first material

- **Category:** governance, workflow
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** issue #16 and #28 combine-first pilots
- **Problem or observation:** The pipeline identifies a target and prohibits
  standalone drafting, but does not carry the distinct contribution into the
  target material.
- **Current safeguard:** Combine-first packets name the target, preserve
  carry-forward material, and set `doNotStandalone: true`.
- **Desired improvement:** Define a human-approved process for comparing source
  and target, extracting distinct material, proposing an amendment, and
  preserving lineage.
- **Reason deferred:** Automatic merging is not authorized, and target mutation
  requires a separate governance design.
- **Dependencies or prerequisites:** DFW-BL-009, durable source snapshots, and
  a decision about retained review artifacts.
- **Validation criteria:** A dry-run proposal identifies only distinct material
  and cannot modify the target or source without explicit approval.
- **Relevant references:** issue #16 and #28 combination packets;
  `loop2-development-packet.v1`

### DFW-BL-021 — Define intake GitHub issue lifecycle and status handling

- **Category:** governance, workflow
- **Status:** proposed
- **Priority:** low
- **Discovered during:** real-backlog operations
- **Problem or observation:** The pipeline does not close, label, edit, or
  comment on GitHub issues, and no policy defines states such as awaiting
  review, combined, deferred, superseded, or changed after processing.
- **Current safeguard:** No GitHub mutation occurs.
- **Desired improvement:** Decide whether operational state remains local or is
  eventually reflected in GitHub.
- **Reason deferred:** Status mutation would expand authority and should follow
  the bounded processor and governance model.
- **Dependencies or prerequisites:** DFW-BL-005 and DFW-BL-009.
- **Validation criteria:** Any future lifecycle proposal defines ownership,
  idempotency, auditability, and explicit mutation authorization.
- **Relevant references:** `MLX983/dfw-intake`; bounded pilot reports

### DFW-BL-022 — Define artifact retention and cleanup policy

- **Category:** governance, technical debt
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** bounded pilots using `/tmp`
- **Problem or observation:** Packets, drafts, evaluations, manifests, and logs
  currently live in temporary workspaces without a durable retention policy.
- **Current safeguard:** Command logs, manifests, paths, and hashes make each
  bounded run auditable while its workspace exists.
- **Desired improvement:** Decide which nonpublic artifacts are retained,
  where they belong, how long failures remain, and how artifacts map to source
  fingerprints and processing commits.
- **Reason deferred:** Durable storage may expose unpublished material and must
  be designed with the review workflow.
- **Dependencies or prerequisites:** DFW-BL-012 and DFW-BL-023.
- **Validation criteria:** A policy distinguishes durable records from
  disposable outputs and preserves privacy, lineage, and cleanup rules.
- **Relevant references:** issue #6, #12, and #28 `/tmp` pilot workspaces

### DFW-BL-023 — Create a durable human-review workspace

- **Category:** workflow, developer experience, governance
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** issue #12 review notification pilot
- **Problem or observation:** Review notifications contain bounded metadata and
  local paths, but those temporary paths are not a durable review surface.
- **Current safeguard:** Manifests and notifications point to local artifacts,
  and full unpublished drafts are not sent by email.
- **Desired improvement:** Investigate a reliable nonpublic place to inspect
  drafts and supporting artifacts while preserving the email-content boundary.
- **Reason deferred:** Storage, access control, retention, and publication
  authority require joint review.
- **Dependencies or prerequisites:** DFW-BL-022 and the existing notification
  contract.
- **Validation criteria:** A reviewer can access the exact fingerprinted
  artifacts without exposing drafts publicly or embedding full drafts in
  email.
- **Relevant references:** issue #12 notification manifest; commit `c90cfd9`

### DFW-BL-024 — Measure editorial usefulness and review burden

- **Category:** observability, editorial quality
- **Status:** proposed
- **Priority:** low
- **Discovered during:** bounded pilot assessment
- **Problem or observation:** Pilot reports provide qualitative outcomes but no
  aggregate view of development, combine-first, governance-stop, research,
  human-input, notification, acceptance, revision, or discard rates.
- **Current safeguard:** Individual reports preserve evidence for manual
  assessment.
- **Desired improvement:** Investigate a small set of measures for editorial
  usefulness, evaluator corrections, and human-review burden.
- **Reason deferred:** Metrics should follow stable workflow states and must
  not become incentives for output volume.
- **Dependencies or prerequisites:** DFW-BL-005 and DFW-BL-008.
- **Validation criteria:** Any proposed measures are derived from auditable
  states, distinguish throughput from usefulness, and expose review capacity.
- **Relevant references:** issue #6, #12, and #28 pilot reports

### DFW-BL-025 — Preserve Loop 1 and Loop 2 regression boundaries

- **Category:** workflow, retrieval, technical debt
- **Status:** completed
- **Priority:** medium
- **Discovered during:** pre-pilot workflow hardening
- **Problem or observation:** Earlier paths could duplicate active-query
  representation, duplicate related material, overpopulate research
  requirements, treat non-evidence as verified observation, or serialize an
  absent blocking condition ambiguously.
- **Current safeguard:** Focused Loop 1 and Loop 2 fixtures cover normalized
  cached and active queries, related-material deduplication, reviewed research
  precedence, labeled evidence posture, and omission of absent blocking
  conditions.
- **Desired improvement:** Completed for the documented cases; retain the
  regression requirements.
- **Reason deferred:** No longer deferred; retained as grouped regression
  history.
- **Dependencies or prerequisites:** New evidence of a distinct failure should
  extend an existing open item or create a separately supported item.
- **Validation criteria:** `loop:intake:fixtures` and `loop:packet:fixtures`
  continue to pass the named cases.
- **Relevant references:** commits `3190a17`, `0a74f8a`, `0747899`,
  `4b03fe5`, `e3b4132`, `ff9a55b`, `cc267fc`, and `d309019`

## Maintenance rules

- Add this observation to the DFW development backlog. Check for an existing related item before creating a new ID. Do not implement it.
- Update this backlog whenever a meaningful deferred issue is discovered.
- Check for an existing related item before creating a new entry.
- Extend an existing item when the new observation is part of the same
  underlying problem.
- Do not use it as a substitute for fixing a critical active defect.
- Keep completed items with their completion commit and outcome.
- Keep declined items with the reason they were declined.
- Reference the backlog ID in implementation work.
- Changes to this document do not authorize implementation.
- Do not convert uncertain recollections into accepted work without verifying
  them against repository evidence.
- Distinguish confirmed observations, provisional investigations, completed
  defects, obsolete items, and broader parent items.
