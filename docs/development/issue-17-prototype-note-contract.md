# Issue #17 prototype-note contract

## Classification and readiness

Issue #17, “AI consumer control surface,” is a `prototype-note`, not a
`concept`. Its subject is a specific proposed screen, its control groups, and
its permission states. The source is sufficient to draft that proposal without
external research, provided the draft never implies that the interface has
been built or tested.

- Primary domain: Interfaces for Judgment
- Theme: supervision-interfaces
- Draft readiness: ready
- Source sufficiency: sufficient for a proposed interaction; insufficient for
  claims about observed prototype behavior
- Human-review boundary: the ordinary-language framing, grouped controls, and
  visible compliance need design review; implementation efficacy remains open

## First-class artifact contract

Target length follows the canonical prototype-note range: 300–800 words.

Required functions:

1. `The design problem` — names what must be controlled or clarified.
2. `The interaction choice` — states the proposed screen-level decision.
3. `How the control surface is grouped` — preserves the interface groups and
   their states as structured content.
4. `Why it matters` — connects the small design choice to the larger pattern.
5. `Current state` — says whether this is proposed, built, tested, or observed.
6. `Remaining questions` — preserves test and design uncertainty.

The Loop 2 packet must carry a `prototypeNote` object with a design problem,
interaction choice, one or more interaction groups, one or more design
principles, and an explicit current-state boundary. Loop 3 may arrange only
that packet-grounded material. Loop 4 evaluates the artifact against these
functions and the 300–800 word range. Loop 5 may make bounded structural or
prose cleanup changes, but may not turn a proposed interaction into evidence
of implementation or change the artifact type.

Optional functions include a design-principle callout, related concepts, and
one pull quote selected from existing prose. Neither a dek nor a pull quote is
required.
