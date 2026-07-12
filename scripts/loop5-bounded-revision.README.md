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

The runner preserves frontmatter identity, domain, type, provenance, draft state, and `canonical: false`. A Loop 4 path reference is the available draft-version identity check; Loop 4 does not yet provide a content hash, so modification at the same path cannot be detected cryptographically.
