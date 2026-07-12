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
  --out-dir /tmp/dfw-loop5/run
```

The runner preserves frontmatter identity, domain, type, provenance, draft state, and `canonical: false`.

## Content integrity

Loop 5 verifies the exact packet, draft, Loop 3 report, and Loop 4 evaluation bytes before classification or revision. It recomputes Loop 4's combined-input hash and verifies the evaluation against the adjacent `<evaluation>.sha256` sidecar written by Loop 4. Legacy pre-hash reports and evaluations are rejected explicitly; there is no compatibility flag.

Revision reports record all four source hashes and the exact revised-draft hash whenever a revised draft exists.

## Threat model

These are **content-integrity fingerprints**, not cryptographic immutability or tamper-proof provenance.

The hashes detect accidental edits, stale inputs, substituted files, and ordinary same-path mutation.

The Loop 4 sidecar detects changes to the evaluation JSON when the sidecar has not also been regenerated.

The mechanism does not defend against an actor deliberately modifying an artifact and recomputing all associated hashes or sidecars.

Stronger tamper resistance would require anchoring hashes in trusted external state such as a Git commit, signed manifest, or append-only ledger.
