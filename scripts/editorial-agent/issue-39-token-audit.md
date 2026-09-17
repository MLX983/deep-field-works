# Issue #39 token and context audit

This audit describes the preserved run
`editorial-v0.1-2026-09-16T23-47-24-522Z-480f98a9`. It does not modify or
rerun that experiment. Character-to-token figures below use four characters per
token and are estimates. CLI totals are the measured values in the saved JSONL
events.

## Measured totals

| Phase | Input | Cached input | Output | Reasoning output |
| --- | ---: | ---: | ---: | ---: |
| Selection | 21,760 | 0 | 407 | 0 |
| Editorial and research | 116,626 | 78,336 | 2,407 | 14 |
| Total | 138,386 | 78,336 | 2,814 | 14 |

The selection prompt was 55,926 characters, about 14,000 tokens. The editorial
prompt was 43,703 characters, about 10,900 tokens. The remaining measured input
comes from Codex runtime instructions and tool schemas, plus accumulated context
across the editorial turn and its three web interactions. The event stream does
not expose a per-request token ledger or the complete text injected by web
search, so those portions cannot be divided exactly after the fact.

## Selection phase

| Contributor | Characters | Estimated tokens |
| --- | ---: | ---: |
| Role instructions | 5,679 | 1,420 |
| Selection scaffold | 183 | 46 |
| Source seed | 6,545 | 1,636 |
| Candidate catalog | 43,502 | 10,876 |
| Output schema, passed separately | 358 | 90 |

The catalog dominated the controllable selection input. It contained 24 records
and 33,600 characters of excerpts alone. Twenty records were intake issues, two
were ordinary DFW records, and two were approved exemplars. The two DFW records
also appeared as exemplar sources, so two underlying documents occupied four
catalog positions and repeated up to 2,800 excerpt characters plus metadata.

## Editorial phase

| Contributor | Characters | Estimated tokens |
| --- | ---: | ---: |
| Role instructions | 5,679 | 1,420 |
| Editorial scaffold | 223 | 56 |
| Source seed and source binding | 6,616 | 1,654 |
| Three positive and three negative exemplar functions | 2,617 | 654 |
| Five selected full context records | 27,870 | 6,968 |
| Editorial questions | 595 | 149 |
| Output schema, passed separately | 2,538 | 635 |

The five selected records contained 23,922 characters of source prose: four
intake issues and the full text of *The Archive Becomes Part of the Work*. No AI
Adoption section was selected. The other five exemplars contributed only their
compact function or anti-pattern metadata, not full prose. This is the intended
lightweight behavior.

The editorial phase made three web interactions. Saved tool-event payloads are
compact and do not contain enough information to assign the 116,626 input tokens
to individual pages. The 78,336 cached tokens indicate that a large fixed prefix
was reused across research turns. This makes accumulated runtime/tool context a
larger total contributor than the one-time editorial prompt, although it is less
directly controllable by this harness.

## Changes justified by the audit

The v0.2 controller makes three targeted reductions:

1. It deduplicates canonical sources before candidate generation while retaining
   aliases, roles, and provenance records.
2. It reduces catalog excerpts from 1,400 to 700 characters. At 24 full excerpts,
   this removes up to 16,800 characters, roughly 4,200 prompt tokens.
3. It sends only editorially useful identity, role, body, and selection-reason
   fields to the writer. Complete provenance remains in `catalog.json` and
   `context.json`.

The role, seed, six exemplar functions, research policy, and output contracts
remain intact. Web research was not artificially capped because the preserved
run does not provide enough evidence to choose a lower safe limit. Future runs
can compare their saved prompt sizes and usage totals against this baseline.
