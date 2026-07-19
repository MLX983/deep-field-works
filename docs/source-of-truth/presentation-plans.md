# Presentation Plans

## Purpose

A presentation plan describes how a single Deep Field Works artifact should be presented during editorial review and, eventually, publication.

The article itself remains the canonical source of content.

A presentation plan never changes the article's meaning. It only proposes how that meaning should be presented.

Presentation plans exist so that editorial presentation can evolve independently of the durable article text.

---

# Relationship to Other Systems

Presentation plans occupy one layer within the publishing pipeline.

```
Article Markdown
        ↓
Presentation Plan
        ↓
Presentation System
        ↓
Astro Rendering
```

The responsibilities are intentionally separated.

| Layer | Responsibility |
|--------|----------------|
| Markdown | Durable content |
| Presentation Plan | Editorial presentation choices |
| Presentation System | Semantic definition of presentation components |
| Astro | Visual implementation |

---

# Guiding Principles

## Content is canonical

Presentation plans never become the canonical source of content.

The Markdown artifact remains authoritative.

---

## Presentation is additive

Presentation plans may:

- emphasize
- reorder
- extract
- annotate
- summarize metadata

They may not introduce new claims or arguments.

---

## Components are selected, not invented

Presentation plans choose from the components defined in the Presentation System.

They should not create new presentation treatments.

If a new treatment is needed, extend the Presentation System first.

---

## Editorial judgment remains human

Presentation plans are proposals.

Final placement and emphasis remain editorial decisions.

---

# Allowed Responsibilities

A presentation plan may specify:

## Display title

A presentation title may differ from the Markdown title when it improves readability.

The underlying article title remains unchanged.

---

## Dek

May:

- omit
- reuse description metadata
- provide reviewed text

A dek is optional.

---

## Section ordering

Presentation may reorder existing sections when readability improves.

No section content may be rewritten during reordering.

---

## Pull Quotes

A presentation plan may specify:

- source paragraph
- source sentence(s)
- placement

Pull quotes always reference existing article text.

---

## Callouts

Presentation plans may insert approved callout components.

Callouts must contain reviewed editorial content.

---

## Related Concepts

Presentation plans may choose which concepts are displayed.

---

## Related Pieces

Presentation plans may choose which related work appears.

---

## Draft Banner

Presentation plans determine whether draft review messaging appears.

Production publication removes draft-only treatments.

---

## Internal Review Guidance

Presentation plans may contain editorial guidance intended only for reviewers.

These annotations never appear in production.

---

# Explicitly Not Allowed

Presentation plans may not:

- change factual claims
- rewrite article content
- introduce new evidence
- change artifact type
- modify publication metadata
- create new presentation components
- bypass editorial review

---

# Review Expectations

Loop 4 should evaluate whether the presentation:

- improves comprehension
- preserves meaning
- matches the Presentation System
- emphasizes appropriate material
- avoids unnecessary decoration
- remains visually balanced
- supports the artifact type

Loop 4 should recommend revision when presentation weakens the article, even if the underlying content is correct.

---

# Human Review

Certain presentation decisions are expected to remain subjective.

Examples include:

- pull quote selection
- pull quote placement
- whether a dek is beneficial
- whether a callout improves readability
- overall visual balance

Reasonable editors may make different choices.

The system should surface these decisions for review rather than attempting to optimize them automatically.

---

# Future Direction

Presentation plans should gradually become reusable editorial artifacts.

The long-term goal is for an article to be regenerated consistently from:

- Markdown
- Presentation Plan
- Presentation System

without embedding presentation decisions inside the article itself.