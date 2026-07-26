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
- **Discovered during:** governance-boundary pilot, issue #6; bounded backlog
  operation, issues #3, #4, #5, #7, #8, #9, #10, #11, #12, #13, and #14
- **Problem or observation:** Loop 1 correctly stopped a proposed new artifact
  type and collection, but its strongest retrieval results were corpus pieces
  rather than `content-schema.md` or `domain-structure.md`. For issue #3,
  retrieval missed the canonical documents that materially improved the
  domain and cluster classification during human review. For issue #4,
  canonical guidance corrected the primary domain to Institutions in
  Transition and the theme to the existing organizational-redesign cluster.
  Issue #5 required the same correction from a provisional multidomain
  enterprise-workflow classification. For issue #6, direct canonical review
  established the closed artifact set and corrected the administrative
  classification from a provisional multidomain assignment and ad hoc
  `archive navigation` theme to Media, Memory, and Meaning with the existing
  `publishing-systems` theme. For issue #7, canonical homepage, domain-page,
  and content-strategy guidance established a legitimate orientation job but
  changed the recommended handling from content combination to a governance
  stop pending a choice among existing curation structures. For issue #8,
  canonical artifact thresholds distinguished a prospective field-report
  structure from the material's present maturity as a research seed, while
  canonical domain guidance confirmed Institutions in Transition and the
  existing `organizational-redesign` theme. For issue #9, canonical checkpoint,
  project-log, content-strategy, and publishing guidance corrected a proposed
  recurring series from checkpoint and project-log classifications to a
  private governance seed with no authorized cadence. For issue #10, canonical
  artifact and domain guidance corrected a provisional two-domain result while
  preserving `essay` as the prospective form without treating that form as
  authorization to draft. For issue #11, canonical essay, project-log,
  workflow, and domain guidance rejected both the note reduction and any
  project-log interpretation. It preserved one Human-Machine Workflows domain
  and an essay-shaped conceptual argument without authorizing a new workflow
  model or draft. For issue #12, canonical artifact, domain, theme, and
  taxonomy guidance rejected the source-declared field-report label, preserved
  the existing `personal-cognitive-infrastructure` theme, required
  `canonical: false`, and bounded the material as a note without creating a
  glossary, naming standard, or canonical harness model. For issue #13,
  canonical field-report, domain, theme, and taxonomy guidance preserved the
  prospective field-report boundary while keeping research as a development
  gate, corrected the primary domain to Interfaces for Judgment, selected the
  existing `supervision-interfaces` theme, and rejected any new
  inference-control taxonomy, glossary, schema field, or canonical status. For
  issue #14, canonical review overrode a provisional field-report and
  multidomain interpretation: the complete intake is a noncanonical seed in
  Cognitive Infrastructure under the existing
  `context-inequality-and-judgment-legibility` theme, while the existing local
  derivative remains the substantive home and no social-strata taxonomy,
  ladder, or second artifact is authorized.
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
- **Relevant references:** dfw-intake issues #3, #4, #5, #6, #7, #8, #9,
  #10, #11, #12, #13, and #14;
  `docs/source-of-truth/content-strategy.md`;
  `docs/source-of-truth/content-schema.md`;
  `docs/source-of-truth/domain-structure.md`; `src/pages/index.astro`

### DFW-BL-003 — Improve ranking of strong cluster anchors

- **Category:** retrieval
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** real-backlog pilots, issues #3, #4, #8, #9, #10,
  #11, #12, #13, #14, #16, and #28
- **Problem or observation:** Loosely related material sometimes outranked a
  more useful cluster anchor. For issue #28, `context-inequality.md` ranked
  above “Storage Is Not Memory.” For issue #3, retrieval surfaced thematic
  adjacency but no defensible cluster anchor or combine target. For issue #4,
  retrieval missed `skills-half-life.md` and `context-inequality.md`, then
  elevated broad adjacency with issue #3 into a combine recommendation. For
  issue #6, self-source and thematic corpus pieces dominated the ranking while
  the canonical artifact, status, evidence-level, and navigation definitions
  that governed the decision were absent. For issue #7, retrieval missed the
  implemented homepage, canonical homepage and domain-page orientation
  guidance, the published “The Archive Becomes Part of the Work,” and backlog
  issues #11, #12, and #29 that materially clarified the complete proposal.
  For issue #8, retrieval surfaced issue #5's raw source but not its approved
  combine-first carry-forward packet or evidence cautions, omitted canonical
  artifact thresholds and several stronger contextual sources, and elevated
  issue #9's longitudinal cadence proposal into a combine recommendation even
  though issue #8 is the initial cluster anchor. For issue #9, retrieval again
  surfaced issues #8 and #5 only as raw intake, omitted their approved
  dispositions and relationship constraints, and missed the canonical
  checkpoint, project-log, and publishing-workflow guidance that governed the
  decision. For issue #10, retrieval missed the existing issue-specific essay
  development packet and contract, canonical artifact guidance, and stronger
  contextual sources. Human review had to recover those records to preserve
  the prospective essay boundary and its evidence gate. For issue #11,
  retrieval elevated issue #27 without exposing its approved supporting
  relationship to the narrower issue #21 anchor. It also missed stronger
  published conceptual context, current processor and workflow documentation,
  approved issue #10 and issue #12 boundaries, and relevant orchestration and
  harness sources. Incomplete source coverage then contributed to an
  unsupported combine recommendation. For issue #12, retrieval ranked its
  cached self-source first, found `context-inequality.md` and `my-ai-rules.md`,
  then elevated issues #22 and #26 largely through intake metadata and generic
  model terminology. It missed the stronger contextual relationships to
  `the-process-is-the-proof.md`, issue #29, and the approved issue #10 and
  issue #11 boundaries. For issue #13, retrieval again ranked the cached
  self-source first, elevated broad weak-signal and data adjacency, and missed
  canonical Interfaces for Judgment guidance, issue #17's approved prototype
  context, issue #10's governance-interface boundary, issue #11's governance
  and lineage context, issue #12's approved layer distinctions, issue #20's
  distinct hidden-authority problem, and issue #16's disclosure-to-control
  relationship. Issue #14 was a useful positive and negative case:
  `context-inequality.md` ranked first and was the correct substantive anchor,
  but ordinary retrieval did not expose its same-issue derivative provenance
  as an explicit workflow relationship and could not see the approved
  downstream boundaries of adjacent issues. Human review was still required
  to distinguish an existing derivative home from a combine target and to
  avoid duplicate development.
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
- **Relevant references:** issue #3 Loop 1 trace; issue #4 Loop 1 trace;
  issue #28 Loop 1 trace; issue #6 Loop 1 trace; issue #7 Loop 1 trace;
  issue #8, issue #9, issue #10, issue #11, issue #12, issue #13, and issue #14 Loop 1
  traces and review packets;
  `docs/development/issue-10-essay-development-packet.json`;
  `docs/development/issue-10-essay-contract.md`;
  “Skills half-life”; “Context inequality”; “Storage Is Not Memory”;
  “The Archive Becomes Part of the Work”

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
- **Status:** completed
- **Priority:** medium
- **Discovered during:** bounded real-backlog pilots
- **Problem or observation:** Backlog issues are currently selected and run
  one at a time through manual commands.
- **Current safeguard:** The implemented command requires an explicit limit,
  isolates issue and run workspaces, uses fingerprint-bound Loop 1 approval
  envelopes, records original and resume processor commits separately,
  preserves stable nondraft stops, keeps awaiting-review capacity reserved
  across source changes, supports an explicit post-Loop-2 human-authorization
  stop for draft-ready packets, and defaults notification to dry run. It has
  no scheduler, GitHub mutation, or publication path.
- **Desired improvement:** Completed: add a manually invoked processor that
  preserves bounded scope, durable provenance, concurrency safety, retry
  boundaries, strict limits, review capacity, and all existing governance
  stops.
- **Reason deferred:** No longer deferred. The bounded implementation,
  dual-commit resume fix, issue #1 nondraft resume, idempotent replay,
  review-capacity behavior, and repeated direct read-only GitHub dry-runs are
  validated. Issue #12 regression maintenance added an explicit
  `--stop-after-loop2` boundary using the existing
  `completed-waiting-for-human` state so source-sufficient classification does
  not imply drafting authorization. Retained as implementation and regression
  history.
- **Dependencies or prerequisites:** Define states including awaiting Loop 1
  review, combine-first, governance stop, waiting for human, retriable failure,
  terminal failure, completed notification, and changed source. Define an
  initial deterministic selection rule before exploring editorial priority.
- **Validation criteria:** A bounded dry run processes only its explicit
  selection, isolates each issue, resumes safely from recorded boundaries,
  respects cost and review-capacity limits, and performs no publication or
  issue mutation. Direct acquisition produces deterministic repeated plans
  from the same live backlog state.
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
  workflow. Issue #6 also showed why the boundary must expose source and
  retrieval limitations: transport metadata influenced matched terms, and a
  truncated working excerpt produced a false question about missing source
  material even though the full source artifact was available. Issue #7
  repeated the metadata signal: sender, timestamp, UUID, URL, and transport
  fields contributed to the self-source match and had to be separated from
  substantive orientation evidence during human review. Issue #8 again ranked
  its self-source using timestamp, UUID, sender, email, URL, and transport
  terms; shared metadata also contributed to the apparent strength of nearby
  issue #9 and had to be separated from the substantive cluster relationship.
  Issue #9 repeated the same pattern: transport fields and sender metadata
  influenced self-source ranking and overlap with issue #8, while human review
  had to distinguish that noise from the real cadence relationship. Issue #10
  again used timestamp, UUID, sender, email, URL, and transport terms in
  ranking, while incomplete source coverage and undiscovered issue-specific
  records materially affected the review boundary. Issue #11 repeated the
  pattern: timestamp, UUID, sender, email, URL, transport, and generic workflow
  terms affected self-source and related-issue scores, requiring human review
  to separate metadata and lexical overlap from substantive relationships.
  Issue #12 again ranked its self-source through email identifiers, sender,
  timestamps, URLs, and transport fields; generic model, system, field-report,
  and intake language also inflated issues #22 and #26 above stronger
  conceptual context. Issue #13 repeated self-source dominance through email
  ID, sender, recipient, timestamps, URL, intake wrappers, and generic
  inference, model, signal, and data language. Loop 2 then carried email
  transport metadata and source-declared frontmatter into
  `developmentMaterial`, mislabeled as inferential mechanism material rather
  than excluding it from editorial evidence. Issue #14 again ranked its
  cached self-source using intake-wrapper identifiers, sender, timestamps,
  email, URL, and generic AI, context, work, and model terminology; human
  review separated those terms from the substantive relationship to
  `context-inequality.md`.
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
  3 approval gates; issue #6, #12, #13, and #28 pilot artifacts; issue #6 Loop 1
  trace and complete source artifact; issue #7, issue #8, issue #9, issue #10,
  issue #11, issue #12, issue #13, and issue #14 Loop 1 traces

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
- **Discovered during:** issue #5, #6, #8, #9, #10, #11, #12, #13, #14, and #28
  pilots
- **Problem or observation:** Provisional proposals inflated issue #12 toward a
  field report, assigned issue #6 an unnecessary secondary domain, and
  recommended field-report research with multiple domains for issue #28 before
  evaluator correction. For issue #5, the provisional stage elevated a single
  uncited architecture proposal to a checkpoint and assigned two domains. For
  issue #6, the provisional stage assigned two domains and an ad hoc archive
  navigation theme to a structural governance proposal; canonical review
  instead supplied one contract-required administrative domain and the
  existing `publishing-systems` theme without authorizing content development.
  For issue #7, the provisional stage again assigned two domains, and the
  evaluator then overcorrected toward content combination even though no
  single target could absorb the distinct reader-orientation decision. For
  issue #8, the provisional `field-report` label described a possible future
  form rather than current seed maturity, and the evaluator overcorrected
  toward combining the initial cluster anchor with issue #9's longitudinal
  cadence proposal. For issue #9, the provisional stage inflated a monitoring
  proposal into a checkpoint, added a second domain and an ad hoc theme, and
  the evaluator then misclassified the private cadence-governance seed as a
  project log and combine candidate. For issue #10, the source-declared
  `Essay` label influenced the provisional result and produced two domains;
  the evaluator then overcorrected to `note`. Complete-source review showed
  that the argument is structurally developed enough to preserve `essay` as
  its prospective artifact while research still blocks drafting. Present
  readiness and prospective form must remain separate: lowering the artifact
  can discard intended argumentative structure, while preserving `essay` must
  never imply draft authorization. Loop 2 retained `approvedArtifactType:
  essay` but its generic recommended structure still said “Maintain as seed,”
  showing that the distinction must remain consistent throughout the packet.
  Issue #11 repeated both failures: the evaluator reduced a structurally
  developed prospective essay to a note and recommended combination based on
  partial source and relationship context. After human correction, Loop 2
  retained authoritative `approvedArtifactType: essay`, `research-required`,
  and no combine target, but its generic `readerQuestion` referred to a field
  report and `recommendedStructure` again said “Maintain as seed.”
  Authoritative structured fields and narrative guidance must not contradict
  each other. Issue #12 repeated the source-label problem: the source declared
  `field-report`, while the defensible artifact was a bounded note. Its durable
  Loop 2 packet kept the authoritative fields consistent as `note`,
  source-sufficient, ready, independently developed, and without a combine
  target; no new structured-versus-narrative contradiction was observed.
  Issue #13 showed the inverse source-label problem: complete-source review
  established that `field-report` was a defensible prospective form while
  research still blocked development, but the evaluator reduced it to a note.
  Loop 2 retained authoritative `approvedArtifactType: field-report`,
  `research-required`, Interfaces for Judgment, `supervision-interfaces`, and
  no combine target, while generic `recommendedStructure` said “Maintain as
  seed.” It also serialized `sourceSufficiency.status: sufficient` despite the
  approved partial posture and the unverified external case. Readiness,
  sufficiency, artifact form, and generic narrative must remain mutually
  consistent. For issue #14, the provisional result again inflated a
  provocative title and partial source into a prospective field report with
  two domains and research requirements. Complete-source and canonical review
  instead approved a noncanonical seed, one Cognitive Infrastructure domain,
  the existing theme, and no independent development. Loop 2's authoritative
  fields and generic narrative did not contradict that reviewed disposition,
  although its generic content-shaped structure was unnecessary for a
  preservation-only stop.
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
- **Relevant references:** issue #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, and
  #28 Loop 1 traces; issue #10, issue #11, issue #12, and issue #13 Loop 2
  packets

### DFW-BL-018 — Distinguish conceptual, normative, speculative, and empirical claims

- **Category:** editorial quality, retrieval
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** intake and Loop 2 pilots
- **Problem or observation:** Conceptual or normative statements can resemble
  empirical claims and create unnecessary research requirements or overstate
  evidence. Issue #5 mixed a proposed enterprise control architecture with
  plausible institutional inferences and unsupported legal, regulatory,
  technical-necessity, and enterprise-prevalence claims. Issue #7 mixed an
  orientation-design proposal and editorial sequence with product claims,
  instructional advice, claims about ordinary user behavior, and unsupported
  assertions about prompting, agents, harnesses, project memory, and
  personal-corpus advantage. Issue #8 mixed a useful institutional framing
  hypothesis and conceptual implementation mechanisms with unsupported
  cross-company, deployment-pattern, model-capability, and enterprise-adoption
  claims that require primary-source research before field-report development.
  Issue #9 mixed a useful longitudinal observation method with a proposed
  calendar cadence, public-series assumptions, checkpoint and project-log
  implications, ownership and lifecycle questions, and possible automation.
  Issue #10 mixed a developed conceptual distinction, product observations,
  empirical claims, predictions about user behavior and application
  architecture, design implications, and unresolved questions. Human review
  preserved the argument while routing the factual and predictive claims to
  research. Issue #11 mixed a provisional conceptual model, descriptions of
  the DFW implementation, operating-model proposals, empirical benefit claims,
  cybernetics and systems-engineering analogies, design implications, and
  predictions. Human review preserved the essay argument while requiring
  repository verification and research. Issue #12 mixed a bounded distinction
  among model, interface, workflow or harness, context, and relationship with
  broad user-behavior claims, product-category forecasting, personal-harness
  architecture, a proposed five-stage market sequence, and terminology that
  could be mistaken for taxonomy. Human review kept the bounded distinction
  draft-ready without treating those broader claims as established or making
  external research a blocker. Issue #13 mixed an unverified external
  healthcare case, conceptual distinctions about inferred attributes,
  hypothetical sensitive-state examples, privacy and governance claims,
  interface requirements, ambient-AI predictions, and proposed action
  boundaries. Human review had to distinguish collected inputs, observations,
  evidence, interpretation, inference, detection, classification, prediction,
  hypothesis, judgment, recommendation, action, and runtime model inference.
  The same case confirms that `inference` can mean runtime computation,
  epistemic conclusion, or operational decision support; confidence is not
  truth, inferred intent is not explicit authority, and lineage must preserve
  the assumptions connecting signals to conclusions and actions. Issue #14
  mixed a bounded mechanism about context and articulated judgment with
  unsupported claims about cheap intelligence, synthetic-content
  contamination, provenance premiums, equal model access, institutional
  implementation, and a speculative five-level social ladder. Human review
  preserved the mechanism and research directions without treating the
  ladder as observed classes. Its Loop 2 packet retained cautions about the
  unsupported claims but did not explicitly carry forward the approved
  counterpressure that AI may raise the floor or reduce some inequalities,
  showing that reviewed counterevidence can be lost even when authoritative
  disposition fields remain correct.
- **Current safeguard:** Reviewed recommendations and Loop 2 evidence posture
  distinguish verified observations, inference, mechanism, hypothesis, and
  speculation in several tested paths.
- **Desired improvement:** Investigate a clearer claim-role boundary including
  empirical claims and normative proposals.
- **Reason deferred:** Several false research blockers were already fixed, but
  the broader classification scope is not formally assessed.
- **Dependencies or prerequisites:** Gather examples such as nutrition-label
  user needs, chatbot-to-harness progression, claims about ordinary users, and
  issue #13's collected-data versus inferred-attribute boundary.
- **Validation criteria:** Fixtures route empirical claims to verification,
  retain conceptual and normative proposals without false research blockers,
  and keep speculation visible.
- **Relevant references:** issue #5, issue #7, issue #8, issue #9, issue #10,
  issue #11, issue #12, issue #13, and issue #14 Loop 1 traces; issue #13 and
  issue #14 Loop 2 packets;
  commits `1331234`, `d309019`, `e3b4132`; Loop 2 evidence-posture fixtures

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
- **Discovered during:** issue #5, #16, and #28 combine-first pilots
- **Problem or observation:** The pipeline identifies a target and prohibits
  standalone drafting, but does not carry the distinct contribution into the
  target material. Issue #5 adds a substantial proposed control layer for
  non-human actors to issue #8 while requiring that the target remain
  unmodified until a separate human-approved merge process exists. That
  combine-first result safely preserved issue #5 without mutating issue #8.
  When issue #8 was later processed, ordinary retrieval surfaced issue #5's
  raw source, but Loop 1 could not discover the approved carry-forward packet,
  its exact distinct contribution, or its evidence cautions. Target review
  therefore required manual inspection of workflow artifacts. A future design
  should make approved carry-forward material and cautions legible to target
  processing without automatically merging or mutating the target, and it
  must prohibit circular combine recommendations. Issue #9 repeated the
  downstream visibility failure: Loop 1 saw the raw issue #8 and issue #5
  intakes but not issue #8's approved research-seed and cluster-anchor status,
  issue #5's approved support relationship, or either packet's cautions.
  Issue #10 demonstrated the broader approved-context visibility problem
  outside a combine relationship: ordinary Loop 1 retrieval missed its
  existing issue-specific essay development packet and contract, so manual
  inspection was required to recover the prospective artifact, distinctive
  contribution, and evidence boundary. For issue #11, ordinary retrieval
  surfaced issue #27's raw source but not its approved supporting relationship
  to issue #21, and it could not see issue #10's completed essay boundary,
  issue #12's approved contextual role, or current workflow state. Manual
  inspection was required to reject combine-first and keep issues #21 and #27
  contextual. Issue #12 exposed the same visibility problem across operational
  generations: an accepted temporary pilot contained reviewed reasoning and
  generated development artifacts, but the durable processor could not
  discover or distinguish that workflow history. Human review had to designate
  the current registry run as the durable successor while prohibiting import
  of the temporary envelope, registry state, or draft. Temporary generated
  artifacts must not silently become corpus sources, combine targets, or
  canonical material, and durable reprocessing should make possible duplicate
  development visible without merging state automatically. Issue #13 showed
  the same approved-context gap without a combine disposition: ordinary Loop 1
  retrieval could not see the approved issue #10, #11, and #12 boundaries or
  issue #17's issue-specific development records, so manual inspection was
  required to preserve each as context and reject a combine target. Issue #14
  adds a local-derivative edge case: the substantive noncanonical artifact
  already exists at `src/content/field-notes/context-inequality.md`, and its
  `sourceNote` explicitly identifies intake issue #14. Because there is no
  separate GitHub `#N` target, a self-combine would be circular and a
  local-file combine would misrepresent the relationship. The reviewed
  preserve-as-seed disposition avoided duplicate development while keeping
  the intake as provenance. Future relationship handling must make same-issue
  derivative provenance visible without treating the local derivative as an
  independent source, combine target, or mutation destination.
- **Current safeguard:** Combine-first packets name the target, preserve
  carry-forward material, and set `doNotStandalone: true`.
- **Desired improvement:** Define a human-approved process for comparing source
  and target, extracting distinct material, proposing an amendment, and
  preserving lineage. Make reviewed carry-forward contributions and cautions
  discoverable during later target review without authorizing automatic
  mutation or allowing the target to be combined circularly back into its
  supporting source. Distinguish accepted temporary workflow history from
  durable processor state, require a human successor designation when both
  exist, and keep temporary generated artifacts outside corpus retrieval.
  Represent local same-issue derivative provenance explicitly enough to
  prevent duplicate development without coercing it into `combineTarget` or
  authorizing local-file mutation.
- **Reason deferred:** Automatic merging is not authorized, and target mutation
  requires a separate governance design.
- **Dependencies or prerequisites:** DFW-BL-009, durable source snapshots, and
  a decision about retained review artifacts.
- **Validation criteria:** A dry-run proposal identifies only distinct material
  and cannot modify the target or source without explicit approval. Target
  processing can retrieve the approved contribution and cautions while keeping
  raw source, reviewed carry-forward material, and target state distinct.
  Circular combine recommendations are rejected. A local derivative whose
  `sourceNote` names the current issue remains related provenance, not a
  separate combine target, and does not trigger duplicate drafting.
- **Relevant references:** issue #5, #16, and #28 combination packets;
  issue #8, issue #9, issue #10, issue #11, issue #12, issue #13, and issue #14 Loop 1 reviews;
  `/private/tmp/dfw-real-pilot-issue12-20260723-WMT4Ov`;
  `docs/development/issue-10-essay-development-packet.json`;
  `docs/development/issue-10-essay-contract.md`;
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

### DFW-BL-026 — Preserve complete-source awareness in Loop 1

- **Category:** workflow, retrieval, editorial quality
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** bounded backlog operation, issues #6, #7, #10, #11,
  #12, #13, and #14
- **Problem or observation:** The complete issue #6 source was saved in the
  isolated workspace, but Loop 1 analyzed only a 4,000-character active-body
  excerpt. The excerpt ended inside the proposed pattern list, causing Loop 1
  to ask what content followed even though that content was present in the
  stored source. Silent excerpt truncation can create false uncertainty,
  incomplete summaries, and incorrect editorial recommendations. For issue
  #7, Loop 1 analyzed 4,000 of 5,769 active-body characters. It ended inside
  item 8 and omitted harness engineering, personal corpus, and the
  author-selected final five-entry sequence. Those omissions materially
  affected source classification, relationship analysis, understanding of the
  proposed structure, and evaluation of the author’s intended sequence. For
  issue #10, the complete stored source was 9,296 characters and the complete
  active body was 8,106 characters, but the model-facing body contained only
  the first 4,000 characters, omitting 4,106 characters. The normalized full
  body was 7,955 characters and the normalized retrieval excerpt was 1,200
  characters. The omitted section contained “The Interface Does Not
  Disappear” counterpressure; the operational-interface versus
  governance-interface distinction; authority, trust, supervision,
  escalation, approval, memory, audit, recovery, and correction controls;
  design implications; unresolved questions; and the author’s explicit
  identification of the governance-interface distinction as the original
  contribution. The incomplete input weakened the central thesis, omitted
  counterarguments and limits, made relationship analysis incomplete, and
  underestimated argument maturity. The evaluator reduced the artifact to a
  note even though complete-source inspection and issue-specific records
  supported preserving an essay boundary with research still blocking
  drafting. For issue #11, the complete stored source was 9,890 characters and
  the complete active body was 8,767 characters, but the model-facing body
  contained only the first 4,000 characters, omitting 4,767 characters. The
  normalized full body was 8,675 characters and the normalized retrieval
  excerpt was 1,200 characters. Omitted material included the current DFW
  harness example; token and operating-cost implications; the “content washing
  machine” failure mode; the contrary view and limits; the cybernetics
  framing; the intended opening and closing; and additional distinctions among
  loops, harnesses, governance, judgment, and lineage. The missing material
  hid the full breadth and maturity of the thesis, removed counterpressure,
  prevented accurate current-system comparison, and contributed to an
  evaluator recommendation of note plus combine-first even though the complete
  source supported a broader essay boundary. For issue #12, the complete
  stored source was 10,894 characters and the complete active body was 9,745
  characters, but the model-facing body contained only the first 4,000
  characters, omitting 5,745 characters. The normalized full body was 9,634
  characters and the normalized retrieval excerpt was 1,200 characters.
  Omitted material included the AI-workspace discussion, super-app
  speculation, personal-harness vocabulary, governance and mental-model
  consequences, the model/interface/workflow/context/person-layer
  distinction, working terminology, the proposed five-phase sequence, and most
  of the material needed to identify both the strongest note and the source's
  overreach. The model-facing input therefore omitted the strongest
  layer-separation argument, prevented full assessment of the naming problem,
  hid most speculative architecture and market claims, and obscured
  relationships to issues #10, #11, and #29. The note recommendation remained
  defensible, but for incomplete reasons. For issue #13, the complete stored
  source was 8,131 characters and the complete active body was 6,999
  characters, but the model-facing body contained only the first 4,000
  characters, omitting 2,999 characters. The normalized full body was 6,921
  characters and the normalized retrieval excerpt was 1,200 characters. The
  omitted section contained the useful-versus-dangerous comparison, ambient
  assistance, the distinction from autonomous agents, the personal
  early-warning framing, the complete inference-control interface, controls
  over observation, inference, storage, action, explanation, locality, and
  prohibition, and the unresolved governance conclusion. The truncation hid
  the strongest governance contribution and most interface implications,
  underestimated field-report maturity, obscured Interfaces for Judgment and
  `supervision-interfaces`, hid relationships to issues #10, #11, #12, #16,
  #17, and #20, and contributed to the evaluator's reduction to a note.
  For issue #14, the complete stored source was 10,337 characters and the
  complete active body was 9,203 characters, but the model-facing body
  contained only the first 4,000 characters, omitting 5,203 characters. The
  normalized full body was 9,128 characters and the normalized retrieval
  excerpt was 1,200 characters. Omitted material included the complete
  judgment-skill list; provenance and synthetic-content claims; “context
  becomes capital”; personal, organizational, and institutional context; the
  proposed five-level leverage ladder; design implications; the balanced
  compressed thesis; and cautions against rigid social-class language. The
  missing material hid the explicit social-strata model, most provenance and
  institutional extensions, and the source's own counterpressure. It prevented
  a complete comparison with `context-inequality.md` and left classification
  and relationship analysis incomplete. Manual full-source review was needed
  to establish that the core argument was already represented while the
  remaining material was speculative.
- **Current safeguard:** The complete source artifact and content fingerprint
  are preserved for human review. In issue #6, direct inspection corrected the
  false missing-content inference before an approval envelope was created. In
  issue #7, direct inspection restored the omitted structural conclusion and
  later entries before the reviewed disposition was approved. For issue #10,
  manual complete-source inspection plus the existing development packet and
  essay contract restored the distinctive argument and prospective artifact
  boundary before approval. For issue #11, manual complete-source and current
  repository inspection restored the essay boundary, rejected the combine
  recommendation, and kept the vocabulary provisional. For issue #12, manual
  complete-source inspection established the bounded conceptual center,
  excluded the market and architecture overreach, and recovered the stronger
  contextual relationships before approval. For issue #13, manual
  complete-source inspection restored the prospective field-report boundary,
  primary domain, existing theme, governance center, and related-material
  boundaries before approval. For issue #14, manual complete-source and
  derivative-provenance inspection preserved the intake as a seed, recognized
  `context-inequality.md` as its existing substantive home, rejected a
  circular combine and duplicate artifact, and kept the omitted social-strata
  material noncanonical.
- **Desired improvement:** Make truncation explicit in the review packet and
  preserve complete-source awareness. Use the full source when provider limits
  permit, or use deterministic chunking that allows analysis to account for
  all source content. Never infer that material is missing merely because a
  working excerpt ends.
- **Reason deferred:** The governance stop remained safe, and changing source
  preparation or provider input strategy requires bounded design and
  regression testing.
- **Dependencies or prerequisites:** Document provider input constraints,
  define deterministic chunking and recombination behavior, and preserve
  source fingerprints and complete-source provenance across all chunks.
- **Validation criteria:**
  - A long-source fixture includes material after the first 4,000 characters.
  - Loop 1 either analyzes the complete source or explicitly reports its
    bounded chunk coverage.
  - The result does not claim content is missing when it exists later in the
    stored source.
  - Summaries and recommendations incorporate materially relevant later
    sections.
  - Short-source behavior and existing Loop 1 fixtures do not regress.
- **Relevant references:** dfw-intake issues #6, #7, #10, #11, #12, #13, and #14;
  issue #6, issue #7, issue #10, issue #11, issue #12, issue #13, and issue #14 complete
  sources, Loop 1 traces, and review packets;
  `docs/development/issue-10-essay-development-packet.json`;
  `docs/development/issue-10-essay-contract.md`;
  `scripts/loop1-intake-understanding.mjs`

### DFW-BL-027 — Govern recurring editorial series and observation cadences

- **Category:** governance, workflow, editorial quality
- **Status:** proposed
- **Priority:** medium
- **Discovered during:** bounded backlog operation, issue #9
- **Problem or observation:** The processor can encounter sources proposing
  periodic reviews, recurring notes, checkpoints, or series. Issue #9 showed
  that a useful longitudinal observation method can be confused with
  authorization for a scheduled public artifact, a project log, a checkpoint,
  or an automated workflow. DFW-BL-006 covers automatic intake triggering, not
  the broader editorial decision about whether recurrence should exist.
- **Current safeguard:** Human review corrected issue #9 to a private seed,
  prohibited a quarterly cadence and all recurring artifacts or automation,
  and preserved chronology and monitoring questions without establishing a
  series.
- **Desired improvement:** Distinguish private observation methods from public
  recurring artifacts. Require explicit human authorization and a
  meaningful-change threshold; distinguish calendar-, event-, and
  evidence-triggered review; define the owner and initiation rule; permit
  silence when nothing meaningful changes; define lifecycle, retirement, and
  end conditions; enforce canonical checkpoint and project-log boundaries;
  prevent repetitive archive growth; and ensure that recurring editorial
  proposals cannot implicitly create schedules, notifications, automation, or
  publication. Preserve chronology without requiring periodic output.
- **Reason deferred:** The manual governance stop is safe, and recurrence,
  lifecycle, and publication-policy decisions require editorial design before
  implementation.
- **Dependencies or prerequisites:** DFW-BL-002, DFW-BL-006, DFW-BL-009,
  canonical checkpoint and project-log guidance, and evidence from additional
  cadence or series proposals.
- **Validation criteria:**
  - Fixtures distinguish private observation methods from public recurring
    artifacts.
  - Calendar cadence alone cannot authorize a review or publication.
  - Event- and evidence-triggered review require an explicit meaningful-change
    threshold and human authorization.
  - Silence is a valid outcome when no meaningful change occurs.
  - Owner, initiation, lifecycle, retirement, and end conditions remain
    explicit governance requirements.
  - Checkpoint and project-log boundaries are enforced.
  - No recurring proposal creates scheduling, notification, automation, or
    publication behavior implicitly.
  - Chronology can be preserved without repetitive periodic artifacts.
- **Relevant references:** dfw-intake issue #9; issue #9 Loop 1 trace, reviewed
  recommendation, and Loop 2 governance-stop packet;
  `docs/source-of-truth/content-strategy.md`;
  `docs/source-of-truth/content-schema.md`;
  `docs/workflows/publishing-workflow.md`; DFW-BL-006

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
