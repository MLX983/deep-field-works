#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const fixtureRoot = path.join(root, 'scripts/fixtures/loop3');
const runnerPath = path.join(root, 'scripts/loop3-constrained-draft.mjs');

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
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
