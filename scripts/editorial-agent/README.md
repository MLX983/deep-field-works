# DFW Editorial Agent v0.4

An isolated editorial experiment. It ends at human editorial review, before the
publishing workflow begins. No existing Loop 1/2 entry point is changed.

## Run

Requires Node >=22.12, installed repository dependencies, authenticated GitHub CLI
and Codex CLI. Verified against Codex 0.154.0-alpha.6.2. The CLI must expose
`--ignore-user-config`, `--ignore-rules`, `--ephemeral`, `--output-schema`, and
the feature switches in `invocation()`. A CLI/model failure is fatal, never a
reason to fall back to another model.

```sh
node scripts/editorial-agent/agent.mjs \
  --repo-path /Users/danowens/Documents/deep-field-works \
  --workspace /Users/danowens/Documents/dfw-editorial-private \
  --issue-number 16 \
  --context-config /absolute/private/path/approved-context.json
```

Use an absolute private workspace outside the repository, publishing state and
canonical KB. Keep it for future runs; `/tmp` is not durable. No command above
publishes, changes an issue, supplies an approval, or invokes a publishing loop.
Use `CODEX_BIN` only to identify the executable, not a model override.

## Role and architecture

`role.md` is a compact editorial role, not the publishing prompt stack. First,
the controller reads the original issue directly using `gh issue view`. It saves
the full source with metadata separately and extracts the original body for the
agent. No publishing registry, Loop 1 result, or reviewed recommendation is read.

It builds a catalog from up to 100 intake issues, tracked articles/field notes/
concepts, canonical domain sections, optional approved exports/exemplars, compact
structured scratchpad items, and preserved legacy scratchpad entries. Sources with identical canonical content are one
catalog item with merged roles, aliases, and provenance records. A 16-item
lexical pool and a 12-item concept-group pool are combined and deduplicated into
at most 24 records. The conceptual pool admits at most four sections from one
underlying source so a long export cannot occupy the pool. Catalog excerpts are
capped at 700 characters. The selection call chooses up to six IDs. A second,
deterministic stage divides those sources at Markdown headings and paragraph
boundaries, ranks passages against the seed, selection reasons and editorial
questions, and supplies only the highest-value passages that fit the editorial
context budget. Source identity, heading, role, provenance and source hash remain
attached to each excerpt. The agent decides framing,
research, artifact type, and whether anything is worth developing. This small
two-call design is selective retrieval, not an autonomous context crawler.

The default selected-source text allowance is 24,000 characters. The source seed is sent
separately and does not count against it. `--editorial-context-chars N` sets an
explicit per-run override from 1,000 through 250,000 characters. Invalid values
fail before a run is created, and the controller never adds a passage that would
cross the limit. Categories have no reserved quota: no KB context or no exemplar
prose remains a valid result. Extremely long prose is split only after heading,
paragraph and then sentence boundaries have been tried.

Both calls explicitly pin their own runtime and do not inherit the desktop
selector. The default is `gpt-5.6-sol` Low for selection and `gpt-5.6-sol`
Medium for research/drafting. Per-run flags are `--selection-model`,
`--selection-reasoning`, `--editorial-model`, and `--editorial-reasoning`.
Astra remains available through an explicit model flag. No automatic routing or
retry changes the model or effort.

An optional private `--model-config PATH` may contain the same selection and
editorial policy; start from `model-policy.example.json`. CLI flags override the
file, and built-in defaults apply below both. Unknown config fields, malformed
model names, unsupported reasoning labels, CLI failures, and detected fallback
signals fail the run. `started.json` records requested values before execution.
Each phase execution record and the final `manifest.json`/`run-report.json`
record requested and actual model/effort, fallback status, and the evidence used
for the actual value. A successful explicitly pinned invocation with no fallback
signal is the available runtime evidence; the model is never asked to identify
itself.
The writer uses `-c web_search="live"`; `--research disabled` is an explicit offline option.
Desktop model selection does not control these calls. No manual app selection
is necessary. The controller records the explicit CLI arguments and whether the
invocation succeeded without a fallback signal; it does not rely on the model's
self-identification.

The CLI supports these flags in local `codex exec --help`. Public configuration
reference: https://learn.chatgpt.com/docs/config-file/config-reference

For an explicit Astra editorial escalation while retaining Sol selection:

```sh
node scripts/editorial-agent/agent.mjs \
  --repo-path /Users/danowens/Documents/deep-field-works \
  --workspace /Users/danowens/Documents/dfw-editorial-private \
  --issue-number 16 \
  --context-config /absolute/private/path/approved-context.json \
  --selection-model gpt-5.6-sol \
  --selection-reasoning low \
  --editorial-model gpt-6-astra \
  --editorial-reasoning medium
```

## Runtime boundaries

The agent has a read-only sandbox with approvals set to never. Feature switches
disable shell/unified exec, connectors, plugins, hooks, computer/browser control,
code mode, memories and subagents. This alpha CLI still advertises some auxiliary
tools despite these switches, including patch and collaboration tools. The native
read-only sandbox is the write boundary; a real canary patch was rejected.
The code-mode host remains enabled because it bridges tools including web research.
User config and exec rules are ignored; the working
directory is outside the repository and project instructions are disabled.
There is no writable KB, GitHub mutation tool, shell command, or publishing
function configured for the editorial model. Web search is its research tool.

Only the trusted Node controller writes editorial outputs, at fixed filenames.
It rejects repository/publishing-state/KB overlap, path traversal, symlinks
escaping the workspace, and overwrites. Model strings never become output paths
or commands. `gh` is called only with fixed read verbs. The CLI may maintain its
own authentication/cache metadata outside the editorial workspace; that is not
model-directed editorial output. This is a capability boundary for the normal
runtime, not isolation against a malicious operator editing the harness.

Runtime SQLite state and logs are routed into each run with `sqlite_home` and
`log_dir`. An additional outer Seatbelt sandbox was tested but prevented this CLI
from starting, so it is not part of v0. Native model execution remains read-only.

## Workspace and output

Each unique `runs/editorial-v0.4-.../` contains source JSON, seed, catalog,
selected full context, bounded `editorial-context.json`, role, prompts, schemas,
raw responses, JSONL tool events, stderr, execution records, `draft.md`,
`result.json`, `research.json`,
development.json, branches.json, design-connections.json, kb-proposals.json and
manifest.json (or failure.json), plus a human-facing run-report.json.
Only a validated result gets `awaiting-human-editorial-review`. It never gets
approval. Preserve generated text even when it warrants revision.

`editorial-context.json` is private diagnostic evidence. It records candidate
and selected-source counts, available and supplied characters, total and
budget-caused omissions, included and excluded sources/passages, the configured limit and whether an
operator override was used. The manifest carries compact totals. These records
are never reader-facing content.

The contract treats a seed as editorial input, not a one-artifact promise. It
records a private seed disposition, at most one primary development, zero or more
discovered branches, and zero or more scratchpad observations. A branch requires
its own premise and a reason combining it with the primary piece would weaken
both. A scratchpad observation requires an explicit preservation rationale.
Empty lists and an empty public draft are valid. The primary draft, when present,
must remain meaningfully connected to its contributing material.

The private seed dispositions are `develop-now`, `develop-with-other-material`,
`split-into-multiple-artifacts`, `scratchpad`, `research-needed`,
`supporting-material`, `duplicate-or-overlap`, and `decline`. They are not public
metadata and never mutate the source issue.

Legacy `scratchpad/<run-id>.json` summaries remain append-only for run continuity.
New observations are also stored as immutable structured records under
`scratchpad/items/<item-id>/rNNNN.json`. A normal run checks explicit structured
relationships for possible coalescence and records unverified signals inside the
run. It does not create a synthesis candidate until the separate synthesis pass
checks existing DFW coverage. KB proposals remain suggestions saved in the run;
no KB write connection exists.

For an independent repeat evaluation, add `--scratchpad-context disabled`.
This omits earlier scratchpad material from retrieval while still persisting new
scratchpad output. It neither reads previous drafts nor alters previous runs.
Use this option for the v0.1 issue #16 evaluation to avoid steering from v0's
discoveries. The default remains `enabled` for continuity in ordinary work.

## Optional context and exemplars

No existing DFW piece is implicitly approved as a writing exemplar. Start with
`config.example.json` (both lists empty). A private `--context-config PATH` can
list `exemplars` and `aiAdoptionContext` records. Each requires `id`, `path`,
`source`, `approvedBy`, and `approvedAt`; optional `title`. Exemplars also require
`polarity: positive | negative`. Paths are absolute paths to human-approved Markdown
exports. Record why a negative exemplar fails inside its text. Approval is a
human assertion for this editorial use, not inferred by the harness. Blank
approval fields, invalid dates, duplicate IDs and non-Markdown paths are rejected.
The controller only reads these files and records content hashes. Exemplars join
selective retrieval as whole approved samples. AI Adoption exports are divided at
second-level Markdown headings; each section carries the full-source hash,
section heading/index and section hash. Sections join the combined lexical and
conceptual candidate pools and the configured selection step, so unrelated
portions are not injected merely because the KB is available. No
synchronization or writable KB integration exists.

Approved exemplar records may carry `editorialFunction`, `failureMode`, `lesson`
and `restrictions`. This small metadata set always reaches the editorial phase;
full exemplar prose reaches it only when context selection chooses that exemplar.
This makes anti-pattern guidance available without indiscriminately loading every
sample. The role prohibits copying wording, cadence, structure or conceptual shape.

Local KB inspection found an existing `system/chatgpt-project-views.json` manifest
and `tools/build-chatgpt-project-views.py` exporter. Its AI Adoption view comprises
`baseline/current-context.md` and `topics/ai-systems-and-institutions.md`.
Those project views are not themselves approval to use private KB material in
DFW. The owner has separately approved only the generated
`AI Adoption/ai-systems-and-institutions.md` view for Editorial Agent use. Its
attachment record lives in the private operator configuration outside this
repository; the checked-in example stays empty. `current-context.md` and all
other private KB material remain excluded. This uses the existing export, so no
second exporter or synchronization process is needed. The KB exporter is never
invoked by this harness, and no KB source is modified.

## Private Editorial Scratchpad

The scratchpad is a provisional editorial memory layer inside the existing
owner-private Editorial Agent workspace. It is neither DFW intake nor public DFW
content, and it is not a second canonical AI Adoption Knowledge Base.

Each `editorial-scratchpad-item.v1` record has a stable ID, append-only revision,
timestamps, concise observation, optional importance note, origin and provenance,
relationships to seeds/runs/artifacts/items, source references, retrieval labels,
editorial signals, lifecycle status, and deterministic source/content/record
fingerprints. Statuses are `unformed`, `accumulating`, `candidate`, `promoted`,
`absorbed`, and `discarded`. Earlier revisions remain owner-read-only.

Normal seed development retrieves compact scratchpad records through the same
hybrid shortlist and bounded passage stage as other sources. Discarded and
absorbed records are not offered as normal context. No scratchpad category is
mandatory, and the editorial selector may choose none. Legacy run-level
scratchpads are parsed into concise observations/branches without injecting the
whole JSON file.

Add a human observation explicitly:

```sh
npm run editorial:scratchpad:add -- \
  --workspace /Users/danowens/Documents/dfw-editorial-private \
  --title "Observation title" \
  --body-file /absolute/private/note.md \
  --origin human-added-note \
  --themes agent-governance,interfaces \
  --concepts authority,visibility
```

Optional flags accept an importance note, provenance/reference JSON files,
related seeds/runs/artifacts/items, entities, and initial status. The input body
file is operator-provided; the command does not treat it as an intake issue.

Review scratchpad metadata without changing it:

```sh
npm run editorial:scratchpad:review -- \
  --workspace /Users/danowens/Documents/dfw-editorial-private \
  --status accumulating \
  --theme agent-governance \
  --include-candidates true
```

Filters also support origin, related seed, and recent-day window. The report is
private JSON and omits full internal source material by default.

## Coalescence and autonomous synthesis

`EditorialSynthesisCandidate` is private, append-only metadata for a possible
coalesced idea. It records its premise, participating items/seeds/runs/artifacts,
source types, why the material belongs together, what made it salient, maturity,
questions, counterpressure, research need, existing-work check, artifact type,
criteria, status, and fingerprints. Statuses are `emerging`, `research-needed`,
`draft-worthy`, `drafted`, `human-reviewed`, `dismissed`, and `absorbed`.

The synthesis command deliberately separates detection from development:

```sh
npm run editorial:synthesize -- \
  --workspace /Users/danowens/Documents/dfw-editorial-private \
  --repo-path /Users/danowens/Documents/deep-field-works \
  --context-config /absolute/private/path/approved-context.json
```

Stage 1 uses the normal Sol/Low selection policy. It sees at most 200 compact
active scratchpad index records and a hybrid shortlist of related intake, DFW,
approved exemplar, approved AI Adoption, and prior editorial-memory records. It
does not draft. A candidate can proceed only when it has at least two
observations, a distinct question/tension, support from multiple directions, a
stronger combined meaning, a concrete case, counterpressure, and no substantial
existing DFW duplicate. Shared keywords or frequent themes are insufficient.

Stage 2 uses the normal Sol/Medium editorial policy for at most one strong
candidate per pass. It retrieves only participating observations and explicitly
selected sources, applies the existing 24,000-character context budget, performs
focused research when enabled, writes a normal DFW draft, and stops at
`awaiting-human-editorial-review` with approval false. A pass that produces
`completed-no-draft` is successful. Astra remains an explicit override only;
there is no routing, fallback, or escalation.

Synthesis runs live under `synthesis/runs/`; candidate revisions live under
`synthesis/candidates/`. Private diagnostics record source types searched,
candidate membership, considered and selected records, duplicate checks,
research, budget use, and drafting decisions. Public drafts cannot mention the
scratchpad, clustering, retrieval, or editorial system.

The command is intentionally unscheduled. It can be called manually, after a
meaningful research run, or later by a weekly/biweekly scheduler after its value
has been observed. This revision creates no recurring task.

## Human editorial approval package

Human approval is a separate explicit command. The Editorial Agent cannot invoke
it and cannot approve itself. The command consumes a completed run at
`awaiting-human-editorial-review` and writes an immutable
`EditorialApprovalPackage` below the same private workspace:

```sh
npm run editorial:approve -- \
  --workspace /Users/danowens/Documents/dfw-editorial-private \
  --source-run editorial-v0.4-... \
  --artifact-id visible-recovery \
  --artifact-type note \
  --approved-by "Reviewer identity" \
  --approval-marker editorial-approved \
  --approve-current-draft
```

`--approve-current-draft` explicitly confirms the preserved model title and
draft. For edited approval, omit it and supply both `--title` and `--body-file`.
Optional `--references-file` and `--relationships-file` point to JSON arrays
containing only references and DFW relationships the human selected. The command
never substitutes model text for a missing edited field.

Packages use `editorial-approval-package.v1` and live at
`approvals/<editorial-artifact-id>/`. One source run or intake issue can produce
zero, one or many artifact IDs. Reapproving one artifact creates the next
revision; package files are created owner-read-only and never overwritten by the
command. Domain and theme are
intentionally absent until future publishing classification.

The content SHA-256 covers deterministic JSON containing exactly the document
type, title, body, sorted approved external-reference set and sorted approved
DFW-connection set. It excludes paths, timestamps, reviewer metadata and
revision, so identical publication content has the same content fingerprint.
The package SHA-256 additionally binds schema version, package/artifact IDs,
revision, source provenance, approval metadata and the content fingerprint.

Private KB excerpts, scratchpad entries, research notes/pages, unused context,
prompts, reasoning, exemplar material, unapproved branches/connections and token
or selection diagnostics are not copied into a package. They remain available
through the preserved source run. Text a human explicitly places in the approved
reader-facing body or approved lists is publication input.

## Cost audit and future publishing handoff

The measured issue #39 prompt/token analysis is in `issue-39-token-audit.md`.
The human approval to future publishing-operator boundary is defined in
`handoff-contract.md`. The package mechanism does not enable publishing, invoke
Loop 1/2, or change the publishing processor.

## Limits and verification

Concept groups are a small deterministic retrieval aid, not embeddings or an
ontology. They can miss relevant material and can surface false positives. The
selection model remains responsible for choosing zero to six useful sources,
and selecting no KB context is valid.
Selection is a single pass; research is limited to tools exposed by Codex web
search, with a 20-minute process timeout and preserved failure logs. A source
citation is an agent claim until human verification. Research events and notes
are saved; do not confuse successful JSON validation with editorial quality.
No notification, publishing integration, polling or scheduled processing exists.

```sh
npm run editorial:test
npm run build
```

An opt-in, real-model boundary test attempts one patch to a disposable canary
outside the agent working directory and asserts rejection plus unchanged bytes:

```sh
node scripts/editorial-agent/boundary-smoke.mjs
```

Set `EDITORIAL_BOUNDARY_MODEL` and `EDITORIAL_BOUNDARY_REASONING` to test a
specific explicit combination. The defaults are Sol/Low.

This test retains its private test workspace and logs for inspection. The normal
fixture suite makes no network calls and never runs the publishing processor.
