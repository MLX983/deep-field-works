# Bounded Publishing Operator Runbook

## Purpose

This is the canonical operator reference for the current manual Deep Field
Works publishing workflow:

```text
one intake issue
→ Loop 1
→ optional manual review notification
→ human review
→ explicit approval envelope
→ Loop 2
→ stop
```

This runbook describes implemented behavior only. It does not authorize
drafting, publication, GitHub mutation, scheduling, or later loops.

## 1. Prerequisites

### Repository state

Operate from the local `MLX983/deep-field-works` repository on `main`.
Start from a clean tree synchronized with `origin/main`. The commit recorded
when Loop 1 runs becomes part of the review-packet binding.

```bash
cd /absolute/path/to/deep-field-works

git rev-parse HEAD
git branch --show-current
git rev-list --left-right --count HEAD...origin/main
git status --short
```

Expected:

- branch: `main`;
- divergence: `0 0`;
- `git status --short`: no output.

Do not begin a production run with unreviewed code or content changes.

### Runtime and services

| Requirement | Use |
| --- | --- |
| Node.js `>=22.12.0` and npm dependencies | Processor and loop commands |
| Git | Commit binding and repository checks |
| Codex CLI, logged in with network access | Loop 1 model calls |
| GitHub CLI, authenticated for read access | Open-issue discovery from `MLX983/dfw-intake` |
| Resend account and verified sender | Only for an intentional email send |

Check the local tools:

```bash
node --version
npm --version
git --version
gh auth status
codex --version
```

`CODEX_BIN` is optional. Set it only when the Codex executable is not at
`/Applications/Codex.app/Contents/Resources/codex` or on `PATH`:

```bash
export CODEX_BIN=/absolute/path/to/codex
```

`npm` inherits the environment of the shell that invokes it. Both `gh` and
`codex` must be discoverable in that inherited `PATH` (unless `CODEX_BIN`
names the Codex executable explicitly). Do not replace `PATH` with an
incomplete value for a processor run; first confirm the exact shell can run
both `gh --version` and `codex --version`.

No processor-specific environment variable is required. A real notification
send requires the Resend variables documented in section 5.

### Operator paths

Use explicit absolute paths outside the repository for private state and
unpublished work. Keep the same state and work paths for the entire issue
lifecycle.

```bash
export DFW_REPO_PATH=/absolute/path/to/deep-field-works
export DFW_SOURCE_REPO=MLX983/dfw-intake
export DFW_STATE_DIR=/absolute/private/path/dfw-backlog-state
export DFW_WORK_ROOT=/absolute/private/path/dfw-backlog-work
export DFW_NOTIFICATION_LEDGER=/absolute/private/path/dfw-loop1-review-ledger.json
export ISSUE_NUMBER=17
```

These are shell conveniences, not application configuration. Do not place
state, workspaces, or notification ledgers inside a public content directory.

## 2. Process one issue through Loop 1

### Command

```bash
cd "$DFW_REPO_PATH"

npm run backlog:process -- \
  --execute \
  --repo "$DFW_SOURCE_REPO" \
  --repo-path "$DFW_REPO_PATH" \
  --limit 1 \
  --issue-number "$ISSUE_NUMBER" \
  --state-dir "$DFW_STATE_DIR" \
  --work-root "$DFW_WORK_ROOT"
```

`--repo` is the source intake repository, currently
`MLX983/dfw-intake`. `--repo-path` is the local
`MLX983/deep-field-works` checkout. Do not interchange them.

### Required arguments

| Argument | Meaning |
| --- | --- |
| `--execute` | Persist state and run the selected issue |
| `--repo OWNER/REPO` | Read-only GitHub issue source |
| `--repo-path PATH` | Local Deep Field Works checkout |
| `--limit 1` | Hard processing-capacity bound |
| `--state-dir PATH` | Durable local registry and claims |
| `--work-root PATH` | Per-run source snapshots and issue workspaces |

For single-issue operation, also supply `--issue-number N`. Without it, the
processor uses deterministic ascending issue-number selection and may choose a
different eligible issue.

### Relevant optional arguments

| Argument | Use |
| --- | --- |
| `--source-snapshot PATH` | Offline or replay input instead of live GitHub discovery |
| `--claim-timeout-minutes N` | Stale threshold; default `120` |
| `--recover-stale-claims` | Explicitly recover inspected stale issue claims or registry lock |
| `--reprocess-changed` | Explicitly create a new run after the source issue changed |

Do not use `--reviewed-recommendation` until human review is complete. Do not
use `--send-notifications`; it belongs to a different processor path and is
not the Loop 1 notification command in this runbook.

### Expected output and state

The command prints:

- a batch plan to stderr;
- JSON to stdout containing `runId`, `manifestPath`, `summaryPath`, and counts.

Exit code `2` means at least one selected issue ended in a durably recorded
`failed-retriable` or `failed-terminal` state. The batch command did not
succeed, but the per-issue registry, workspace, logs, and failure details may
have been written successfully. Inspect them before retrying.

The durable registry is:

```text
<state-dir>/registry.v2.json
```

The run creates:

```text
<work-root>/
  runs/<run-id>/
    source-snapshot.json
    source-cache/issues/*.md
    batch-manifest.json
    summary.md
  issues/issue-N/<run-id>/
    source/<issue-snapshot>.md
    loop1/
      execution.json
      stdout.log
      stderr.log
      loop1-N-result.md
      review-packet.json
```

On success, processing stops with:

```text
processingStatus: awaiting-loop1-review
currentOrFinalStage: loop1-review
```

Loop 1 output is provisional. This state is not approval.

## 3. Review Loop 1 output

Open the workspace path recorded for the issue in
`<state-dir>/registry.v2.json`. Review these files together:

```text
source/<issue-snapshot>.md
loop1/loop1-N-result.md
loop1/review-packet.json
loop1/execution.json
loop1/stderr.log
```

The review packet binds:

- issue number and title;
- source-content fingerprint;
- source processing commit;
- workspace path;
- Loop 1 result path and fingerprint;
- the requirement for human approval.

The Loop 1 result contains:

- recommendation;
- proposed document type;
- confidence;
- primary domain;
- theme;
- rationale under `Why this may matter`;
- related material;
- evaluation result and explanation;
- suggested next action;
- open questions and uncertainty notes.

Fixed machine-readable fields use their exact contract vocabulary and casing.
In particular, recommendation, document type, and confidence values are
lowercase; primary domains retain their canonical title case; and evaluation
results are `PASS`, `REVISE`, or `ESCALATE`. Display formatting is separate
from stored values. The standalone notifier rejects unsupported values rather
than inferring intent; its bounded legacy compatibility is documented in
`scripts/notify-loop1-review.README.md`.

Before approval, the operator must:

1. Compare the recommendation with the complete issue snapshot.
2. Verify that retrieval metadata or a truncated excerpt did not drive the
   conclusion.
3. Inspect related material directly; similarity is not proof of duplication
   or a valid combine target.
4. Confirm the smallest adequate artifact, reviewed disposition, canonical
   domain, and existing theme.
5. Check confidence and rationale against the available evidence.
6. Preserve observation, inference, speculation, and uncertainty boundaries.
7. Resolve any `ESCALATE`, weak-evidence, governance, taxonomy, or human-intent
   concern before approval.
8. Confirm the source issue has not materially changed since the packet was
   created.

The notification's disposition is a deterministic provisional mapping for
review convenience. It is not an approved disposition. The human-created
`loop1-reviewed-recommendation.v1` record is authoritative for Loop 2.

## 4. Preview a review notification

Set the packet path from the issue workspace:

```bash
export REVIEW_PACKET=/absolute/path/to/loop1/review-packet.json
```

Preview:

```bash
cd "$DFW_REPO_PATH"

npm run notify:loop1-review -- \
  --review-packet "$REVIEW_PACKET" \
  --ledger "$DFW_NOTIFICATION_LEDGER"
```

Expected result:

```json
{
  "result": "dry-run",
  "plan": {
    "mode": "dry-run",
    "duplicate": false,
    "notificationKey": "...",
    "provider": "resend"
  },
  "content": {
    "text": "...",
    "html": "..."
  }
}
```

Inspect the subject, recipient-configuration flags, summary fields, safe local
packet reference, commit, and complete text/HTML bodies.

The command uses the absolute packet path locally for validation and hashing,
but the notification renders only:

- a repository-relative reference when the packet is in this repository;
- an `issues/issue-N/<run-id>/loop1/review-packet.json` workspace reference
  when safely derivable; or
- a local processor-workspace label.

The rendered reference is not a public link. It contains no `file://` URL.
Use the original local command or processor registry to open the packet. The
rendered review instruction similarly replaces local repository, state,
workspace, and envelope paths with operator placeholders.

Preview mode:

- makes no Resend request;
- creates no notification-ledger entry;
- creates no other file;
- does not approve or continue processing.

It may read an existing ledger to report duplicate status.

## 5. Send a review notification

### Resend configuration

Use a verified Resend sender and the intended human reviewer:

```bash
export RESEND_API_KEY='...'
export DFW_REVIEW_EMAIL_FROM='Deep Field Works <review@verified-domain.example>'
export DFW_REVIEW_EMAIL_TO='editor@example.com'
```

The sender domain must be configured in the operator's Resend account. The API
key is not printed or stored in the ledger.

### Send command

Run the preview first. Then add `--send`:

```bash
npm run notify:loop1-review -- \
  --review-packet "$REVIEW_PACKET" \
  --ledger "$DFW_NOTIFICATION_LEDGER" \
  --send
```

Expected successful result:

```json
{
  "result": "sent",
  "providerMessageId": "...",
  "plan": {
    "mode": "send",
    "duplicate": false,
    "notificationKey": "...",
    "provider": "resend"
  }
}
```

Confirm the provider message ID in Resend and delivery to the intended mailbox.

### Duplicate prevention

The notifier derives one deterministic SHA-256 key from the bound review state,
normalized summary, and path-normalized review instruction. It excludes send
time, sender, recipient, absolute packet path, and machine-specific command
paths. Equivalent review states at different local locations therefore retain
the same identity. Successful legacy keys remain suppressible.

The local ledger:

```text
<DFW_NOTIFICATION_LEDGER>
```

uses `dfw-loop1-review-notification-ledger.v1`, records attempts and successful
deliveries separately, stores a hashed recipient identity, and uses atomic
mode-0600 writes. New attempt records contain only the safe packet reference,
while existing ledgers with the legacy absolute packet-path field remain
readable.

A lock covers the final duplicate check, provider call, and ledger write.
Resend receives:

```text
Idempotency-Key: dfw-loop1-review-<notification-key>
```

Repeating a successfully delivered state returns:

```text
result: duplicate-suppressed
```

and makes no provider call. A meaningful change to the issue identity, source,
commit, Loop 1 result, review instruction, or normalized summary creates a new
key and may be sent intentionally.

There is no duplicate-bypass option. Do not delete or replace a production
ledger to force another send.

The standalone Loop 1 notification is not recorded in the processor registry.
Confirm notification status from the command result and this ledger.
Processor `notificationStatus` therefore remains unchanged by standalone
preview or delivery; this separation is intentional.

## 6. Approve and continue to Loop 2

Approval is a manual editorial act. The processor does not generate approval.

### Create an approval envelope

Create a private `backlog-loop1-review-envelope.v2` JSON file outside public
content directories. Copy binding values exactly from `review-packet.json`.
Set `resumeProcessingCommitSha` to the current clean checkout commit:

```bash
git -C "$DFW_REPO_PATH" rev-parse HEAD
```

Envelope shape:

```json
{
  "contractVersion": "backlog-loop1-review-envelope.v2",
  "issueNumber": 17,
  "sourceContentSha256": "<from review-packet.json>",
  "sourceProcessingCommitSha": "<from review-packet.json>",
  "resumeProcessingCommitSha": "<current git rev-parse HEAD>",
  "workspacePath": "<from review-packet.json>",
  "loop1ResultSha256": "<from review-packet.json>",
  "recommendation": {
    "contractVersion": "loop1-reviewed-recommendation.v1",
    "issueNumber": 17,
    "disposition": "develop independently",
    "suggestedArtifact": "note",
    "primaryDomain": "Human-Machine Workflows",
    "themeOrCluster": "existing-theme",
    "rationale": "One or two concise, human-reviewed sentences.",
    "nextAction": "One concrete bounded next step.",
    "uncertaintyOrReviewFlag": "Optional residual caution.",
    "humanApprovalStatus": "approved",
    "reviewedAt": "<current ISO-8601 date-time>",
    "reviewedBy": "operator identifier",
    "sourceLoop1Run": "<review packet or run reference>"
  }
}
```

Use only values permitted by:

- `docs/contracts/backlog-loop1-review-envelope.v2.schema.json`;
- `docs/contracts/loop1-reviewed-recommendation.v1.schema.json`.

Do not mechanically copy the provisional notification disposition. Review and
approve each recommendation field.

### Resume command

```bash
export REVIEW_ENVELOPE=/absolute/private/path/to/review-envelope.json

npm run backlog:process -- \
  --execute \
  --repo "$DFW_SOURCE_REPO" \
  --repo-path "$DFW_REPO_PATH" \
  --limit 1 \
  --issue-number "$ISSUE_NUMBER" \
  --state-dir "$DFW_STATE_DIR" \
  --work-root "$DFW_WORK_ROOT" \
  --reviewed-recommendation "$REVIEW_ENVELOPE" \
  --stop-after-loop2
```

`--stop-after-loop2` is mandatory for the workflow governed by this runbook.
Do not omit it. The `nextCommand` generated in `review-packet.json`, and the
same instruction rendered by the standalone notification, must contain this
flag exactly once. Replace only the private review-envelope placeholder before
running the command.

The processor:

1. re-acquires the current open issue source;
2. validates the envelope against the issue, registry, original processing
   commit, current resume commit, workspace, and Loop 1 result fingerprint;
3. saves the approved recommendation as
   `loop1/reviewed-recommendation.json`;
4. runs Loop 2 without rerunning Loop 1;
5. writes Loop 2 logs, execution metadata, and
   `loop2/loop2-N-packet.json`;
6. stops.

Possible stable outcomes are:

| Processor state | Meaning |
| --- | --- |
| `completed-waiting-for-human` at stage `loop2` | Loop 2 packet is ready; later drafting is not authorized |
| `completed-combine-first` | Review the approved combine target; no target mutation occurred |
| `completed-governance-stop` | Resolve the governance or human-judgment question manually |
| `completed-other-nondraft-stop` | Valid nondraft disposition; no later work was run |

Replaying the same completed approval is a validated no-op and reports an
unchanged completed result. It does not rerun Loop 1 or Loop 2.

## 7. State and recovery

### Processor state reference

| State | Operator response |
| --- | --- |
| `pending` | Transient before claim |
| `claimed` | Inspect claim and current run; do not start a competing run |
| `awaiting-loop1-review` | Review the existing packet; do not rerun Loop 1 |
| `completed-waiting-for-human` | Bounded Loop 2 stop is complete |
| `completed-combine-first` | Review the combine target manually |
| `completed-governance-stop` | Resolve outside automation |
| `completed-other-nondraft-stop` | No further automated action |
| `failed-retriable` | Correct the recorded transient failure and rerun the same issue |
| `failed-terminal` | Do not retry unchanged input; inspect the failure and contracts |

The current state and failure details are in:

```text
<state-dir>/registry.v2.json
```

The latest batch audit is under:

```text
<work-root>/runs/<run-id>/batch-manifest.json
<work-root>/runs/<run-id>/summary.md
```

### Interrupted processing and stale claims

Normal completion releases issue and global locks. A killed process may leave:

```text
<state-dir>/claims/issue-N.claim.json
<state-dir>/registry.v2.lock
```

Do not remove either file immediately. Inspect its run ID, timestamp, registry
record, workspace, logs, and whether any process is still active.

Claims are stale only after `--claim-timeout-minutes` has elapsed; the default
is 120 minutes. After confirming the prior process is gone, recover explicitly:

```bash
npm run backlog:process -- \
  --execute \
  --repo "$DFW_SOURCE_REPO" \
  --repo-path "$DFW_REPO_PATH" \
  --limit 1 \
  --issue-number "$ISSUE_NUMBER" \
  --state-dir "$DFW_STATE_DIR" \
  --work-root "$DFW_WORK_ROOT" \
  --claim-timeout-minutes 120 \
  --recover-stale-claims
```

Recovered claims and locks are preserved under
`<state-dir>/claims/stale/`. Malformed claims or locks are not recovered
automatically.

If interruption happened after `awaiting-loop1-review` was recorded, use the
existing packet. Do not run Loop 1 again. If the registry records
`failed-retriable`, correct the failure and rerun the targeted issue; the
processor preserves prior result metadata and creates a new run workspace when
required.

If Loop 2 alone failed before a packet was created after accepted human review,
use the explicit bounded retry path:

```bash
npm run backlog:process -- \
  --execute \
  --repo "$DFW_SOURCE_REPO" \
  --repo-path "$DFW_REPO_PATH" \
  --limit 1 \
  --issue-number "$ISSUE_NUMBER" \
  --state-dir "$DFW_STATE_DIR" \
  --work-root "$DFW_WORK_ROOT" \
  --reviewed-recommendation "$REVIEW_ENVELOPE" \
  --retry-loop2 \
  --stop-after-loop2
```

This path requires a clean repository and exactly one `--stop-after-loop2`.
It revalidates the issue, source fingerprint, original and resuming commits,
workspace, and Loop 1 result; preserves the original Loop 1 outputs; archives
the previously saved recommendation if a contract-only correction is supplied;
and rejects a retry if a Loop 2 packet or downstream directory exists. A
corrected recommendation may only change the artifact representation and its
separate narrative treatment while preserving the accepted editorial decision.
The corrected private envelope must fingerprint and explain the earlier
envelope it operationally supersedes.

### Failed or uncertain notification

| Result | Action |
| --- | --- |
| `provider-failed` | Correct Resend configuration or transient provider failure, then rerun the same packet with the same ledger |
| `concurrent-in-progress` | Wait for the active notifier; inspect the ledger lock if it does not finish |
| `delivery-uncertain` | Do not resend automatically; inspect the ledger and Resend dashboard to determine whether delivery occurred |
| `duplicate-suppressed` | Expected safe outcome; no provider call occurred |

A failed provider attempt does not create a successful delivery and may be
retried. A persisted `sending` attempt without an outcome is intentionally not
retried because delivery may already have occurred.

If `<DFW_NOTIFICATION_LEDGER>.lock` remains after the notifier process has
ended, inspect its PID and timestamp and confirm no notifier is active. Only
then remove that exact lock file and rerun. The ledger may still return
`delivery-uncertain`; resolve that status against the Resend dashboard rather
than forcing another send.

### Partially completed runs

Do not promote loose files manually:

- use only a processor-created review packet whose Loop 1 hash validates;
- use only the Loop 2 packet recorded by the resumed processor run;
- inspect `execution.json`, stdout, stderr, registry failure fields, and batch
  manifest before deciding to retry;
- keep the same state directory when resuming.

If an output file exists but the corresponding state transition was not
recorded, treat the run as incomplete. Follow the registry state rather than
assuming that file existence means success.

### Review intentionally abandoned

Do not create an approval envelope and do not invoke Loop 2. Leave the issue at
`awaiting-loop1-review`.

There is currently no implemented abandoned or rejected processor state. An
awaiting issue reserves capacity in untargeted runs. Preserve its registry
record and workspace for audit; do not edit them to simulate abandonment.

### Safe cleanup

There is no automated retention or cleanup command.

- Dry-run outputs are disposable after inspection because dry run does not
  mutate the supplied state or work roots.
- Synthetic notification smoke-test directories and ledgers may be removed
  after confirming they contain no production state.
- Do not remove an execution workspace, registry, claim archive, review packet,
  approval envelope, or production notification ledger while it is referenced
  by an awaiting, retriable, or uncertain state.
- Before manual cleanup, resolve the exact absolute target, inspect its
  contents, confirm it is outside the repository, and preserve any required
  audit record.

Do not treat `/tmp` storage as durable. The project does not yet define a
retention policy for production review artifacts.

## 8. Current boundaries

The current workflow intentionally does not perform:

- automatic scheduling;
- automatic or unbounded backlog processing;
- automatic notification after Loop 1;
- automatic publication;
- autonomous approval;
- GitHub issue mutation;
- drafting or any later loop under this runbook.

Every run is explicit and bounded to a stated limit. Human approval is
mandatory between Loop 1 and Loop 2. Loop 2 stops without publication.

## 9. Troubleshooting

### Common mistakes

| Symptom | Check |
| --- | --- |
| Wrong issue selected | Use `--issue-number N` and `--limit 1` |
| GitHub discovery fails | Run `gh auth status`; confirm `--repo MLX983/dfw-intake` |
| Loop 1 cannot start Codex | Confirm the invoking shell's inherited `PATH` finds `codex`, do not replace `PATH` incompletely, and check optional `CODEX_BIN` |
| Batch exits `2` | Inspect the batch result and durable per-issue failure in `registry.v2.json`; correct it before a targeted retry |
| No matching review record | Use the original `--state-dir`; verify issue number and open-issue source |
| `review-envelope-invalid` | Compare every binding, use envelope v2, and use the current resume commit |
| Loop 1 fingerprint mismatch | Do not edit the Loop 1 result; use the bound artifact or reprocess explicitly |
| Unexpected later-stage risk | Confirm the resume command contains `--stop-after-loop2` |
| Notification configuration missing | Set all three Resend variables only for `--send` |
| Notification status absent from registry | Inspect the standalone Loop 1 notification ledger |

### Verify repository cleanliness

```bash
git -C "$DFW_REPO_PATH" status --short
git -C "$DFW_REPO_PATH" branch --show-current
git -C "$DFW_REPO_PATH" rev-list --left-right --count HEAD...origin/main
```

If the checkout changed between Loop 1 and approval, use the new current commit
as `resumeProcessingCommitSha`; do not alter the packet's original
`sourceProcessingCommitSha`. Review the code changes before resuming.

### When not to rerun Loop 1

Do not rerun Loop 1 when:

- the registry already says `awaiting-loop1-review`;
- a valid review packet exists and only notification failed;
- notification was suppressed as a duplicate;
- the operator is still deciding whether to approve;
- Loop 2 already completed;
- a completed replay reports unchanged state.

If the source issue changed, the default is a safe skip. Reprocessing requires
both the targeted issue and explicit authorization:

```text
--issue-number N --reprocess-changed
```

That operation creates a new workspace and preserves the earlier result.

## 10. Future roadmap — not implemented

The following are future work and are not operator capabilities:

- scheduler;
- automatic backlog operation;
- publication pipeline;
- Loops 3–5;
- `DFW-BL-003` — improve ranking of strong cluster anchors;
- `DFW-BL-009` — formalize the Loop 1 reviewed-recommendation boundary;
- `DFW-BL-018` — distinguish conceptual, normative, speculative, and empirical claims;
- `DFW-BL-020` — define a controlled merge workflow for combine-first material.

See `docs/development-backlog.md` for current status and detail. Do not infer
authorization from a proposed backlog item.
