# Deep Field Works — Content Schema

## Purpose of this document

This document defines the metadata schema for Deep Field Works content.

It is intended for:

* published site content
* draft content
* ChatGPT-assisted writing
* Codex and agent workflows
* archive indexing
* future retrieval and automation

Use this document when creating, classifying, editing, importing, or publishing content.

The schema should help both humans and AI systems understand:

* what kind of artifact a piece is
* where it belongs
* what themes it connects to
* whether it is canonical
* how it should be retrieved later
* whether it is draft, published, archived, or superseded

The goal is not to create bureaucracy.

The goal is to make the archive navigable and durable.

---

# Default frontmatter

All publishable content should include the following frontmatter.

```yaml
---
title: ""
description: ""
pubDate: YYYY-MM-DD
updatedDate:
draft: true

documentType: ""
theme: ""
status: ""

sourceNote: ""
domainPath:
  - ""

relatedConcepts:
  - ""

relatedPieces:
  - ""

canonical: true
---
```

---

# Required fields

## title

The public title of the piece.

The title should be clear enough to help a reader understand the subject without extra context.

Prefer:

* specific
* direct
* durable
* question- or tension-aware

Avoid:

* vague titles
* overly clever titles
* generic AI phrasing
* titles that depend too heavily on a current news cycle

Good examples:

```text
The Pyramid Was Built to Route Information
Delegation Without Governance Is a Blind Spot
The Archive Becomes Part of the Work
The Interface Is a Governance Surface
```

---

## description

A short summary used for previews, index pages, metadata, and agent retrieval.

The description should answer:

```text
What is this piece about, and why does it matter?
```

A useful description should include the core idea, not just the topic.

Weak:

```text
A post about AI and work.
```

Better:

```text
A field note on how AI changes the routing of information inside organizations, and why that may alter the role of middle management.
```

---

## pubDate

The original publication date.

Use format:

```text
YYYY-MM-DD
```

Publication dates matter because Deep Field Works preserves the evolution of thinking over time.

Do not silently change `pubDate` when revising a piece.

---

## updatedDate

Use when a published piece receives a meaningful update.

Use format:

```text
YYYY-MM-DD
```

Use `updatedDate` for:

* substantive clarification
* added context
* changed interpretation
* meaningful structural revision
* updated links to related work
* corrections that affect meaning

Do not use `updatedDate` for:

* typo fixes
* minor formatting changes
* small wording improvements
* metadata cleanup

---

## draft

Boolean value.

Allowed values:

```yaml
draft: true
draft: false
```

Use `true` until the piece is ready to publish.

Use `false` only when the piece is public or ready for publication.

---

# Classification fields

## documentType

The artifact type.

Allowed values:

```text
seed
note
field-report
essay
experiment
prototype-note
concept
checkpoint
project-log
```

## documentType definitions

### seed

Raw or lightly processed material.

Use for:

* fragments
* questions
* rough observations
* possible titles
* early ideas
* saved signals

Seeds do not need to be public.

---

### note

A short observation, distinction, or question.

Use when an idea is worth preserving but not developed enough for an essay.

Typical length:

```text
200–600 words
```

---

### field-report

A structured interpretation of an external signal.

Use for:

* articles
* product launches
* company announcements
* public behavior
* emerging patterns
* current developments

A field report should distinguish observation from interpretation.

---

### essay

A developed argument, model, or distinction.

Use when the piece has a clear reader question, central tension, concrete example, and durable takeaway.

---

### experiment

A writeup for something built, tested, simulated, or prototyped.

Use for:

* interface prototypes
* workflow models
* AI-assisted production experiments
* design explorations
* technical proof-of-concept work

---

### prototype-note

A shorter writeup about a specific screen, interaction, state, design decision, or prototype behavior.

Use when the artifact is too small for a full experiment page but still worth documenting.

---

### concept

A durable model, framework, distinction, or reusable vocabulary item.

Use when an idea appears across multiple pieces and should become part of the shared concept layer.

---

### checkpoint

A synthesis of accumulated thinking at a specific point in time.

Use when:

* several pieces form a larger pattern
* a project direction has changed
* an earlier assumption has shifted
* the archive needs compression for future retrieval

---

### project-log

A record of site development, workflow changes, publishing system changes, or meta-level decisions about Deep Field Works itself.

Use when documenting the project as an evolving system.

---

# Theme field

## theme

A human-readable topic area.

Themes should describe the content cluster.

Themes are more flexible than domains.

Themes may evolve over time.

Do not treat themes as permanent taxonomy.

Recommended starting values:

```text
agent-governance
organizational-redesign
supervision-interfaces
externalized-cognition
design-after-ai
personal-cognitive-infrastructure
media-and-memory
publishing-systems
prototype-lab
```

## Theme usage rules

Use one primary theme when possible.

If multiple themes apply, choose the one that best describes the piece’s main contribution.

Do not create a new theme when an existing one is close enough.

Themes should help retrieval.

They should not become decorative tags.

---

# Status field

## status

The lifecycle state of the artifact.

Allowed values:

```text
seed
draft
review
published
archived
superseded
```

## Status definitions

### seed

Raw or early material.

Not ready for public review.

---

### draft

A structured piece exists, but it still needs development or editing.

---

### review

The piece is close to publication and needs human review.

Use this status when an agent or assistant has prepared a publishable draft but human approval is still required.

---

### published

The piece is public or ready to be treated as public canonical content.

---

### archived

The piece is preserved but no longer active.

Use when the piece remains historically useful but should not be treated as current.

---

### superseded

The piece has been replaced by a newer or better version.

Superseded pieces should usually link to the newer version.

Do not delete or silently rewrite them unless there is a strong reason.

---

# Source and origin fields

## sourceNote

Optional note describing where the material originated.

Examples:

```text
Deep Field Works launch notes
AI Adoption project
Personal observation
Prototype review
ChatGPT checkpoint
Response to product announcement
Imported from prior project documentation
```

Use `sourceNote` to preserve provenance.

This is especially useful when content moves between ChatGPT projects, Codex, GitHub, and the public site.

---

# Navigation fields

## domainPath

A curated reading pathway.

Domains are manually managed.

Do not treat domains as casual tags.

Use domain paths to place content inside the site’s larger thematic map.

Recommended primary domains:

```text
Cognitive Infrastructure
Human-Machine Workflows
Institutions in Transition
Interfaces for Judgment
Media, Memory, and Meaning
```

Example:

```yaml
domainPath:
  - "Interfaces for Judgment"
```

Another example:

```yaml
domainPath:
  - "Human-Machine Workflows"
  - "Agent governance"
```

## Domain usage rules

Use one primary domain unless a piece genuinely bridges two areas.

Do not over-nest early.

Avoid creating deep domain paths before the archive has enough content to justify them.

The domain should answer:

```text
What larger territory does this piece belong to?
```

---

# Relationship fields

## relatedConcepts

Stable concept IDs or concept names.

Use when the piece connects to a durable framework.

Examples:

```yaml
relatedConcepts:
  - "GOV-01"
  - "AUT-01"
  - "HAI-01"
```

If concept IDs are not yet available, use the concept name.

Example:

```yaml
relatedConcepts:
  - "Delegated authority"
  - "Governance surface"
```

Over time, concept names should be replaced or supplemented with stable IDs.

---

## relatedPieces

Links, slugs, or filenames for related published pieces.

Use when a piece continues, responds to, supersedes, or depends on another piece.

Example:

```yaml
relatedPieces:
  - "the-pyramid-was-built-to-route-information"
  - "monitoring-preferences"
```

Related pieces help the archive become navigable as it grows.

---

# Canonical field

## canonical

Boolean value.

Allowed values:

```yaml
canonical: true
canonical: false
```

Use `canonical: true` for the preferred version of an idea.

Use `canonical: false` for:

* drafts
* excerpts
* alternate versions
* imported legacy versions
* deprecated copies
* experiments with duplicated content

If a piece is superseded, set:

```yaml
status: superseded
canonical: false
```

And link to the newer version using `relatedPieces`.

---

# Recommended extended fields

The default schema should stay small.

However, some content types may benefit from optional extended fields.

## Optional field: summary

Short internal summary for agents.

```yaml
summary: ""
```

Use when the public description is too short for retrieval.

---

## Optional field: confidence

Use for field reports, working theories, and speculative pieces.

```yaml
confidence: "low"
```

Allowed values:

```text
low
medium
high
```

Confidence should reflect the strength of the interpretation, not the importance of the topic.

---

## Optional field: evidenceLevel

Use when evaluating claims or external signals.

```yaml
evidenceLevel: "early-signal"
```

Allowed values:

```text
personal-observation
single-signal
early-pattern
recurring-pattern
well-supported
speculative
```

---

## Optional field: visibility

Use if private, semi-private, and public material share a repository.

```yaml
visibility: "public"
```

Allowed values:

```text
private
internal
public
```

---

## Optional field: supersedes

Use when a piece replaces an earlier version.

```yaml
supersedes:
  - ""
```

---

## Optional field: supersededBy

Use when a piece has been replaced.

```yaml
supersededBy:
  - ""
```

---

# Content-type examples

## Field report example

```yaml
---
title: "When Agents Start Spending Money"
description: "A field report on autonomous spending systems and why delegated authority requires governance before scale."
pubDate: 2026-06-01
updatedDate:
draft: true

documentType: field-report
theme: agent-governance
status: draft

sourceNote: "Response to agentic finance article"
domainPath:
  - "Human-Machine Workflows"

relatedConcepts:
  - "GOV-01"
  - "AUT-01"

relatedPieces:
  - ""

canonical: true
---
```

---

## Experiment example

```yaml
---
title: "Monitoring Preferences"
description: "A prototype exploring how users might set thresholds for interruption, surprise, automation trust, and device impact."
pubDate: 2026-06-01
updatedDate:
draft: true

documentType: experiment
theme: supervision-interfaces
status: draft

sourceNote: "Prototype writeup"
domainPath:
  - "Interfaces for Judgment"

relatedConcepts:
  - "GOV-01"
  - "AUT-01"
  - "HAI-01"

relatedPieces:
  - ""

canonical: true
---
```

---

## Checkpoint example

```yaml
---
title: "Current Model of Human-Machine Workflows"
description: "A checkpoint summarizing the current working model of delegation, supervision, governance, and human judgment in AI-supported workflows."
pubDate: 2026-06-01
updatedDate:
draft: true

documentType: checkpoint
theme: agent-governance
status: draft

sourceNote: "Synthesis across prior notes and prototype work"
domainPath:
  - "Human-Machine Workflows"

relatedConcepts:
  - "GOV-01"
  - "AUT-01"
  - "HAI-01"

relatedPieces:
  - ""

canonical: true
---
```

---

# Schema governance

The schema should be stable enough for agents to rely on.

Do not change field names casually.

If a field name changes, update:

* `content-schema.md`
* `article-templates.md`
* publishing scripts
* agent instructions
* existing content metadata where needed

Allowed values may evolve, but changes should be deliberate.

---

# Schema principles

## 1. Keep metadata useful

Do not add fields unless they improve publishing, retrieval, navigation, or maintenance.

## 2. Preserve chronology

Do not overwrite publication dates to make old work seem newer.

## 3. Separate type from theme

`documentType` describes what kind of artifact it is.

`theme` describes what topic cluster it belongs to.

## 4. Separate theme from domain

`theme` is flexible.

`domainPath` is curated.

Themes can evolve freely.

Domains should remain relatively stable.

## 5. Preserve provenance

Use `sourceNote` to explain where material came from when it matters.

## 6. Mark supersession clearly

Do not silently replace old thinking.

If a piece is superseded, preserve that fact.

## 7. Make the archive agent-readable

Metadata should help future AI systems classify, retrieve, connect, and update content without guessing.

---

# Minimum viable schema

If a piece is early or private, use at least:

```yaml
---
title: ""
description: ""
pubDate:
draft: true

documentType: seed
theme: ""
status: seed

sourceNote: ""
domainPath:
  - ""

canonical: false
---
```

This keeps even rough material retrievable without requiring full publication metadata.

---

# Final principle

Metadata is not decoration.

It is part of the cognitive infrastructure of Deep Field Works.

The schema should help the archive remember what each piece is, where it came from, how it relates to the larger investigation, and whether it should be treated as current.
