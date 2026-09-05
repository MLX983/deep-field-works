# Deep Field Works — Article Templates

## Purpose of this document

This document provides reusable templates for Deep Field Works content.

It is intended for:

* human drafting
* ChatGPT-assisted writing
* Codex and agent workflows
* publication preparation
* site content consistency

Use this document when creating or restructuring a specific artifact.

Use `content-strategy.md` to decide what kind of artifact should exist.

Use `editorial-guidelines.md` to evaluate the strength of the piece.

Use `voice-and-style.md` for the final tone and language pass.

---

# Default frontmatter

Use this frontmatter for publishable content unless a specific template requires otherwise.

```yaml
---
title: ""
description: ""
pubDate: YYYY-MM-DD
draftDate:
updatedDate:
draft: true

documentType: ""
theme: ""
status: draft

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

## Field definitions

### title

The public title of the piece.

Prefer clear, specific titles over clever or overly abstract titles.

### description

A short summary used for previews, indexes, metadata, and agent retrieval.

The description should answer:

```text
What is this piece about, and why does it matter?
```

### pubDate

The original publication date.

Required for published content. Internal drafts may omit it until publication.

### draftDate

Optional internal creation date for a draft that has not been published. Generated drafts use `draftDate`, omit `pubDate`, and remain `canonical: false` until human approval.

Chronology matters. Preserve the date when the piece first becomes public.

### updatedDate

Use only when the piece receives a meaningful update after publication.

Minor typo fixes do not require an updated date.

### draft

Use `true` until the piece is ready to publish.

### documentType

Use one of:

```text
note
field-report
essay
experiment
prototype-note
concept
checkpoint
seed
```

### theme

Use a stable theme label where possible.

Examples:

```text
agent-governance
organizational-redesign
supervision-interfaces
externalized-cognition
design-after-ai
personal-cognitive-infrastructure
```

### status

Use one of:

```text
seed
draft
review
published
archived
superseded
```

### sourceNote

Optional note describing where the piece came from.

Examples:

```text
Based on a field observation from May 2026.
Adapted from prototype notes.
Developed from a ChatGPT conversation checkpoint.
Response to a product announcement.
```

### domainPath

A flexible navigation path.

Example:

```yaml
domainPath:
  - "AI adoption"
  - "Agent governance"
  - "Supervision interfaces"
```

### relatedConcepts

Stable concept references when available.

Example:

```yaml
relatedConcepts:
  - "GOV-01"
  - "AUT-01"
  - "HAI-01"
```

### relatedPieces

Links or slugs for related published pieces.

### canonical

Use `true` for the main version of a piece.

Use `false` for drafts, excerpts, alternate versions, or deprecated versions.

---

# Universal article skeleton

Use this when no more specific template applies.

```md
---
title: ""
description: ""
pubDate: YYYY-MM-DD
updatedDate:
draft: true

documentType: ""
theme: ""
status: draft

sourceNote: ""

domainPath:
  - ""

relatedConcepts:
  - ""

relatedPieces:
  - ""

canonical: true
---

# Title

Opening observation or reader question.

State the live question, observed signal, or central tension clearly and quickly.

Avoid broad setup.

## Why this matters

Explain why the observation is interesting.

Prefer concrete examples over abstract claims.

Show what changes if the observation is correct.

## Supporting observations

Use short sections.

Use bullets where appropriate.

Avoid unnecessary exposition.

Separate observation, interpretation, and speculation when needed.

## Tension or implication

What changes if the observation is correct?

What becomes possible?

What becomes harder?

What role, workflow, interface, or assumption is affected?

## What remains unresolved

Name the open question, unresolved tension, or signal to watch.

The objective is not always to reach a conclusion.

Sometimes the objective is to frame the problem more clearly.
```

---

# Note template

Use for short observations, early ideas, and partial distinctions.

Target length: 200–600 words.

```md
---
title: ""
description: ""
pubDate: YYYY-MM-DD
updatedDate:
draft: true

documentType: note
theme: ""
status: draft

sourceNote: ""

domainPath:
  - ""

relatedConcepts:
  - ""

relatedPieces:
  - ""

canonical: true
---

# Title

State the observation or question directly.

## Why it may matter

Explain the possible significance.

Keep the scope narrow.

## Current interpretation

Describe the clearest working interpretation.

Mark uncertainty honestly.

## Open question

End with the unresolved question or pattern to watch.
```

## Note requirements

A note should have:

* a clear observation or question
* enough context to revisit later
* a reason it belongs in the archive
* an unresolved edge

A note does not need:

* a full argument
* a polished ending
* broad reader framing

---

# Field report template

Use for interpreting an external signal: article, product launch, organizational change, public announcement, workplace pattern, or emerging behavior.

Target length: 500–1,200 words.

When a field report is treated as long-form, default to approximately 700–1,000 words. More than approximately 1,200 words requires a clear editorial reason. These are strong defaults with human editorial override, not mechanical publication limits.

```md
---
title: ""
description: ""
pubDate: YYYY-MM-DD
updatedDate:
draft: true

documentType: field-report
theme: ""
status: draft

sourceNote: ""

domainPath:
  - ""

relatedConcepts:
  - ""

relatedPieces:
  - ""

canonical: true
---

# Title

Name the signal and why it is worth noticing.

## The signal

Describe what happened.

Stay close to what is observable.

## Why it may matter

Explain the larger pattern this may point toward.

Avoid overclaiming from one example.

## The deeper tension

Name the structural issue underneath the signal.

What old assumption does this challenge?

## What is not being said

Identify missing context, incentives, risks, constraints, or second-order effects.

## What to watch next

List the signals that would strengthen, weaken, or complicate the interpretation.
```

## Field report requirements

A field report should have:

* observed signal
* interpretation
* uncertainty
* larger pattern
* what to watch next
* one central thesis or distinction
* 2–4 substantive points by default, regardless of heading count
* one meaningful counterargument or counterpressure when appropriate
* representative evidence rather than a source inventory

A field report does not need:

* final conclusion
* comprehensive research
* exhaustive proof
* academic treatment
* complete topic education
* polished thesis

Research can be extensive in the internal dossier. The public field report should synthesize only enough evidence to establish the point. End when the point lands rather than recapping the research.

---

# Essay template

Use for developed arguments, durable distinctions, and larger conceptual pieces.

Target length: approximately 700–1,000 words by default. More than approximately 1,200 words requires a clear editorial reason.

```md
---
title: ""
description: ""
pubDate: YYYY-MM-DD
updatedDate:
draft: true

documentType: essay
theme: ""
status: draft

sourceNote: ""

domainPath:
  - ""

relatedConcepts:
  - ""

relatedPieces:
  - ""

canonical: true
---

# Title

Open with the reader’s question or the central tension.

Avoid throat-clearing.

## The old framing is too small

Describe the common way people understand the issue.

Explain why that framing misses something important.

## The clearer distinction

Introduce the model, distinction, or claim that makes the issue easier to see.

## A concrete example

Show the idea through a workflow, interface, role, decision, prototype, or operational scenario.

## What changes

Explain the implications.

Focus on changed work, changed responsibilities, changed interfaces, or changed governance.

## What remains unresolved

Name the uncertainty honestly.

What is still too early to know?

What would change the interpretation?

## Closing turn

End by sharpening the original question, distinction, or tension.

Do not mechanically summarize.
```

## Essay requirements

An essay should have:

* clear opening question or tension
* structured argument
* 2–4 substantive points by default, regardless of heading count
* concrete example
* reader payoff
* strong ending
* one meaningful counterargument or counterpressure when appropriate

An essay does not need:

* exhaustive coverage
* academic proof
* false certainty

Comprehensive research may remain in the internal dossier. Use representative evidence in the public essay rather than reproducing the research process.

---

# Experiment template

Use for prototypes, interface studies, workflow simulations, and practical tests.

Target length: 700–1,500 words.

```md
---
title: ""
description: ""
pubDate: YYYY-MM-DD
updatedDate:
draft: true

documentType: experiment
theme: ""
status: draft

sourceNote: ""

domainPath:
  - ""

relatedConcepts:
  - ""

relatedPieces:
  - ""

canonical: true
---

# Title

State what was built or tested and what question it explores.

## Purpose

What larger question does this experiment address?

Why was this worth prototyping?

## What was built

Describe the artifact.

Include the relevant screens, flows, states, rules, or interaction patterns.

## What it demonstrates

Explain what the prototype makes visible.

Connect the design to the larger theme.

## What it does not solve

Name the limits.

Be clear about what is simulated, incomplete, or unresolved.

## What changed through the process

Describe any shift in thinking caused by the experiment.

## Next iteration

Identify what should be tested, refined, or built next.
```

## Experiment requirements

An experiment should have:

* purpose
* what was built or tested
* what it demonstrates
* what remains unresolved
* connection to the larger investigation

An experiment does not need:

* production polish
* complete technical implementation
* a broad theory unless relevant

---

# Prototype note template

Use for smaller design decisions, interaction patterns, or screen-level explanations.

Target length: 300–800 words.

```md
---
title: ""
description: ""
pubDate: YYYY-MM-DD
updatedDate:
draft: true

documentType: prototype-note
theme: ""
status: draft

sourceNote: ""

domainPath:
  - ""

relatedConcepts:
  - ""

relatedPieces:
  - ""

canonical: true
---

# Title

Name the interaction, screen, state, or design choice.

## The design problem

What needed to be represented, controlled, clarified, or tested?

## The interaction choice

Describe the design decision.

## Why it matters

Explain what larger pattern this small choice illustrates.

## Remaining questions

What is still unresolved?

What would need to be tested in a real system?
```

---

# Concept document template

Use for reusable models, frameworks, distinctions, and stable vocabulary.

Target length: 700–1,500 words.

```md
---
title: ""
description: ""
pubDate: YYYY-MM-DD
updatedDate:
draft: true

documentType: concept
theme: ""
status: draft

sourceNote: ""

domainPath:
  - ""

relatedConcepts:
  - ""

relatedPieces:
  - ""

canonical: true
---

# Concept name

Short definition.

## Core idea

Explain the concept clearly.

What does it help distinguish or understand?

## Why it matters

Explain the value of the concept.

What confusion does it reduce?

## Where it applies

List the contexts where the concept is useful.

## Example

Show the concept in practice.

Use a workflow, role, interface, decision, or organizational scenario.

## Related concepts

List related concept IDs or names.

## Open questions

What remains unresolved?

What might change the concept over time?
```

---

# Checkpoint template

Use to summarize accumulated thinking at a point in time.

Target length: 500–1,500 words.

```md
---
title: ""
description: ""
pubDate: YYYY-MM-DD
updatedDate:
draft: true

documentType: checkpoint
theme: ""
status: draft

sourceNote: ""

domainPath:
  - ""

relatedConcepts:
  - ""

relatedPieces:
  - ""

canonical: true
---

# Title

State what body of thinking this checkpoint summarizes.

## Current state

Summarize where the thinking stands now.

## What changed

Explain what has shifted since the previous version, earlier assumption, or prior checkpoint.

## Working model

Describe the current model.

Use bullets or diagrams if helpful.

## What remains uncertain

Name unresolved tensions, weak signals, or open questions.

## Next directions

List the next pieces, prototypes, questions, or signals to watch.
```

---

# Seed template

Use for private or semi-private raw material.

Seeds do not need to be public.

Target length: as short as needed.

```md
---
title: ""
description: ""
createdDate: YYYY-MM-DD

documentType: seed
theme: ""
status: seed

sourceNote: ""

domainPath:
  - ""

relatedConcepts:
  - ""
---

# Seed title

Raw thought, phrase, observation, question, or fragment.

## Why it might matter

Optional.

## Possible connections

Optional.

## Next action

Optional.
```

---

# Copy deck template

Use this for preparing site-ready copy before implementation.

```md
# Copy Deck: [Page or Piece Title]

## Metadata

Title:
Description:
Document type:
Theme:
Status:
Publication date:
Related concepts:
Related pieces:

---

## Page purpose

What should this page or piece accomplish?

---

## Primary reader question

What question is the reader likely carrying?

---

## Main copy

[Draft content goes here.]

---

## Pull quotes or anchor lines

Optional memorable lines:

- 
- 
- 

---

## Supporting modules

Optional page sections, cards, captions, or sidebars:

### Module 1

Title:
Copy:

### Module 2

Title:
Copy:

---

## Open graph / preview copy

Title:
Description:

---

## Internal notes

Questions, unresolved issues, links, or implementation notes.
```

---

# Template selection guide

Use this guide before drafting.

```text
Raw thought or fragment                  → seed
Short observation or question             → note
External signal or article response       → field report
Developed argument or model               → essay
Prototype or interface demonstration      → experiment
Small design decision or interaction note → prototype-note
Reusable framework or distinction         → concept
Accumulated synthesis                     → checkpoint
Site/page implementation copy             → copy deck
```

---

# Editorial reminders

Before moving any template-based draft toward publication, check:

* Is the artifact type correct?
* Is the opening close to the live question?
* Is the piece grounded in observation, example, or prototype behavior?
* Are observation, interpretation, and speculation separated where needed?
* Does the piece preserve uncertainty honestly?
* Does it avoid generic AI language?
* Does it connect to the larger Deep Field Works investigation?
* Does it have the right amount of polish for its type?
* Does the ending sharpen rather than merely summarize?

Chronology is a feature.

Preserve the evolution of thought.
