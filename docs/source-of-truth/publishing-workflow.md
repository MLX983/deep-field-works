# Deep Field Works — Publishing Workflow

## Purpose of this document

This document defines the publishing workflow for Deep Field Works.

It explains how raw material moves from signal to seed, note, field report, essay, experiment, concept document, checkpoint, and published archive.

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

Use `editorial-guidelines.md` and `voice-and-style.md` before publication.

---

# Core philosophy

Publish small.

The objective is continuous accumulation of useful observations, not production of polished masterpieces.

A short, clear field note is better than an unfinished perfect essay.

Deep Field Works should preserve thinking while it develops.

The site should not wait until every idea is complete.

But small does not mean careless.

Every public artifact should clarify something.

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

Not every idea must pass through every stage.

Some ideas will remain seeds forever.

Some field reports will never become essays.

Some prototypes may skip directly to experiments.

Some clusters may eventually produce concept documents or checkpoints.

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

---

## Note

A note is a short structured observation.

Use when:

* the idea is clearer than a seed
* there is a specific observation or question
* the material may become useful later
* the piece is not yet developed enough for an essay

A note should include:

* observation or question
* why it may matter
* current interpretation
* open question

Action:

```text
Draft a compact public or private note.
```

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
* what is not being said
* what to watch next

Action:

```text
Publish if the piece adds interpretation beyond summary.
```

---

## Essay

An essay develops a durable argument, distinction, or model.

Use when:

* the central tension is clear
* the idea has repeated across signals
* the piece offers a useful reader payoff
* the argument can stand beyond one event

An essay should include:

* reader question or tension
* old framing that is insufficient
* clearer model or claim
* concrete example
* implications
* unresolved questions
* sharp ending

Action:

```text
Draft, revise, review, and publish selectively.
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
* what was built
* what it demonstrates
* what it does not solve
* next iteration

Action:

```text
Publish when the prototype makes a concept tangible.
```

---

## Prototype Note

A prototype note documents a smaller piece of an experiment.

Use for:

* interaction decisions
* screen-level rationale
* state changes
* recommendation logic
* governance controls
* interface patterns

Action:

```text
Publish when the small design choice illustrates a larger pattern.
```

---

## Concept Document

A concept document extracts a durable model or reusable distinction.

Use when:

* a concept appears repeatedly
* future pieces need stable vocabulary
* agents need a retrieval anchor
* the archive needs conceptual structure

Action:

```text
Create or update the concept layer after repetition justifies it.
```

Do not create concept documents too early.

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
* working model
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

---

## 4. Draft

Use the relevant template from `article-templates.md`.

Do not begin with broad context.

Start near the live question, signal, tension, or prototype behavior.

---

## 5. Review

Before publication, check:

* Is the central observation clear?
* Does the piece have a meaningful title?
* Does it distinguish observation from interpretation?
* Does it add something beyond summarizing news?
* Does it connect to a larger Deep Field Works theme?
* Is the artifact type appropriate?
* Is the piece the right size for the idea?

---

## 6. Editorial pass

Use `editorial-guidelines.md`.

Check:

* reader question
* central tension
* concrete example
* section function
* heading strength
* evidence posture
* uncertainty
* ending

Cut or compress anything that does not advance the piece.

---

## 7. Voice pass

Use `voice-and-style.md`.

Check:

* no generic AI language
* no corporate phrasing
* no default ChatGPT cadence
* concrete verbs
* operational examples
* restrained confidence
* clear rhythm
* sharp ending

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

---

## 9. Publish

Publish when the piece meets the minimum viable publication standard.

A piece does not need to be perfect.

It does need to be clear, grounded, and worth preserving.

Set:

```yaml
draft: false
status: published
canonical: true
```

---

## 10. Link and index

After publication:

* add it to the appropriate domain page
* add it to the chronological archive
* link related pieces
* update concept references if needed
* add it to any relevant checkpoint queue

Publishing is not complete until the piece can be found again.

---

# Before publishing checklist

Confirm:

* The artifact type is correct.
* The central observation is clear.
* The title is meaningful.
* The piece adds something beyond summary.
* The piece distinguishes observation, inference, and speculation where needed.
* The piece has at least one concrete example or operational detail.
* The ending sharpens the question or tension.
* The metadata is valid.
* The piece belongs in the public archive.
* Human review has happened if the piece makes strong claims or changes source-of-truth material.

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

Use one or more:

* update note
* checkpoint
* superseding piece
* revision note
* `updatedDate`
* `status: superseded`

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

Avoid publishing content solely because it is trending.

Avoid pieces that only summarize an article.

Avoid tool reviews unless they reveal a larger workflow, interface, governance, or cognitive pattern.

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

Agents can draft, classify, revise, and suggest.

Humans approve publication and major conceptual changes.

---

# Agent workflow rules

Agents should follow this sequence:

```text
1. Classify the material.
2. Choose the smallest adequate artifact type.
3. Apply the correct template.
4. Preserve observation vs interpretation.
5. Add or validate metadata.
6. Run editorial pass.
7. Run voice pass.
8. Flag uncertainty or missing context.
9. Stop for human review when required.
```

Agents should not:

* inflate seeds into essays by default
* publish source-of-truth changes without review
* silently rewrite published content
* create new domains or themes casually
* remove chronology
* over-polish away uncertainty
* summarize news without adding interpretation
* generate generic AI commentary

---

# Lightweight publishing flow

```text
Inbox
  → classify
  → seed / note / field report / draft
  → human review
  → editorial pass
  → voice pass
  → metadata check
  → publish
  → index / link related pieces
  → checkpoint when patterns accumulate
```

This process should remain lightweight.

The goal is not bureaucracy.

The goal is to keep useful thinking from being lost and weak drafts from being published too easily.

---

# Minimum viable publication standard

Before something is published, it should answer:

1. What is this piece?
2. Why does it exist?
3. What does it help clarify?
4. What observation, evidence, example, or prototype behavior anchors it?
5. What remains uncertain?
6. How does it connect to the larger Deep Field Works investigation?
7. Where does it belong in the archive?

If those questions cannot be answered, the piece should remain a seed or draft.

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
