# Presentation Review

## Purpose

Presentation review evaluates whether a Deep Field Works artifact uses the presentation system appropriately.

The review is semantic and editorial, not merely visual.

Its purpose is to determine whether presentation choices:

- improve comprehension
- preserve the meaning of the artifact
- match the intended role of each component
- support the artifact type
- remain restrained and coherent

Presentation review does not redesign the page or rewrite the article.

---

# Relationship to Other Systems

Presentation review relies on three sources:

1. The artifact Markdown
2. The artifact's presentation plan
3. The Presentation System

The Markdown establishes the canonical content.

The presentation plan records the proposed presentation choices.

The Presentation System defines the intended meaning and permitted use of each component.

Figma and the Astro implementation may be consulted when visual fidelity is relevant, but they do not override the semantic definitions in the Presentation System.

---

# Review Scope

Presentation review evaluates:

- component selection
- component content
- placement
- frequency
- hierarchy
- duplication
- reading flow
- relationship to the artifact type
- separation of public and review-only material

Presentation review does not evaluate:

- the underlying argument, except where presentation changes or distorts it
- visual pixel accuracy
- implementation quality
- responsive behavior
- accessibility implementation
- factual accuracy already covered by editorial review

Those concerns may be handled by other review stages.

---

# Core Review Questions

## Comprehension

- Does the presentation make the artifact easier to understand?
- Does it clarify the structure of the argument?
- Does it help the reader distinguish primary ideas from supporting material?
- Does any treatment make the content harder to follow?

## Meaning

- Does the presentation preserve the artifact's original meaning?
- Has any treatment introduced a new claim, implication, or conclusion?
- Has extracted content been altered?
- Could the reader reasonably interpret the presented version differently from the canonical Markdown?

## Component Semantics

- Does every component perform the role defined in the Presentation System?
- Is the component's content appropriate for that role?
- Has a visual treatment been selected merely to create variety?
- Is ordinary prose being forced into a specialized component?

## Hierarchy

- Is there one clear page title?
- Do section headings represent genuine structural divisions?
- Does visual emphasis correspond to editorial importance?
- Are multiple components competing for attention?

## Placement

- Does each treatment appear near the material it supports?
- Does it interrupt a sentence, paragraph, list, or argument?
- Has enough context been established before emphasized material appears?
- Does the placement improve the reading rhythm?

## Restraint

- Is each presentation treatment necessary?
- Would removing one or more treatments improve the page?
- Are the same kinds of treatments repeated too often?
- Does the artifact still feel like a coherent piece of writing rather than a collection of components?

## Duplication

- Does a pull quote duplicate nearby text appropriately, or does it feel repetitive?
- Does a callout repeat a conclusion already emphasized elsewhere?
- Do the dek, title, opening paragraph, and metadata repeat the same information?
- Are Related Concepts and Related Pieces adding distinct value?

## Artifact Fit

- Does the presentation support the artifact type?
- Is a short note being over-presented?
- Does a longer essay have enough structure?
- Does a prototype note make the prototype, observation, and implication easy to distinguish?
- Is the presentation proportional to the length and complexity of the artifact?

## Publication Safety

- Are draft banners and internal editorial warnings limited to review contexts?
- Is any internal guidance visible in the public rendering?
- Are unpublished relationships or placeholder references exposed?
- Can the production version be generated without review-only material?

---

# Component-Specific Checks

## Page Title

Confirm that:

- exactly one H1 is present
- it represents the central idea
- it is not merely a filename, slug, or internal label
- it does not duplicate a separate display title unnecessarily

## Metadata Row

Confirm that:

- metadata is accurate
- the displayed fields are appropriate for the artifact
- draft state is only shown when relevant
- metadata does not compete with the title or dek

## Dek

Confirm that:

- it provides useful orientation
- it does not repeat the title
- it does not repeat the opening paragraph
- it does not introduce a claim absent from the artifact
- the page still reads naturally when no dek is used

## Section Heading

Confirm that:

- each heading introduces a meaningful section
- headings reflect the section's role or argument
- headings are not being used merely to style isolated sentences
- the heading hierarchy is coherent

## Pull Quote

Confirm that:

- the text already exists in the artifact
- the wording is unchanged
- it represents a meaningful idea
- it contains prose rather than a heading, list, label, or summary
- its placement follows sufficient context
- its removal would not alter the article's meaning
- its frequency is proportionate to the artifact

## Operational Callout

Confirm that:

- the content is an operational insight, principle, or durable takeaway
- the wording has been editorially reviewed
- it is concise
- it does not introduce unsupported meaning
- it is not placed inside a list
- it is not immediately adjacent to another callout
- ordinary paragraph content has not been converted into a callout without reason

## Ordered List

Confirm that:

- order, sequence, progression, or priority matters
- the sequence is clear
- the items use parallel structure where practical
- the list is not being used only to break up prose visually

## Unordered List

Confirm that:

- the items are meaningfully related
- no sequence or priority is implied
- the content is easier to understand as a list than as prose
- the list is not being used only for emphasis

## Inline Links

Confirm that:

- the linked text describes its destination or relevance
- the sentence reads naturally
- links support rather than interrupt the argument
- excessive linking does not fragment the reading experience

## Related Concepts

Confirm that:

- each concept represents a recurring idea in the archive
- the relationship is meaningful
- the section does not merely repeat tags or metadata
- the number of concepts remains selective

## Related Pieces

Confirm that:

- each relationship expands or complements the artifact
- the relationship is more useful than a generic topical similarity
- unpublished or unavailable pieces are not exposed unintentionally
- the section remains selective

## Draft Banner

Confirm that:

- it appears on unpublished review pages
- it clearly communicates draft status
- it does not appear in production

## Internal Editorial Warning

Confirm that:

- it communicates actionable review information
- it is visually distinguishable from article content
- it cannot appear in production
- it is removed when no longer relevant

---

# Review Outcomes

Presentation review returns one of three outcomes.

## PASS

Use when:

- presentation choices match the Presentation System
- meaning is preserved
- hierarchy and placement are coherent
- no material presentation problem remains

Minor subjective alternatives do not prevent a PASS.

## REVISE

Use when:

- one or more presentation choices weaken comprehension
- a component is used for the wrong semantic purpose
- placement or repetition disrupts reading
- presentation introduces or changes meaning
- review-only material may leak into production
- the page is substantially over-presented or under-structured

A REVISE outcome must identify the specific problem and the smallest reasonable correction.

## ESCALATE

Use when:

- the Presentation System does not define the needed treatment
- the presentation plan conflicts with the artifact's editorial intent
- correcting the presentation would require rewriting canonical content
- multiple valid interpretations require human editorial judgment
- the evaluator cannot determine whether a treatment is intentional

ESCALATE should not be used merely because presentation choices are subjective.

---

# Review Response Format

A presentation review should return:

## Outcome

PASS, REVISE, or ESCALATE.

## Summary

A concise assessment of the overall presentation.

## Findings

For each material issue:

- component
- location
- relevant Presentation System rule
- problem
- recommended correction

## Meaning Preservation

State whether the presented artifact preserves the meaning of the canonical Markdown.

## Production Safety

State whether draft-only and internal material are safely excluded from production.

## Optional Observations

Record non-blocking alternatives or subjective editorial suggestions separately from required revisions.

---

# Review Constraints

The evaluator must not:

- invent a new component
- rewrite article content
- substitute personal visual preferences for system rules
- reject a presentation solely because another valid treatment is possible
- require decorative variety
- turn optional guidance into rigid quotas
- treat every imperfect choice as a blocking issue

The evaluator should prefer the smallest correction that restores semantic and editorial coherence.

---

# Human Authority

Presentation review supports editorial judgment; it does not replace it.

A human editor may approve an intentional exception.

When an exception is approved, it should be documented if it establishes a reusable precedent. Repeated exceptions may indicate that the Presentation System needs to be revised.