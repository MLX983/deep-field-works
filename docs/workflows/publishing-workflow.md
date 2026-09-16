# Deep Field Works — Publishing Workflow

## Purpose of this document

This document defines the publishing workflow for Deep Field Works.

It explains how raw material moves from signal to seed, note, field report, essay, experiment, prototype note, concept document, checkpoint, and published archive.

It is intended for:

* human publishing decisions
* ChatGPT-assisted drafting
* Codex and agent workflows
* GitHub or CMS publishing automation
* long-term archive maintenance

Use this document when deciding what to do next with a piece of material.

Use `content-strategy.md` to decide what kinds of content should exist.

Use `content-schema.md` to classify and structure metadata.

Use `article-templates.md` to draft the artifact.

Use `editorial-guidelines.md` to develop and evaluate the thinking.

Use `voice-and-style.md` for the final language and tone pass.

Use the shared `prose-warning-signs.md` as a diagnostic layer for AI-assisted prose.

For manual operation of the current bounded processor workflow, use `docs/workflows/bounded-publishing-operator-runbook.md`. That runbook is the canonical command and recovery reference for the implemented Loop 1 → human review → explicit approval → Loop 2 → stop boundary.

---

# Core philosophy

Publish small.

The objective is continuous accumulation of useful observations, not production of polished masterpieces.

A short, clear field note is better than an unfinished perfect essay.

Deep Field Works should preserve thinking while it develops.

The site should not wait until every idea is complete.

But small does not mean compressed, careless, or underdeveloped.

Every public artifact should clarify something.

Use the smallest adequate artifact, then develop that artifact adequately.

---

# Publishing principle

The archive should show development.

Do not continually rewrite published work to make the past look more correct than it was.

Minor corrections are acceptable.

Clarifying edits are acceptable.

Substantive changes should usually become:

* an update note
* a new version
* a checkpoint
* a superseding piece
* a link to a newer interpretation

The publication record should preserve the evolution of thinking.

---

# Default content pipeline

The default pipeline is:

```text
Signal → Seed → Note → Field Report → Essay / Experiment → Concept Document → Checkpoint
```

This is an archive model, not a mandatory progression.

Not every idea must pass through every stage.

Some ideas will remain seeds forever.

Some notes will be complete at note scale.

Some field reports will never become essays.

Some prototypes may skip directly to experiments.

Some repeated observations may eventually justify concept documents.

Some clusters may eventually produce checkpoints.

Do not promote material merely because a later stage appears more substantial.

---

# Stage definitions

## Signal

A signal is something noticed.

Examples:

* article
* product announcement
* design problem
* prototype behavior
* work pattern
* phrase
* conversation
* personal observation
* recurring question
* failure mode
* contradiction

A signal does not need to be fully interpreted yet.

Action:

```text
Capture enough context that it can be revisited.
```

---

## Seed

A seed is raw or lightly structured material.

Use for:

* fragments
* early questions
* rough observations
* possible titles
* unsorted ideas
* things that may matter later

A seed should answer at least one of:

* What prompted this?
* Why did it seem interesting?
* What might it connect to?

Action:

```text
Store, lightly label, and avoid overdeveloping too soon.
```

A seed is a successful archival outcome.

It does not need to become publishable.

---

## Note

A note is a short structured observation.

Use when:

* the idea is clearer than a seed
* there is a specific observation or question
* the material may become useful later
* the point can be developed adequately at small scale

A note should usually include:

* observation or question
* enough context to understand it
* current interpretation
* why it may matter
* uncertainty or open edge where relevant

Action:

```text
Draft a compact public or private note.
```

Do not mistake a sequence of aphorisms or compressed assertions for a developed note.

---

## Field Report

A field report interprets an external or observed signal.

Use when:

* responding to a current event
* analyzing an article or announcement
* capturing a product or organizational signal
* identifying a possible broader shift

A field report should include:

* what happened
* why it may matter
* what larger pattern it may indicate
* what is observed versus inferred
* what is not yet established
* what to watch next

Action:

```text
Publish if the piece adds interpretation beyond summary.
```

A field report should not merely restate the source with better prose.

---

## Essay

An essay develops a durable argument, distinction, inquiry, or interpretation.

Use when:

* the central question or tension is clear
* the idea has enough substance to support development
* the piece offers a useful reader payoff
* the argument can stand beyond one event

An essay should include:

* a meaningful question, tension, or observation
* developed reasoning
* concrete grounding
* evidence appropriate to the claims
* movement beyond the opening premise
* unresolved questions where they genuinely remain
* an ending that adds something rather than mechanically summarizing

A model or framework is not required.

Prefer a concrete example when it can communicate the idea more clearly.

Action:

```text
Draft, develop, revise, review, and publish selectively.
```

---

## Experiment

An experiment documents something built or tested.

Use when:

* a prototype demonstrates a larger idea
* an interface pattern needs explanation
* a workflow has been simulated
* a design decision reveals a broader question

An experiment should include:

* purpose
* what was built or tested
* what actually happened
* what it demonstrates
* what it does not solve
* what remains unresolved
* next iteration where relevant

Action:

```text
Publish when the experiment makes a concept or problem tangible.
```

Do not imply testing, validation, or observed behavior that did not occur.

---

## Prototype Note

A prototype note documents a smaller design exploration.

Use for:

* interaction decisions
* screen-level rationale
* state changes
* recommendation logic
* governance controls
* interface patterns

A prototype note should do more than describe the proposed interface.

Ask:

* What became clearer because this interface was considered?
* What assumption did the design expose?
* What distinction did the interface require?
* What becomes difficult when the idea is made operational?
* What did designing the control surface reveal about authority, state, policy, thresholds, exceptions, escalation, reversibility, or failure recovery?

Action:

```text
Publish when the design exploration reveals a larger pattern or design finding.
```

Make clear whether the prototype is:

* proposed
* built
* simulated
* tested
* observed in production

Do not blur these states.

---

## Concept Document

A concept document extracts a durable model, term, or reusable distinction.

Use when:

* a concept appears repeatedly
* future pieces need stable vocabulary
* agents need a retrieval anchor
* the archive needs conceptual structure
* the abstraction has demonstrated durable explanatory value

Action:

```text
Create or update the concept layer after repetition justifies it.
```

Do not create concept documents too early.

Do not name a pattern merely because it can be named.

Let repeated use prove that the concept is worth stabilizing.

---

## Checkpoint

A checkpoint compresses accumulated thinking.

Use when:

* several pieces form a cluster
* the working model has changed
* the site needs a synthesis point
* a project phase is ending
* agents need updated context

A checkpoint should include:

* current state
* what changed
* what became clearer
* what previous framing weakened or was superseded
* working interpretation
* open questions
* next directions

Action:

```text
Publish periodically or when a meaningful shift occurs.
```

---

# Practical workflow

## 1. Capture

Capture raw material quickly.

Do not decide too much at capture time.

Useful capture formats:

* pasted article excerpt
* rough note
* quick question
* prototype observation
* voice transcript
* screenshot note
* conversation checkpoint
* title fragment

Minimum capture requirement:

```text
What is this, and why might it matter?
```

Preserve source context when it may matter later.

---

## 2. Classify

Classify the material using `documentType`.

Ask:

```text
Is this a seed, note, field report, essay, experiment, prototype note, concept, checkpoint, or project log?
```

Use the smallest adequate artifact type.

Do not inflate.

A strong note is better than a weak essay.

A preserved seed is better than a manufactured note.

---

## 3. Assign domain and theme

Use `domainPath` for the curated site territory.

Use `theme` for the more flexible topic cluster.

Example:

```yaml
documentType: field-report
domainPath:
  - "Human-Machine Workflows"
theme: agent-governance
```

If uncertain, leave a note for review instead of inventing a new taxonomy.

Do not create domains, themes, or concepts merely to classify one piece.

---

## 4. Draft

Use the relevant template from `article-templates.md`.

Start near:

* the live question
* the originating signal
* the tension
* the observed behavior
* the prototype problem
* the concrete situation

Do not begin with broad context unless the reader genuinely needs it.

Draft for meaning before polish.

Do not automatically turn the idea into:

* a framework
* an arrow chain
* a ladder
* a taxonomy
* a named progression
* a neat three-part structure

If a concrete situation can carry the idea, begin there.

---

## 5. Initial review

Before deeper editorial work, check:

* Is the central observation clear?
* Does the piece have a meaningful title?
* Does it distinguish observation from interpretation?
* Does it add something beyond summarizing source material?
* Does it connect to a larger Deep Field Works inquiry?
* Is the artifact type appropriate?
* Is the piece the right size for the idea?
* Is there enough material here to justify public development?

Do not continue merely because a draft exists.

A draft can return to seed status.

---

## 6. Development and editorial pass

Use `editorial-guidelines.md`.

Before polishing the prose, ask:

> What does this draft understand that the seed or source material did not yet say?

Check:

* idea development
* reader question or originating signal
* central tension where one genuinely exists
* concrete grounding
* whether a continuing narrative would clarify change over time
* mechanism or design finding
* evidence posture
* observation / inference / speculation
* uncertainty
* section function
* ending
* whether the inquiry has meaningfully advanced

A good draft should usually contribute something beyond:

* rewording
* organization
* compression
* expansion
* rhetorical polish
* a cleaner framework

Look for a turn.

The turn may be:

* a consequence
* a mechanism
* a complication
* a counterexample
* a changed interpretation
* a design implication
* a better question

Do not manufacture a twist.

But if the ending was already entirely contained in the seed, the piece may need further development.

### Prefer concrete examples

Ask:

* Can the reader picture what is happening?
* Is there a person, task, team, interface, decision, workflow, or institution through which the idea can be seen?
* Is an abstract model doing work that a concrete example could do better?

When the idea involves change over time, consider following the same person, team, task, decision, or institution through that change.

A continuing narrative can show:

* what happened before
* what changed
* what the system began doing
* what the person or organization did next
* what became easier
* what became harder
* where judgment or responsibility moved

Examples should do intellectual work.

Do not add an anecdote merely to decorate an already-complete abstraction.

Whenever possible, let the reader see the pattern before naming it.

### Editorial dispositions

Do not assume a competent draft is ready for editing.

End the development/editorial pass with one of these dispositions.

#### READY FOR HUMAN REVIEW

Use when:

* the idea is adequately developed
* evidence posture is sound
* a mechanical scan confirms that the publishable prose contains no Unicode em dash character (`—`)
* remaining work is primarily human editorial judgment

#### REVISE

Use when:

* the underlying idea is sufficiently developed
* identifiable draft problems can reasonably be solved through revision

Examples:

* weak opening
* unclear structure
* repetition
* missing example
* unsupported phrasing
* generic AI voice
* weak ending

#### DEVELOP FURTHER

Use when the prose is not the main problem.

The underlying thinking has not advanced enough.

Use when:

* the draft merely restates or polishes the seed
* the argument consists mostly of assertions
* a framework substitutes for explanation
* the example does not reveal a mechanism
* the inquiry has not moved
* a prototype is described without extracting a design finding
* the draft feels finished but does not clarify much

Action:

```text
DEVELOP FURTHER
```

Return to the idea before polishing the prose.

#### RESEARCH REQUIRED

Use when a material factual or evidentiary question blocks responsible development.

Action:

```text
RESEARCH REQUIRED
```

Identify exactly what must be verified.

Do not generate a polished draft around unresolved evidence.

#### KEEP AS SEED

Use when the idea is worth preserving but does not yet justify development into a public artifact.

Action:

```text
KEEP AS SEED
```

This is a successful outcome.

Not every seed needs publication.

---

## 7. Voice and prose-warning-sign pass

Use `voice-and-style.md` and the shared `prose-warning-signs.md`.

For Deep Field Works, apply the prose warning signs strongly.

Check:

* no Unicode em dash character (`—`) anywhere in the publishable prose
* no generic AI language
* no corporate phrasing
* no default ChatGPT cadence
* established AI terminology is used directly when the intended reader is likely to know it
* concrete verbs and human actions
* natural paragraph rhythm
* restrained confidence
* no unnecessary staged contrasts
* no manufactured symmetry
* no habitual three-part lists
* no stacked aphorisms
* no self-emphasizing sentences
* no mechanical conclusion
* no polished transition hiding weak logic
* no premature framework
* no arrow-chain model used as rhetorical packaging
* no premature naming
* no repeated explanation of obvious significance
* no rhetorical polish that exceeds the strength of the thinking

Prefer examples over conceptual packaging when an example can carry the idea.

Preserve useful irregularity.

Paragraphs do not need equal length.

Sections do not need symmetrical structure.

Lists do not need three items.

Every paragraph does not need a quotable ending.

Every observation does not need to become a principle.

Every piece does not need a conclusion.

Do not replace one recognizable AI pattern with another.

Do not polish the piece into a voice that sounds more certain, complete, or generic than the underlying thought.

---

## 8. Metadata pass

Use `content-schema.md`.

Confirm:

* required frontmatter fields are present
* `documentType` is valid
* `status` is correct
* `domainPath` is appropriate
* `theme` is useful
* `canonical` is correct
* related concepts or pieces are linked where helpful
* dates are accurate
* draft/publication state matches the actual workflow state

Do not use metadata to imply a conceptual status the piece has not earned.

---

## 9. Preview and human review

While a piece has `draft: true`, it should remain excluded from production.

Use the project's local draft-review infrastructure to evaluate the fully rendered page before publication.

For the current site:

1. Run the local development server.
2. Use the repository's documented review route for unpublished drafts.
3. Review the actual composed page rather than Markdown alone.
4. Check desktop and mobile behavior where relevant.
5. Verify that the draft remains excluded from production.

Review:

* title
* dek or opening
* pacing
* headings
* paragraph density
* presentation plan
* narrative flow
* visual hierarchy
* related content
* ending
* overall sense of whether the piece deserves publication

Human review is not merely proofreading.

A human reviewer may conclude:

* revise
* develop further
* research further
* keep as seed
* publish
* abandon

The rendered page is part of the editorial artifact.

---

## 10. Publish

Publish when the piece meets the minimum viable publication standard.

A piece does not need to be perfect.

It does need to be:

* clear
* grounded
* sufficiently developed
* appropriately evidenced
* worth preserving
* reviewed by a human when required

Set:

```yaml
draft: false
status: published
canonical: true
```

Do not publish merely because automated checks pass.

Technical validity is not editorial readiness.

---

## 11. Validate publication state

Before deployment or merge, run the repository's normal validation checks.

These may include:

* build
* draft-production-exclusion checks
* metadata/schema validation
* `git diff --check`
* route verification
* presentation-plan validation

Use existing repository scripts and documented commands.

Do not invent substitute checks when canonical ones exist.

Confirm that unpublished material remains excluded from production.

---

## 12. Link and index

After publication:

* add it to the appropriate domain page
* add it to the chronological archive
* link related pieces
* update concept references if needed
* add it to any relevant checkpoint queue
* confirm related-content relationships
* confirm the piece can be retrieved through the intended archive paths

Publishing is not complete until the piece can be found again.

---

# Before publishing checklist

Confirm:

* The artifact type is correct.
* The central observation is clear.
* The title is meaningful.
* The piece develops the source idea rather than merely polishing it.
* The piece adds something beyond summary.
* The inquiry has moved beyond the opening premise where development is expected.
* The piece distinguishes observation, inference, and speculation where needed.
* Material factual claims are adequately supported.
* The reader can picture what is happening.
* The piece contains concrete human, operational, interface, prototype, or institutional grounding where appropriate.
* If the piece describes change over time, a continuing narrative has been considered.
* Any framework or model adds value that a concrete example could not provide more clearly.
* The shared prose-warning-sign pass has been completed.
* A mechanical scan confirms that the publishable prose contains no Unicode em dash character (`—`).
* Avoidable AI tell-tales have been removed.
* The ending adds something or stops at the right point.
* The metadata is valid.
* The piece belongs in the public archive.
* Human review has happened where required.
* Production-exclusion and build checks pass.
* The publication state matches the actual editorial decision.

---

# After publishing rules

## Do not continually rewrite

Published work should remain historically meaningful.

Do not keep revising old pieces simply because the current wording could be better.

## Minor corrections are allowed

Examples:

* typos
* broken links
* formatting
* small wording fixes

These do not require a new update note.

## Clarifying edits are allowed

Examples:

* clearer sentence
* improved heading
* added example
* better internal link

Use `updatedDate` if the clarification meaningfully improves the piece.

## Substantive revisions should be visible

Examples:

* changed conclusion
* new interpretation
* major restructuring
* correction of a significant error
* updated model
* materially changed evidence
* a new design finding

Use one or more:

* update note
* checkpoint
* superseding piece
* revision note
* `updatedDate`
* `status: superseded`

The archive should preserve changes in thinking rather than silently erase them.

---

# Content selection

Prefer topics that are:

* timely but not merely trendy
* relevant to daily work or real systems
* evidence of broader shifts
* useful for understanding human-machine systems
* connected to prototypes or design practice
* connected to organizational structure or governance
* likely to remain interesting after the news cycle fades
* capable of sharpening an existing question or introducing a useful new one

Avoid publishing content solely because it is trending.

Avoid pieces that only summarize an article.

Avoid tool reviews unless they reveal a larger workflow, interface, governance, institutional, or cognitive pattern.

Avoid manufacturing a public artifact simply because a signal entered the pipeline.

---

# Human review requirements

Human review is required before publishing when a piece:

* makes strong claims
* names specific companies or people
* interprets current events
* uses personal context
* updates canonical source-of-truth docs
* defines or changes a concept
* affects professional positioning
* may become a homepage, about page, or domain page
* relies on speculative extrapolation that could be mistaken for established fact
* changes the presentation or editorial conventions of the site

Agents can:

* draft
* classify
* research
* revise
* suggest
* prepare presentation plans
* run validation
* recommend editorial disposition

Humans approve publication and major conceptual changes.

---

# Agent workflow rules

Agents should follow this sequence:

```text
1. Identify the source signal or seed.
2. Classify the material.
3. Choose the smallest adequate artifact type.
4. Apply the correct template.
5. Determine what the draft needs to add beyond the source.
6. Find concrete grounding.
7. Develop the idea.
8. Research material factual claims where necessary.
9. Preserve observation vs inference vs speculation.
10. Add or validate metadata.
11. Run the development/editorial pass.
12. Assign an editorial disposition.
13. Run the voice and prose-warning-sign pass.
14. Prepare and validate the rendered review artifact.
15. Flag uncertainty or missing context.
16. Stop for human review where required.
17. Publish only after explicit approval.
18. Validate, index, and link the published artifact.
```

Agents should not:

* inflate seeds into essays by default
* treat every signal as publishable
* publish source-of-truth changes without review
* silently rewrite published content
* create new domains or themes casually
* create concepts merely because a pattern can be named
* remove chronology
* over-polish away uncertainty
* summarize news without adding interpretation
* generate generic AI commentary
* use frameworks as a substitute for reasoning
* use arrow chains as default rhetorical structure
* manufacture narrative examples that imply real evidence
* create fictional quotations or events
* force every piece toward a conclusion
* treat passing technical validation as editorial approval
* keep revising prose when the underlying idea needs further development

---

# Lightweight publishing flow

The conceptual flow is:

```text
Inbox
  → classify
  → seed / note / field report / draft
  → develop
  → research where required
  → editorial disposition
  → human review
  → voice / prose-warning-sign pass
  → metadata check
  → rendered review
  → explicit approval
  → publish
  → validate
  → index / link related pieces
  → checkpoint when patterns accumulate
```

This process should remain lightweight.

The goal is not bureaucracy.

The goal is to keep useful thinking from being lost, prevent weak drafts from being published merely because they look finished, and preserve a durable record of how the thinking develops.

---

# Minimum viable publication standard

Before something is published, it should answer:

1. What is this piece?
2. Why does it exist?
3. What does it help clarify?
4. What observation, evidence, example, or prototype behavior anchors it?
5. What does the developed piece understand that the original seed did not yet say?
6. Can the reader see how the phenomenon works in practice?
7. What remains uncertain?
8. How does it connect to the larger Deep Field Works investigation?
9. Where does it belong in the archive?
10. Has a human decided that this version is worth preserving publicly?

If those questions cannot be answered, the piece should remain a seed, draft, research item, or development item.

---

# Long-term goal

Over time, the site should become:

* a field journal
* a research archive
* a knowledge base
* a prototype lab
* a cognitive institution

The archive itself is part of the experiment.
Deep Field Works is not only about the changing relationship between humans, machines, institutions, interfaces, and memory.

It is also a working example of that relationship.
