#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256Bytes, sha256Combined } from './lib/content-fingerprint.mjs';

const root = process.cwd();
const base = process.argv[2] || '/tmp/dfw-integrity-fixtures';
let failures = 0;

function run(script, args) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { encoding: 'utf8' });
}

async function loop3(dir) {
  const out = path.join(dir, 'loop3');
  const result = run('loop3-constrained-draft.mjs', [
    '--packet', path.join(root, 'scripts/fixtures/loop3/packet-ready-note.json'),
    '--issue', path.join(root, 'scripts/fixtures/loop3/issue-ready-note.md'),
    '--recommendation', path.join(root, 'scripts/fixtures/loop3/recommendation-ready-note.json'),
    '--out-dir', out,
  ]);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return {
    packet: path.join(root, 'scripts/fixtures/loop3/packet-ready-note.json'),
    draft: path.join(out, 'loop3-9201-draft.md'),
    report: path.join(out, 'loop3-9201-draft-report.json'),
  };
}

async function localizeInputs(chain, dir) {
  await fs.mkdir(dir, { recursive: true });
  const localized = {};
  for (const [key, source] of Object.entries(chain)) {
    const target = path.join(dir, `${key}${key === 'draft' ? '.md' : '.json'}`);
    await fs.copyFile(source, target); localized[key] = target;
  }
  const report = JSON.parse(await fs.readFile(localized.report, 'utf8'));
  report.draftPath = localized.draft;
  const packetBytes = await fs.readFile(localized.packet), draftBytes = await fs.readFile(localized.draft);
  report.sourcePacketSha256 = sha256Bytes(packetBytes); report.generatedDraftSha256 = sha256Bytes(draftBytes);
  await fs.writeFile(localized.report, `${JSON.stringify(report, null, 2)}\n`);
  return localized;
}

async function loop4(chain, dir) {
  const out = path.join(dir, 'loop4');
  const result = run('loop4-editorial-evaluation.mjs', ['--packet', chain.packet, '--draft', chain.draft, '--draft-report', chain.report, '--out-dir', out]);
  return { result, evaluation: path.join(out, 'loop4-9201-evaluation.json'), out };
}

function record(name, passed, detail = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
  if (!passed) failures += 1;
}

await fs.mkdir(base, { recursive: true });

{
  const chain = await localizeInputs(await loop3(path.join(base, 'unchanged-chain-source')), path.join(base, 'unchanged-chain'));
  const evaluated = await loop4(chain, path.join(base, 'unchanged-chain'));
  record('unchanged-chain', evaluated.result.status === 0, `Loop 4 exit ${evaluated.result.status}`);
}

{
  const chain = await localizeInputs(await loop3(path.join(base, 'draft-after-loop3-source')), path.join(base, 'draft-after-loop3'));
  await fs.appendFile(chain.draft, '\nchanged after Loop 3\n');
  const evaluated = await loop4(chain, path.join(base, 'draft-after-loop3'));
  const failurePath = path.join(evaluated.out, 'loop4-9201-integrity-failure.json');
  const failure = JSON.parse(await fs.readFile(failurePath, 'utf8'));
  record('draft-modified-after-loop3', evaluated.result.status === 2 && failure.failures.some((item) => item.artifact === 'Loop 3 draft'));
}

{
  const chain = await localizeInputs(await loop3(path.join(base, 'packet-after-loop3-source')), path.join(base, 'packet-after-loop3'));
  await fs.appendFile(chain.packet, ' \n');
  const evaluated = await loop4(chain, path.join(base, 'packet-after-loop3'));
  const failure = JSON.parse(await fs.readFile(path.join(evaluated.out, 'loop4-9201-integrity-failure.json'), 'utf8'));
  record('packet-modified-after-loop3', evaluated.result.status === 2 && failure.failures.some((item) => item.artifact === 'Loop 2 packet'));
}

async function evaluatedChain(name) {
  const dir = path.join(base, name);
  const chain = await localizeInputs(await loop3(`${dir}-source`), dir);
  const evaluated = await loop4(chain, dir);
  if (evaluated.result.status !== 0) throw new Error(evaluated.result.stderr || evaluated.result.stdout);
  return { ...chain, evaluation: evaluated.evaluation, dir };
}

{
  const chain = await evaluatedChain('draft-after-loop4');
  await fs.appendFile(chain.draft, '\nchanged after Loop 4\n');
  const out = path.join(chain.dir, 'loop5');
  const revised = run('loop5-bounded-revision.mjs', ['--packet', chain.packet, '--draft', chain.draft, '--draft-report', chain.report, '--evaluation', chain.evaluation, '--out-dir', out]);
  const failure = JSON.parse(await fs.readFile(path.join(out, 'loop5-9201-integrity-failure.json'), 'utf8'));
  record('draft-modified-after-loop4', revised.status === 2 && failure.failures.some((item) => item.artifact === 'Loop 3 draft'));
}

{
  const chain = await evaluatedChain('evaluation-before-loop5');
  await fs.appendFile(chain.evaluation, ' \n');
  const out = path.join(chain.dir, 'loop5');
  const revised = run('loop5-bounded-revision.mjs', ['--packet', chain.packet, '--draft', chain.draft, '--draft-report', chain.report, '--evaluation', chain.evaluation, '--out-dir', out]);
  const failure = JSON.parse(await fs.readFile(path.join(out, 'loop5-9201-integrity-failure.json'), 'utf8'));
  record('evaluation-modified-before-loop5', revised.status === 2 && failure.failures.some((item) => item.artifact === 'Loop 4 evaluation'));
}

{
  const dir = path.join(base, 'unchanged-revised-chain'); await fs.mkdir(dir, { recursive: true });
  const packet = {
    contractVersion: 'loop2-development-packet.v1', issueReference: { number: 9601, title: 'Integrity revision', url: 'https://example.invalid/issues/9601' },
    approvedArtifactType: 'note', primaryDomain: 'Human-Machine Workflows', theme: 'integrity', workingTitle: 'Integrity revision',
    readerQuestion: 'Where should review return?', centralTension: 'Delegated work can cross into judgment.',
    verifiedObservations: ['Delegated work can cross into judgment.', 'Where should review return?'], inferences: [], speculation: [],
    sourceRequirements: [], evidenceGaps: [], unresolvedQuestions: ['Where should review return?'], draftReadiness: 'ready', sourceSufficiency: { status: 'sufficient' }, blockingCondition: null,
  };
  const draft = `---\ntitle: "Integrity revision"\ndescription: "A note on review boundaries."\ndraftDate: 2026-07-12\nupdatedDate:\ndraft: true\ndocumentType: note\ntheme: integrity\nstatus: draft\nsourceNote: "Sanitized integrity fixture"\ndomainPath:\n  - "Human-Machine Workflows"\nrelatedConcepts: []\nrelatedPieces: []\ncanonical: false\n---\n\n# Integrity revision\n\nDelegated work can cross into judgment.\n\n## Why it may matter\n\nDelegated work can cross into judgment.\n\n## Current interpretation\n\nReview remains necessary.\n\n## Open question\n\nWhere should review return?\n`;
  const packetBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`), draftBytes = Buffer.from(draft);
  const packetPath = path.join(dir, 'packet.json'), draftPath = path.join(dir, 'draft.md'), reportPath = path.join(dir, 'report.json'), evaluationPath = path.join(dir, 'evaluation.json');
  const report = { contractVersion: 'loop3-drafting-report.v1', sourcePacketReference: { issueNumber: 9601, packetContract: packet.contractVersion }, artifactType: 'note', validationStatus: 'passed', sectionsGenerated: [], claimsUsed: packet.verifiedObservations, speculationIncluded: [], unresolvedGapsPreserved: [], warnings: [], blockedContentOmitted: [], validationErrors: [], draftPath, sourcePacketSha256: sha256Bytes(packetBytes), sourceIssueSha256: sha256Bytes(Buffer.from('issue')), sourceRecommendationSha256: sha256Bytes(Buffer.from('recommendation')), generatedDraftSha256: sha256Bytes(draftBytes) };
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  const evaluation = { contractVersion: 'loop4-editorial-evaluation.v1', sourcePacketSha256: sha256Bytes(packetBytes), sourceDraftSha256: sha256Bytes(draftBytes), sourceDraftReportSha256: sha256Bytes(reportBytes), sourceEvaluationInputsSha256: sha256Combined([{ label: 'loop2-packet', bytes: packetBytes }, { label: 'loop3-draft', bytes: draftBytes }, { label: 'loop3-draft-report', bytes: reportBytes }]), issueAndDraftReference: { issueNumber: 9601, draftPath, packetContract: packet.contractVersion, draftReportContract: report.contractVersion }, verdict: 'REVISE', confidence: 'high', blockingProblems: [], revisionInstructions: ['Remove the repeated paragraph and keep the first instance.'], strengths: [], risks: [], evidenceUsed: [], humanReviewNotes: [] };
  const evaluationBytes = Buffer.from(`${JSON.stringify(evaluation, null, 2)}\n`);
  await Promise.all([fs.writeFile(packetPath, packetBytes), fs.writeFile(draftPath, draftBytes), fs.writeFile(reportPath, reportBytes), fs.writeFile(evaluationPath, evaluationBytes), fs.writeFile(`${evaluationPath}.sha256`, `${sha256Bytes(evaluationBytes)}\n`)]);
  const out = path.join(dir, 'loop5');
  const revised = run('loop5-bounded-revision.mjs', ['--packet', packetPath, '--draft', draftPath, '--draft-report', reportPath, '--evaluation', evaluationPath, '--out-dir', out]);
  const revisionReport = JSON.parse(await fs.readFile(path.join(out, 'loop5-9601-revision-report.json'), 'utf8'));
  const actualRevised = await fs.readFile(revisionReport.revisedDraftPath);
  record('unchanged-revised-draft-chain', revised.status === 0 && revisionReport.overallStatus === 'REVISED' && revisionReport.revisedDraftSha256 === sha256Bytes(actualRevised));
}

if (failures) process.exitCode = 1;
