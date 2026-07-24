#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256Bytes, sha256Combined } from './lib/content-fingerprint.mjs';

const root = process.cwd();
const cases = JSON.parse(await fs.readFile(path.join(root, 'scripts/fixtures/loop5/cases.json'), 'utf8'));
const baseOut = process.argv[2] || '/tmp/dfw-loop5-fixtures';
let failures = 0;

for (const fixture of cases) {
  const artifactType = fixture.artifactType ?? 'note';
  const dir = path.join(baseOut, fixture.name), outputDir = path.join(dir, 'output');
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const draftPath = path.join(dir, 'draft.md');
  const packetPath = path.join(dir, 'packet.json');
  const reportPath = path.join(dir, 'draft-report.json');
  const evaluationPath = path.join(dir, 'evaluation.json');
  const packet = {
    contractVersion: 'loop2-development-packet.v1',
    issueReference: { number: fixture.issueNumber, title: fixture.title, url: `https://example.invalid/issues/${fixture.issueNumber}` },
    approvedArtifactType: artifactType, primaryDomain: 'Human-Machine Workflows', theme: 'loop5-fixture', workingTitle: fixture.title,
    readerQuestion: fixture.readerQuestion, centralTension: fixture.centralTension,
    verifiedObservations: fixture.approvedMaterial, inferences: [], speculation: [], sourceRequirements: [], evidenceGaps: [], relatedMaterial: [],
    recommendedStructure: [], unresolvedQuestions: [fixture.readerQuestion], draftReadiness: 'ready',
    sourceSufficiency: { status: 'sufficient', reasons: [], missingElements: [] }, blockingCondition: null,
    ...(fixture.prototypeNote ? { prototypeNote: fixture.prototypeNote } : {}),
  };
  const draft = `---\ntitle: ${JSON.stringify(fixture.title)}\ndescription: ${JSON.stringify(fixture.description)}\ndraftDate: 2026-07-11\nupdatedDate:\ndraft: true\ndocumentType: ${artifactType}\ntheme: loop5-fixture\nstatus: draft\nsourceNote: "Sanitized Loop 5 fixture"\ndomainPath:\n  - "Human-Machine Workflows"\nrelatedConcepts: []\nrelatedPieces: []\ncanonical: false\n---\n\n${fixture.body.trim()}\n`;
  const packetBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  const draftBytes = Buffer.from(draft, 'utf8');
  const report = {
    contractVersion: 'loop3-drafting-report.v1', sourcePacketReference: { issueNumber: fixture.issueNumber, packetContract: packet.contractVersion },
    artifactType, validationStatus: 'passed', sectionsGenerated: [], claimsUsed: fixture.approvedMaterial,
    speculationIncluded: [], unresolvedGapsPreserved: [fixture.readerQuestion], warnings: [], blockedContentOmitted: [], validationErrors: [], draftPath,
    sourcePacketSha256: sha256Bytes(packetBytes),
    sourceIssueSha256: sha256Bytes(Buffer.from(`sanitized issue ${fixture.issueNumber}\n`)),
    sourceRecommendationSha256: sha256Bytes(Buffer.from(`sanitized recommendation ${fixture.issueNumber}\n`)),
    generatedDraftSha256: sha256Bytes(draftBytes),
  };
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const evaluation = {
    contractVersion: 'loop4-editorial-evaluation.v1',
    issueAndDraftReference: { issueNumber: fixture.issueNumber, draftPath, packetContract: packet.contractVersion, draftReportContract: report.contractVersion },
    verdict: fixture.verdict, confidence: 'high', blockingProblems: [], revisionInstructions: fixture.instructions,
    strengths: [], risks: [], evidenceUsed: [], humanReviewNotes: [],
    sourcePacketSha256: sha256Bytes(packetBytes),
    sourceDraftSha256: sha256Bytes(draftBytes),
    sourceDraftReportSha256: sha256Bytes(reportBytes),
    sourceEvaluationInputsSha256: sha256Combined([
      { label: 'loop2-packet', bytes: packetBytes }, { label: 'loop3-draft', bytes: draftBytes },
      { label: 'loop3-draft-report', bytes: reportBytes },
    ]),
  };
  const evaluationBytes = Buffer.from(`${JSON.stringify(evaluation, null, 2)}\n`, 'utf8');
  await Promise.all([
    fs.writeFile(draftPath, draftBytes), fs.writeFile(packetPath, packetBytes),
    fs.writeFile(reportPath, reportBytes), fs.writeFile(evaluationPath, evaluationBytes),
    fs.writeFile(`${evaluationPath}.sha256`, `${sha256Bytes(evaluationBytes)}\n`),
  ]);
  const run = spawnSync(process.execPath, [path.join(root, 'scripts/loop5-bounded-revision.mjs'),
    '--packet', packetPath, '--draft', draftPath, '--draft-report', reportPath,
    '--evaluation', evaluationPath, '--out-dir', outputDir], { encoding: 'utf8' });
  const reportCandidates = [path.join(outputDir, `loop5-${fixture.issueNumber}-revision-report.json`), path.join(outputDir, 'failed', `loop5-${fixture.issueNumber}-revision-report.json`)];
  let result;
  for (const candidate of reportCandidates) {
    try { result = JSON.parse(await fs.readFile(candidate, 'utf8')); break; } catch {}
  }
  let prototypePreserved = true;
  if (fixture.prototypeNote && result?.revisedDraftPath) {
    const revisedDraft = await fs.readFile(result.revisedDraftPath, 'utf8');
    const sourceGrounding = [
      fixture.prototypeNote.designProblem,
      fixture.prototypeNote.interactionChoice,
      ...fixture.prototypeNote.interactionGroups.flatMap((group) => group.items),
      ...fixture.prototypeNote.designPrinciples,
      fixture.prototypeNote.currentState,
    ];
    prototypePreserved =
      result.issueAndDraftReference?.artifactType === 'prototype-note' &&
      revisedDraft.includes('documentType: prototype-note') &&
      sourceGrounding.every((item) => revisedDraft.includes(item));
  }
  const passed =
    result?.overallStatus === fixture.expectedStatus &&
    (fixture.expectedExit ?? 0) === (run.status ?? 1) &&
    prototypePreserved &&
    (result?.humanInputRequests ?? []).every((request) =>
      request.includes(`Issue #${fixture.issueNumber}`)
      && fixture.instructions.some((instruction) => request.includes(instruction))
      && (
        fixture.instructions.some((instruction) => /tool-specific skill|skill decaying/i.test(instruction))
        || !/tool-specific skill|durable judgment skill|skill that decayed/i.test(request)
      ));
  console.log(`${passed ? 'PASS' : 'FAIL'} ${fixture.name}: expected ${fixture.expectedStatus}, received ${result?.overallStatus ?? 'NO_REPORT'}`);
  if (!passed) { failures += 1; console.log(run.stdout); console.error(run.stderr); if (result) console.log(JSON.stringify(result, null, 2)); }
}

if (failures) process.exitCode = 1;
