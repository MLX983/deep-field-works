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

The component and token inventory was refreshed from the Figma MCP parity audit on 2026-09-25. The initial article examples below retain their 2026-07-18 verification record.

| Item | Verified value |
|---|---|
| Figma file key | `9BPDDO9m33ffYpkMNWSFYW` |
| Design Tokens page | `0:1` |
| Interface Components section | `2054:113` |
| Colors / Fonts / Spacing | `1:2` / `1:3` / `1:5` |
| Index / Domain / Chronology | `8019:688` / `8076:211` / `8019:736` |
| Representative article / dark article | `8126:278` / `8148:388` |

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
| Operational Callout (component set) | `DFW / Article / Operational Callout` | `8126:240` |
| Dek | `DFW / Article / Dek` | `8126:341` |
| Sources Link (inventory only) | `DFW / Article / Sources Link` | `8127:380` |
| Related Links (inventory only) | `DFW / Article / Related Links` | `8126:250` |
| Footer Utility Link | `DFW / Article / Footer Utility Link` | `8085:269` |

The Operational Callout set contains `Title=False` (`8046:412`) and `Title=True` (`8126:241`). The registry points to the set; this does not implement titled-callout semantics.

The Dek maps to the existing draft-review renderer. Its presence in the registry does not add a production renderer or new published content.

Sources Link and Related Links are verified visual inventory only. Sources behavior and the relationship between Related Links and repository relationship data remain deferred. Their registry semantics are not inferred from names alone. Entries without an unambiguous semantic mapping remain unmapped.

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
| `Text/Link` | `#80341a`; back-navigation arrow and label |
| Dek light color | `Text/Header`, `#685149` |
| Non-link metadata light color | `Text/Body`, `#3c3c3c` |
| `Dark Surface/Primary` | `#3c3c3c` |
| `Dark Surface/Secondary` | `#4d4949`; Operational Callout |
| `Dark Text/Body` | `#ccc9c2`; body and non-link metadata |
| `Dark Text/Header` | `#faf9f7`; headings, deks, pull quotes |
| `Dark Text/Link` | `#f2e2c2`; links including back arrows |
| `Spacing/50` | 4px |
| `Spacing/100` | 8px |
| `Spacing/200` | 16px |
| `Spacing/300` | 24px |
| Newsreader | Article titles and headings |
| Inter | Body, navigation, and utility text; 300 loaded for existing Light roles |
| Mobile page gutters | `Spacing/200`, 16px; 358px rail at 390px |
| Chronology month / entry indentation | `Spacing/100`, 8px at each level |
| Chronology month-to-links gap | `Spacing/50`, 4px |
| Field-note / checkpoint metadata | 11px, after title |

`--color-text-muted` is a compatibility alias to the body token, not a separate Figma color. `--color-text-dek` aliases the header token in both modes. OS preference, browser color-scheme, screen-only dark overrides, and keyboard focus remain documented web behavior.

Serif line-height translation, heading-role mapping, decorative rules, pull-quote spacing, prose lists, desktop rail width, masthead guidance, and review-only experiments remain outside this parity correction.

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
