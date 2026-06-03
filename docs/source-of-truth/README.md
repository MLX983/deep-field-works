# Deep Field Works — Source of Truth

## Purpose of this folder

This folder contains the canonical operating documents for Deep Field Works.

These documents define what the project is, what it publishes, how content should be structured, how drafts should be evaluated, how the site should sound, and how humans and AI agents should work with the archive.

This folder is intended to be shared across:

* ChatGPT projects
* Codex and coding agents
* Cursor projects
* site repositories
* publishing workflows
* future content automation

The goal is to prevent important project guidance from becoming scattered across conversations, repositories, drafts, and prototypes.

---

# How to use this folder

Use these documents as the shared context layer before creating, editing, classifying, or publishing Deep Field Works material.

The documents are meant to work together.

They should not all be pasted into every prompt unless needed.

Use the smallest relevant set.

---

# Recommended reading order

## 1. Start here

Read this file first:

```text
README.md
```

Then read:

```text
project-overview.md
```

This establishes what Deep Field Works is and what kind of work belongs in the project.

---

## 2. For deciding what to create

Read:

```text
content-strategy.md
domain-structure.md
```

Use these to decide:

* what kind of artifact should exist
* why it should exist
* where it belongs
* which domain it fits
* whether it should be public, private, draft, or deferred

---

## 3. For drafting a piece

Read:

```text
article-templates.md
content-schema.md
```

Use these to choose the correct structure and metadata.

Do not inflate small ideas into essays by default.

Use the smallest artifact type that preserves the value.

---

## 4. For revising a piece

Read:

```text
editorial-guidelines.md
voice-and-style.md
```

Use these to improve:

* opening
* structure
* argument
* clarity
* evidence posture
* uncertainty
* headings
* tone
* rhythm
* ending

---

## 5. For publishing

Read:

```text
publishing-workflow.md
content-schema.md
```

Use these to move content from draft to published archive.

Confirm that metadata is valid before publishing.

---

# Canonical documents

## `project-overview.md`

Defines what Deep Field Works is.

Use for:

* project orientation
* site/about copy
* agent context
* scope boundaries
* explaining the overall purpose

---

## `content-strategy.md`

Defines what should be created, why it should exist, and how artifacts relate.

Use for:

* deciding whether something belongs
* choosing between note, field report, essay, experiment, concept, checkpoint, or seed
* prioritizing content
* preserving the project’s long-term direction

---

## `editorial-guidelines.md`

Defines how pieces should be written, evaluated, edited, and improved.

Use for:

* article revision
* argument structure
* evidence posture
* reader payoff
* headings
* endings
* avoiding generic AI writing

---

## `voice-and-style.md`

Defines how Deep Field Works should sound and feel.

Use for:

* final language pass
* tone calibration
* avoiding corporate, hype, or default AI voice
* preserving the recognizable Deep Field Works rhythm

---

## `article-templates.md`

Provides reusable structures for different artifact types.

Use for drafting:

* notes
* field reports
* essays
* experiments
* prototype notes
* concept documents
* checkpoints
* seeds
* copy decks

---

## `content-schema.md`

Defines metadata and frontmatter rules.

Use for:

* valid `documentType`
* valid `status`
* domain paths
* themes
* related concepts
* canonical status
* publication metadata

---

## `publishing-workflow.md`

Defines how material moves through the system.

Use for:

* deciding next action
* moving from signal to seed
* drafting and review flow
* publication checks
* post-publication handling
* human review requirements

---

## `domain-structure.md`

Defines the thematic territories of the site.

Use for:

* assigning content to domains
* creating domain pages
* organizing the archive
* distinguishing domain, type, and theme

Recommended primary domains:

```text
Cognitive Infrastructure
Human-Machine Workflows
Institutions in Transition
Interfaces for Judgment
Media, Memory, and Meaning
```

---

# Working model

Deep Field Works uses several classification layers.

```text
Domain = what larger territory the piece belongs to
Type   = what kind of artifact the piece is
Theme  = what recurring topic cluster it connects to
Status = where it is in the lifecycle
```

Example:

```text
Title: Monitoring Preferences
Domain: Interfaces for Judgment
Type: Experiment
Theme: supervision-interfaces
Status: published
```

---

# Default content lifecycle

Most material moves through some version of this path:

```text
Signal → Seed → Note → Field Report → Essay / Experiment → Concept Document → Checkpoint
```

Not every idea moves through every stage.

Some ideas remain seeds.

Some notes never become essays.

Some prototypes become experiments.

Some repeated ideas become concepts.

Some clusters eventually become checkpoints.

---

# Core operating principles

## 1. Preserve the evolution of thought

Do not rewrite history to make earlier work appear more correct than it was.

Chronology is part of the value.

---

## 2. Use the smallest adequate artifact

Not every idea needs to become an essay.

A strong note is better than a weak article.

A clear field report is better than a generic think piece.

---

## 3. Separate observation from interpretation

When claims matter, distinguish:

* observation
* inference
* speculation
* uncertainty

Do not present speculation as fact.

---

## 4. Make abstract ideas operational

Whenever possible, show what changes in:

* work
* interfaces
* roles
* decisions
* governance
* memory
* coordination
* supervision

---

## 5. Avoid generic AI commentary

Deep Field Works should not publish interchangeable AI trend writing.

The site should clarify patterns, distinctions, prototypes, and working models.

---

## 6. Keep source-of-truth documents stable

Do not change canonical documents casually.

When updating source-of-truth material, preserve the intent of the system.

Major changes should receive human review.

---

# Agent instructions

When an AI agent uses this folder, it should:

1. Identify the task type.
2. Read only the relevant source-of-truth documents.
3. Classify the material before drafting.
4. Use the smallest adequate artifact type.
5. Preserve observation, inference, and speculation.
6. Avoid generic AI language.
7. Apply the correct metadata schema.
8. Flag uncertainty or missing context.
9. Stop for human review when required.
10. Avoid silently changing canonical source-of-truth documents.

Agents should not:

* inflate seeds into essays by default
* create new domains without approval
* rewrite published work to hide earlier uncertainty
* publish source-of-truth updates without review
* replace human judgment with confident-sounding synthesis
* remove chronology
* over-polish away the live quality of the work

---

# Human review required

Human review is required before publishing or merging changes when a document:

* changes the project’s scope
* updates source-of-truth guidance
* defines a new domain
* defines or changes a durable concept
* makes strong claims about current companies or people
* uses personal context
* affects public positioning
* becomes homepage, about page, or domain page copy

Agents may draft, classify, revise, and suggest.

Humans approve canonical changes.

---

# Recommended folder structure

```text
/source-of-truth/
  README.md
  project-overview.md
  content-strategy.md
  editorial-guidelines.md
  voice-and-style.md
  article-templates.md
  content-schema.md
  publishing-workflow.md
  domain-structure.md
  concept-registry.md
  agent-instructions.md
```

Some documents may not exist yet.

That is acceptable.

The folder should grow as the system needs more structure.

---

# Versioning rule

When a source-of-truth document changes meaningfully:

* update the document directly if it improves clarity without changing direction
* add an update note if the change alters guidance
* preserve older versions only when the change represents a meaningful shift
* avoid maintaining competing versions of the same canonical document

There should be one preferred version of each source-of-truth document.

---

# Final principle

This folder is part of the work.

It is not just documentation around Deep Field Works.

It is the operating memory that allows the project, the site, the archive, and future agents to develop coherently over time.
