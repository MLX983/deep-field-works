# AGENTS.md

## Codex Operating Summary

Treat this repository as the working corpus for Deep Field Works.

Before major content, metadata, taxonomy, publishing, or public-facing changes, read the relevant files in `docs/source-of-truth/`.

Use the smallest adequate artifact type: `seed`, `note`, `field-report`, `essay`, `experiment`, `prototype-note`, `concept`, `checkpoint`, or `project-log`.

Follow `content-schema.md`, `docs/workflows/publishing-workflow.md`, `editorial-guidelines.md`, and `voice-and-style.md` as applicable.

Preserve chronology. Do not modify source-of-truth documents, publish content, change draft status, or change canonical status without human approval.

Avoid generic AI writing and over-polished ChatGPT cadence.

Keep changes scoped, and run `npm run build` before reporting work complete.

---

## Project Overview

Deep Field Works is a long-term field journal, laboratory notebook, prototype lab, and publishing platform focused on the intersection of humans, technology, knowledge systems, institutions, interfaces, and artificial intelligence.

The site serves as:

* a public notebook
* a research archive
* a prototype lab
* a concept library
* a working record of evolving thought
* a development environment for future ideas

The objective is not audience growth, SEO optimization, personal branding, consulting lead generation, or content marketing.

The objective is to document observations, develop ideas, preserve intellectual history, and explore emerging human-machine workflows.

The archive is not merely documentation.

The archive itself is part of the experiment.

---

## Source of Truth

Before making content, publishing, taxonomy, voice, metadata, or site-structure decisions, read:

```text
docs/source-of-truth/
```

That folder contains the canonical Deep Field Works source-of-truth documents.

Authoritative operational publishing guidance lives at `docs/workflows/publishing-workflow.md`.

Use the source-of-truth documents together with the publishing workflow for:

* project purpose
* content strategy
* domain structure
* article templates
* metadata schema
* publishing workflow
* editorial guidance
* voice and style

Do not invent new domains, content types, metadata fields, workflow stages, or publishing conventions unless explicitly asked.

When source-of-truth guidance conflicts with assumptions in this repository, the source-of-truth documents take precedence unless the user says otherwise.

---

## Recommended Source-of-Truth Reading Order

Use the smallest relevant set of documents.

For general orientation:

```text
docs/source-of-truth/README.md
docs/source-of-truth/content-strategy.md
docs/source-of-truth/domain-structure.md
```

For drafting content:

```text
docs/source-of-truth/article-templates.md
docs/source-of-truth/content-schema.md
```

For revising content:

```text
docs/source-of-truth/editorial-guidelines.md
docs/source-of-truth/voice-and-style.md
```

For publishing or workflow decisions:

```text
docs/workflows/publishing-workflow.md
docs/source-of-truth/content-schema.md
```

For domain, taxonomy, or navigation decisions:

```text
docs/source-of-truth/domain-structure.md
docs/source-of-truth/content-schema.md
```

---

## Core Principles

### Preserve Evolution

The archive should show how ideas develop over time.

Do not rewrite history to make earlier work appear more polished, correct, or complete.

Chronology is a feature, not a problem.

### Favor Observation Over Opinion

Articles should begin with observations, signals, examples, or prototype behavior whenever possible.

Avoid unsupported claims and sweeping conclusions.

### Preserve Uncertainty

Not every article requires a conclusion.

Open questions are valuable.

Tentative interpretations are acceptable when clearly identified as tentative.

When claims matter, distinguish:

* observation
* inference
* speculation
* uncertainty

### Build Durable Knowledge

Prioritize work that remains useful months or years later.

Avoid chasing short-lived trends unless they reveal a broader shift.

### Use the Smallest Adequate Artifact

Do not inflate every idea into an essay.

A strong note is better than a weak article.

A clear field report is better than a generic think piece.

A focused prototype note is better than a vague project essay.

---

## What Deep Field Works Is Not

Do not transform the site into:

* a traditional blog
* a newsletter
* a personal brand platform
* a consulting website
* a startup landing page
* a marketing funnel
* an SEO content farm
* an AI hype publication
* a generic productivity site
* a conventional UX portfolio

The project should retain the feeling of a working notebook, field journal, research vessel, and prototype cognitive institution.

---

## Writing Style

Preferred characteristics:

* clear
* direct
* thoughtful
* analytical
* concrete
* concise
* structurally honest
* provisional when needed

Avoid:

* corporate language
* marketing language
* clickbait
* excessive jargon
* generic AI-generated prose
* empty motivational language
* broad introductions
* AI hype language
* polished paragraphs that do not sharpen the idea

Use short paragraphs.

Favor concrete examples over abstract claims.

Make abstract shifts operational by showing what changes in:

* work
* interfaces
* roles
* decisions
* governance
* memory
* coordination
* supervision

---

## Content Types

Use the canonical content types defined in the source-of-truth folder.

Current primary types include:

* seed
* note
* field-report
* essay
* experiment
* prototype-note
* concept
* checkpoint
* project-log

Before creating content, classify the artifact type.

Use the smallest type that preserves the value of the idea.

---

## Domains and Themes

Use the canonical domain structure defined in the source-of-truth folder.

Current primary domains:

* Cognitive Infrastructure
* Human-Machine Workflows
* Institutions in Transition
* Interfaces for Judgment
* Media, Memory, and Meaning

Do not create new domains without explicit user approval.

Distinguish:

```text
Domain = what larger territory the piece belongs to
Type   = what kind of artifact the piece is
Theme  = what recurring topic cluster it connects to
Status = where it is in the lifecycle
```

---

## Metadata and Schema

Use the canonical metadata schema from the source-of-truth folder.

Do not create new frontmatter fields unless explicitly asked.

Do not change field names casually.

For publishable content, ensure frontmatter follows the current schema.

Use valid values for:

* `documentType`
* `theme`
* `status`
* `domainPath`
* `relatedConcepts`
* `relatedPieces`
* `canonical`

When uncertain, leave a clear note rather than inventing taxonomy.

---

## Editorial Guidance

Before creating or modifying published content, consult the canonical editorial guidance in the source-of-truth folder.

Editorial guidance governs:

* opening structure
* reader question
* central tension
* argument shape
* headings
* evidence posture
* uncertainty
* endings
* avoiding generic AI prose

Editorial guidance takes precedence over stylistic assumptions.

---

## Voice and Style

Before finalizing public-facing copy, consult the canonical voice and style guidance in the source-of-truth folder.

Deep Field Works should sound like a thoughtful field journal for the AI age:

* clear
* provisional
* concrete
* structurally honest
* quietly ambitious
* more interested in useful understanding than performative certainty

Avoid default AI cadence.

Avoid corporate thought-leadership voice.

Avoid marketing polish.

The writing should feel selected, argued, and edited.

Not generated.

---

## Publishing Guidance

Before publishing or restructuring content, consult the authoritative operational publishing guidance at `docs/workflows/publishing-workflow.md`.

Agents may draft, organize, summarize, edit, classify, and propose.

Agents should not assume authority to publish automatically.

Do not set content to published status, change canonical status, or alter publishing workflow unless explicitly asked.

---

## Site Architecture

When modifying the site:

* prefer simple solutions
* minimize dependencies
* favor static generation
* preserve readability
* preserve performance
* keep routing understandable
* avoid unnecessary frameworks
* avoid speculative abstractions
* preserve the ability for one person to understand and maintain the site

Complexity requires justification.

Do not restructure the site unless explicitly asked.

When building new pages, extend the existing structure rather than replacing it.

---

## Agent Behavior

Before making substantial changes:

1. Read this file.
2. Read `docs/source-of-truth/`.
3. Consult the relevant source-of-truth documents.
4. Identify the smallest viable change.
5. Explain proposed changes before implementing them when the change is structural, public-facing, or irreversible.
6. Preserve existing content and chronology.
7. Avoid speculative redesigns.
8. Run the relevant build or validation step when code changes are made.
9. Report what changed.

Do not introduce major structural changes unless explicitly requested.

Do not silently alter canonical documentation.

Do not overwrite source-of-truth documents unless specifically instructed.

---

## Content Creation Rules

When asked to create new content:

1. Classify the content type.
2. Assign the likely domain and theme.
3. Use the relevant template.
4. Preserve observation, inference, and speculation.
5. Add valid metadata.
6. Draft the smallest adequate artifact.
7. Avoid generic AI commentary.
8. Stop for review unless the user explicitly asks to publish.

When asked to revise content:

1. Preserve the original idea unless asked to reframe it.
2. Improve clarity without over-polishing.
3. Keep uncertainty visible where it matters.
4. Strengthen headings and structure.
5. Avoid making old work appear more certain than it was.

---

## Presentation System

The Deep Field Works presentation system is governed by the following documents.

Priority order:

1. docs/source-of-truth/presentation-system.md
2. docs/source-of-truth/presentation-plans.md
3. docs/source-of-truth/presentation-review.md
4. src/presentation/componentRegistry.ts

Editorial meaning is defined by the Markdown documentation.

Figma is the canonical visual authoring source.

The component registry provides stable machine-readable identifiers and mappings.

When the repository conflicts with Figma:

- do not invent a resolution
- report the conflict
- wait for human review

Do not create new presentation components unless explicitly requested.

Do not infer missing Figma metadata.

When Figma MCP is unavailable, use the approved repository specification rather than inventing behavior.

---

## Human Review Rule

Human review is required before publication when content:

* makes strong claims
* interprets current events
* names specific companies or people
* uses personal context
* changes source-of-truth guidance
* defines a new domain
* defines or changes a durable concept
* affects public positioning
* changes homepage, about page, or domain page copy

Agents may draft, organize, summarize, edit, classify, and propose.

The repository owner approves publication and major conceptual changes.

---

## Build and Validation

After code or routing changes, run the appropriate local validation command if available.

Likely commands may include:

```bash
npm run build
```

If the build fails:

* report the failure clearly
* identify the likely cause
* propose a minimal fix
* avoid broad rewrites unless necessary

Do not treat a change as complete if the site no longer builds.

---

## Long-Term Goal

The long-term goal is to accumulate a body of observations, experiments, articles, concepts, checkpoints, and prototypes that document the transition into an AI-mediated world.

The site should become:

* a field journal
* a research archive
* a knowledge base
* a prototype lab
* a cognitive institution

Deep Field Works is not only about the changing relationship between humans, machines, institutions, interfaces, and memory.

It is also a working example of that relationship.
