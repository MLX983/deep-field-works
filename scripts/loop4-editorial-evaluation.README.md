# Loop 4 — Editorial Evaluation

Loop 4 reviews a Loop 3 draft against its approved Loop 2 packet, Loop 3 drafting report, DFW source-of-truth guidance, and artifact-type requirements. It emits an evaluation JSON under `/tmp`.

It does not rewrite drafts, publish, access or mutate GitHub, or implement Loop 5.

## Verdicts

- `PASS_TO_HUMAN`: safe and useful enough for human editorial review; not publication approval.
- `REVISE`: viable and adequately grounded, but up to five bounded changes are required.
- `HOLD`: upstream readiness, evidence, factual grounding, coherence, or artifact fit prevents revision alone.

Deterministic checks are authoritative for input consistency, metadata, structure, length measurement, and unsupported sentences, named entities, dates, statistics, and quotations. Artifact-length targets are advisory: an out-of-range draft records a risk, while `REVISE` requires a corresponding substantive defect such as an underdeveloped section, missing editorial function, weak grounding, unclear tension, weak ending, repetition, or unnecessary expansion. Loop 4 does not request padding merely to cross a numeric threshold. Reproducible editorial heuristics assess concrete examples, generic AI language, repetition, reader question, tension, description, ending, and preserved uncertainty.

## Usage

```bash
npm run loop:evaluate -- \
  --packet /tmp/loop2-18-packet.json \
  --draft /tmp/loop3-18-draft.md \
  --draft-report /tmp/loop3-18-draft-report.json \
  --revision-report /tmp/loop5-18-revision-report.json \
  --out-dir /tmp/dfw-loop4/0018
```

The output is `loop4-<issue>-evaluation.json` and conforms to `docs/contracts/loop4-editorial-evaluation.v1.schema.json`.

## Content integrity

Loop 4 hashes the exact packet, draft, and Loop 3 report bytes. It refuses before evaluation when the packet or draft no longer matches the fingerprints in the Loop 3 report. Legacy pre-hash reports are rejected explicitly; there is no compatibility flag.

The evaluation records the three source hashes plus a length-delimited combined-input hash. Loop 4 also writes `<evaluation>.sha256`, a lowercase SHA-256 fingerprint of the exact evaluation JSON bytes, for Loop 5 to verify.

When `--revision-report` is supplied, Loop 4 evaluates the exact revised draft fingerprinted by a `REVISED` Loop 5 report while also verifying that report's reference to the original Loop 3 report. This supports one bounded post-revision evaluation without weakening the chain.

## Threat model

These are **content-integrity fingerprints**, not cryptographic immutability or tamper-proof provenance.

The hashes detect accidental edits, stale inputs, substituted files, and ordinary same-path mutation.

The Loop 4 sidecar detects changes to the evaluation JSON when the sidecar has not also been regenerated.

The mechanism does not defend against an actor deliberately modifying an artifact and recomputing all associated hashes or sidecars.

Stronger tamper resistance would require anchoring hashes in trusted external state such as a Git commit, signed manifest, or append-only ledger.
