#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256Bytes, sha256Combined } from './lib/content-fingerprint.mjs';

const root = process.cwd();
const base = process.argv[2] || '/tmp/dfw-loop5-human-input-fixtures';
const cases = JSON.parse(await fs.readFile(path.join(root, 'scripts/fixtures/loop5-human-input/cases.json'), 'utf8'));
let failures = 0;
const exampleInstruction = 'Add one concrete workplace example showing a tool-specific skill decaying while a durable judgment skill remains useful.';
const exampleContent = 'A designer may become fast in one prototyping tool, then lose that advantage when the team changes tools. The durable skill is deciding what needs to be prototyped, what fidelity is sufficient, and how to interpret the result.';

for (const fixture of cases) {
  const dir = path.join(base, fixture.name); await fs.mkdir(dir, { recursive: true });
  const packet = { contractVersion: 'loop2-development-packet.v1', issueReference: { number: 9701, title: 'Human input fixture', url: 'https://example.invalid/issues/9701' }, approvedArtifactType: 'note', primaryDomain: 'Human-Machine Workflows', theme: 'human-input', workingTitle: 'Human input fixture', readerQuestion: 'Which skills remain useful?', centralTension: 'Tool-specific speed can decay while judgment remains useful.', verifiedObservations: ['Tool-specific speed can decay while judgment remains useful.'], inferences: [], speculation: [], sourceRequirements: [], evidenceGaps: [], unresolvedQuestions: ['Which skills remain useful?'], draftReadiness: 'ready', sourceSufficiency: { status: 'sufficient' }, blockingCondition: null };
  const draft = `---\ntitle: "Human input fixture"\ndescription: "A note on tool-specific speed and durable judgment."\ndraftDate: 2026-07-12\nupdatedDate:\ndraft: true\ndocumentType: note\ntheme: human-input\nstatus: draft\nsourceNote: "Sanitized fixture"\ndomainPath:\n  - "Human-Machine Workflows"\nrelatedConcepts: []\nrelatedPieces: []\ncanonical: false\n---\n\n# Human input fixture\n\nTool-specific speed can decay while judgment remains useful.\n\n## Why it may matter\n\nThe distinction affects what teams should preserve.\n\n## Current interpretation\n\nJudgment remains useful.\n\n## Open question\n\nWhich skills remain useful?\n`;
  const packetBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`), draftBytes = Buffer.from(draft);
  const packetPath = path.join(dir, 'packet.json'), draftPath = path.join(dir, 'draft.md'), reportPath = path.join(dir, 'draft-report.json'), evaluationPath = path.join(dir, 'evaluation.json'), inputPath = path.join(dir, 'human-input.json'), outDir = path.join(dir, 'output');
  const report = { contractVersion: 'loop3-drafting-report.v1', sourcePacketReference: { issueNumber: 9701, packetContract: packet.contractVersion }, artifactType: 'note', validationStatus: 'passed', sectionsGenerated: [], claimsUsed: packet.verifiedObservations, speculationIncluded: [], unresolvedGapsPreserved: packet.unresolvedQuestions, warnings: [], blockedContentOmitted: [], validationErrors: [], draftPath, sourcePacketSha256: sha256Bytes(packetBytes), sourceIssueSha256: sha256Bytes(Buffer.from('issue')), sourceRecommendationSha256: sha256Bytes(Buffer.from('recommendation')), generatedDraftSha256: sha256Bytes(draftBytes) };
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  const instructions = fixture.variant === 'not-needed' ? ['Remove the repeated paragraph and keep the first instance.'] : [exampleInstruction];
  const evaluation = { contractVersion: 'loop4-editorial-evaluation.v1', sourcePacketSha256: sha256Bytes(packetBytes), sourceDraftSha256: sha256Bytes(draftBytes), sourceDraftReportSha256: sha256Bytes(reportBytes), sourceEvaluationInputsSha256: sha256Combined([{ label: 'loop2-packet', bytes: packetBytes }, { label: 'loop3-draft', bytes: draftBytes }, { label: 'loop3-draft-report', bytes: reportBytes }]), issueAndDraftReference: { issueNumber: 9701, draftPath, packetContract: packet.contractVersion, draftReportContract: report.contractVersion }, verdict: 'REVISE', confidence: 'high', blockingProblems: [], revisionInstructions: instructions, strengths: [], risks: [], evidenceUsed: [], humanReviewNotes: [] };
  const evaluationBytes = Buffer.from(`${JSON.stringify(evaluation, null, 2)}\n`);
  const input = { contractVersion: 'loop5-human-input.v1', issueNumber: fixture.variant === 'wrong-issue' ? 9999 : 9701, inputType: fixture.variant === 'unsupported-type' ? 'research-note' : 'editorial-example', suppliedBy: 'human-editor', requestedFor: exampleInstruction, content: exampleContent, usageScope: fixture.variant === 'scope-mismatch' ? 'Use for a different article.' : 'Use only to satisfy the concrete-example revision instruction for issue 9701. Do not broaden the note.' };
  const inputBytes = fixture.variant === 'malformed' ? Buffer.from('{ not valid json') : Buffer.from(`${JSON.stringify(input, null, 2)}\n`);
  await Promise.all([fs.writeFile(packetPath, packetBytes), fs.writeFile(draftPath, draftBytes), fs.writeFile(reportPath, reportBytes), fs.writeFile(evaluationPath, evaluationBytes), fs.writeFile(`${evaluationPath}.sha256`, `${sha256Bytes(evaluationBytes)}\n`), fs.writeFile(inputPath, inputBytes)]);
  const run = spawnSync(process.execPath, [path.join(root, 'scripts/loop5-bounded-revision.mjs'), '--packet', packetPath, '--draft', draftPath, '--draft-report', reportPath, '--evaluation', evaluationPath, '--human-input', inputPath, '--out-dir', outDir], { encoding: 'utf8' });
  const candidates = [path.join(outDir, 'loop5-9701-revision-report.json'), path.join(outDir, 'failed', 'loop5-9701-revision-report.json')];
  let result = null; for (const candidate of candidates) { try { result = JSON.parse(await fs.readFile(candidate, 'utf8')); break; } catch {} }
  const validProvenance = fixture.variant !== 'valid' || (result?.humanInputProvenance?.[0]?.sha256 === sha256Bytes(inputBytes) && result?.humanInputProvenance?.[0]?.useMode === 'verbatim');
  const revisedContainsInput = fixture.variant !== 'valid' || (await fs.readFile(result.revisedDraftPath, 'utf8')).includes(exampleContent);
  const passed = run.status === fixture.expectedExit && result?.overallStatus === fixture.expectedStatus && validProvenance && revisedContainsInput;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${fixture.name}: expected ${fixture.expectedStatus}, received ${result?.overallStatus ?? 'NO_REPORT'}`);
  if (!passed) { failures += 1; console.log(run.stdout); console.error(run.stderr); if (result) console.log(JSON.stringify(result, null, 2)); }
}

if (failures) process.exitCode = 1;
