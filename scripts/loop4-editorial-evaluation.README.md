# Loop 4 — Editorial Evaluation

Loop 4 reviews a Loop 3 draft against its approved Loop 2 packet, Loop 3 drafting report, DFW source-of-truth guidance, and artifact-type requirements. It emits an evaluation JSON under `/tmp`.

It does not rewrite drafts, publish, access or mutate GitHub, or implement Loop 5.

## Verdicts

- `PASS_TO_HUMAN`: safe and useful enough for human editorial review; not publication approval.
- `REVISE`: viable and adequately grounded, but up to five bounded changes are required.
- `HOLD`: upstream readiness, evidence, factual grounding, coherence, or artifact fit prevents revision alone.

Deterministic checks are authoritative for input consistency, metadata, structure, target length, and unsupported sentences, named entities, dates, statistics, and quotations. Reproducible editorial heuristics assess concrete examples, generic AI language, repetition, reader question, tension, description, ending, and preserved uncertainty.

## Usage

```bash
npm run loop:evaluate -- \
  --packet /tmp/loop2-18-packet.json \
  --draft /tmp/loop3-18-draft.md \
  --draft-report /tmp/loop3-18-draft-report.json \
  --out-dir /tmp/dfw-loop4/0018
```

The output is `loop4-<issue>-evaluation.json` and conforms to `docs/contracts/loop4-editorial-evaluation.v1.schema.json`.
