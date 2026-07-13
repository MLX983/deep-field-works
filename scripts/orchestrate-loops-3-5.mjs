#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { sha256File } from './lib/content-fingerprint.mjs';

const ROOT = process.cwd();
const CONTRACT = 'loop3-5-orchestration-manifest.v1';
const STATUSES = new Set([
  'LOOP3_BLOCKED', 'READY_FOR_HUMAN_EDITORIAL_REVIEW', 'REVISED_PENDING_REEVALUATION',
  'REVISED_STILL_NEEDS_WORK', 'PARTIALLY_REVISED_WAITING_FOR_HUMAN', 'WAITING_FOR_HUMAN', 'HOLD', 'BLOCKED',
]);

function parseArgs(argv) {
  const out = { packet: '', issue: '', recommendation: '', humanInput: '', outRoot: '', help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--packet') out.packet = argv[++i] ?? '';
    else if (value === '--issue') out.issue = argv[++i] ?? '';
    else if (value === '--recommendation') out.recommendation = argv[++i] ?? '';
    else if (value === '--human-input') out.humanInput = argv[++i] ?? '';
    else if (value === '--out-root') out.outRoot = argv[++i] ?? '';
    else if (value === '--help' || value === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return out;
}

function usage() {
  return `Usage: node scripts/orchestrate-loops-3-5.mjs \\
  --packet <loop2-packet.json> \\
  --issue <source-issue.md> \\
  --recommendation <approved-loop1-recommendation.json> \\
  [--human-input <loop5-human-input.json>] \\
  --out-root </tmp/run-root>`;
}

function resolveInput(value) { return path.isAbsolute(value) ? path.normalize(value) : path.join(ROOT, value); }

function validateOutputRoot(value) {
  const resolved = path.resolve(value);
  if (!(resolved === '/tmp' || resolved.startsWith('/tmp/') || resolved === '/private/tmp' || resolved.startsWith('/private/tmp/'))) {
    throw new Error('Orchestrator output root must be under /tmp or /private/tmp');
  }
  return resolved;
}

async function execute(stage, script, args, stageDir) {
  const startedAt = new Date().toISOString();
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args]);
  const stdoutPath = path.join(stageDir, `${stage}-stdout.log`);
  const stderrPath = path.join(stageDir, `${stage}-stderr.log`);
  await fs.mkdir(stageDir, { recursive: true });
  await Promise.all([
    fs.writeFile(stdoutPath, run.stdout ?? Buffer.alloc(0)),
    fs.writeFile(stderrPath, run.stderr ?? Buffer.alloc(0)),
  ]);
  return {
    stage, startedAt, completedAt: new Date().toISOString(), exitCode: run.status ?? 1,
    outcome: run.status === 0 ? 'completed' : 'stopped', stdoutPath, stderrPath,
  };
}

async function filesRecursively(dir) {
  const files = [];
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await filesRecursively(target));
      else if (entry.isFile()) files.push(target);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return files.sort();
}

function artifactKind(filePath) {
  const name = path.basename(filePath);
  if (name.endsWith('-stdout.log') || name.endsWith('-stderr.log')) return 'diagnostic';
  if (name.endsWith('-draft.md')) return 'draft';
  if (name.endsWith('-revised.md')) return 'revised-draft';
  if (name.endsWith('.sha256')) return 'fingerprint-sidecar';
  if (name.includes('integrity-failure')) return 'integrity-failure-report';
  if (name.includes('gate-blocked')) return 'gate-blocked-report';
  if (name.includes('evaluation')) return 'evaluation';
  if (name.includes('revision-report')) return 'revision-report';
  if (name.includes('draft-report')) return 'draft-report';
  return 'stage-output';
}

async function collectArtifacts(outRoot) {
  const artifacts = [];
  for (const stage of ['loop3', 'loop4', 'loop5', 'loop4-reevaluation']) {
    for (const file of await filesRecursively(path.join(outRoot, stage))) {
      artifacts.push({ stage, kind: artifactKind(file), path: file, sha256: await sha256File(file) });
    }
  }
  return artifacts;
}

async function findJson(dir, pattern) {
  return (await filesRecursively(dir)).find((file) => pattern.test(path.basename(file))) ?? '';
}

async function readJsonIfPresent(filePath) {
  if (!filePath) return null;
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); } catch { return null; }
}

function stageWarnings(value) {
  return Array.isArray(value?.warnings) ? value.warnings : [];
}

function validateManifest(manifest) {
  if (manifest.contractVersion !== CONTRACT || !STATUSES.has(manifest.finalWorkflowStatus)) throw new Error('Invalid orchestration manifest status or contract');
  if (!manifest.issueReference?.number || !manifest.startedAt || !manifest.completedAt) throw new Error('Incomplete orchestration manifest identity or timestamps');
  if (!['loop3', 'loop4', 'loop5', 'loop4-reevaluation'].includes(manifest.stoppedAtStage) || !manifest.stopReason) throw new Error('Incomplete orchestration stop state');
  if (!Array.isArray(manifest.stageExecutionSummary) || !Array.isArray(manifest.artifacts)) throw new Error('Invalid orchestration manifest arrays');
}

export async function orchestrate({ packetPath, issuePath, recommendationPath, humanInputPath = '', outRoot, afterStage } = {}) {
  const startedAt = new Date().toISOString();
  const resolvedPacket = resolveInput(packetPath), resolvedIssue = resolveInput(issuePath), resolvedRecommendation = resolveInput(recommendationPath);
  const resolvedHumanInput = humanInputPath ? resolveInput(humanInputPath) : '';
  const resolvedOut = validateOutputRoot(outRoot);
  const packet = JSON.parse(await fs.readFile(resolvedPacket, 'utf8'));
  const issueReference = { number: packet.issueReference.number, title: packet.issueReference.title, url: packet.issueReference.url };
  await fs.mkdir(resolvedOut, { recursive: true });
  const stageExecutionSummary = [];
  let finalWorkflowStatus = 'BLOCKED', stoppedAtStage = 'loop3', stopReason = 'Workflow did not complete.', humanInputRequests = [], warnings = [];

  const finish = async () => {
    const manifest = {
      contractVersion: CONTRACT, issueReference, startedAt, completedAt: new Date().toISOString(),
      finalWorkflowStatus, stageExecutionSummary, artifacts: await collectArtifacts(resolvedOut),
      stoppedAtStage, stopReason, humanInputRequests: [...new Set(humanInputRequests)], warnings: [...new Set(warnings)],
    };
    validateManifest(manifest);
    const manifestPath = path.join(resolvedOut, `loop3-5-${issueReference.number}-manifest.json`);
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return { manifest, manifestPath };
  };

  const loop3Dir = path.join(resolvedOut, 'loop3');
  const loop3 = await execute('loop3', 'loop3-constrained-draft.mjs', ['--packet', resolvedPacket, '--issue', resolvedIssue, '--recommendation', resolvedRecommendation, '--out-dir', loop3Dir], loop3Dir);
  stageExecutionSummary.push(loop3);
  await afterStage?.({ stage: 'loop3', outRoot: resolvedOut, packetPath: resolvedPacket, issuePath: resolvedIssue, recommendationPath: resolvedRecommendation });
  if (loop3.exitCode !== 0) {
    finalWorkflowStatus = loop3.exitCode === 2 ? 'LOOP3_BLOCKED' : 'BLOCKED'; stoppedAtStage = 'loop3';
    const reportPath = await findJson(loop3Dir, /(?:gate-blocked|draft-report)\.json$/);
    stopReason = `Loop 3 stopped with exit code ${loop3.exitCode}${reportPath ? `; see ${reportPath}` : ''}.`;
    return finish();
  }
  const loop3Draft = await findJson(loop3Dir, /loop3-\d+-draft\.md$/);
  const loop3ReportPath = await findJson(loop3Dir, /loop3-\d+-draft-report\.json$/);
  const loop3Report = await readJsonIfPresent(loop3ReportPath); warnings.push(...stageWarnings(loop3Report));
  if (!loop3Draft || !loop3ReportPath) { finalWorkflowStatus = 'BLOCKED'; stoppedAtStage = 'loop3'; stopReason = 'Loop 3 exited successfully but required draft artifacts are missing.'; return finish(); }

  const loop4Dir = path.join(resolvedOut, 'loop4');
  const loop4 = await execute('loop4', 'loop4-editorial-evaluation.mjs', ['--packet', resolvedPacket, '--draft', loop3Draft, '--draft-report', loop3ReportPath, '--out-dir', loop4Dir], loop4Dir);
  stageExecutionSummary.push(loop4);
  await afterStage?.({ stage: 'loop4', outRoot: resolvedOut, packetPath: resolvedPacket, draftPath: loop3Draft, draftReportPath: loop3ReportPath });
  if (loop4.exitCode !== 0) {
    finalWorkflowStatus = 'BLOCKED'; stoppedAtStage = 'loop4';
    const failurePath = await findJson(loop4Dir, /(?:integrity-failure|evaluation)\.json$/);
    stopReason = `Loop 4 stopped with exit code ${loop4.exitCode}${failurePath ? `; see ${failurePath}` : ''}.`;
    return finish();
  }
  const evaluationPath = await findJson(loop4Dir, /loop4-\d+-evaluation\.json$/);
  const evaluation = await readJsonIfPresent(evaluationPath);
  if (!evaluation) { finalWorkflowStatus = 'BLOCKED'; stoppedAtStage = 'loop4'; stopReason = 'Loop 4 exited successfully but its evaluation is missing or invalid.'; return finish(); }
  warnings.push(...stageWarnings(evaluation));
  if (evaluation.verdict === 'PASS_TO_HUMAN') {
    finalWorkflowStatus = 'READY_FOR_HUMAN_EDITORIAL_REVIEW'; stoppedAtStage = 'loop4'; stopReason = 'Loop 4 passed the draft to human editorial review; Loop 5 was not run.'; return finish();
  }
  if (evaluation.verdict === 'HOLD') {
    finalWorkflowStatus = 'HOLD'; stoppedAtStage = 'loop4'; stopReason = 'Loop 4 placed the draft on hold; Loop 5 was not run.'; return finish();
  }
  if (evaluation.verdict !== 'REVISE') {
    finalWorkflowStatus = 'BLOCKED'; stoppedAtStage = 'loop4'; stopReason = `Loop 4 returned unsupported verdict ${evaluation.verdict}.`; return finish();
  }

  const loop5Dir = path.join(resolvedOut, 'loop5');
  const loop5Args = ['--packet', resolvedPacket, '--draft', loop3Draft, '--draft-report', loop3ReportPath, '--evaluation', evaluationPath];
  if (resolvedHumanInput) loop5Args.push('--human-input', resolvedHumanInput);
  loop5Args.push('--out-dir', loop5Dir);
  const loop5 = await execute('loop5', 'loop5-bounded-revision.mjs', loop5Args, loop5Dir);
  stageExecutionSummary.push(loop5);
  await afterStage?.({ stage: 'loop5', outRoot: resolvedOut, packetPath: resolvedPacket, draftPath: loop3Draft, draftReportPath: loop3ReportPath, evaluationPath });
  const revisionReportPath = await findJson(loop5Dir, /loop5-\d+-revision-report\.json$/);
  const revisionReport = await readJsonIfPresent(revisionReportPath);
  const integrityPath = await findJson(loop5Dir, /integrity-failure\.json$/);
  if (loop5.exitCode !== 0 || !revisionReport) {
    finalWorkflowStatus = 'BLOCKED'; stoppedAtStage = 'loop5';
    stopReason = `Loop 5 stopped with exit code ${loop5.exitCode}${integrityPath || revisionReportPath ? `; see ${integrityPath || revisionReportPath}` : ''}.`;
    return finish();
  }
  warnings.push(...stageWarnings(revisionReport)); humanInputRequests = revisionReport.humanInputRequests ?? [];
  stoppedAtStage = 'loop5';
  if (revisionReport.overallStatus === 'REVISED') {
    const revisedDraftPath = revisionReport.revisedDraftPath;
    if (!revisedDraftPath) {
      finalWorkflowStatus = 'BLOCKED'; stopReason = `Loop 5 reported REVISED without a revised draft path; see ${revisionReportPath}.`; return finish();
    }
    const reevaluationDir = path.join(resolvedOut, 'loop4-reevaluation');
    const reevaluation = await execute('loop4-reevaluation', 'loop4-editorial-evaluation.mjs', [
      '--packet', resolvedPacket, '--draft', revisedDraftPath, '--draft-report', loop3ReportPath,
      '--revision-report', revisionReportPath, '--out-dir', reevaluationDir,
    ], reevaluationDir);
    stageExecutionSummary.push(reevaluation);
    await afterStage?.({ stage: 'loop4-reevaluation', outRoot: resolvedOut, packetPath: resolvedPacket, draftPath: revisedDraftPath, draftReportPath: loop3ReportPath, revisionReportPath });
    const reevaluationPath = await findJson(reevaluationDir, /loop4-\d+-evaluation\.json$/);
    const reevaluationResult = await readJsonIfPresent(reevaluationPath);
    stoppedAtStage = 'loop4-reevaluation';
    if (reevaluation.exitCode !== 0 || !reevaluationResult) {
      const failurePath = await findJson(reevaluationDir, /integrity-failure\.json$/);
      finalWorkflowStatus = 'BLOCKED'; stopReason = `Loop 4 reevaluation stopped with exit code ${reevaluation.exitCode}${failurePath || reevaluationPath ? `; see ${failurePath || reevaluationPath}` : ''}.`;
    } else if (reevaluationResult.verdict === 'PASS_TO_HUMAN') {
      finalWorkflowStatus = 'READY_FOR_HUMAN_EDITORIAL_REVIEW'; stopReason = 'The single post-revision Loop 4 evaluation passed the draft to human editorial review.';
    } else if (reevaluationResult.verdict === 'REVISE') {
      finalWorkflowStatus = 'REVISED_STILL_NEEDS_WORK'; stopReason = 'The single post-revision Loop 4 evaluation found additional bounded revision work; no further cycle was run.';
    } else {
      finalWorkflowStatus = 'BLOCKED'; stopReason = `The single post-revision Loop 4 evaluation returned ${reevaluationResult.verdict}; no further cycle was run.`;
    }
    warnings.push(...stageWarnings(reevaluationResult));
  } else if (revisionReport.overallStatus === 'PARTIALLY_REVISED_WAITING_FOR_HUMAN') {
    finalWorkflowStatus = 'PARTIALLY_REVISED_WAITING_FOR_HUMAN'; stopReason = 'Loop 5 applied independent safe instructions and is waiting for human input.';
  } else if (revisionReport.overallStatus === 'WAITING_FOR_HUMAN') {
    finalWorkflowStatus = 'WAITING_FOR_HUMAN'; stopReason = 'Loop 5 requires human input before revision can continue.';
  } else {
    finalWorkflowStatus = 'BLOCKED'; stopReason = `Loop 5 returned ${revisionReport.overallStatus}; see ${revisionReportPath}.`;
  }
  return finish();
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (input.help) { console.log(usage()); return; }
  if (!input.packet || !input.issue || !input.recommendation || !input.outRoot) throw new Error(`Missing required argument.\n${usage()}`);
  const result = await orchestrate({ packetPath: input.packet, issuePath: input.issue, recommendationPath: input.recommendation, humanInputPath: input.humanInput, outRoot: input.outRoot });
  console.log(JSON.stringify({ ok: !['BLOCKED', 'LOOP3_BLOCKED', 'HOLD'].includes(result.manifest.finalWorkflowStatus), finalWorkflowStatus: result.manifest.finalWorkflowStatus, manifestPath: result.manifestPath }, null, 2));
  if (result.manifest.finalWorkflowStatus === 'BLOCKED') process.exitCode = 2;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
