# Loop 5 — Bounded Revision

Loop 5 accepts a Loop 3 draft, its approved Loop 2 packet and passing Loop 3 report, and a Loop 4 `REVISE` evaluation. It classifies each instruction, applies only deterministic edits grounded in existing material, and writes a revised draft and revision report under `/tmp` when appropriate.

It does not research, invent examples, reframe or reclassify pieces, publish, access GitHub, or rerun Loop 4.

## Instruction classes

- `AUTO_APPLY`: bounded cleanup or packet-grounded revision.
- `HUMAN_INPUT_REQUIRED`: missing example, experience, choice, verification, or source.
- `UNSAFE_OR_OUT_OF_SCOPE`: research, invention, publication, artifact/domain change, or unsupported facts.

## Statuses

- `REVISED`
- `PARTIALLY_REVISED_WAITING_FOR_HUMAN`
- `WAITING_FOR_HUMAN`
- `BLOCKED`

## Usage

```bash
npm run loop:revise -- \
  --packet /tmp/loop2-packet.json \
  --draft /tmp/loop3-draft.md \
  --draft-report /tmp/loop3-draft-report.json \
  --evaluation /tmp/loop4-evaluation.json \
  --human-input /tmp/loop5-human-input.json \
  --out-dir /tmp/dfw-loop5/run
```

The runner preserves frontmatter identity, domain, type, provenance, draft state, and `canonical: false`.

The protected artifact types include `note`, `field-report`, and
`prototype-note`. For prototype notes, bounded cleanup may operate on existing
packet-grounded sections, but it may not convert a proposed interaction into a
claim of implementation or testing, invent interface behavior, or reclassify
the artifact as a concept or essay.

## Content integrity

Loop 5 verifies the exact packet, draft, Loop 3 report, and Loop 4 evaluation bytes before classification or revision. It recomputes Loop 4's combined-input hash and verifies the evaluation against the adjacent `<evaluation>.sha256` sidecar written by Loop 4. Legacy pre-hash reports and evaluations are rejected explicitly; there is no compatibility flag.

Revision reports record all four source hashes and the exact revised-draft hash whenever a revised draft exists.

## Human editorial input

`--human-input` accepts `loop5-human-input.v1` only when its issue, requested instruction, and usage scope exactly match an existing `HUMAN_INPUT_REQUIRED` instruction. The initial supported input is a human-editor supplied editorial example. It is not intake material and cannot authorize research, reframing, reclassification, publication, or unrelated revisions.

When used, the revision report records the exact input path and SHA-256, input type, supplier, satisfied instruction, and whether the content was used verbatim, lightly edited, or only as factual grounding. The human-input hash is therefore preserved in the revision chain.

## Threat model

These are **content-integrity fingerprints**, not cryptographic immutability or tamper-proof provenance.

The hashes detect accidental edits, stale inputs, substituted files, and ordinary same-path mutation.

The Loop 4 sidecar detects changes to the evaluation JSON when the sidecar has not also been regenerated.

The mechanism does not defend against an actor deliberately modifying an artifact and recomputing all associated hashes or sidecars.

Stronger tamper resistance would require anchoring hashes in trusted external state such as a Git commit, signed manifest, or append-only ledger.

## Future enhancement: Evaluate whether human-supplied revisions fit the surrounding argument

### Problem

Loop 5 can correctly apply a human-supplied change, and Loop 4 can verify that the requested instruction was satisfied, while still missing that the inserted material is editorially incoherent with the rest of the piece.

### Example

In issue #18, the prototyping example was valid, sourceable, and relevant to “skills half-life,” but it did not mesh naturally with the note’s larger argument. It passed structural and grounding checks while weakening editorial coherence.

### Risk

A reviewer may supply material intended for another piece, respond late or imprecisely, or provide content that is locally relevant but globally misplaced. The system should not assume that human-supplied material is editorially appropriate merely because it satisfies the requested slot.

### Future enhancement

Add a post-integration coherence check that evaluates:

- whether the inserted material advances the central argument
- whether it connects naturally to the surrounding section
- whether it introduces a new topic or frame without support
- whether it duplicates or contradicts another part of the piece
- whether the human input appears to belong to a different artifact
- whether the revision improves the piece as a whole rather than only satisfying the instruction

### Expected behavior

Human input remains authoritative as source material, but not automatically authoritative as placement or editorial fit.

Loop 4 may return `REVISE` or `HOLD_FOR_HUMAN_CONFIRMATION` when supplied material is grounded but poorly integrated.

The system should never silently discard or rewrite human input to make it fit.

The review should surface the mismatch and ask whether to remove, relocate, or replace the material.

### Scope

Record only as a future enhancement. Do not implement it now.
