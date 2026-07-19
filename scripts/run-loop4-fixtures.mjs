#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256Bytes } from './lib/content-fingerprint.mjs';

const root = process.cwd();
const fixturePath = path.join(root, 'scripts/fixtures/loop4/cases.json');
const baseOut = process.argv[2] || '/tmp/dfw-loop4-fixtures';
const cases = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
let failures = 0;

function yamlString(value) {
  return JSON.stringify(value);
}

for (const fixture of cases) {
  const dir = path.join(baseOut, fixture.name);
  await fs.mkdir(dir, { recursive: true });
  const packet = {
    contractVersion: 'loop2-development-packet.v1',
    issueReference: { number: fixture.issueNumber, title: fixture.title, url: `https://example.invalid/issues/${fixture.issueNumber}` },
    approvedArtifactType: fixture.approvedArtifactType,
    primaryDomain: 'Human-Machine Workflows',
    theme: 'editorial-evaluation-fixture',
    workingTitle: fixture.title,
    readerQuestion: fixture.readerQuestion,
    centralTension: fixture.centralTension,
    verifiedObservations: fixture.verifiedObservations,
    inferences: fixture.inferences,
    speculation: fixture.speculation,
    sourceRequirements: [],
    evidenceGaps: fixture.evidenceGaps,
    relatedMaterial: [],
    recommendedStructure: [],
    unresolvedQuestions: fixture.unresolvedQuestions,
    draftReadiness: 'ready',
    sourceSufficiency: { status: 'sufficient', reasons: [], missingElements: [] },
    blockingCondition: null,
    nextAction: 'Evaluate the constrained fixture draft.',
    ...(fixture.prototypeNote ? { prototypeNote: fixture.prototypeNote } : {}),
  };
  const draft = `---\ntitle: ${yamlString(fixture.title)}\ndescription: ${yamlString(fixture.description)}\ndraftDate: 2026-07-11\nupdatedDate:\ndraft: true\ndocumentType: ${fixture.draftArtifactType}\ntheme: editorial-evaluation-fixture\nstatus: draft\nsourceNote: ${yamlString('Sanitized Loop 4 fixture')}\ndomainPath:\n  - "Human-Machine Workflows"\nrelatedConcepts: []\nrelatedPieces: []\ncanonical: false\n---\n\n${fixture.body.trim()}\n`;
  const packetBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  const draftBytes = Buffer.from(draft, 'utf8');
  const report = {
    contractVersion: 'loop3-drafting-report.v1',
    sourcePacketReference: { issueNumber: fixture.issueNumber, packetContract: 'loop2-development-packet.v1', issueUrl: packet.issueReference.url },
    artifactType: fixture.reportArtifactType,
    validationStatus: 'passed',
    sectionsGenerated: [],
    claimsUsed: [...fixture.verifiedObservations, ...fixture.inferences],
    speculationIncluded: fixture.speculation,
    unresolvedGapsPreserved: [...fixture.evidenceGaps, ...fixture.unresolvedQuestions],
    warnings: [],
    blockedContentOmitted: [],
    validationErrors: [],
    sourcePacketSha256: sha256Bytes(packetBytes),
    sourceIssueSha256: sha256Bytes(Buffer.from(`sanitized issue ${fixture.issueNumber}\n`)),
    sourceRecommendationSha256: sha256Bytes(Buffer.from(`sanitized recommendation ${fixture.issueNumber}\n`)),
    generatedDraftSha256: sha256Bytes(draftBytes),
  };
  const packetPath = path.join(dir, 'packet.json');
  const reportPath = path.join(dir, 'draft-report.json');
  const draftPath = path.join(dir, 'draft.md');
  const evaluationDir = path.join(dir, 'evaluation');
  await Promise.all([
    fs.writeFile(packetPath, packetBytes),
    fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`),
    fs.writeFile(draftPath, draftBytes),
  ]);
  const run = spawnSync(process.execPath, [
    path.join(root, 'scripts/loop4-editorial-evaluation.mjs'),
    '--packet', packetPath,
    '--draft', draftPath,
    '--draft-report', reportPath,
    '--out-dir', evaluationDir,
  ], { encoding: 'utf8' });
  if (run.status !== 0) {
    console.error(`${fixture.name}: runner failed\n${run.stderr}`);
    failures += 1;
    continue;
  }
  const result = JSON.parse(await fs.readFile(path.join(evaluationDir, `loop4-${fixture.issueNumber}-evaluation.json`), 'utf8'));
  const expectedRisk = fixture.expectedRiskIncludes
    ? result.risks.some((risk) => risk.includes(fixture.expectedRiskIncludes))
    : true;
  const forbiddenRevision = fixture.forbiddenRevisionIncludes
    ? result.revisionInstructions.every((instruction) => !instruction.includes(fixture.forbiddenRevisionIncludes))
    : true;
  const passed = result.verdict === fixture.expectedVerdict && expectedRisk && forbiddenRevision;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${fixture.name}: expected ${fixture.expectedVerdict}, received ${result.verdict}`);
  if (!passed) {
    failures += 1;
    console.log(JSON.stringify(result, null, 2));
  }
}

if (failures) process.exitCode = 1;
