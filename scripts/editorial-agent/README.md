# DFW Editorial Agent v0.1

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
  --issue-number 16
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
concepts, canonical domain sections, optional approved exports/exemplars, and up
to 20 prior scratchpad files.
A simple term overlap shortlist limits the catalog to 24 title/excerpt records.
An Astra selection call chooses up to six IDs. The controller supplies their
full text to a fresh Astra editorial invocation. The agent decides framing,
research, artifact type, and whether anything is worth developing. This small
two-call design is selective retrieval, not an autonomous context crawler.

Both calls explicitly use `--model gpt-6-astra`. Selection uses
`-c model_reasoning_effort="low"`; research/drafting uses
`-c model_reasoning_effort="medium"`. High is available only with an explicit
`--selection-reasoning high` and/or `--editorial-reasoning high` operator override.
Other reasoning levels are rejected; no retry changes the model or effort.
The exact model, effort and arguments are retained in each execution record.
The writer
uses `-c web_search="live"`; `--research disabled` is an explicit offline option.
Desktop model selection does not control these calls. No manual app selection
is necessary. Evidence of model availability comes from the installed model
catalog and actual invocation, not the model's self-identification.

The CLI supports these flags in local `codex exec --help`. Public configuration
reference: https://learn.chatgpt.com/docs/config-file/config-reference

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

Each unique `runs/editorial-v0.1-.../` contains source JSON, seed, catalog,
selected full context, role, prompts, schemas, raw responses, JSONL tool events,
stderr, execution records, draft.md, result.json, research.json,
development.json, branches.json, design-connections.json, kb-proposals.json and
manifest.json (or failure.json).
Only a validated result gets `awaiting-human-editorial-review`. It never gets
approval. Preserve generated text even when it warrants revision.

The contract separates the source premise, editorial assessment (judgment,
rationale, primary development), and main draft. A worthwhile premise should
remain recognizable in the draft; a substantially different discovery belongs
in a branch. Challenging or abandoning a weak premise remains allowed.
It contains recommendation (`develop | preserve | defer`), editorial
judgment, proposed type/title/observation/scope, draft, research basis, candidate
framings/revision notes, unresolved edge, connections, scratchpad additions and
noncanonical KB proposals. Optional discovered branches record idea, emergence,
relationship to the seed and next action; optional design/prototype connections
record a design question, relationship and next action. Empty lists are valid.
These private outputs do not force a design project or extra prose section.
No publication frontmatter is required.

Persistent `scratchpad/<run-id>.json` records loose ideas and source/run provenance
separately, including discovered branches and design/prototype connections.
No scratchpad entry creates an issue or public content automatically.
KB proposals are only suggestions saved in the run; no KB write connection exists.

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
section heading/index and section hash. Sections join the same lexical shortlist
and Astra selection step, so unrelated portions are not injected. No
synchronization or writable KB integration exists.

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

## Limits and verification

Retrieval is a small lexical shortlist and can miss conceptually relevant work.
Selection is a single pass; research is limited to tools exposed by Codex web
search, with a 20-minute process timeout and preserved failure logs. A source
citation is an agent claim until human verification. Research events and notes
are saved; do not confuse successful JSON validation with editorial quality.
No notification, publishing integration, polling or scheduled processing exists.

```sh
node --test scripts/editorial-agent/agent.test.mjs
npm run build
```

An opt-in, real-Astra boundary test attempts one patch to a disposable canary
outside the agent working directory and asserts rejection plus unchanged bytes:

```sh
node scripts/editorial-agent/boundary-smoke.mjs
```

This test retains its private test workspace and logs for inspection. The normal
fixture suite makes no network calls and never runs the publishing processor.
