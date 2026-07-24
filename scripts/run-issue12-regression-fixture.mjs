#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const fixtureRoot = path.join(root, 'scripts/fixtures/issue12-regression');
const issuePath = path.join(fixtureRoot, 'issue-9812-mental-model-layers.md');
const recommendationPath = path.join(fixtureRoot, 'recommendation-9812.json');
const base = process.argv[2] || await fs.mkdtemp(
  '/tmp/dfw-issue12-regression-',
);

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

async function runCase(name) {
  const caseRoot = path.join(base, name);
  const packetDir = path.join(caseRoot, 'loop2');
  const orchestrationDir = path.join(caseRoot, 'orchestration');
  const packetRun = await runNode([
    path.join(root, 'scripts/loop2-development-packet.mjs'),
    '--issue', issuePath,
    '--recommendation', recommendationPath,
    '--out-dir', packetDir,
  ]);
  assert.equal(packetRun.code, 0, packetRun.stderr || packetRun.stdout);
  const packetPath = path.join(packetDir, 'loop2-9812-packet.json');
  const packet = JSON.parse(await fs.readFile(packetPath, 'utf8'));
  const orchestrationRun = await runNode([
    path.join(root, 'scripts/orchestrate-loops-3-5.mjs'),
    '--packet', packetPath,
    '--issue', issuePath,
    '--recommendation', recommendationPath,
    '--out-root', orchestrationDir,
  ]);
  assert.equal(orchestrationRun.code, 0, orchestrationRun.stderr || orchestrationRun.stdout);
  const draftPath = path.join(orchestrationDir, 'loop3', 'loop3-9812-draft.md');
  const evaluationPath = path.join(orchestrationDir, 'loop4', 'loop4-9812-evaluation.json');
  const manifestPath = path.join(orchestrationDir, 'loop3-5-9812-manifest.json');
  const draft = await fs.readFile(draftPath, 'utf8');
  const evaluation = JSON.parse(await fs.readFile(evaluationPath, 'utf8'));
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  let revision = null;
  const revisionCandidates = [
    path.join(orchestrationDir, 'loop5', 'loop5-9812-revision-report.json'),
    path.join(orchestrationDir, 'loop5', 'failed', 'loop5-9812-revision-report.json'),
  ];
  for (const candidate of revisionCandidates) {
    try {
      revision = JSON.parse(await fs.readFile(candidate, 'utf8'));
      break;
    } catch {}
  }
  return { packet, draft, evaluation, manifest, revision };
}

await fs.mkdir(base, { recursive: true });
const sourceFixture = await fs.readFile(issuePath, 'utf8');
const noQuestionIssuePath = path.join(base, 'issue-9813-no-supported-question.md');
const noQuestionRecommendationPath = path.join(base, 'recommendation-9813.json');
await fs.writeFile(
  noQuestionIssuePath,
  sourceFixture
    .replaceAll('9812', '9813')
    .replace(
      '\nThe open question is whether people can hold these layers apart while still using the conversational surface naturally.\n',
      '\nThe source stops at the distinction and does not supply a further inquiry.\n',
    ),
);
const baseRecommendation = JSON.parse(await fs.readFile(recommendationPath, 'utf8'));
await fs.writeFile(
  noQuestionRecommendationPath,
  `${JSON.stringify({
    ...baseRecommendation,
    issueNumber: 9813,
    nextAction: 'Draft a bounded note from the source material.',
  }, null, 2)}\n`,
);
const noQuestionOut = path.join(base, 'no-supported-question');
const noQuestionRun = await runNode([
  path.join(root, 'scripts/loop2-development-packet.mjs'),
  '--issue', noQuestionIssuePath,
  '--recommendation', noQuestionRecommendationPath,
  '--out-dir', noQuestionOut,
]);
assert.equal(noQuestionRun.code, 0, noQuestionRun.stderr || noQuestionRun.stdout);
const noQuestionPacket = JSON.parse(
  await fs.readFile(path.join(noQuestionOut, 'loop2-9813-packet.json'), 'utf8'),
);
assert.equal(noQuestionPacket.readerQuestion, '');
assert.doesNotMatch(
  JSON.stringify(noQuestionPacket),
  /What should a reader understand about.*within Cognitive Infrastructure/i,
);
const noQuestionDraftOut = path.join(base, 'no-supported-question-draft');
const noQuestionDraftRun = await runNode([
  path.join(root, 'scripts/loop3-constrained-draft.mjs'),
  '--packet', path.join(noQuestionOut, 'loop2-9813-packet.json'),
  '--issue', noQuestionIssuePath,
  '--recommendation', noQuestionRecommendationPath,
  '--out-dir', noQuestionDraftOut,
]);
assert.equal(
  noQuestionDraftRun.code,
  0,
  noQuestionDraftRun.stderr || noQuestionDraftRun.stdout,
);
const noQuestionDraft = await fs.readFile(
  path.join(noQuestionDraftOut, 'loop3-9813-draft.md'),
  'utf8',
);
assert.doesNotMatch(noQuestionDraft, /^## Open question$/m);
assert.doesNotMatch(
  noQuestionDraft,
  /What should a reader understand about.*within Cognitive Infrastructure/i,
);

const [first, parallel] = await Promise.all([
  runCase('first'),
  runCase('parallel'),
]);
const repeated = await runCase('repeated');

for (const result of [first, parallel, repeated]) {
  const serializedMaterial = JSON.stringify(result.packet.developmentMaterial);
  assert.equal(result.packet.draftReadiness, 'ready');
  assert.doesNotMatch(serializedMaterial, /legacy-intake-theme|Imported from an email seed|sender@example|pubDate|canonical: true/);
  assert.match(serializedMaterial, /literal phrase `documentType: note`/);
  assert.match(serializedMaterial, /People can use one conversational surface/);
  assert.equal(
    result.packet.readerQuestion,
    'The open question is whether people can hold these layers apart while still using the conversational surface naturally.',
  );
  assert.doesNotMatch(result.packet.readerQuestion, /What should a reader understand about/i);
  assert.doesNotMatch(result.draft, /legacy-intake-theme|Imported from an email seed|sender@example|pubDate|canonical: true/);
  assert.doesNotMatch(result.draft, /tool-specific skill|durable judgment skill|skill that decayed/i);
  assert.match(result.draft, /model, interface, workflow, context, and person or relationship layer/i);
  if (result.revision) {
    for (const request of result.revision.humanInputRequests) {
      assert.match(request, /Issue #9812/);
      assert.ok(
        result.evaluation.revisionInstructions.some((instruction) =>
          request.includes(instruction)),
        `Human-input request lacks active-evaluation grounding: ${request}`,
      );
    }
  }
}

assert.deepEqual(first.packet, parallel.packet);
assert.deepEqual(first.packet, repeated.packet);
assert.equal(first.draft, parallel.draft);
assert.equal(first.draft, repeated.draft);
assert.deepEqual(
  first.revision?.humanInputRequests ?? [],
  parallel.revision?.humanInputRequests ?? [],
);
assert.deepEqual(
  first.revision?.humanInputRequests ?? [],
  repeated.revision?.humanInputRequests ?? [],
);

console.log(`PASS issue-12-content-integrity-regression: ${base}`);
