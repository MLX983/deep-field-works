import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createApprovalPackage, verifyApprovalPackage } from './approval-package.mjs';

function fixture() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dfw-approval-test-'));
  const sourceRunId = 'editorial-v0.3-fixture-run';
  const run = path.join(workspace, 'runs', sourceRunId);
  fs.mkdirSync(run, { recursive: true });
  const sourceBody = 'Synthetic intake source.';
  const sourceBodySha256 = crypto.createHash('sha256').update(sourceBody).digest('hex');
  fs.writeFileSync(path.join(run, 'manifest.json'), JSON.stringify({ runId: sourceRunId, status: 'awaiting-human-editorial-review', approvalGranted: false, sourceBodySha256 }));
  fs.writeFileSync(path.join(run, 'source.json'), JSON.stringify({ number: 91, url: 'https://github.com/MLX983/dfw-intake/issues/91', body: sourceBody }));
  fs.writeFileSync(path.join(run, 'result.json'), JSON.stringify({ proposedArtifact: { workingTitle: 'Current model title' } }));
  fs.writeFileSync(path.join(run, 'draft.md'), '# Current model title\n\nApproved public prose.\n');
  fs.writeFileSync(path.join(run, 'context.json'), JSON.stringify({ privateSecret: 'NEVER_PACKAGE_THIS_CONTEXT' }));
  fs.writeFileSync(path.join(run, 'research.json'), JSON.stringify({ privateSecret: 'NEVER_PACKAGE_THIS_RESEARCH' }));
  fs.writeFileSync(path.join(run, 'coalescence-signals.json'), JSON.stringify({ privateSecret: 'NEVER_PACKAGE_THIS_SYNTHESIS' }));
  fs.mkdirSync(path.join(workspace, 'scratchpad'));
  fs.writeFileSync(path.join(workspace, 'scratchpad', `${sourceRunId}.json`), JSON.stringify({ privateSecret: 'NEVER_PACKAGE_THIS_SCRATCHPAD' }));
  return { workspace, sourceRunId };
}

const approval = fixture => ({
  ...fixture,
  editorialArtifactId: 'visible-recovery',
  documentType: 'note',
  approvedBy: 'Fixture Human',
  approvalMarker: 'editorial-approved',
  approvedAt: '2026-09-17T12:00:00.000Z',
});

test('explicit current-draft approval creates a valid immutable private package', () => {
  const f = fixture();
  const created = createApprovalPackage({ ...approval(f), approveCurrentDraft: true });
  assert.equal(created.package.revision, 1);
  assert.equal(created.package.editorialApprovalGranted, true);
  assert.equal(created.package.approvedArtifact.title, 'Current model title');
  assert.equal(created.package.approvedArtifact.body, '# Current model title\n\nApproved public prose.\n');
  assert.deepEqual(verifyApprovalPackage(JSON.parse(fs.readFileSync(created.path))), created.package);
  assert.equal(fs.statSync(created.path).mode & 0o777, 0o400);
});

test('one source run supports multiple artifacts and append-only revisions', () => {
  const f = fixture();
  const first = createApprovalPackage({ ...approval(f), title: 'First title', body: 'First approved body.' });
  const firstBytes = fs.readFileSync(first.path, 'utf8');
  const secondArtifact = createApprovalPackage({ ...approval(f), editorialArtifactId: 'model-failover', title: 'Second title', body: 'Second approved body.' });
  const revision = createApprovalPackage({ ...approval(f), title: 'First title', body: 'First approved body.' });
  assert.equal(first.package.revision, 1);
  assert.equal(secondArtifact.package.revision, 1);
  assert.equal(revision.package.revision, 2);
  assert.equal(first.package.sourceProvenance.sourceIntakeId, secondArtifact.package.sourceProvenance.sourceIntakeId);
  assert.equal(first.package.fingerprints.contentSha256, revision.package.fingerprints.contentSha256);
  assert.notEqual(first.package.fingerprints.packageSha256, revision.package.fingerprints.packageSha256);
  assert.equal(fs.readFileSync(first.path, 'utf8'), firstBytes);
});

test('edited approval is authoritative and content changes alter its fingerprint', () => {
  const f = fixture();
  const original = createApprovalPackage({ ...approval(f), title: 'Human title', body: 'Human edited body.' });
  const changed = createApprovalPackage({ ...approval(f), title: 'Human title', body: 'Human edited body with a correction.' });
  assert.equal(original.package.approvedArtifact.title, 'Human title');
  assert.equal(original.package.approvedArtifact.body, 'Human edited body.');
  assert.notEqual(original.package.fingerprints.contentSha256, changed.package.fingerprints.contentSha256);
  assert.throws(() => createApprovalPackage({ ...approval(f), title: 'Only a title' }));
  assert.throws(() => createApprovalPackage({ ...approval(f), approveCurrentDraft: true, title: 'Silent substitution' }));
});

test('approval packages include only explicitly approved publication inputs', () => {
  const f = fixture();
  const created = createApprovalPackage({
    ...approval(f),
    title: 'Approved title', body: 'Approved body.',
    externalReferences: [{ url: 'https://example.test/source', title: 'Public source' }],
    relatedDfwConnections: [{ reference: 'src/content/articles/related.md', note: 'Explicit relationship' }],
  });
  const serialized = JSON.stringify(created.package);
  for (const secret of ['NEVER_PACKAGE_THIS_CONTEXT','NEVER_PACKAGE_THIS_RESEARCH','NEVER_PACKAGE_THIS_SCRATCHPAD','NEVER_PACKAGE_THIS_SYNTHESIS']) assert.doesNotMatch(serialized, new RegExp(secret));
  for (const forbidden of ['context','scratchpad','researchNotes','prompts','tokenDiagnostics','selectionDiagnostics','discoveredBranches','designPrototypeConnections','domain','theme']) assert.ok(!Object.hasOwn(created.package, forbidden));
  assert.deepEqual(created.package.approvedArtifact.externalReferences, [{ url: 'https://example.test/source', title: 'Public source' }]);
  assert.deepEqual(created.package.approvedArtifact.relatedDfwConnections, [{ reference: 'src/content/articles/related.md', note: 'Explicit relationship' }]);
});

test('tampering and invalid approval inputs fail visibly', () => {
  const f = fixture();
  const created = createApprovalPackage({ ...approval(f), title: 'Approved title', body: 'Approved body.' });
  const tampered = structuredClone(created.package);
  tampered.approvedArtifact.body = 'Changed later.';
  assert.throws(() => verifyApprovalPackage(tampered), /fingerprint mismatch/);
  assert.throws(() => createApprovalPackage({ ...approval(f), documentType: 'article', title: 'x', body: 'y' }));
  assert.throws(() => createApprovalPackage({ ...approval(f), approvedBy: '', title: 'x', body: 'y' }));
});

test('approval creation rejects source fingerprint changes and output symlink escapes', () => {
  const changed = fixture();
  const sourcePath = path.join(changed.workspace, 'runs', changed.sourceRunId, 'source.json');
  fs.writeFileSync(sourcePath, JSON.stringify({ number: 91, url: 'https://github.com/MLX983/dfw-intake/issues/91', body: 'Changed source.' }));
  assert.throws(() => createApprovalPackage({ ...approval(changed), title: 'x', body: 'y' }), /source fingerprint/);

  const escaped = fixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'dfw-approval-outside-'));
  fs.symlinkSync(outside, path.join(escaped.workspace, 'approvals'));
  assert.throws(() => createApprovalPackage({ ...approval(escaped), title: 'x', body: 'y' }), /output root escapes/);
  assert.deepEqual(fs.readdirSync(outside), []);
});
