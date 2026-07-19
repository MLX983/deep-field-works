#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { orchestrate } from './orchestrate-loops-3-5.mjs';
import { sha256Bytes, sha256File } from './lib/content-fingerprint.mjs';

const root = process.cwd();
const base = process.argv[2] || '/tmp/dfw-orchestration-fixtures';
const cases = JSON.parse(await fs.readFile(path.join(root, 'scripts/fixtures/orchestration/cases.json'), 'utf8'));
let failures = 0;

async function rewriteEvaluation(outRoot, updates, issueNumber = 9201) {
  const evaluationPath = path.join(outRoot, 'loop4', `loop4-${issueNumber}-evaluation.json`);
  const evaluation = JSON.parse(await fs.readFile(evaluationPath, 'utf8'));
  Object.assign(evaluation, updates);
  const bytes = Buffer.from(`${JSON.stringify(evaluation, null, 2)}\n`);
  await fs.writeFile(evaluationPath, bytes);
  await fs.writeFile(`${evaluationPath}.sha256`, `${sha256Bytes(bytes)}\n`);
}

async function mutateDraftAndRefreshLoop3(outRoot, addition) {
  const draftPath = path.join(outRoot, 'loop3', 'loop3-9201-draft.md');
  const reportPath = path.join(outRoot, 'loop3', 'loop3-9201-draft-report.json');
  await fs.appendFile(draftPath, addition);
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  report.generatedDraftSha256 = await sha256File(draftPath);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function fixtureObserver(fixture) {
  const { scenario } = fixture;
  const issueNumber = fixture.issueNumber ?? 9201;
  return async ({ stage, outRoot }) => {
    if (stage === 'loop3') {
      if (scenario === 'loop4-integrity-failure') {
        await fs.appendFile(path.join(outRoot, 'loop3', 'loop3-9201-draft.md'), '\nchanged after Loop 3\n');
      }
      if (scenario === 'loop5-revised') {
        await mutateDraftAndRefreshLoop3(outRoot, '\n\nTeams sometimes delegate routine coordination to automated assistants before they have a shared rule for when a human must re-enter the loop.\n');
      }
      if (scenario === 'loop5-partial') {
        await mutateDraftAndRefreshLoop3(outRoot, '\n\nIn today’s rapidly changing world, AI unlocks new possibilities.\n');
      }
    }
    if (stage === 'loop4') {
      if (scenario === 'prototype-note-pass') await rewriteEvaluation(outRoot, { verdict: 'PASS_TO_HUMAN', blockingProblems: [], revisionInstructions: [] }, issueNumber);
      if (scenario === 'loop4-pass') await rewriteEvaluation(outRoot, { verdict: 'PASS_TO_HUMAN', blockingProblems: [], revisionInstructions: [] });
      if (scenario === 'loop4-hold') await rewriteEvaluation(outRoot, { verdict: 'HOLD', blockingProblems: ['Sanitized orchestration hold fixture.'], revisionInstructions: [] });
      if (scenario === 'loop5-revised') await rewriteEvaluation(outRoot, { verdict: 'REVISE', blockingProblems: [], revisionInstructions: ['Remove the repeated paragraph and keep the first instance.'] });
      if (scenario === 'loop5-partial') await rewriteEvaluation(outRoot, { verdict: 'REVISE', blockingProblems: [], revisionInstructions: ['Remove the generic AI setup while retaining the grounded observation.', 'Add one concrete workplace example showing the distinction in action.'] });
      if (scenario === 'loop5-waiting') await rewriteEvaluation(outRoot, { verdict: 'REVISE', blockingProblems: [], revisionInstructions: ['Add one concrete workplace or training example showing a tool-specific skill decaying while a more durable judgment skill remains useful.', 'Expand only the existing note functions enough to move toward the 200–600 word target; do not broaden it into an essay or add unsupported evidence.', 'Recheck whether the opening creates enough tension after the example is added; revise only if the central question remains unclear.'] });
      if (scenario === 'loop5-blocked') await rewriteEvaluation(outRoot, { verdict: 'REVISE', blockingProblems: [], revisionInstructions: ['Recheck whether the opening creates enough tension; revise only if the central question remains unclear.'] });
      if (scenario === 'loop5-integrity-failure') await fs.appendFile(path.join(outRoot, 'loop4', 'loop4-9201-evaluation.json'), ' \n');
      if (scenario === 'valid-human-input') await rewriteEvaluation(outRoot, { verdict: 'REVISE', blockingProblems: [], revisionInstructions: ['Add one concrete workplace example showing a tool-specific skill decaying while a durable judgment skill remains useful.', 'Expand only the existing note functions enough to move toward the 200–600 word target; do not broaden it into an essay or add unsupported evidence.', 'Recheck whether the opening creates enough tension after the example is added; revise only if the central question remains unclear.'] });
    }
  };
}

await fs.mkdir(base, { recursive: true });
for (const fixture of cases) {
  const outRoot = path.join(base, fixture.name);
  await fs.rm(outRoot, { recursive: true, force: true });
  const blocked = fixture.scenario === 'loop3-blocked';
  const prototype = fixture.scenario === 'prototype-note-pass';
  const packetPath = prototype
    ? path.join(root, 'scripts/fixtures/loop3/packet-ready-prototype-note.json')
    : path.join(root, `scripts/fixtures/loop3/${blocked ? 'packet-research-required.json' : 'packet-ready-note.json'}`);
  const issuePath = prototype
    ? path.join(root, 'scripts/fixtures/loop3/issue-ready-prototype-note.md')
    : path.join(root, `scripts/fixtures/loop3/${blocked ? 'issue-fixture.md' : 'issue-ready-note.md'}`);
  const recommendationPath = prototype
    ? path.join(root, 'scripts/fixtures/loop3/recommendation-ready-prototype-note.json')
    : path.join(root, `scripts/fixtures/loop3/${blocked ? 'recommendation-fixture.json' : 'recommendation-ready-note.json'}`);
  let humanInputPath = '';
  if (fixture.scenario === 'valid-human-input') {
    humanInputPath = path.join(outRoot, 'human-input.json');
    await fs.mkdir(outRoot, { recursive: true });
    await fs.writeFile(humanInputPath, `${JSON.stringify({ contractVersion: 'loop5-human-input.v1', issueNumber: 9201, inputType: 'editorial-example', suppliedBy: 'human-editor', requestedFor: 'Add one concrete workplace example showing a tool-specific skill decaying while a durable judgment skill remains useful.', content: 'A designer may become fast in one prototyping tool, then lose that advantage when the team changes tools. The durable skill is deciding what needs to be prototyped, what fidelity is sufficient, and how to interpret the result.', usageScope: 'Use only to satisfy the concrete-example revision instruction for issue 9201. Do not broaden the note.' }, null, 2)}\n`);
  }
  let result;
  try {
    result = await orchestrate({ packetPath, issuePath, recommendationPath, humanInputPath, outRoot, afterStage: fixtureObserver(fixture) });
  } catch (error) {
    console.error(`FAIL ${fixture.name}: ${error.message}`); failures += 1; continue;
  }
  const manifest = result.manifest;
  const loop5Exists = await fs.access(path.join(outRoot, 'loop5')).then(() => true).catch(() => false);
  const hashesValid = (await Promise.all(manifest.artifacts.map(async (artifact) => artifact.sha256 === await sha256File(artifact.path)))).every(Boolean);
  const diagnostics = manifest.artifacts.filter((artifact) => artifact.kind === 'diagnostic');
  const expectedDiagnosticCount = manifest.stageExecutionSummary.length * 2;
  const diagnosticsValid = diagnostics.length === expectedDiagnosticCount && manifest.stageExecutionSummary.every((summary) =>
    diagnostics.some((artifact) => artifact.path === summary.stdoutPath) && diagnostics.some((artifact) => artifact.path === summary.stderrPath) && !('stdout' in summary) && !('stderr' in summary));
  const passed = manifest.finalWorkflowStatus === fixture.expectedStatus && manifest.stoppedAtStage === fixture.stoppedAtStage && loop5Exists === fixture.loop5Expected && hashesValid && diagnosticsValid;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${fixture.name}: expected ${fixture.expectedStatus}, received ${manifest.finalWorkflowStatus}`);
  if (!passed) { failures += 1; console.log(JSON.stringify(manifest, null, 2)); }
}

if (failures) process.exitCode = 1;
