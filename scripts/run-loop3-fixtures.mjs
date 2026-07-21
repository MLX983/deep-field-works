#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateDraftContent } from './loop3-constrained-draft.mjs';

const root = process.cwd();
const fixtureRoot = path.join(root, 'scripts/fixtures/loop3');
const runnerPath = path.join(root, 'scripts/loop3-constrained-draft.mjs');
const loop2RunnerPath = path.join(root, 'scripts/loop2-development-packet.mjs');
const loop4RunnerPath = path.join(root, 'scripts/loop4-editorial-evaluation.mjs');
const conceptualFixtureRoot = path.join(root, 'scripts/fixtures/loop2-adversarial');

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function developmentItem(content, role, evidencePosture = 'inference', provenance = 'source') {
  return { content, role, evidencePosture, provenance };
}

function draftBody(markdown) {
  return markdown.split('---').slice(2).join('---').trim();
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dfw-loop3-prototype-'));

try {
  const packet = JSON.parse(
    await fs.readFile(
      path.join(fixtureRoot, 'packet-ready-prototype-note.json'),
      'utf8',
    ),
  );
  const run = await runNode([
    runnerPath,
    '--packet',
    path.join(fixtureRoot, 'packet-ready-prototype-note.json'),
    '--issue',
    path.join(fixtureRoot, 'issue-ready-prototype-note.md'),
    '--recommendation',
    path.join(fixtureRoot, 'recommendation-ready-prototype-note.json'),
    '--out-dir',
    tempRoot,
  ]);
  assert.equal(run.code, 0, run.stderr || run.stdout);

  const draft = await fs.readFile(
    path.join(tempRoot, 'loop3-9601-draft.md'),
    'utf8',
  );
  const report = JSON.parse(
    await fs.readFile(
      path.join(tempRoot, 'loop3-9601-draft-report.json'),
      'utf8',
    ),
  );

  const requiredHeadings = [
    '# Visible review boundary',
    '## The design problem',
    '## The interaction choice',
    '## How the control surface is grouped',
    '### Needs review',
    '### Already resolved',
    '## Why it matters',
    '## Current state',
    '## Remaining questions',
  ];
  for (const heading of requiredHeadings) {
    assert.ok(draft.includes(heading), `Missing prototype heading: ${heading}`);
  }
  assert.match(draft, /documentType: prototype-note/);
  assert.equal(report.artifactType, 'prototype-note');
  assert.equal(report.validationStatus, 'passed');

  const grounding = [
    packet.prototypeNote.designProblem,
    packet.prototypeNote.interactionChoice,
    ...packet.prototypeNote.interactionGroups.flatMap((group) => group.items),
    ...packet.prototypeNote.designPrinciples,
    packet.prototypeNote.currentState,
  ];
  for (const sourceText of grounding) {
    assert.ok(
      draft.includes(sourceText),
      `Draft did not preserve prototype grounding: ${sourceText}`,
    );
  }
  console.log(
    'PASS ready-prototype-note: required structure and source grounding preserved',
  );

  const legacyPacket = { ...JSON.parse(
    await fs.readFile(path.join(fixtureRoot, 'packet-ready-note.json'), 'utf8'),
  ) };
  delete legacyPacket.developmentMaterial;
  const legacyPacketPath = path.join(tempRoot, 'legacy-ready-note.json');
  await fs.writeFile(legacyPacketPath, `${JSON.stringify(legacyPacket, null, 2)}\n`);
  const legacyRun = await runNode([
    runnerPath,
    '--packet', legacyPacketPath,
    '--issue', path.join(fixtureRoot, 'issue-ready-note.md'),
    '--recommendation', path.join(fixtureRoot, 'recommendation-ready-note.json'),
    '--out-dir', path.join(tempRoot, 'legacy-ready'),
  ]);
  assert.equal(legacyRun.code, 2, legacyRun.stderr || legacyRun.stdout);
  assert.match(legacyRun.stdout, /lacks sufficient approved developmentMaterial/);
  const legacyOutputs = await fs.readdir(path.join(tempRoot, 'legacy-ready'));
  assert.equal(legacyOutputs.some((name) => name.endsWith('-draft.md')), false);
  console.log('PASS legacy-ready-note: missing development material is conservatively blocked');

  const baseNotePacket = JSON.parse(
    await fs.readFile(path.join(fixtureRoot, 'packet-ready-note.json'), 'utf8'),
  );
  async function runNoteCase(name, centralTension, developmentMaterial) {
    const caseDir = path.join(tempRoot, name);
    const packetPath = path.join(tempRoot, `${name}-packet.json`);
    await fs.writeFile(
      packetPath,
      `${JSON.stringify({ ...baseNotePacket, centralTension, developmentMaterial }, null, 2)}\n`,
    );
    const caseRun = await runNode([
      runnerPath,
      '--packet', packetPath,
      '--issue', path.join(fixtureRoot, 'issue-ready-note.md'),
      '--recommendation', path.join(fixtureRoot, 'recommendation-ready-note.json'),
      '--out-dir', caseDir,
    ]);
    assert.equal(caseRun.code, 0, `${name}: ${caseRun.stderr || caseRun.stdout}`);
    return {
      packet: JSON.parse(await fs.readFile(packetPath, 'utf8')),
      draft: await fs.readFile(path.join(caseDir, 'loop3-9201-draft.md'), 'utf8'),
      report: JSON.parse(
        await fs.readFile(path.join(caseDir, 'loop3-9201-draft-report.json'), 'utf8'),
      ),
    };
  }

  const straightGrounding = 'A clear "decision boundary" keeps delegated work tied to accountable judgment.';
  const straightCase = await runNoteCase(
    'approved-straight-quotation',
    straightGrounding,
    [
      developmentItem(straightGrounding, 'distinction'),
      developmentItem('Unexpected outcomes require an explicit return to authority review.', 'mechanism'),
      developmentItem('Which boundary should a team inspect first?', 'question'),
    ],
  );
  assert.match(straightCase.draft, /"decision boundary"/);
  assert.ok(straightCase.report.claimsUsed.includes(straightGrounding));
  const spacedQuotationDraft = straightCase.draft.replace(
    '"decision boundary"',
    '"decision   boundary"',
  );
  assert.equal(
    validateDraftContent(spacedQuotationDraft, straightCase.packet).errors.length,
    0,
    'Whitespace normalization must not change quotation authorization',
  );
  console.log('PASS approved-straight-quotation: packet-grounded quotation accepted');

  const curlyGrounding = 'A manager can distinguish “normal drift” from “meaningful risk” before delegating escalation.';
  const curlyCase = await runNoteCase(
    'approved-curly-quotation',
    curlyGrounding,
    [
      developmentItem(curlyGrounding, 'distinction'),
      developmentItem('Articulated thresholds make the review boundary inspectable.', 'mechanism'),
      developmentItem('How should that threshold remain visible?', 'question'),
    ],
  );
  assert.match(curlyCase.draft, /“normal drift”/);
  assert.ok(curlyCase.report.claimsUsed.includes(curlyGrounding));
  const straightenedCurlyDraft = curlyCase.draft
    .replace(/“normal drift”/g, '"normal drift"')
    .replace(/“meaningful risk”/g, '"meaningful risk"');
  assert.equal(
    validateDraftContent(straightenedCurlyDraft, curlyCase.packet).errors.length,
    0,
    'Equivalent straight and curly quote styles must compare identically',
  );
  console.log('PASS approved-curly-quotation: normalized quote style accepted');

  const unapprovedDraft = straightCase.draft.replace(
    '## Open question',
    'A reviewer called the result "unexpected authority".\n\n## Open question',
  );
  const unapprovedValidation = validateDraftContent(unapprovedDraft, straightCase.packet);
  assert.ok(unapprovedValidation.errors.some((error) =>
    error.includes('quotation not present in approved packet grounding: "unexpected authority"')));
  assert.equal(
    unapprovedValidation.errors.some((error) => error.includes('"decision boundary"')),
    false,
  );
  console.log('PASS unapproved-quotation: offending span identified');

  const partialOverlapDraft = straightCase.draft.replace(
    '## Open question',
    'The separate approved words do not authorize "authority unexpected".\n\n## Open question',
  );
  const partialOverlapValidation = validateDraftContent(partialOverlapDraft, straightCase.packet);
  assert.ok(partialOverlapValidation.errors.some((error) =>
    error.includes('quotation not present in approved packet grounding: "authority unexpected"')));
  console.log('PASS partial-word-overlap: separate words do not authorize a quoted span');

  const relatedOnlyDraft = straightCase.draft.replace(
    '## Open question',
    'Related context called this "related-only phrase".\n\n## Open question',
  );
  const relatedOnlyValidation = validateDraftContent(
    relatedOnlyDraft,
    {
      ...straightCase.packet,
      relatedMaterial: [{ reference: 'related-item', note: 'Uses "related-only phrase".' }],
    },
    ['A related file also uses "related-only phrase".'],
  );
  assert.ok(relatedOnlyValidation.errors.some((error) =>
    error.includes('quotation not present in approved packet grounding: "related-only phrase"')));
  console.log('PASS related-only-quotation: related material does not expand quote authorization');

  const sharedTension = 'Shared context makes the boundary between assistance and authority visible.';
  const duplicateCase = await runNoteCase(
    'duplicate-opening-section',
    sharedTension,
    [
      developmentItem(sharedTension.replace(/\.$/, '!'), 'distinction'),
      developmentItem('Articulated judgment explains why the same tool can produce different leverage.', 'mechanism'),
      developmentItem('Which context should remain inspectable?', 'question'),
    ],
  );
  assert.equal(draftBody(duplicateCase.draft).split(sharedTension).length - 1, 1);
  assert.match(duplicateCase.draft, /Articulated judgment explains/);
  assert.match(duplicateCase.draft, /## Why it may matter/);
  console.log('PASS duplicate-opening-section: distinct approved opening selected');

  const noAlternateCase = await runNoteCase(
    'no-alternate-section-material',
    sharedTension,
    [
      developmentItem(sharedTension, 'distinction'),
      developmentItem('For example, a team can expose the action that returns to review.', 'example'),
      developmentItem('Which context should remain inspectable?', 'question'),
    ],
  );
  assert.equal(draftBody(noAlternateCase.draft).split(sharedTension).length - 1, 1);
  assert.doesNotMatch(noAlternateCase.draft, /## Why it may matter/);
  console.log('PASS no-alternate-section-material: redundant section omitted');

  const mixedRationale = 'Context quality shapes unequal leverage, so a bounded standalone note is appropriate.';
  const mixedRationaleCase = await runNoteCase(
    'mixed-editorial-rationale',
    mixedRationale,
    [
      developmentItem(mixedRationale, 'distinction', 'inference', 'reviewed-recommendation'),
      developmentItem('Articulated judgment turns context into usable direction.', 'mechanism'),
      developmentItem('A manager can supply constraints before asking for a plan.', 'example'),
      developmentItem('Which forms of context remain durable?', 'question'),
    ],
  );
  assert.match(mixedRationaleCase.draft, /Context quality shapes unequal leverage/);
  assert.doesNotMatch(mixedRationaleCase.draft, /bounded standalone note is appropriate/);
  assert.ok(mixedRationaleCase.report.editorialWorkflowNotesOmitted.some((item) =>
    /bounded standalone note is appropriate/.test(item)));
  assert.ok(mixedRationaleCase.report.claimsUsed.includes(mixedRationale));
  console.log('PASS mixed-editorial-rationale: conceptual clause retained, process clause omitted');

  const pureEditorialRationale = 'Related DFW material supports a bounded standalone note that is appropriate for development.';
  const pureEditorialCase = await runNoteCase(
    'pure-editorial-rationale',
    pureEditorialRationale,
    [
      developmentItem(
        pureEditorialRationale,
        'distinction',
        'inference',
        'reviewed-recommendation',
      ),
      developmentItem('Context quality changes what the same assistant can do.', 'mechanism'),
      developmentItem('Articulated judgment makes constraints usable.', 'distinction'),
      developmentItem('Which context should remain inspectable?', 'question'),
    ],
  );
  assert.doesNotMatch(pureEditorialCase.draft, /Related DFW material|bounded standalone note/);
  assert.ok(pureEditorialCase.report.editorialWorkflowNotesOmitted.includes(
    pureEditorialRationale,
  ));
  assert.equal(pureEditorialCase.report.claimsUsed.includes(pureEditorialRationale), false);
  console.log('PASS pure-editorial-rationale: process rationale remains workflow metadata');

  const conceptualIssue = path.join(conceptualFixtureRoot, 'issue-developed-conceptual-note.md');
  const conceptualRecommendation = path.join(
    conceptualFixtureRoot,
    'recommendation-developed-conceptual-note.json',
  );
  const conceptualLoop2 = path.join(tempRoot, 'conceptual-loop2');
  const conceptualLoop3 = path.join(tempRoot, 'conceptual-loop3');
  const conceptualLoop4 = path.join(tempRoot, 'conceptual-loop4');
  const loop2Run = await runNode([
    loop2RunnerPath,
    '--issue', conceptualIssue,
    '--recommendation', conceptualRecommendation,
    '--out-dir', conceptualLoop2,
  ]);
  assert.equal(loop2Run.code, 0, loop2Run.stderr || loop2Run.stdout);
  const conceptualPacketPath = path.join(conceptualLoop2, 'loop2-9115-packet.json');
  const conceptualPacket = JSON.parse(await fs.readFile(conceptualPacketPath, 'utf8'));
  assert.equal(conceptualPacket.draftReadiness, 'ready');
  assert.deepEqual(conceptualPacket.verifiedObservations, []);
  assert.ok(conceptualPacket.developmentMaterial.length >= 6);

  const loop3Run = await runNode([
    runnerPath,
    '--packet', conceptualPacketPath,
    '--issue', conceptualIssue,
    '--recommendation', conceptualRecommendation,
    '--out-dir', conceptualLoop3,
  ]);
  assert.equal(loop3Run.code, 0, loop3Run.stderr || loop3Run.stdout);
  const conceptualDraftPath = path.join(conceptualLoop3, 'loop3-9115-draft.md');
  const conceptualReportPath = path.join(conceptualLoop3, 'loop3-9115-draft-report.json');
  const conceptualDraft = await fs.readFile(conceptualDraftPath, 'utf8');
  const conceptualReport = JSON.parse(await fs.readFile(conceptualReportPath, 'utf8'));
  assert.match(conceptualDraft, /context quality and articulated judgment/i);
  assert.match(conceptualDraft, /For example, two managers/);
  assert.match(conceptualDraft, /Provisional hypothesis \(speculation, not verified\)/);
  assert.doesNotMatch(conceptualDraft, /Keep this as a provisional lens/);
  assert.ok(conceptualReport.claimsUsed.length > 0);
  assert.ok(conceptualReport.editorialWorkflowNotesOmitted.includes(
    'Keep this as a provisional lens, not an observed hierarchy.',
  ));
  assert.equal(conceptualReport.warnings.some((item) => /scaffold/i.test(item)), false);

  const loop4Run = await runNode([
    loop4RunnerPath,
    '--packet', conceptualPacketPath,
    '--draft', conceptualDraftPath,
    '--draft-report', conceptualReportPath,
    '--out-dir', conceptualLoop4,
  ]);
  assert.equal(loop4Run.code, 0, loop4Run.stderr || loop4Run.stdout);
  const conceptualEvaluation = JSON.parse(await fs.readFile(
    path.join(conceptualLoop4, 'loop4-9115-evaluation.json'),
    'utf8',
  ));
  assert.equal(conceptualEvaluation.verdict, 'REVISE');
  assert.equal(conceptualEvaluation.revisionInstructions.some((item) =>
    /Open question/.test(item)), false);
  console.log('PASS developed-conceptual-note: production Loop 2 → Loop 3 → Loop 4 path');
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
