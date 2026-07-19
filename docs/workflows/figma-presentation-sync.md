# Figma Presentation Sync

## Purpose

This document defines how Deep Field Works presentation components are transferred from Figma into the repository.

Figma is the visual authoring source.

The repository stores the last reviewed and approved specification so that Codex and other agents can work when:

- Figma is closed
- the Figma MCP server is unavailable
- the relevant frame is not selected
- the source file has changed
- a future agent does not have Figma access

Figma MCP is therefore a synchronization and verification tool, not a runtime dependency.

---

# Sources of Truth

The presentation system is divided across several durable sources.

| Source | Responsibility |
|---|---|
| Figma | Visual design and component annotations |
| `presentation-system.md` | Editorial meaning and permitted use |
| `componentRegistry.ts` | Stable identifiers and machine-readable constraints |
| Astro components and styles | Web implementation |
| Reference captures | Human-readable visual evidence |

No single source replaces the others.

When conflicts occur:

1. Editorial semantics in `presentation-system.md` govern component meaning.
2. Approved Figma components govern visual intent.
3. The registry records the last approved machine-readable state.
4. Astro should implement the approved semantic and visual specifications.
5. Unresolved conflicts require human review.

---

# Stable and Unstable Information

## Stable information

The following should remain stable across visual redesigns:

- semantic component ID
- component name
- purpose
- content rules
- placement rules
- production availability
- source-text behavior
- review constraints

These belong primarily in:

- `presentation-system.md`
- `componentRegistry.ts`

## Potentially unstable information

The following may change when Figma is reorganized or redesigned:

- Figma file key
- node ID
- component hierarchy
- variant properties
- typography
- spacing
- colors
- borders
- corner radii
- responsive behavior
- implementation mapping

These must be captured from the actual source rather than inferred.

---

# Synchronization Triggers

A Figma synchronization should occur when:

- a new presentation component is added
- an existing component is visually changed
- component annotations are revised
- a component is renamed
- a component is moved or recreated
- an Astro implementation appears inconsistent with Figma
- a Figma node ID is no longer valid
- the presentation specification is being audited
- a human editor explicitly requests a refresh

Routine article drafting does not require a Figma synchronization.

---

# Required Access

A synchronization session requires:

- the Figma desktop application or supported Figma environment
- the local Figma MCP server
- access to the Deep Field Works Figma file
- a node-specific Figma URL or an explicitly selected component
- access to the Deep Field Works repository

A node-specific URL is preferred over relying on the current selection.

The URL should point to the exact component, frame, or documented example being inspected.

---

# Synchronization Scope

Each synchronization task must define its scope before inspection.

Examples:

- one component
- several related components
- one page section
- the full presentation component frame
- annotations only
- visual properties only
- a comparison between Figma and Astro

Do not silently expand the scope.

When multiple components are being synchronized, process and report them separately.

---

# Information to Capture

For each component, capture the following when available.

## Identification

- stable semantic ID
- exact Figma component or frame name
- Figma file key
- Figma node ID
- capture date
- source URL
- inspection scope

## Editorial annotation

- purpose
- intended content
- placement guidance
- frequency guidance
- usage notes
- production or review-only status

Editorial annotations should be transferred into the repository without changing their meaning.

Minor editing for clarity is permitted, but substantive reinterpretation requires human review.

## Structure

- component hierarchy
- child layers
- text layers
- optional elements
- nested components
- auto-layout direction
- alignment
- resizing behavior

## Visual properties

- spacing
- padding
- gaps
- widths
- maximum widths
- typography
- text styles
- fills
- borders
- corner radii
- shadows
- opacity
- icons
- decorative elements

## Tokens and variables

Capture named Figma variables and styles whenever they exist.

Prefer:

- token or variable name
- semantic role
- resolved value, when useful

Do not replace a named variable with only its resolved pixel or color value.

For example:

```text
Spacing/100 — 8px
Spacing/200 — 16px
Surface/Secondary — #f0efed
Text/Body — #3c3c3c
```

---

# Last Verified Figma Source

The following source was inspected through Figma MCP on 2026-07-18.

| Item | Verified value |
|---|---|
| Figma file key | `9BPDDO9m33ffYpkMNWSFYW` |
| Design Tokens page | `0:1` |
| Interface Components section | `2054:113` |
| Interface examples section | `2054:82` |

## Canonical component definitions

The Interface Components section defines the canonical visual implementation
of article presentation components.

| Semantic entry | Figma component | Node ID |
|---|---|---|
| Intro | `DFW / Article / Compositions / Intro` | `8043:6796` |
| Body Content | `DFW / Article / Body Content` | `8043:6800` |
| Pull Quote | `DFW / Article / Pull Quote` | `8043:6804` |
| Subheading Block | `DFW / Article / Compositions / Subheading Block` | `8043:6817` |
| Masthead | `DFW / Article / Masthead` | `8043:6812` |
| Global Navigation | `DFW / Article / Global Navigation` | `8043:6816` |
| Section Heading | `DFW / Article / Section Heading` | `8045:30` |
| Main Link | `DFW / Article / Main Link` | `8046:34` |
| Subheading | `DFW / Article / Subheading` | `8046:40` |
| Operational Callout | `DFW / Article / Operational Callout` | `8046:412` |
| Footer Utility Link | `DFW / Article / Footer Utility Link` | `8085:269` |

Entries without a standalone Figma component remain unmapped in the component
registry rather than receiving an inferred node ID.

## Canonical article composition examples

The Interface section contains three actual Deep Field Works articles from the
initial site implementation.

| Article example | Node ID |
|---|---|
| `04a Article - Process is Proof` | `8030:950` |
| `04b Article - Third Intelligence` | `8034:1035` |
| `04c Article - AI shopping` | `8039:1082` |

These examples demonstrate accepted article-specific composition decisions.
They do not automatically define universal component requirements.

## Repository semantic constraints

The three presentation layers remain distinct:

1. Interface Components defines canonical visual component implementation.
2. Interface article examples demonstrate how those components were assembled
   in three accepted initial compositions.
3. `presentation-system.md` and `componentRegistry.ts` define current semantic
   meaning, permitted use, and machine-readable constraints.

A difference between an article example and a current repository constraint
may represent an older accepted rule, a newer constraint, article-specific
composition, or incomplete documentation. It requires human review rather than
automatic synchronization.

## Verified token mappings

| Figma token or style | Verified repository value or role |
|---|---|
| `Surface/Primary` | `#faf9f7` |
| `Surface/Secondary` | `#f0efed` |
| `Text/Header` | `#685149` |
| `Text/Body` | `#3c3c3c` |
| `Text/Link` | `#80341a` |
| `Spacing/50` | 4px |
| `Spacing/100` | 8px |
| `Spacing/200` | 16px |
| `Spacing/300` | 24px |
| Newsreader | Article titles and headings |
| Inter | Body, navigation, and utility text |

Only verified mappings are recorded here. Unused Figma tokens do not need to
be added to the web implementation solely because they exist in the design
file.

---

# Synchronization Review

Before applying repository changes:

1. Compare the inspected Figma component with its semantic definition.
2. Compare its verified variables and styles with repository tokens.
3. Identify differences without assuming either side should change.
4. Separate synchronization metadata from semantic or runtime changes.
5. Request human review for unresolved conflicts.

Repository synchronization must not silently:

- change component meaning
- change placement or frequency rules
- alter article content
- convert an example-specific composition into a universal rule
- invent missing Figma metadata
- edit Figma while performing a repository-only pass
