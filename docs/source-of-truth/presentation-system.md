# Presentation System

## Purpose

The Deep Field Works presentation system separates editorial meaning from visual implementation.

Every presentation component or treatment exists to serve a specific editorial purpose. It is selected because it improves comprehension, navigation, or orientation—not because it adds visual variety.

Figma is the visual design source.

This document is the semantic source of truth.

The Astro implementation renders these semantics for the web.

Presentation plans select among the components and treatments defined here. They should not invent new presentation forms.

Presentation components are part of the editorial language of Deep Field Works. They communicate the role of information, not merely its appearance.

---

# Sources of Truth

The system is distributed across several sources:

| Source | Responsibility |
|---|---|
| Figma component page | Approved visual design |
| `presentation-system.md` | Editorial meaning and permitted use |
| `componentRegistry.ts` | Stable IDs and machine-readable constraints |
| Astro components and styles | Web implementation |
| Published DFW articles | Canonical examples of appropriate use |

The first three published entries may be used as positive presentation examples.

The system does not attempt to document every possible misuse. Review should evaluate new cases against component purpose, content rules, and placement guidance.

---

# Principles

## Editorial first

Presentation exists to clarify ideas, not decorate them.

## Every component has one job

Each component or treatment has a primary editorial purpose.

Content that does not match that purpose should use another component or remain ordinary prose.

## Presentation is optional

Special presentation treatments are not required simply to create variety.

The artifact should remain coherent without pull quotes, callouts, standalone links, or other optional treatments.

## Components do not create meaning

Presentation may organize, extract, emphasize, or connect existing material.

It must not silently introduce new arguments, evidence, or conclusions.

## Compositions combine defined components

A composition groups multiple components into a recurring page structure.

A composition does not create a new editorial meaning for the content inside it.

## Human judgment remains authoritative

Presentation plans are proposals.

The final editor may reposition, remove, or replace optional treatments.

---

# Page Structure

## Masthead

### Semantic ID

`masthead`

### Figma Name

`DFW / Article / Masthead`

### Type

Component.

### Purpose

Identify Deep Field Works as the publishing context for the page.

### Placement

At the top of the article page.

### Guidance

- Appears once per page.
- Remains visually subordinate to the artifact title.
- Does not contain article-specific claims or metadata.

---

## Global Navigation

### Semantic ID

`global-navigation`

### Figma Name

`DFW / Article / Global Navigation`

### Type

Component.

### Purpose

Provide navigation from the current artifact to a broader DFW destination, such as the index.

### Placement

Near the top of the page, before the article introduction.

### Guidance

- Appears once when the article template includes global navigation.
- Uses concise navigational language.
- Should not be confused with an article-specific main link.

---

## Intro

### Semantic ID

`intro`

### Figma Name

`DFW / Article / Compositions / Intro`

### Type

Composition.

### Purpose

Orient the reader by presenting the artifact title and its essential metadata as one coherent introductory block.

### Contents

- Page title
- Metadata wrapper

### Placement

After the masthead and global navigation, before the article body.

### Guidance

- Appears once per artifact page.
- Does not include body content.
- May be extended later if the approved article template adds a dek.

---

## Page Title

### Semantic ID

`page-title`

### Type

Text element within the Intro composition.

### Purpose

Identify the primary idea of the artifact.

### Guidance

- Exactly one per page.
- Communicates the central concept.
- Must not merely repeat a filename, slug, or internal label.
- Remains the highest article-specific heading in the page hierarchy.

---

## Metadata Wrapper

### Semantic ID

`metadata-wrapper`

### Type

Structured element within the Intro composition.

### Purpose

Orient the reader with essential artifact information.

### Typical Contents

- Artifact type
- Domain
- Publication month and year
- Draft state when applicable

### Guidance

- Displayed information must come from canonical artifact metadata.
- Metadata should not compete visually with the page title.
- Draft state must only appear in review contexts when applicable.

---

# Article Structure

## Section Heading

### Semantic ID

`section-heading`

### Figma Name

`DFW / Article / Section Heading`

### Type

Component.

### Purpose

Divide the artifact into coherent major sections.

### Placement

Within the article body.

### Guidance

- Represents a genuine structural division.
- Describes the section’s function, subject, or argument.
- Must not be used merely to emphasize an isolated sentence.
- Maps to the primary section-heading level below the page title.

---

## Subheading Block

### Semantic ID

`subheading-block`

### Figma Name

`DFW / Article / Compositions / Subheading Block`

### Type

Composition.

### Purpose

Introduce and contain a meaningful subsection within a larger article section.

### Contents

- Subheading
- Associated body content

### Placement

Within an existing major section.

### Guidance

- Use only when the surrounding section benefits from another level of organization.
- The body content must relate directly to the subheading.
- A short isolated paragraph generally does not require a Subheading Block.

---

## Subheading

### Semantic ID

`subheading`

### Figma Name

`DFW / Article / Subheading`

### Type

Component.

### Purpose

Introduce a subsection within a larger article section.

### Placement

Within a Subheading Block or equivalent subsection structure.

### Guidance

- Remains subordinate to the Section Heading.
- Represents a meaningful subdivision.
- Must not be used merely to style or emphasize a sentence.
- Maps to the next heading level below the Section Heading.

---

## Body Content

### Semantic ID

`body-content`

### Figma Name

`DFW / Article / Body Content`

### Type

Component.

### Purpose

Present the primary prose of the artifact.

### Placement

Within the article body and composed content blocks.

### Guidance

- Carries the canonical article text.
- Remains the default presentation form for prose.
- Content should not be moved into a specialized component unless that component’s semantic purpose is genuinely applicable.
- May contain inline links and ordinary text emphasis.

---

# Editorial Emphasis

## Pull Quote

### Semantic ID

`pull-quote`

### Figma Name

`DFW / Article / Pull Quote`

### Type

Component.

### Purpose

Emphasize an important sentence already present in the artifact.

### Content

- Must reuse existing article text.
- Must preserve the original wording.
- Must contain prose rather than a heading, list, label, or newly written summary.
- Must not introduce new material.

### Placement

- Between paragraphs.
- Within the section containing the source text.
- Usually after enough context has been established.

### Guidance

- Optional.
- Generally no more than two per article.
- Useful for creating emphasis or visual rhythm in longer pieces.
- Removing it must not change the meaning of the artifact.
- Its source sentence remains in the canonical article text unless the approved renderer explicitly handles extraction without loss.

---

## Operational Callout

### Semantic ID

`operational-callout`

### Figma Name

`DFW / Article / Operational Callout`

### Type

Component.

### Purpose

Highlight a design principle, operational insight, practical implication, or durable takeaway.

### Content

- May contain reviewed editorial text.
- May concisely summarize an implication already supported by the artifact.
- Must not introduce an unsupported claim.
- Should remain brief and focused.

### Placement

- Between paragraphs.
- Near the material it interprets or summarizes.
- Not inside a list.
- Not directly adjacent to another Operational Callout.

### Guidance

- Optional.
- Use when the artifact contains a distinct operational implication worth separating from the surrounding prose.
- Ordinary body text should not be converted into a callout solely for visual variety.

---

# Links and Navigation

## Inline Link

### Semantic ID

`inline-link`

### Figma Representation

Text styling within Body Content. It is not a separate Figma component.

### Type

Text treatment.

### Purpose

Connect readers to supporting material without interrupting the reading flow.

### Placement

Within body prose or other approved text content.

### Guidance

- Linked text should describe the destination or its relevance.
- The surrounding sentence should read naturally.
- Links should support rather than fragment the argument.
- Avoid generic link labels such as “click here.”
- Inline links inherit the surrounding text structure and differ through approved link styling.

---

## Main Link

### Semantic ID

`main-link`

### Figma Name

`DFW / Article / Main Link`

### Type

Component.

### Purpose

Present a prominent standalone destination that is directly relevant to the artifact.

### Placement

Within or immediately after the article content it supports.

### Guidance

- Use for a meaningful primary destination, source, prototype, or next action.
- Link text should identify the destination or purpose.
- Must not be used merely to make an ordinary inline citation more prominent.
- Optional.
- Use selectively.

---

## Footer Utility Link

### Semantic ID

`footer-utility-link`

### Figma Name

`DFW / Article / Footer Utility Link`

### Type

Component.

### Purpose

Provide a low-priority utility action at the end of the article, such as returning to the top of the page.

### Placement

After the article body and other article-specific content.

### Guidance

- Performs a utility navigation function.
- Does not serve as a recommendation, source citation, or related-content link.
- Remains visually subordinate to article content.
- Usually appears no more than once per page.

---

# Semantic Lists

Lists are semantic HTML structures styled by the article renderer. They do not currently require separate canonical Figma components.

## Ordered List

### Semantic ID

`ordered-list`

### Purpose

Communicate sequence, procedure, progression, ranking, or priority.

### Guidance

- Use only when item order carries meaning.
- Items should use parallel structure where practical.
- Do not use solely to break up prose visually.

---

## Unordered List

### Semantic ID

`unordered-list`

### Purpose

Present related items without implying sequence or priority.

### Guidance

- Items must be meaningfully related.
- Use when a list improves comprehension over prose.
- Do not use solely for emphasis or visual variety.

---

# Archive Relationships

The following structures may exist in article data or templates even when they do not yet have dedicated Figma components.

## Related Concepts

### Semantic ID

`related-concepts`

### Purpose

Connect the artifact to recurring concepts within the Deep Field Works archive.

### Placement

After the article body.

### Guidance

- Relationships must be meaningful.
- Must not merely repeat tags or metadata.
- Keep the selection limited and useful.

---

## Related Pieces

### Semantic ID

`related-pieces`

### Purpose

Surface nearby work that meaningfully expands or complements the current artifact.

### Placement

After the article body.

### Guidance

- Generic topical similarity is insufficient.
- Unpublished pieces must not be exposed unintentionally.
- Keep the selection selective.

---

# Review-Only Components

Review-only components may exist in the local editorial environment without appearing on the canonical Figma article component page.

## Draft Banner

### Semantic ID

`draft-banner`

### Purpose

Clearly distinguish unpublished review material from published work.

### Guidance

- Appears on unpublished review pages.
- Never appears in production.
- Communicates draft status clearly without being mistaken for article content.

---

## Internal Editorial Warning

### Semantic ID

`internal-editorial-warning`

### Purpose

Communicate actionable guidance to editors and reviewers.

### Guidance

- Never appears in production.
- Must be visually distinguishable from article content.
- Should be removed when no longer relevant.

---

# Presentation Review Questions

Presentation plans and rendered artifacts should be evaluated against the following questions:

- Does every specialized component improve understanding or navigation?
- Does every component perform the role defined in this document?
- Would ordinary body content be more appropriate?
- Does emphasis correspond to editorial importance?
- Does the page hierarchy remain clear?
- Does any treatment interrupt the reading flow?
- Is the page restrained rather than mechanically varied?
- Does the presentation preserve the canonical artifact’s meaning?
- Are review-only elements excluded from production?
- Does the page remain recognizably consistent with the canonical published examples?

---

# Extending the System

A new presentation component should not be added solely because a new visual treatment is desired.

Before adding one, define:

1. its editorial purpose
2. the content it accepts
3. its normal placement
4. how it differs from existing components
5. whether it is optional
6. how presentation review should evaluate it
7. its stable semantic ID
8. its approved Figma source
9. its Astro renderer

New components require explicit editorial and visual approval.