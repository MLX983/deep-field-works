import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import {
  ELIGIBLE_STATUSES as NOTIFICATION_ELIGIBLE,
  notifyReview as existingNotifier,
} from "./review-notification.mjs";

export const CONTRACTS = Object.freeze({
  source: "backlog-source-snapshot.v1",
  registry: "backlog-registry.v2",
  batch: "backlog-batch-manifest.v1",
  reviewEnvelope: "backlog-loop1-review-envelope.v2",
  reviewPacket: "backlog-loop1-review-packet.v2",
});

export const PROCESSING_STATES = Object.freeze([
  "pending",
  "claimed",
  "awaiting-loop1-review",
  "completed-waiting-for-human",
  "completed-combine-first",
  "completed-governance-stop",
  "completed-other-nondraft-stop",
  "failed-retriable",
  "failed-terminal",
]);

const COMPLETE_STATES = new Set([
  "completed-waiting-for-human",
  "completed-combine-first",
  "completed-governance-stop",
  "completed-other-nondraft-stop",
]);
const VALID_DISPOSITIONS = new Set([
  "develop independently",
  "research before development",
  "combine with existing material",
  "combine with overlapping material",
  "needs human judgment",
  "defer",
  "preserve as seed",
  "not for publication",
]);
const VALID_DOMAINS = new Set([
  "Cognitive Infrastructure",
  "Human-Machine Workflows",
  "Institutions in Transition",
  "Interfaces for Judgment",
  "Media, Memory, and Meaning",
]);

function now(deps = {}) {
  return deps.now ? deps.now() : new Date().toISOString();
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalIssue(issue) {
  return JSON.stringify({
    number: Number(issue.number),
    title: String(issue.title ?? ""),
    body: String(issue.body ?? ""),
    state: String(issue.state ?? "").toLowerCase(),
    createdAt: String(issue.createdAt ?? ""),
    updatedAt: String(issue.updatedAt ?? ""),
    url: String(issue.url ?? ""),
  });
}

export function sourceFingerprint(issue) {
  return sha256(canonicalIssue(issue));
}

function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "untitled"
  );
}

export function issueMarkdown(issue) {
  return `# Issue #${issue.number}: ${issue.title}

- State: ${String(issue.state).toLowerCase()}
- URL: ${issue.url}
- Created: ${issue.createdAt}
- Updated: ${issue.updatedAt}

### Body

${issue.body || "_No issue body supplied._"}
`;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

function writePrivate(path, value) {
  writeFileSync(path, value, { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function atomicWriteJson(path, value, hooks = {}) {
  ensureDir(dirname(path));
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  writePrivate(temporary, `${JSON.stringify(value, null, 2)}\n`);
  if (hooks.beforeRename) hooks.beforeRename(temporary, path);
  renameSync(temporary, path);
  chmodSync(path, 0o600);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function getGitCommit(repoPath) {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoPath,
    encoding: "utf8",
  }).trim();
}

export function discoverGitHubIssues(sourceRepository) {
  try {
    const output = execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--repo",
        sourceRepository,
        "--state",
        "open",
        "--limit",
        "1000",
        "--json",
        "number,title,url,state,body,createdAt,updatedAt",
      ],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    return JSON.parse(output);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "GitHub issue discovery unavailable: the gh executable was not found. Install/authenticate gh or pass an explicitly refreshed --source-snapshot.",
      );
    }
    const detail = String(error.stderr || error.message || "").trim();
    throw new Error(
      `GitHub issue discovery failed for ${sourceRepository}: ${detail || "unknown gh error"}`,
    );
  }
}

export function normalizeSourceSnapshot(raw, sourceRepository, fetchedAt) {
  const rawIssues = Array.isArray(raw) ? raw : raw.issues;
  if (!Array.isArray(rawIssues)) {
    throw new Error("Source snapshot must contain an issues array.");
  }
  const issues = rawIssues
    .map((issue) => {
      const normalized = {
        number: Number(issue.number),
        title: String(issue.title ?? ""),
        url: String(issue.url ?? ""),
        state: String(issue.state ?? "open").toLowerCase(),
        createdAt: String(issue.createdAt ?? ""),
        updatedAt: String(issue.updatedAt ?? ""),
        body: String(issue.body ?? ""),
      };
      if (!Number.isInteger(normalized.number) || normalized.number < 1) {
        throw new Error(`Invalid issue number: ${issue.number}`);
      }
      return {
        ...normalized,
        sourceContentSha256: sourceFingerprint(normalized),
      };
    })
    .filter((issue) => issue.state === "open")
    .sort((left, right) => left.number - right.number);
  return {
    contractVersion: CONTRACTS.source,
    sourceRepository,
    fetchedAt,
    issueCount: issues.length,
    issues,
  };
}

function loadSource(options, deps, fetchedAt) {
  if (options.sourceSnapshot) {
    return normalizeSourceSnapshot(
      readJson(options.sourceSnapshot),
      options.sourceRepository,
      fetchedAt,
    );
  }
  const discovered = deps.discoverIssues
    ? deps.discoverIssues(options.sourceRepository)
    : discoverGitHubIssues(options.sourceRepository);
  return normalizeSourceSnapshot(discovered, options.sourceRepository, fetchedAt);
}

function emptyRegistry(sourceRepository, timestamp) {
  return {
    contractVersion: CONTRACTS.registry,
    sourceRepository,
    createdAt: timestamp,
    updatedAt: timestamp,
    migrationHistory: [],
    issues: {},
  };
}

function registryPath(stateDir) {
  return join(stateDir, "registry.v2.json");
}

function legacyRegistryPath(stateDir) {
  return join(stateDir, "registry.v1.json");
}

function loadRegistry(stateDir, sourceRepository, timestamp) {
  const path = registryPath(stateDir);
  const legacyPath = legacyRegistryPath(stateDir);
  if (!existsSync(path) && !existsSync(legacyPath)) {
    return emptyRegistry(sourceRepository, timestamp);
  }
  const registry = readJson(existsSync(path) ? path : legacyPath);
  if (registry.contractVersion === "backlog-registry.v1") {
    if (
      registry.sourceRepository !== sourceRepository ||
      typeof registry.issues !== "object"
    ) {
      throw new Error(
        "Registry invariant failed: incompatible legacy registry contract.",
      );
    }
    for (const record of Object.values(registry.issues)) {
      record.stateRecordVersion = 2;
      record.sourceProcessingCommitSha = record.processingCommitSha;
      record.resumeProcessingCommitSha = null;
      delete record.processingCommitSha;
    }
    registry.contractVersion = CONTRACTS.registry;
    registry.migrationHistory = [
      ...(registry.migrationHistory || []),
      {
        fromContractVersion: "backlog-registry.v1",
        toContractVersion: CONTRACTS.registry,
        migratedAt: timestamp,
        sourcePath: legacyPath,
      },
    ];
    return registry;
  }
  if (
    registry.contractVersion !== CONTRACTS.registry ||
    registry.sourceRepository !== sourceRepository ||
    typeof registry.issues !== "object"
  ) {
    throw new Error("Registry invariant failed: incompatible registry contract.");
  }
  return registry;
}

function acquireGlobalLock(
  stateDir,
  runId,
  timestamp,
  timeoutMinutes,
  recoverStaleClaims,
) {
  const path = join(stateDir, "registry.v2.lock");
  if (existsSync(path) && recoverStaleClaims) {
    let existing;
    try {
      existing = readJson(path);
    } catch {
      existing = null;
    }
    const age = existing?.claimedAt
      ? Date.parse(timestamp) - Date.parse(existing.claimedAt)
      : 0;
    if (existing && age > timeoutMinutes * 60_000) {
      const staleDir = join(stateDir, "claims", "stale");
      ensureDir(staleDir);
      renameSync(
        path,
        join(
          staleDir,
          `registry-${String(timestamp).replace(/[^0-9]/g, "")}.lock.json`,
        ),
      );
    }
  }
  let descriptor;
  try {
    descriptor = openSync(path, "wx", 0o600);
    writeFileSync(
      descriptor,
      `${JSON.stringify({ runId, claimedAt: timestamp })}\n`,
    );
    closeSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    throw new Error(`Global registry lock unavailable: ${error.message}`);
  }
  return () => {
    if (existsSync(path)) unlinkSync(path);
  };
}

function claimPath(stateDir, issueNumber) {
  return join(stateDir, "claims", `issue-${issueNumber}.claim.json`);
}

export function inspectClaim(
  stateDir,
  issueNumber,
  timestamp,
  timeoutMinutes,
) {
  const path = claimPath(stateDir, issueNumber);
  if (!existsSync(path)) return { status: "none", path };
  let claim;
  try {
    claim = readJson(path);
  } catch (error) {
    return { status: "invalid", path, error: error.message };
  }
  const age = Date.parse(timestamp) - Date.parse(claim.claimedAt);
  return {
    status: age > timeoutMinutes * 60_000 ? "stale" : "active",
    path,
    claim,
  };
}

export function acquireIssueClaim({
  stateDir,
  issue,
  runId,
  timestamp,
  timeoutMinutes,
  recoverStaleClaims,
}) {
  ensureDir(join(stateDir, "claims"));
  const existing = inspectClaim(
    stateDir,
    issue.number,
    timestamp,
    timeoutMinutes,
  );
  if (existing.status === "active") {
    return { acquired: false, reason: "actively-claimed", existing };
  }
  if (existing.status === "invalid") {
    return { acquired: false, reason: "invalid-claim", existing };
  }
  if (existing.status === "stale") {
    if (!recoverStaleClaims) {
      return {
        acquired: false,
        reason: "stale-claim-requires-recovery",
        existing,
      };
    }
    const staleDir = join(stateDir, "claims", "stale");
    ensureDir(staleDir);
    renameSync(
      existing.path,
      join(staleDir, `issue-${issue.number}-${Date.now()}.claim.json`),
    );
  }
  const path = claimPath(stateDir, issue.number);
  const claim = {
    issueNumber: issue.number,
    sourceContentSha256: issue.sourceContentSha256,
    runId,
    claimedAt: timestamp,
  };
  try {
    const descriptor = openSync(path, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(claim, null, 2)}\n`);
    closeSync(descriptor);
    chmodSync(path, 0o600);
    return { acquired: true, path, claim };
  } catch (error) {
    return {
      acquired: false,
      reason: "claim-race-lost",
      error: error.message,
      path,
    };
  }
}

function releaseIssueClaim(path) {
  if (path && existsSync(path)) unlinkSync(path);
}

function selectCandidates({
  issues,
  registry,
  stateDir,
  timestamp,
  limit,
  timeoutMinutes,
  recoverStaleClaims,
  reprocessChanged,
  hasReviewEnvelope,
}) {
  const selected = [];
  const skipped = [];
  let capacityUsed = 0;
  for (const issue of issues) {
    const claim = inspectClaim(
      stateDir,
      issue.number,
      timestamp,
      timeoutMinutes,
    );
    if (claim.status === "active" || claim.status === "invalid") {
      skipped.push({
        issue,
        reason:
          claim.status === "active" ? "actively-claimed" : "invalid-claim",
      });
      continue;
    }
    if (claim.status === "stale" && !recoverStaleClaims) {
      skipped.push({ issue, reason: "stale-claim-requires-recovery" });
      continue;
    }

    const record = registry.issues[String(issue.number)];
    if (record) {
      const changed =
        record.sourceContentSha256 !== issue.sourceContentSha256;
      if (
        record.processingStatus === "awaiting-loop1-review" &&
        !hasReviewEnvelope(issue.number)
      ) {
        const consumesCapacity = capacityUsed < limit;
        if (consumesCapacity) capacityUsed += 1;
        skipped.push({
          issue,
          reason: "awaiting-loop1-review",
          consumesCapacity,
          ...(changed
            ? {
                sourceChanged: true,
                previousFingerprint: record.sourceContentSha256,
                currentFingerprint: issue.sourceContentSha256,
              }
            : {}),
        });
        continue;
      }
      if (changed && !reprocessChanged) {
        skipped.push({
          issue,
          reason: "changed-requires-explicit-reprocess",
          previousFingerprint: record.sourceContentSha256,
        });
        continue;
      }
      if (
        !changed &&
        COMPLETE_STATES.has(record.processingStatus) &&
        record.notificationStatus !== "provider-failed"
      ) {
        skipped.push({ issue, reason: "unchanged-completed" });
        continue;
      }
      if (!changed && record.processingStatus === "failed-terminal") {
        skipped.push({ issue, reason: "failed-terminal" });
        continue;
      }
    }

    if (capacityUsed < limit) {
      selected.push({
        issue,
        record,
        changed:
          Boolean(record) &&
          record.sourceContentSha256 !== issue.sourceContentSha256,
      });
      capacityUsed += 1;
    } else {
      skipped.push({ issue, reason: "batch-limit" });
    }
  }
  return { selected, skipped };
}

function makeRecord(issue, previous, context) {
  const priorResults = previous
    ? [
        ...(previous.priorResults || []),
        {
          sourceContentSha256: previous.sourceContentSha256,
          processingStatus: previous.processingStatus,
          finalWorkflowStatus: previous.finalWorkflowStatus ?? null,
          disposition: previous.disposition ?? null,
          workspacePath: previous.workspacePath ?? null,
          artifactPaths: previous.artifactPaths ?? [],
          completedAt: previous.completedAt ?? null,
          sourceProcessingCommitSha:
            previous.sourceProcessingCommitSha ?? null,
          resumeProcessingCommitSha:
            previous.resumeProcessingCommitSha ?? null,
        },
      ]
    : [];
  return {
    stateRecordVersion: 2,
    issueNumber: issue.number,
    issueTitle: issue.title,
    issueUrl: issue.url,
    sourceContentSha256: issue.sourceContentSha256,
    fetchedAt: context.fetchedAt,
    processingStatus: "pending",
    currentOrFinalStage: "selection",
    finalWorkflowStatus: null,
    disposition: null,
    combineTarget: null,
    workspacePath: null,
    artifactPaths: [],
    notificationEligibility: false,
    notificationKey: null,
    notificationStatus: "not-attempted",
    attemptCount: (previous?.attemptCount || 0) + 1,
    attemptHistory: previous?.attemptHistory || [],
    latestAttemptTimestamp: context.timestamp,
    sourceProcessingCommitSha: context.processingCommitSha,
    resumeProcessingCommitSha: null,
    failureCategory: null,
    failureMessage: null,
    claimOwner: context.runId,
    claimTimestamp: context.timestamp,
    completedAt: null,
    priorResults,
  };
}

function persistRegistry(stateDir, registry, timestamp) {
  registry.updatedAt = timestamp;
  atomicWriteJson(registryPath(stateDir), registry);
}

function finishAttempt(record, status, timestamp) {
  record.attemptHistory.push({
    runId: record.claimOwner,
    attemptedAt: record.latestAttemptTimestamp,
    completedAt: timestamp,
    processingStatus: status,
    currentOrFinalStage: record.currentOrFinalStage,
    failureCategory: record.failureCategory,
    failureMessage: record.failureMessage,
    processorCommitSha:
      record.resumeProcessingCommitSha ||
      record.sourceProcessingCommitSha ||
      null,
  });
}

function listFiles(path) {
  if (!existsSync(path)) return [];
  const results = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) results.push(...listFiles(child));
    else results.push(child);
  }
  return results.sort();
}

function writeExecution(path, command, run) {
  atomicWriteJson(path, {
    command,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    exitCode: run.status ?? 1,
    signal: run.signal ?? null,
  });
}

function spawnLogged({
  command,
  args,
  cwd,
  stdoutPath,
  stderrPath,
  executionPath,
}) {
  const startedAt = new Date().toISOString();
  const run = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const completedAt = new Date().toISOString();
  writePrivate(stdoutPath, run.stdout || "");
  writePrivate(stderrPath, run.stderr || "");
  writeExecution(executionPath, [command, ...args], {
    ...run,
    startedAt,
    completedAt,
  });
  if (run.error) throw run.error;
  return run;
}

function defaultRunLoop1(context) {
  ensureDir(context.loop1Dir);
  const resultPath = join(
    context.loop1Dir,
    `loop1-${context.issue.number}-result.md`,
  );
  const run = spawnLogged({
    command: "npm",
    args: [
      "run",
      "loop:intake",
      "--",
      "--issue",
      context.issuePath,
      "--intake-cache",
      context.intakeCache,
      "--out",
      resultPath,
      "--trace",
    ],
    cwd: context.repoPath,
    stdoutPath: join(context.loop1Dir, "stdout.log"),
    stderrPath: join(context.loop1Dir, "stderr.log"),
    executionPath: join(context.loop1Dir, "execution.json"),
  });
  if (run.status !== 0) {
    throw new StageError("loop1-failed", `Loop 1 exited ${run.status}.`, true);
  }
  return { resultPath };
}

function defaultRunLoop2(context) {
  ensureDir(context.loop2Dir);
  const run = spawnLogged({
    command: "npm",
    args: [
      "run",
      "loop:packet",
      "--",
      "--issue",
      context.issuePath,
      "--recommendation",
      context.recommendationPath,
      "--out-dir",
      context.loop2Dir,
    ],
    cwd: context.repoPath,
    stdoutPath: join(context.loop2Dir, "stdout.log"),
    stderrPath: join(context.loop2Dir, "stderr.log"),
    executionPath: join(context.loop2Dir, "execution.json"),
  });
  if (![0, 2].includes(run.status)) {
    throw new StageError("loop2-failed", `Loop 2 exited ${run.status}.`, true);
  }
  const packetPath = listFiles(context.loop2Dir).find((path) =>
    /loop2-\d+-packet\.json$/.test(path),
  );
  if (!packetPath) {
    throw new StageError(
      "loop2-packet-missing",
      "Loop 2 wrote no packet.",
      false,
    );
  }
  return { packetPath, exitCode: run.status };
}

function defaultRunOrchestration(context) {
  ensureDir(context.orchestrationDir);
  const run = spawnLogged({
    command: "npm",
    args: [
      "run",
      "loop:orchestrate",
      "--",
      "--packet",
      context.packetPath,
      "--issue",
      context.issuePath,
      "--recommendation",
      context.recommendationPath,
      "--out-root",
      context.orchestrationDir,
    ],
    cwd: context.repoPath,
    stdoutPath: join(context.orchestrationDir, "stdout.log"),
    stderrPath: join(context.orchestrationDir, "stderr.log"),
    executionPath: join(context.orchestrationDir, "execution.json"),
  });
  if (run.status !== 0) {
    throw new StageError(
      "orchestration-failed",
      `Loops 3–5 exited ${run.status}.`,
      true,
    );
  }
  const manifestPath = listFiles(context.orchestrationDir).find((path) =>
    /loop3-5-\d+-manifest\.json$/.test(path),
  );
  if (!manifestPath) {
    throw new StageError(
      "orchestration-manifest-missing",
      "Loops 3–5 wrote no orchestration manifest.",
      false,
    );
  }
  return { manifestPath };
}

async function defaultNotify(context) {
  let result;
  try {
    result = await existingNotifier({
      manifestPath: context.manifestPath,
      ledgerPath: context.ledgerPath,
      send: context.send,
    });
  } catch (error) {
    if (/Missing provider configuration/.test(error.message)) {
      throw new StageError(
        "notification-configuration-missing",
        error.message,
        true,
      );
    }
    throw error;
  }
  return {
    ...result,
    status: result.result,
    notificationKey: result.plan?.notificationKey ?? null,
    message: result.failure?.message,
  };
}

export class StageError extends Error {
  constructor(category, message, retriable = true) {
    super(message);
    this.name = "StageError";
    this.category = category;
    this.retriable = retriable;
  }
}

function validateReviewEnvelope(envelope, context) {
  const failures = [];
  if (envelope.contractVersion !== CONTRACTS.reviewEnvelope) {
    failures.push("contractVersion");
  }
  if (Number(envelope.issueNumber) !== context.issue.number) {
    failures.push("issueNumber");
  }
  if (envelope.sourceContentSha256 !== context.issue.sourceContentSha256) {
    failures.push("sourceContentSha256");
  }
  if (
    resolve(envelope.workspacePath || ".") !==
    resolve(context.record.workspacePath)
  ) {
    failures.push("workspacePath");
  }
  if (
    envelope.sourceProcessingCommitSha !==
    context.record.sourceProcessingCommitSha
  ) {
    failures.push("sourceProcessingCommitSha");
  }
  if (
    context.currentProcessingCommitSha &&
    envelope.resumeProcessingCommitSha !== context.currentProcessingCommitSha
  ) {
    failures.push("resumeProcessingCommitSha");
  }
  if (envelope.loop1ResultSha256 !== context.record.loop1ResultSha256) {
    failures.push("loop1ResultSha256");
  }
  if (
    !context.record.loop1ResultPath ||
    !existsSync(context.record.loop1ResultPath) ||
    sha256(readFileSync(context.record.loop1ResultPath)) !==
      context.record.loop1ResultSha256
  ) {
    failures.push("loop1ArtifactContent");
  }
  const recommendation = envelope.recommendation;
  if (
    !recommendation ||
    recommendation.contractVersion !== "loop1-reviewed-recommendation.v1" ||
    recommendation.humanApprovalStatus !== "approved" ||
    Number(recommendation.issueNumber) !== context.issue.number ||
    typeof recommendation.suggestedArtifact !== "string" ||
    typeof recommendation.rationale !== "string" ||
    typeof recommendation.nextAction !== "string" ||
    !VALID_DOMAINS.has(recommendation.primaryDomain)
  ) {
    failures.push("recommendation");
  }
  if (
    recommendation &&
    !VALID_DISPOSITIONS.has(recommendation.disposition)
  ) {
    failures.push("recommendation.disposition");
  }
  if (failures.length) {
    throw new StageError(
      "review-envelope-invalid",
      `Review envelope rejected: ${failures.join(", ")} mismatch or invalid.`,
      false,
    );
  }
  return recommendation;
}

function validateCompletedReviewReplay(envelope, context) {
  const recommendation = validateReviewEnvelope(envelope, context);
  const savedRecommendationPath = join(
    context.record.workspacePath,
    "loop1",
    "reviewed-recommendation.json",
  );
  if (
    !existsSync(savedRecommendationPath) ||
    !isDeepStrictEqual(readJson(savedRecommendationPath), recommendation)
  ) {
    throw new StageError(
      "review-envelope-invalid",
      "Review envelope rejected: recommendation does not match the completed review.",
      false,
    );
  }
  return recommendation;
}

function writeReviewPacket(context, resultPath) {
  const packetPath = join(context.loop1Dir, "review-packet.json");
  const packet = {
    contractVersion: CONTRACTS.reviewPacket,
    createdAt: context.timestamp,
    issueNumber: context.issue.number,
    issueTitle: context.issue.title,
    sourceContentSha256: context.issue.sourceContentSha256,
    sourceProcessingCommitSha: context.processingCommitSha,
    workspacePath: context.workspace,
    loop1ResultPath: resultPath,
    loop1ResultSha256: sha256(readFileSync(resultPath)),
    approvalRequired: true,
    nextCommand:
      "Rerun backlog:process with --reviewed-recommendation pointing to a matching backlog-loop1-review-envelope.v2 file.",
  };
  atomicWriteJson(packetPath, packet);
  return { packetPath, packet };
}

function classifyLoop2(packet, recommendation) {
  const disposition = packet.disposition || recommendation.disposition;
  const readiness = packet.draftReadiness || packet.readiness;
  if (readiness === "combine-first") return "completed-combine-first";
  if (readiness === "ready" || disposition === "ready") return "ready";
  if (disposition === "needs human judgment") {
    return "completed-governance-stop";
  }
  return "completed-other-nondraft-stop";
}

function orchestrationStatus(manifest) {
  return (
    manifest.finalStatus ||
    manifest.finalWorkflowStatus ||
    manifest.workflowStatus ||
    manifest.status ||
    "UNKNOWN"
  );
}

function recommendedAction(status) {
  return (
    {
      "awaiting-loop1-review":
        "Review Loop 1 and supply a matching approval envelope on a later run.",
      "completed-waiting-for-human":
        "Open the orchestration manifest and complete human editorial review.",
      "completed-combine-first":
        "Review the combine target before changing either source.",
      "completed-governance-stop":
        "Resolve the governance or source-of-truth question outside automation.",
      "completed-other-nondraft-stop":
        "Review the nondraft disposition and decide whether to revise the intake.",
      "failed-retriable": "Correct the transient failure and rerun this issue.",
      "failed-terminal": "Human intervention is required before reprocessing.",
    }[status] || "No action required."
  );
}

function resultFromRecord(record) {
  return {
    issueNumber: record.issueNumber,
    title: record.issueTitle,
    sourceContentSha256: record.sourceContentSha256,
    sourceProcessingCommitSha: record.sourceProcessingCommitSha,
    resumeProcessingCommitSha: record.resumeProcessingCommitSha,
    processingStatus: record.processingStatus,
    currentOrFinalStage: record.currentOrFinalStage,
    finalWorkflowStatus: record.finalWorkflowStatus,
    disposition: record.disposition,
    combineTarget: record.combineTarget,
    notificationEligibility: record.notificationEligibility,
    notificationStatus: record.notificationStatus,
    notificationKey: record.notificationKey,
    failureCategory: record.failureCategory,
    failureMessage: record.failureMessage,
    workspacePath: record.workspacePath,
    artifactPaths: record.artifactPaths,
    recommendedNextAction: recommendedAction(record.processingStatus),
  };
}

async function processClaimedIssue(context) {
  const {
    issue,
    record,
    options,
    deps,
    registry,
    stateDir,
  } = context;
  const persist = () => persistRegistry(stateDir, registry, now(deps));

  try {
    if (
      record.processingStatus === "failed-retriable" &&
      record.currentOrFinalStage === "notification" &&
      record.orchestrationManifestPath
    ) {
      const notification = await (deps.notifyReview || defaultNotify)({
        manifestPath: record.orchestrationManifestPath,
        ledgerPath: join(stateDir, "notification-ledger.json"),
        send: Boolean(options.sendNotification),
        repoPath: options.repoPath,
        issue,
      });
      record.notificationStatus = notification.status || "unknown";
      record.notificationKey = notification.notificationKey || null;
      if (
        [
          "provider-failed",
          "delivery-uncertain",
          "concurrent-in-progress",
        ].includes(record.notificationStatus)
      ) {
        throw new StageError(
          `notification-${record.notificationStatus}`,
          notification.message || "Notification provider failed.",
          true,
        );
      }
      record.processingStatus = "completed-waiting-for-human";
      record.failureCategory = null;
      record.failureMessage = null;
      record.completedAt = now(deps);
      finishAttempt(record, record.processingStatus, record.completedAt);
      persist();
      return;
    }

    let recommendation;
    let recommendationPath;
    if (record.processingStatus === "awaiting-loop1-review") {
      const envelope = readJson(options.reviewedRecommendation);
      recommendation = validateReviewEnvelope(envelope, {
        issue,
        record,
        currentProcessingCommitSha: context.processingCommitSha,
      });
      record.resumeProcessingCommitSha = context.processingCommitSha;
      recommendationPath = join(
        record.workspacePath,
        "loop1",
        "reviewed-recommendation.json",
      );
      atomicWriteJson(recommendationPath, recommendation);
      record.processingStatus = "claimed";
      record.currentOrFinalStage = "loop2";
      persist();
    } else {
      record.currentOrFinalStage = "loop1";
      persist();
      ensureDir(context.loop1Dir);
      const loop1 = await (deps.runLoop1 || defaultRunLoop1)({
        issue,
        issuePath: context.issuePath,
        intakeCache: context.intakeCache,
        loop1Dir: context.loop1Dir,
        repoPath: options.repoPath,
        workspace: context.workspace,
      });
      if (!existsSync(loop1.resultPath)) {
        throw new StageError(
          "loop1-result-missing",
          "Loop 1 wrote no result.",
          false,
        );
      }
      const review = writeReviewPacket(context, loop1.resultPath);
      record.loop1ResultPath = loop1.resultPath;
      record.loop1ResultSha256 = review.packet.loop1ResultSha256;
      record.reviewPacketPath = review.packetPath;
      record.processingStatus = "awaiting-loop1-review";
      record.currentOrFinalStage = "loop1-review";
      record.artifactPaths = listFiles(context.workspace);
      finishAttempt(record, record.processingStatus, now(deps));
      persist();
      return;
    }

    const loop2Dir = join(record.workspacePath, "loop2");
    ensureDir(loop2Dir);
    const loop2 = await (deps.runLoop2 || defaultRunLoop2)({
      issue,
      issuePath: record.issueSnapshotPath,
      recommendationPath,
      loop2Dir,
      repoPath: options.repoPath,
      workspace: record.workspacePath,
    });
    const packet = readJson(loop2.packetPath);
    record.loop2PacketPath = loop2.packetPath;
    record.disposition = packet.disposition || recommendation.disposition;
    record.combineTarget =
      packet.combineTarget ||
      recommendation.combineTarget ||
      recommendation.preferredCombineTarget ||
      recommendation.combineTargetReference ||
      packet.combinationPlan?.targetReference ||
      packet.combinationPlan?.target?.reference ||
      null;
    const loop2Class = classifyLoop2(packet, recommendation);
    if (loop2Class !== "ready") {
      record.processingStatus = loop2Class;
      record.currentOrFinalStage = "loop2";
      record.finalWorkflowStatus =
        packet.draftReadiness || packet.readiness || "NOT_DRAFT_READY";
      record.completedAt = now(deps);
      record.artifactPaths = listFiles(record.workspacePath);
      finishAttempt(record, record.processingStatus, record.completedAt);
      persist();
      return;
    }

    record.currentOrFinalStage = "loops3-5";
    persist();
    const orchestrationDir = join(record.workspacePath, "orchestration");
    ensureDir(orchestrationDir);
    const orchestration = await (
      deps.runOrchestration || defaultRunOrchestration
    )({
      issue,
      issuePath: record.issueSnapshotPath,
      recommendationPath,
      packetPath: loop2.packetPath,
      orchestrationDir,
      repoPath: options.repoPath,
      workspace: record.workspacePath,
    });
    const manifest = readJson(orchestration.manifestPath);
    record.orchestrationManifestPath = orchestration.manifestPath;
    record.finalWorkflowStatus = orchestrationStatus(manifest);
    record.notificationEligibility = NOTIFICATION_ELIGIBLE.has(
      record.finalWorkflowStatus,
    );

    if (record.notificationEligibility) {
      record.currentOrFinalStage = "notification";
      persist();
      const notification = await (deps.notifyReview || defaultNotify)({
        manifestPath: orchestration.manifestPath,
        ledgerPath: join(stateDir, "notification-ledger.json"),
        send: Boolean(options.sendNotification),
        repoPath: options.repoPath,
        issue,
      });
      record.notificationStatus = notification.status || "unknown";
      record.notificationKey = notification.notificationKey || null;
      if (
        [
          "provider-failed",
          "delivery-uncertain",
          "concurrent-in-progress",
        ].includes(record.notificationStatus)
      ) {
        throw new StageError(
          `notification-${record.notificationStatus}`,
          notification.message || "Notification provider failed.",
          true,
        );
      }
    } else {
      record.notificationStatus = "not-eligible";
    }

    record.processingStatus = "completed-waiting-for-human";
    record.currentOrFinalStage = "loops3-5";
    record.completedAt = now(deps);
    record.artifactPaths = listFiles(record.workspacePath);
    finishAttempt(record, record.processingStatus, record.completedAt);
    persist();
  } catch (error) {
    const stageError =
      error instanceof StageError
        ? error
        : new StageError("unexpected-stage-failure", error.message, true);
    if (stageError.category === "review-envelope-invalid") {
      record.processingStatus = "awaiting-loop1-review";
      record.currentOrFinalStage = "loop1-review";
    } else {
      record.processingStatus = stageError.retriable
        ? "failed-retriable"
        : "failed-terminal";
    }
    record.failureCategory = stageError.category;
    record.failureMessage = stageError.message;
    record.artifactPaths = record.workspacePath
      ? listFiles(record.workspacePath)
      : [];
    finishAttempt(record, record.processingStatus, now(deps));
    persist();
  }
}

function summarize(results, skipped) {
  const processingStates = {};
  for (const result of results) {
    processingStates[result.processingStatus] =
      (processingStates[result.processingStatus] || 0) + 1;
  }
  const skipReasons = {};
  for (const item of skipped) {
    skipReasons[item.reason] = (skipReasons[item.reason] || 0) + 1;
  }
  return {
    processed: results.length,
    skipped: skipped.length,
    processingStates,
    skipReasons,
  };
}

export async function processBacklog(options, deps = {}) {
  if (!["dry-run", "execute"].includes(options.mode)) {
    throw new Error("Exactly one mode is required: dry-run or execute.");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("--limit must be a positive integer.");
  }
  if (!options.sourceRepository || !options.repoPath) {
    throw new Error("--source-repo and --repo-path are required.");
  }
  if (options.mode === "execute" && (!options.stateDir || !options.workRoot)) {
    throw new Error("--state-dir and --work-root are required.");
  }

  const timestamp = now(deps);
  const runId = `${timestamp.replace(/[^0-9]/g, "").slice(0, 14)}-${randomUUID()}`;
  const processingCommitSha =
    deps.processingCommitSha || getGitCommit(options.repoPath);
  const dryRunRoot =
    options.mode === "dry-run"
      ? mkdtempSync(join(tmpdir(), "dfw-backlog-dry-run-"))
      : null;
  const stateDir = resolve(
    options.mode === "dry-run" ? join(dryRunRoot, "state") : options.stateDir,
  );
  const registryStateDir =
    options.mode === "dry-run" && options.stateDir
      ? resolve(options.stateDir)
      : stateDir;
  const workRoot = resolve(
    options.mode === "dry-run" ? join(dryRunRoot, "work") : options.workRoot,
  );
  ensureDir(stateDir);
  ensureDir(workRoot);
  ensureDir(join(stateDir, "claims"));

  const releaseGlobal = acquireGlobalLock(
    stateDir,
    runId,
    timestamp,
    options.claimTimeoutMinutes || 120,
    Boolean(options.recoverStaleClaims),
  );
  try {
    const source = loadSource(options, deps, timestamp);
    const sourcePath =
      options.mode === "dry-run"
        ? join(dryRunRoot, "source-snapshot.json")
        : join(workRoot, "runs", runId, "source-snapshot.json");
    atomicWriteJson(sourcePath, source);
    const registry = loadRegistry(
      registryStateDir,
      options.sourceRepository,
      timestamp,
    );
    const reviewEnvelope = options.reviewedRecommendation
      ? readJson(options.reviewedRecommendation)
      : null;
    if (reviewEnvelope) {
      const reviewRecord =
        registry.issues[String(Number(reviewEnvelope.issueNumber))];
      const reviewIssue = source.issues.find(
        (issue) => issue.number === Number(reviewEnvelope.issueNumber),
      );
      if (!reviewRecord || !reviewIssue) {
        throw new Error(
          "Reviewed recommendation rejected: no matching issue is awaiting Loop 1 review in this registry.",
        );
      }
      if (COMPLETE_STATES.has(reviewRecord.processingStatus)) {
        validateCompletedReviewReplay(reviewEnvelope, {
          issue: reviewIssue,
          record: reviewRecord,
          currentProcessingCommitSha: processingCommitSha,
        });
      } else if (reviewRecord.processingStatus !== "awaiting-loop1-review") {
        throw new Error(
          "Reviewed recommendation rejected: no matching issue is awaiting Loop 1 review in this registry.",
        );
      }
    }
    const selection = selectCandidates({
      issues: source.issues,
      registry,
      stateDir: registryStateDir,
      timestamp,
      limit: options.limit,
      timeoutMinutes: options.claimTimeoutMinutes || 120,
      recoverStaleClaims: Boolean(options.recoverStaleClaims),
      reprocessChanged: Boolean(options.reprocessChanged),
      hasReviewEnvelope: (number) =>
        Number(reviewEnvelope?.issueNumber) === Number(number),
    });

    const batch = {
      contractVersion: CONTRACTS.batch,
      runId,
      mode: options.mode,
      sourceRepository: options.sourceRepository,
      processingCommitSha,
      startedAt: timestamp,
      completedAt: null,
      limit: options.limit,
      stateDirectory: registryStateDir,
      workRoot,
      sourceSnapshotPath: sourcePath,
      selected: selection.selected.map(({ issue, changed }) => ({
        issueNumber: issue.number,
        title: issue.title,
        sourceContentSha256: issue.sourceContentSha256,
        sourceChanged: changed,
      })),
      skipped: selection.skipped.map(({ issue, ...rest }) => ({
        issueNumber: issue.number,
        title: issue.title,
        ...rest,
      })),
      results: [],
      summary: null,
    };
    if (deps.onPlan) {
      deps.onPlan({
        runId,
        mode: options.mode,
        limit: options.limit,
        selected: batch.selected,
        skipped: batch.skipped,
        sourceSnapshotPath: sourcePath,
      });
    }

    if (options.mode === "execute") {
      const runDir = join(workRoot, "runs", runId);
      ensureDir(runDir);
      const intakeCache = join(runDir, "source-cache", "issues");
      ensureDir(intakeCache);
      for (const issue of source.issues) {
        const path = join(
          intakeCache,
          `${String(issue.number).padStart(4, "0")}-${slugify(issue.title)}.md`,
        );
        writePrivate(path, issueMarkdown(issue));
      }

      for (const selected of selection.selected) {
        const { issue, record: previous } = selected;
        const claim = acquireIssueClaim({
          stateDir,
          issue,
          runId,
          timestamp: now(deps),
          timeoutMinutes: options.claimTimeoutMinutes || 120,
          recoverStaleClaims: Boolean(options.recoverStaleClaims),
        });
        if (!claim.acquired) {
          batch.skipped.push({
            issueNumber: issue.number,
            title: issue.title,
            reason: claim.reason,
          });
          continue;
        }

        let record = previous;
        try {
          const reviewResume =
            previous?.processingStatus === "awaiting-loop1-review" &&
            options.reviewedRecommendation;
          const notificationResume =
            previous?.processingStatus === "failed-retriable" &&
            previous.currentOrFinalStage === "notification";
          if (!reviewResume && !notificationResume) {
            record = makeRecord(issue, previous, {
              fetchedAt: source.fetchedAt,
              timestamp: now(deps),
              runId,
              processingCommitSha,
            });
            const workspace = join(
              workRoot,
              "issues",
              `issue-${issue.number}`,
              runId,
            );
            ensureDir(workspace);
            const workspaceSourceDir = join(workspace, "source");
            ensureDir(workspaceSourceDir);
            const workspaceIssuePath = join(
              workspaceSourceDir,
              `${String(issue.number).padStart(4, "0")}-${slugify(issue.title)}.md`,
            );
            writePrivate(workspaceIssuePath, issueMarkdown(issue));
            record.workspacePath = workspace;
            record.issueSnapshotPath = workspaceIssuePath;
            registry.issues[String(issue.number)] = record;
          } else {
            record.claimOwner = runId;
            record.claimTimestamp = now(deps);
            record.latestAttemptTimestamp = now(deps);
            record.attemptCount += 1;
            record.resumeProcessingCommitSha = processingCommitSha;
          }
          if (!reviewResume && !notificationResume) {
            record.processingStatus = "claimed";
          }
          persistRegistry(stateDir, registry, now(deps));
          await processClaimedIssue({
            issue,
            record,
            options,
            deps,
            registry,
            stateDir,
            timestamp,
            runId,
            processingCommitSha,
            workspace: record.workspacePath,
            issuePath: record.issueSnapshotPath,
            intakeCache,
            loop1Dir: join(record.workspacePath, "loop1"),
          });
          batch.results.push(resultFromRecord(record));
        } finally {
          releaseIssueClaim(claim.path);
        }
      }
      if (selection.selected.length > 0) {
        persistRegistry(stateDir, registry, now(deps));
      }
    }

    batch.completedAt = now(deps);
    batch.summary = summarize(batch.results, batch.skipped);
    const manifestPath =
      options.mode === "dry-run"
        ? join(dryRunRoot, "batch-manifest.json")
        : join(workRoot, "runs", runId, "batch-manifest.json");
    atomicWriteJson(manifestPath, batch);
    const summaryPath =
      options.mode === "dry-run"
        ? join(dryRunRoot, "summary.md")
        : join(workRoot, "runs", runId, "summary.md");
    writePrivate(summaryPath, renderSummary(batch));
    return { batch, manifestPath, summaryPath, dryRunRoot };
  } finally {
    releaseGlobal();
    if (options.mode === "dry-run" && options.cleanupDryRun) {
      rmSync(dryRunRoot, { recursive: true, force: true });
    }
  }
}

export function renderSummary(batch) {
  const lines = [
    `# Backlog batch ${batch.runId}`,
    "",
    `- Mode: ${batch.mode}`,
    `- Repository: ${batch.sourceRepository}`,
    `- Limit: ${batch.limit}`,
    `- Selected: ${batch.selected.length}`,
    `- Processed: ${batch.summary.processed}`,
    `- Skipped: ${batch.summary.skipped}`,
    "",
    "## Results",
    "",
  ];
  if (!batch.results.length) lines.push("_No issues processed._", "");
  for (const result of batch.results) {
    lines.push(
      `### #${result.issueNumber}: ${result.title}`,
      "",
      `- State: ${result.processingStatus}`,
      `- Stage: ${result.currentOrFinalStage}`,
      `- Disposition: ${result.disposition || "not yet reviewed"}`,
      `- Combine target: ${result.combineTarget || "none"}`,
      `- Notification: ${result.notificationStatus}`,
      `- Failure: ${result.failureCategory || "none"}`,
      `- Workspace: ${result.workspacePath || "none"}`,
      `- Next: ${result.recommendedNextAction}`,
      "",
    );
  }
  lines.push("## Skipped", "");
  if (!batch.skipped.length) lines.push("_No issues skipped._", "");
  for (const item of batch.skipped) {
    const capacity = item.consumesCapacity
      ? " (reserves one batch slot)"
      : "";
    lines.push(
      `- #${item.issueNumber} ${item.title}: ${item.reason}${capacity}`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
