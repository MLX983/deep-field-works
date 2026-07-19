#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const root = process.cwd();
const fixtureRoot = path.join(root, 'scripts/fixtures/loop3');
const readinessFixtureRoot = path.join(
  root,
  'scripts/fixtures/loop2-readiness',
);
const adversarialFixtureRoot = path.join(
  root,
  'scripts/fixtures/loop2-adversarial',
);
const schemaPath = path.join(
  root,
  'docs/contracts/loop2-development-packet.v1.schema.json',
);
const runnerPath = path.join(root, 'scripts/loop2-development-packet.mjs');

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

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dfw-loop2-prototype-'));

try {
  const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
  const expectedPacket = JSON.parse(
    await fs.readFile(
      path.join(fixtureRoot, 'packet-ready-prototype-note.json'),
      'utf8',
    ),
  );
  const recommendation = JSON.parse(
    await fs.readFile(
      path.join(fixtureRoot, 'recommendation-ready-prototype-note.json'),
      'utf8',
    ),
  );
  const reviewFlagCases = JSON.parse(
    await fs.readFile(
      path.join(readinessFixtureRoot, 'review-flag-cases.json'),
      'utf8',
    ),
  );

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  assert.equal(
    validate(expectedPacket),
    true,
    `Tracked prototype packet fixture must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
  );

  const validOut = path.join(tempRoot, 'valid');
  const validRun = await runNode([
    runnerPath,
    '--issue',
    path.join(fixtureRoot, 'issue-ready-prototype-note.md'),
    '--recommendation',
    path.join(fixtureRoot, 'recommendation-ready-prototype-note.json'),
    '--out-dir',
    validOut,
  ]);
  assert.equal(validRun.code, 0, validRun.stderr || validRun.stdout);

  const generatedPacketPath = path.join(validOut, 'loop2-9601-packet.json');
  const generatedPacket = JSON.parse(
    await fs.readFile(generatedPacketPath, 'utf8'),
  );
  assert.equal(
    validate(generatedPacket),
    true,
    `Generated prototype packet must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
  );
  assert.equal(generatedPacket.approvedArtifactType, 'prototype-note');
  assert.deepEqual(generatedPacket.prototypeNote, expectedPacket.prototypeNote);
  await fs.access(path.join(validOut, 'loop2-9601-summary.md'));
  console.log('PASS valid-prototype-note: generated packet is schema-valid');

  for (const [expectedReadiness, expectedCode, cases] of [
    ['ready', 0, reviewFlagCases.nonBlocking],
    ['research-required', 2, reviewFlagCases.blocking],
  ]) {
    for (const fixture of cases) {
      const caseRecommendationPath = path.join(
        tempRoot,
        `recommendation-${fixture.name}.json`,
      );
      await fs.writeFile(
        caseRecommendationPath,
        `${JSON.stringify({
          ...recommendation,
          uncertaintyOrReviewFlag: fixture.flag,
        }, null, 2)}\n`,
      );

      const caseOut = path.join(tempRoot, `review-flag-${fixture.name}`);
      const caseRun = await runNode([
        runnerPath,
        '--issue',
        path.join(fixtureRoot, 'issue-ready-prototype-note.md'),
        '--recommendation',
        caseRecommendationPath,
        '--out-dir',
        caseOut,
      ]);
      assert.equal(
        caseRun.code,
        expectedCode,
        `${fixture.name}: ${caseRun.stderr || caseRun.stdout}`,
      );

      const casePacket = JSON.parse(
        await fs.readFile(path.join(caseOut, 'loop2-9601-packet.json'), 'utf8'),
      );
      assert.equal(
        validate(casePacket),
        true,
        `${fixture.name}: packet must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
      );
      assert.equal(casePacket.draftReadiness, expectedReadiness, fixture.name);
      assert.equal(
        casePacket.prototypeNote.currentState,
        expectedPacket.prototypeNote.currentState,
        `${fixture.name}: current-state grounding must be preserved`,
      );
      await fs.access(path.join(caseOut, 'loop2-9601-summary.md'));
      console.log(
        `PASS review-flag-${fixture.name}: ${expectedReadiness}`,
      );
    }
  }

  const missingRecommendationPath = path.join(
    tempRoot,
    'recommendation-missing-grounding.json',
  );
  await fs.writeFile(
    missingRecommendationPath,
    `${JSON.stringify({ ...recommendation, issueNumber: 9602 }, null, 2)}\n`,
  );
  const invalidOut = path.join(tempRoot, 'invalid');
  const invalidRun = await runNode([
    runnerPath,
    '--issue',
    path.join(fixtureRoot, 'issue-missing-prototype-grounding.md'),
    '--recommendation',
    missingRecommendationPath,
    '--out-dir',
    invalidOut,
  ]);
  assert.equal(invalidRun.code, 1, invalidRun.stderr || invalidRun.stdout);
  assert.match(invalidRun.stderr, /interactionGroups/);
  assert.match(invalidRun.stderr, /currentState/);

  const invalidFiles = await fs.readdir(invalidOut).catch(() => []);
  assert.deepEqual(
    invalidFiles,
    [],
    'Incomplete grounding must write no packet or summary',
  );
  console.log(
    'PASS missing-prototype-grounding: named all missing fields and wrote no output',
  );

  const nonPrototypeCases = [
    {
      name: 'ready-note',
      issue: 'issue-ready-note.md',
      recommendation: 'recommendation-ready-note.json',
      issueNumber: 9103,
      expectedCode: 0,
      expectedReadiness: 'ready',
    },
    {
      name: 'thin-body',
      issue: 'issue-thin-body.md',
      recommendation: 'recommendation-thin-body.json',
      issueNumber: 9101,
      expectedCode: 2,
      expectedReadiness: 'insufficient-material',
    },
    {
      name: 'unverified-external',
      issue: 'issue-unverified-external.md',
      recommendation: 'recommendation-unverified-external.json',
      issueNumber: 9102,
      expectedCode: 2,
      expectedReadiness: 'research-required',
    },
  ];

  for (const fixture of nonPrototypeCases) {
    const caseOut = path.join(tempRoot, `non-prototype-${fixture.name}`);
    const caseRun = await runNode([
      runnerPath,
      '--issue',
      path.join(adversarialFixtureRoot, fixture.issue),
      '--recommendation',
      path.join(adversarialFixtureRoot, fixture.recommendation),
      '--out-dir',
      caseOut,
    ]);
    assert.equal(
      caseRun.code,
      fixture.expectedCode,
      `${fixture.name}: ${caseRun.stderr || caseRun.stdout}`,
    );

    const casePacket = JSON.parse(
      await fs.readFile(
        path.join(caseOut, `loop2-${fixture.issueNumber}-packet.json`),
        'utf8',
      ),
    );
    assert.equal(
      casePacket.draftReadiness,
      fixture.expectedReadiness,
      fixture.name,
    );
    console.log(
      `PASS non-prototype-${fixture.name}: ${fixture.expectedReadiness}`,
    );
  }
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
