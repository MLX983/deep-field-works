# Loop 1 human-review email notification

This manual command previews or sends one bounded review notification for one
completed Loop 1 review packet:

```bash
npm run notify:loop1-review -- \
  --review-packet /tmp/dfw-work/issues/issue-17/RUN/loop1/review-packet.json \
  --ledger /tmp/dfw-notifications/loop1-review-ledger.json
```

The default is a dry run. It validates the packet, re-hashes the referenced
Loop 1 result, parses the bounded review summary, checks the ledger, and prints
the complete text and HTML payload. It makes no provider call and writes no
ledger entry.

Add `--send` only when a real delivery is intended. The command is not called
by Loop 1 or by `backlog:process`; there is no automatic send after processing.

## Review boundary

The notification does not approve a recommendation or continue the pipeline.
The intended workflow remains:

```text
Loop 1
→ explicit notification command
→ human review
→ explicit approval envelope
→ Loop 2
→ stop
```

The notifier does not invoke any loop, create an approval envelope, schedule
work, mutate GitHub, or publish content.

## Payload

The email includes:

- issue number and title;
- Loop 1 recommendation;
- provisional disposition derived from the fixed Loop 1 recommendation
  vocabulary;
- proposed artifact, domain, theme, confidence, and bounded rationale;
- absolute local review-packet path;
- source processing commit;
- bounded review instruction from the packet;
- notification key and review-packet fingerprint.

The disposition mapping is deterministic:

| Loop 1 recommendation | Provisional disposition |
| --- | --- |
| `preserve as-is` | `preserve as seed` |
| `defer` | `defer` |
| `combine with other material` | `combine with overlapping material` |
| `develop as note` | `develop independently` |
| `research as field report` | `research before development` |
| `draft artifact` | `develop independently` |
| `needs human judgment` | `needs human judgment` |
| `not for publication` | `not for publication` |

This is review context, not approved `loop1-reviewed-recommendation.v1`
guidance. The human reviewer may correct any field when creating the approval
envelope.

The notifier reads the Loop 1 result only to extract its fixed top-level fields
and `Why this may matter` section. It does not transmit the issue body, related
material, evaluation diagnostics, open questions, agent notes, prompts,
traces, unpublished drafts, Loop 2 packets, attachments, or processor logs.
HTML interpolations are escaped.

## Deterministic duplicate prevention

The notification key is SHA-256 over canonical JSON with recursively sorted
object keys. Its identity input is:

- notification and review-packet contract versions;
- issue number and bounded title;
- source-content fingerprint;
- source processing commit;
- Loop 1 result fingerprint;
- bounded packet review instruction;
- normalized recommendation, provisional disposition, proposed artifact,
  domain, theme, confidence, and rationale.

Packet path, workspace path, packet creation time, send time, sender, and
recipient are excluded. Repeating the same review state therefore produces the
same key. A changed source, commit, Loop 1 artifact, title, instruction, or
review summary produces a new key and permits an intentional new notification.

The dedicated ledger contract is
`dfw-loop1-review-notification-ledger.v1`. It keeps provider attempts separate
from successful deliveries and stores the recipient only as a normalized-email
SHA-256 hash.

Ledger updates use a mode-0600 temporary file and atomic rename. The command
holds an exclusive `<ledger>.lock` from its final duplicate check through
provider completion and ledger recording. A successful key is suppressed. A
provider failure may be retried. A `sending` attempt with no recorded outcome
returns `delivery-uncertain` and is not retried automatically. There is no
duplicate-bypass option.

Resend also receives `dfw-loop1-review-<notification-key>` as its
`Idempotency-Key`, providing a second safeguard during the provider's
idempotency window. The local successful-delivery ledger remains authoritative
after that window.

## Resend configuration

A real send requires:

```bash
export RESEND_API_KEY='...'
export DFW_REVIEW_EMAIL_FROM='Deep Field Works <review@verified-domain.example>'
export DFW_REVIEW_EMAIL_TO='editor@example.com'
```

The API key is never printed or stored in the ledger.

## Local validation

Run the fixture suite:

```bash
npm run notify:loop1-review:fixtures
```

Preview the committed synthetic payload:

```bash
SMOKE_LEDGER=/tmp/dfw-loop1-review-smoke/ledger.json

npm run notify:loop1-review -- \
  --review-packet scripts/fixtures/loop1-review-notification/review-packet.json \
  --ledger "$SMOKE_LEDGER"
```

The fixture includes a synthetic private marker in a non-summary section. The
preview must not contain that marker.

## Real-provider smoke test

Do not run this as routine automation. Configure a real Resend account and use
the committed synthetic packet, which contains no unpublished content:

```bash
SMOKE_LEDGER=/tmp/dfw-loop1-review-smoke/ledger.json

npm run notify:loop1-review -- \
  --review-packet scripts/fixtures/loop1-review-notification/review-packet.json \
  --ledger "$SMOKE_LEDGER" \
  --send

npm run notify:loop1-review -- \
  --review-packet scripts/fixtures/loop1-review-notification/review-packet.json \
  --ledger "$SMOKE_LEDGER" \
  --send
```

The first send should return `sent` with a Resend message ID. The second should
return `duplicate-suppressed` without a provider attempt. Confirm delivery in
the recipient mailbox and Resend dashboard, then inspect the local ledger for
one successful attempt and one delivery.

Use a new temporary ledger only when deliberately repeating the synthetic
smoke test. Do not delete or replace a production ledger to force a duplicate.
