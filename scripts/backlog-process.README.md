# Bounded backlog processor

> **Current operator reference:** Use
> `docs/workflows/bounded-publishing-operator-runbook.md` for the bounded
> Loop 1 → human review → explicit approval → Loop 2 → stop workflow. The
> runbook requires `--stop-after-loop2` and uses the separately invoked Loop 1
> review notifier. This implementation reference also documents broader
> processor paths; their presence is not operator authorization.

The backlog processor is a manually invoked operational wrapper around the
existing Deep Field Works publishing pipeline. It discovers open issues,
selects at most an explicit limit, isolates work by issue and run, records
durable state, and stops at the existing editorial and governance boundaries.

It does not schedule itself, poll, react to webhooks, mutate GitHub, approve
Loop 1, publish content, or alter taxonomy or source-of-truth documents.

## Modes

Every invocation must choose exactly one mode.

Dry run discovers and ranks candidates, explains skips, and writes its report
only to a newly created temporary directory:

```bash
npm run backlog:process -- \
  --dry-run \
  --repo MLX983/dfw-intake \
  --repo-path /absolute/path/to/deep-field-works \
  --limit 3 \
  --state-dir /tmp/dfw-backlog-state \
  --work-root /tmp/dfw-backlog-work
```

The supplied state and work paths are deliberately not created or modified in
dry-run mode. When the supplied state path already contains a registry or
claims, the dry-run reads them so its selection reflects current capacity,
while all reports and locks remain temporary. The command prints the temporary
manifest and summary paths.

Execute mode claims and processes no more than the explicit limit:

```bash
npm run backlog:process -- \
  --execute \
  --repo MLX983/dfw-intake \
  --repo-path /absolute/path/to/deep-field-works \
  --limit 1 \
  --state-dir /tmp/dfw-backlog-state \
  --work-root /tmp/dfw-backlog-work
```

When an operator has approved one specific backlog item, `--issue-number N`
restricts selection and execution to that open issue while direct acquisition
still records the complete source response. This prevents an earlier eligible
record from being processed during an explicitly targeted resume or
changed-source reprocessing operation.

GitHub access is read-only and uses:

```bash
gh issue list --repo OWNER/REPO --state open --limit 1000 \
  --json number,title,url,state,body,createdAt,updatedAt
```

For fixture, replay, or offline work, `--source-snapshot PATH` accepts the
`backlog-source-snapshot.v1` shape. The processor recomputes every source
fingerprint rather than trusting a supplied digest.

## Selection and capacity

Version 1 selection is intentionally simple and deterministic: open issues are
ordered by ascending issue number after ineligible records and claims are
removed. This is not editorial prioritization. The strict `--limit` is the only
throughput and review-capacity control in this version.

The earliest issue waiting for Loop 1 review reserves one batch slot. This
prevents a repeated command from walking past an unresolved review boundary
and accumulating additional unreviewed work. With `--limit 1`, the same command
remains stable until that issue receives a matching approval envelope.
The reservation remains in force when direct acquisition detects that the
awaiting issue's source fingerprint changed; the manifest reports both
fingerprints, and the issue still requires explicit human resolution.

The processor skips:

- active or invalid claims;
- stale claims unless recovery was explicitly requested;
- unchanged stable outcomes;
- awaiting Loop 1 records without a matching approval envelope;
- terminal failures;
- changed completed sources unless `--reprocess-changed` was supplied;
- otherwise eligible candidates beyond the batch limit.

Every skip reason is present in the batch manifest and human-readable summary.

## Loop 1 approval boundary

An initial execute run may run Loop 1, but it always stops in
`awaiting-loop1-review`. Loop 1 model output is not editorial authorization.
The workspace contains:

- the immutable issue snapshot;
- Loop 1 result and execution logs;
- `loop1/review-packet.json`, which binds the source fingerprint, processing
  commit, workspace, and Loop 1 artifact fingerprint.

A human reviewer creates a `backlog-loop1-review-envelope.v2` document whose
`recommendation` is a valid, approved
`loop1-reviewed-recommendation.v1`. Resume with:

```bash
npm run backlog:process -- \
  --execute \
  --repo MLX983/dfw-intake \
  --repo-path /absolute/path/to/deep-field-works \
  --limit 1 \
  --state-dir /tmp/dfw-backlog-state \
  --work-root /tmp/dfw-backlog-work \
  --reviewed-recommendation /absolute/path/to/review-envelope.json
```

When the approved operation authorizes Loop 2 classification but deliberately
withholds drafting authorization, add:

```text
--stop-after-loop2
```

For a targeted `failed-retriable` Loop 2 failure after accepted review but
before packet creation, add `--retry-loop2`. This explicit operator path
requires `--execute`, `--limit 1`, `--issue-number`, a bound review envelope, a
clean repository, and exactly one `--stop-after-loop2`. It preserves Loop 1 and
fails closed if a Loop 2 packet or downstream work already exists.

If Loop 2 is draft-ready, the processor records
`completed-waiting-for-human` at stage `loop2`, preserves the ready packet, and
does not create an orchestration directory or invoke notification. A later
drafting run requires separate human authorization; this option does not add a
new registry state or weaken the Loop 1 review-envelope bindings.

The issue number, source fingerprint, workspace, original processing commit,
current resume-processing commit, and Loop 1 result fingerprint must all
match. The original commit records where the workspace and Loop 1 result came
from; the resume commit records which processor version validated and
continued the run. They may differ, but neither is optional or arbitrary. A
mismatch leaves the issue at the review boundary with
`review-envelope-invalid`. The processor does not infer approval and cannot
use an envelope for a different issue or run.

Repeating a completed resume with the same envelope is a validated no-op. The
processor rechecks every binding, including the current resume commit and the
saved reviewed recommendation, then reports the issue as
`unchanged-completed` without rerunning any loop. A changed or incomplete
envelope is still rejected.

Legacy `backlog-loop1-review-envelope.v1` files are rejected; regenerate the
envelope from the saved review packet and current processor commit. A
`backlog-registry.v1` file is migrated explicitly in memory to
`backlog-registry.v2`, preserving its original `processingCommitSha` as
`sourceProcessingCommitSha`. The first durable write creates
`registry.v2.json`; the original v1 registry remains untouched as migration
evidence.

## Workflow outcomes

After valid approval, the processor delegates to the existing commands:

1. `npm run loop:packet`
2. stop at Loop 2 when `--stop-after-loop2` is explicit
3. `npm run loop:orchestrate` only when Loop 2 is draft-ready and the explicit
   Loop 2 stop was not requested
4. the existing review notifier only for an eligible orchestration manifest

Stable issue states are:

- `awaiting-loop1-review`
- `completed-waiting-for-human`
- `completed-combine-first`
- `completed-governance-stop`
- `completed-other-nondraft-stop`
- `failed-retriable`
- `failed-terminal`

The registry also uses `pending` and `claimed` as explicit transient states.
Combine-first, governance, and other valid nondraft stops are successful
terminal workflow outcomes, not generic errors.

Notification delivery is disabled unless `--send-notifications` is explicit.
Without it, an eligible result runs the notifier in its existing dry-run mode.
A provider failure is recorded as retriable while preserving the completed
orchestration manifest; retry resumes at notification without rerunning the
upstream loops. Existing notification-key and ledger behavior remains
authoritative for duplicate suppression.

## Registry, claims, and recovery

The private mode-0600 registry lives at:

```text
<state-dir>/registry.v2.json
```

It records source and processing fingerprints, current or final state,
disposition and combine target, workspace and artifact paths, notification
state and key, attempt history, processing commit, and bounded failure details.
Rewrites use a temporary file followed by atomic rename.

Each issue is claimed with exclusive file creation at:

```text
<state-dir>/claims/issue-N.claim.json
```

A competing process cannot acquire the same live claim. Claims older than
`--claim-timeout-minutes` (default 120) are not reclaimed automatically.
After inspecting the claim and workspace, an operator may explicitly recover
them with `--recover-stale-claims`; the old claim is preserved under
`claims/stale/`.

The same explicit option applies to a stale global registry lock. An active or
malformed global lock always stops the batch. A well-formed global lock older
than the timeout may be recovered explicitly and is preserved beside stale
issue claims before a new lock is acquired.

If the source fingerprint changes after a stable result, the default remains a
safe skip. `--reprocess-changed` creates a new workspace and preserves the
prior result in registry history. It never overwrites the earlier artifacts.
For a changed record already awaiting review, the flag must be paired with
`--issue-number N`; without explicit reprocessing it continues to reserve
review capacity.

Per-issue stage failures are recorded and do not stop later selected issues.
Malformed registry state or failure to acquire the global registry lock stops
the whole batch because state consistency can no longer be guaranteed.

## Output layout

Execute mode creates:

```text
<work-root>/
  runs/<run-id>/
    source-snapshot.json
    source-cache/issues/*.md
    batch-manifest.json
    summary.md
  issues/issue-N/<run-id>/
    loop1/
    loop2/
    orchestration/
```

Run IDs are unique, so separate attempts cannot silently reuse an output
directory. The batch manifest is the machine-readable audit record; the
summary gives each issue's state, stage, disposition, combine target,
notification result, failure, workspace, and recommended human next action.

## Validation

Run the local safety and contract fixtures:

```bash
npm run backlog:process:fixtures
```

The suite covers dry-run safety, exact limits, approval binding, all stable
stops, notification eligibility and retry, source changes, claims and stale
recovery, atomic writes, failure isolation, summary consistency, and the
absence of issue-mutation and scheduling paths.

## Explicit non-goals

This processor does not:

- create a scheduler, trigger, daemon, webhook, or polling service;
- process an unbounded backlog;
- update, label, comment on, close, or otherwise mutate GitHub issues;
- approve a Loop 1 recommendation;
- modify source-of-truth documents or taxonomy;
- publish or change publication state;
- select editorial priority automatically;
- remove human review from any existing gate.
