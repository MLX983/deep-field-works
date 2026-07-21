#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
