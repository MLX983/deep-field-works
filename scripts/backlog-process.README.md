# Bounded backlog processor

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
dry-run mode. The command prints the temporary manifest and summary paths.

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

A human reviewer creates a `backlog-loop1-review-envelope.v1` document whose
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

The issue number, source fingerprint, workspace, processing commit, and Loop 1
result fingerprint must all match the recorded run. A mismatch leaves the
issue at the review boundary with `review-envelope-invalid`. The processor does
not infer approval and cannot use an envelope for a different issue or run.

## Workflow outcomes

After valid approval, the processor delegates to the existing commands:

1. `npm run loop:packet`
2. `npm run loop:orchestrate` only when Loop 2 is draft-ready
3. the existing review notifier only for an eligible orchestration manifest

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
<state-dir>/registry.v1.json
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
