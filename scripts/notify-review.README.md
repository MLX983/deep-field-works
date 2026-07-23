# Human-review email notification

This manual command reads exactly one completed Loops 3–5 orchestration manifest and plans or sends one human-review notification:

```bash
npm run notify:review -- \
  --manifest /tmp/dfw-run/loop3-5-9901-manifest.json \
  --ledger /tmp/dfw-notifications/review-ledger.json
```

The default is a dry run. It validates the manifest and any existing ledger, reports eligibility, duplicate status, the deterministic notification key, configuration presence, subject, bounded summary counts, and expected ledger action. It does not contact Resend or write a delivery record. Add `--send` to perform a real send.

## Eligibility

Only these terminal states are eligible:

* `READY_FOR_HUMAN_EDITORIAL_REVIEW`
* `WAITING_FOR_HUMAN`
* `PARTIALLY_REVISED_WAITING_FOR_HUMAN`

All other supported orchestration statuses return `not-eligible` without a provider call or ledger write. In particular, `BLOCKED`, `LOOP3_BLOCKED`, `HOLD`, `REVISED_STILL_NEEDS_WORK`, and `REVISED_PENDING_REEVALUATION` do not generate a normal review email.

## Resend configuration

A real send requires all three variables:

```bash
export RESEND_API_KEY='...'
export DFW_REVIEW_EMAIL_FROM='Deep Field Works <review@example.com>'
export DFW_REVIEW_EMAIL_TO='editor@example.com'
```

The command never prints the API key. Provider code is isolated behind `sendReviewNotification({ from, to, subject, text, html, idempotencyKey })`; fixture tests inject a local fake and make no network calls. Resend receives `dfw-review-<notification-key>` through its `Idempotency-Key` header.

## Notification identity and duplicate handling

The notification key is SHA-256 over canonical JSON whose object keys are recursively sorted. The exact identity input is:

* notification contract `dfw-review-notification.v1`;
* manifest contract;
* issue number;
* final workflow status;
* manifest `startedAt` and `completedAt`;
* stopped stage and stop reason;
* every artifact's stage, kind, and SHA-256 fingerprint, sorted by canonical entry;
* sorted human-input requests;
* sorted warnings.

The current time, manifest path, sender, and recipient are excluded. Repeating the same completed review state therefore produces the same key, while a material status, artifact, request, warning, or completed-run change produces a different key. Resend retains idempotency keys for 24 hours; the local successful-delivery ledger remains authoritative beyond that provider window.

The local ledger uses `dfw-review-notification-ledger.v1` and keeps separate `attempts` and successful `deliveries`. Recipient identity is stored only as a normalized-email SHA-256 hash. Attempts include issue/status identity, local manifest path and fingerprint, artifact fingerprints, provider, attempt time, result, provider ID when available, or a bounded failure category/message.

Ledger rewrites use a mode-0600 temporary file followed by atomic rename. The command creates parent directories, rejects malformed or unsupported ledgers without replacing them, and holds an exclusive `<ledger>.lock` from its final duplicate check through provider completion and ledger recording. A concurrent invocation returns `concurrent-in-progress`. If a process terminates abnormally, inspect the lock metadata and ledger before manually removing a stale lock; an existing `sending` attempt returns `delivery-uncertain` and is not retried automatically. This preserves the uncertain-delivery boundary. There is no duplicate-bypass flag.

A successful key is suppressed before another send. A provider failure is recorded but does not create a delivery, so the same command may be retried. Resend idempotency provides an additional safeguard if provider success occurs but the local process cannot finish its ledger update.

## Email privacy boundary

The email contains only the Deep Field Works identifier, issue number/title/optional URL, workflow status, stopped stage, bounded stop reason, completion time, notification key, manifest fingerprint and local path, up to ten bounded human-input requests, warning count plus up to ten bounded warning summaries, and up to twenty local review-artifact filenames, kinds, paths, and fingerprints.

The notifier never reads artifact contents. It sends no draft body, excerpts, arbitrary artifact contents, attachments, or remote draft upload. The message directs the editor to review all draft material locally. HTML interpolations are escaped.

## Real-provider smoke test

The committed fixture is synthetic and contains no unpublished draft body. Do not run this test as part of routine automation.

```bash
SMOKE_LEDGER=/tmp/dfw-review-smoke/ledger.json

npm run notify:review -- \
  --manifest scripts/fixtures/review-notification/eligible-manifest.json \
  --ledger "$SMOKE_LEDGER"

npm run notify:review -- \
  --manifest scripts/fixtures/review-notification/eligible-manifest.json \
  --ledger "$SMOKE_LEDGER" \
  --send

npm run notify:review -- \
  --manifest scripts/fixtures/review-notification/eligible-manifest.json \
  --ledger "$SMOKE_LEDGER" \
  --send
```

Inspect the ledger locally: the first real invocation should have one `sent` attempt and delivery with a provider message ID; the repeated invocation should return `duplicate-suppressed` without another attempt. Confirm the same message ID and delivery in the Resend dashboard's Emails view. Use a new ledger only to repeat the synthetic smoke test intentionally; production identities cannot be forced through an existing successful ledger.

## Explicit non-goals

This command does not process the backlog.

This command does not run the drafting pipeline.

This command does not publish content.

This command is not scheduled.

It also does not poll issues, traverse manifests, invoke any workflow loop, mutate GitHub, upload or attach drafts, handle inbound email, or provide action links.
