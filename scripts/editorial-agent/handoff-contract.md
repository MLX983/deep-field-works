# Editorial approval and future publishing handoff

This boundary is implemented only through human editorial approval. It does not
connect the Editorial Agent to the bounded publishing processor, invoke Loop 1 or
Loop 2, change canonical content, or authorize publication.

## Separate authorities

The Editorial Agent may retrieve approved context, research, develop a seed,
draft prose, and propose branches or design/system connections. It stops at
`awaiting-human-editorial-review` with `approvalGranted: false`. It may not
approve or publish.

The human editorial reviewer may edit, approve, reject, or preserve a draft. The
reviewer may split one seed into multiple editorial artifacts, decide that it
produces none, and create the authoritative `EditorialApprovalPackage` for each
approved artifact. Approval is an explicit operator command, never an inference
from model output or silence.

A future publishing operator may transform a verified package into canonical
publication artifacts. It may verify integrity, create the canonical file and
frontmatter, classify domain/theme when needed, attach approved provenance,
create or update a presentation plan, render a review page, run schema/build
validation, and prepare a publication commit. It may not materially rewrite the
approved title or body. An editorial change returns to human editorial review
and produces a new package revision.

Final human publication approval is a separate authority that permits public
release. Editorial approval alone does not.

## EditorialApprovalPackage

The implemented schema is `editorial-approval-package.v1`. Each package contains:

- package schema/version and package ID;
- stable editorial artifact ID and append-only revision number;
- intake repository, issue, URL and source-body fingerprint;
- source Editorial Agent run ID;
- approved artifact type, title and reader-facing body;
- explicitly approved external references and DFW connections;
- human approval identity, marker and timestamp;
- deterministic content and package fingerprints;
- `editorialApprovalGranted: true`.

Domain and theme are excluded to keep the editorial authority surface small.
They remain future publishing-classification responsibilities. A single intake
ID or Editorial Agent run can appear in multiple packages with different
editorial artifact IDs. Each artifact has its own independent revision history.

The content fingerprint binds deterministic JSON for document type, title, body,
approved external references and approved DFW connections. Reference and
connection sets are normalized, deduplicated and sorted. Revision, timestamps,
reviewer data and filesystem paths do not participate, so identical approved
content retains the same content fingerprint. The package fingerprint binds the
remaining immutable record, including source and approval metadata and revision.

Packages do not automatically contain AI Adoption KB excerpts or terminology,
scratchpad entries, research notes/pages, unused context, prompts, reasoning,
negative exemplars, unapproved branches or design/system connections, or token
and selection diagnostics. The preserved source run supplies private audit
provenance without making those materials future publication inputs.

## Creation and immutability

`npm run editorial:approve -- ...` requires a completed, still-unapproved source
run, stable artifact ID, artifact type, approval identity and marker. The human
must either pass `--approve-current-draft` or supply both a final `--title` and
`--body-file`. Optional approved reference/relationship lists are explicit JSON
inputs. Earlier package files use exclusive creation and are never overwritten.
They are made owner-read-only after creation. Later approval for the same artifact increments its revision and changes its
package fingerprint; changed approved content also changes its content
fingerprint.

## Future publishing input

A future publishing integration should treat a verified package as authoritative
editorial input. It should fail closed for an unknown schema, fingerprint
mismatch, missing explicit approval, or mutated package. Its work should be
limited to publication construction and validation. It should stop for final
human publication approval before release.

The existing publishing implementation still requires its current Loop 1 review
and later workflow records. This change does not adapt, simplify, bypass, or
replace those requirements. Whether `EditorialApprovalPackage` eventually
replaces part of Loop 1 remains a later architecture decision after the package
boundary has been evaluated.
