#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CONTRACTS,
  StageError,
  acquireIssueClaim,
  atomicWriteJson,
  defaultRunLoop1,
  processBacklog,
} from "./lib/backlog-processor.mjs";

const REPO = process.cwd();
const SOURCE_REPO = "MLX983/dfw-intake";
const COMMIT = "1111111111111111111111111111111111111111";
const RESUME_COMMIT = "2222222222222222222222222222222222222222";
const FIXED_NOW = "2026-07-23T12:00:00.000Z";
const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function root(name) {
  return mkdtempSync(join(tmpdir(), `dfw-backlog-${name}-`));
}

function issue(number, title = `Issue ${number}`, body = `Body ${number}`) {
  return {
    number,
    title,
    body,
    state: "OPEN",
    url: `https://github.com/${SOURCE_REPO}/issues/${number}`,
    createdAt: `2026-07-${String(number).padStart(2, "0")}T00:00:00Z`,
    updatedAt: `2026-07-${String(number).padStart(2, "0")}T01:00:00Z`,
  };
}

function options(name, issues, overrides = {}) {
  const directory = root(name);
  const snapshotPath = join(directory, "source.json");
  writeFileSync(snapshotPath, `${JSON.stringify({ issues }, null, 2)}\n`);
  return {
    directory,
    snapshotPath,
    value: {
      mode: "execute",
      sourceRepository: SOURCE_REPO,
      repoPath: REPO,
      limit: 10,
      stateDir: join(directory, "state"),
      workRoot: join(directory, "work"),
      sourceSnapshot: snapshotPath,
      claimTimeoutMinutes: 120,
      ...overrides,
    },
  };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readRegistry(setup) {
  return JSON.parse(
    readFileSync(join(setup.value.stateDir, "registry.v2.json"), "utf8"),
  );
}

function recommendation(issueNumber, disposition = "develop independently") {
  return {
    contractVersion: "loop1-reviewed-recommendation.v1",
    issueNumber,
    disposition,
    suggestedArtifact: "note",
    primaryDomain: "Human-Machine Workflows",
    themeOrCluster: "bounded fixture",
    rationale: "The fixture has enough bounded material for this disposition.",
    nextAction: "Apply the reviewed disposition without publishing.",
    humanApprovalStatus: "approved",
    ...(disposition.startsWith("combine")
      ? { combineTargetReference: "#20" }
      : {}),
  };
}

function mockDeps(overrides = {}) {
  return {
    processingCommitSha: COMMIT,
    now: () => FIXED_NOW,
    runLoop1: async (context) => {
      const resultPath = join(
        context.loop1Dir,
        `loop1-${context.issue.number}-result.md`,
      );
      writeFileSync(
        resultPath,
        `# Loop 1\n\nIssue ${context.issue.number} understood.\n`,
      );
      return { resultPath };
    },
    runLoop2: async (context) => {
      const reviewed = JSON.parse(
        readFileSync(context.recommendationPath, "utf8"),
      );
      const readiness =
        reviewed.disposition === "develop independently"
          ? "ready"
          : reviewed.disposition.startsWith("combine")
            ? "combine-first"
            : reviewed.disposition === "research before development"
              ? "research-required"
              : reviewed.disposition === "not for publication"
                ? "not-for-publication"
                : "insufficient-material";
      const packetPath = join(
        context.loop2Dir,
        `loop2-${context.issue.number}-packet.json`,
      );
      writeJson(packetPath, {
        contractVersion: "loop2-development-packet.v1",
        issueReference: { number: context.issue.number },
        disposition: reviewed.disposition,
        draftReadiness: readiness,
        ...(readiness === "combine-first"
          ? { combinationPlan: { target: { reference: "#20" } } }
          : {}),
      });
      return { packetPath, exitCode: readiness === "ready" ? 0 : 2 };
    },
    runOrchestration: async (context) => {
      const manifestPath = join(
        context.orchestrationDir,
        `loop3-5-${context.issue.number}-manifest.json`,
      );
      writeJson(manifestPath, {
        contractVersion: "loop3-5-orchestration-manifest.v1",
        finalWorkflowStatus: "READY_FOR_HUMAN_EDITORIAL_REVIEW",
      });
      return { manifestPath };
    },
    notifyReview: async () => ({
      status: "dry-run",
      notificationKey: "fixture-notification-key",
    }),
    ...overrides,
  };
}

async function firstPass(setup, deps = mockDeps()) {
  return processBacklog(setup.value, deps);
}

function makeEnvelope(
  setup,
  issueNumber,
  disposition,
  mutate = () => {},
  resumeProcessingCommitSha = COMMIT,
) {
  const record = readRegistry(setup).issues[String(issueNumber)];
  const envelope = {
    contractVersion: CONTRACTS.reviewEnvelope,
    issueNumber,
    sourceContentSha256: record.sourceContentSha256,
    sourceProcessingCommitSha: record.sourceProcessingCommitSha,
    resumeProcessingCommitSha,
    workspacePath: record.workspacePath,
    loop1ResultSha256: record.loop1ResultSha256,
    recommendation: recommendation(issueNumber, disposition),
  };
  mutate(envelope);
  const path = join(setup.directory, `review-${issueNumber}-${Date.now()}.json`);
  writeJson(path, envelope);
  return path;
}

async function resume(
  setup,
  issueNumber,
  disposition = "develop independently",
  mutate = () => {},
  deps = mockDeps(),
) {
  const path = makeEnvelope(
    setup,
    issueNumber,
    disposition,
    mutate,
    deps.processingCommitSha,
  );
  return processBacklog(
    { ...setup.value, reviewedRecommendation: path },
    deps,
  );
}

async function failedLoop2Setup(name) {
  const setup = options(name, [issue(1)], { limit: 1, issueNumber: 1 });
  await firstPass(setup);
  const originalEnvelope = makeEnvelope(
    setup,
    1,
    "develop independently",
    (envelope) => {
      envelope.recommendation.suggestedArtifact = "seed pending sourcing";
    },
  );
  const failed = await processBacklog(
    {
      ...setup.value,
      reviewedRecommendation: originalEnvelope,
      stopAfterLoop2: true,
      stopAfterLoop2Count: 1,
    },
    mockDeps({
      runLoop2: async () => {
        throw new StageError("loop2-failed", "Loop 2 exited 1.", true);
      },
    }),
  );
  assert.equal(failed.batch.results[0].processingStatus, "failed-retriable");
  assert.equal(failed.batch.results[0].currentOrFinalStage, "loop2");
  const record = readRegistry(setup).issues["1"];
  const retryEnvelope = makeEnvelope(
    setup,
    1,
    "develop independently",
    (envelope) => {
      envelope.recommendation.suggestedArtifact = "seed";
      envelope.recommendation.artifactTreatment =
        "retain as seed pending sourcing";
      envelope.recommendation.possibleFutureArtifact =
        "sourced field-report after research";
      envelope.recommendation.researchRequirements = [
        "Hyperscaler AI capital-expenditure trajectories.",
      ];
      envelope.supersedesEnvelopeSha256 = "a".repeat(64);
      envelope.supersessionReason =
        "Correct canonical artifact representation after a pre-packet Loop 2 failure.";
    },
    RESUME_COMMIT,
  );
  return { setup, record, retryEnvelope };
}

test("01 dry-run shows ordered candidates and skip reasons", async () => {
  const setup = options("dry-order", [issue(3), issue(1), issue(2)], {
    mode: "dry-run",
    limit: 2,
  });
  const result = await processBacklog(setup.value, mockDeps());
  assert.deepEqual(
    result.batch.selected.map((item) => item.issueNumber),
    [1, 2],
  );
  assert.equal(result.batch.skipped[0].reason, "batch-limit");
});

test("02 dry-run never invokes Loop 1", async () => {
  let calls = 0;
  const setup = options("dry-no-loop", [issue(1)], { mode: "dry-run" });
  await processBacklog(
    setup.value,
    mockDeps({ runLoop1: async () => (calls += 1) }),
  );
  assert.equal(calls, 0);
});

test("03 dry-run does not create caller state or work roots", async () => {
  const setup = options("dry-no-persist", [issue(1)], { mode: "dry-run" });
  await processBacklog(setup.value, mockDeps());
  assert.equal(existsSync(setup.value.stateDir), false);
  assert.equal(existsSync(setup.value.workRoot), false);
});

test("04 execute stops after Loop 1 for review", async () => {
  const setup = options("loop1-stop", [issue(1)]);
  const result = await firstPass(setup);
  assert.equal(
    result.batch.results[0].processingStatus,
    "awaiting-loop1-review",
  );
  assert.equal(result.batch.results[0].currentOrFinalStage, "loop1-review");
});

test("05 review packet binds source, workspace, commit, and Loop 1 artifact", async () => {
  const setup = options("review-binding", [issue(1)]);
  await firstPass(setup);
  const record = readRegistry(setup).issues["1"];
  const packet = JSON.parse(readFileSync(record.reviewPacketPath, "utf8"));
  assert.equal(packet.sourceContentSha256, record.sourceContentSha256);
  assert.equal(packet.workspacePath, record.workspacePath);
  assert.equal(packet.sourceProcessingCommitSha, COMMIT);
  assert.equal(packet.loop1ResultSha256, record.loop1ResultSha256);
  assert.match(packet.nextCommand, /^npm run backlog:process -- --execute /);
  assert.match(packet.nextCommand, /--repo 'MLX983\/dfw-intake'/);
  assert.match(packet.nextCommand, /--repo-path '.+'/);
  assert.match(packet.nextCommand, /--limit 1/);
  assert.match(packet.nextCommand, /--issue-number 1/);
  assert.match(packet.nextCommand, new RegExp(`--state-dir '${setup.value.stateDir}'`));
  assert.match(packet.nextCommand, new RegExp(`--work-root '${setup.value.workRoot}'`));
  assert.match(
    packet.nextCommand,
    /--reviewed-recommendation '\/absolute\/private\/path\/to\/review-envelope\.json'/,
  );
  assert.equal(
    packet.nextCommand.match(/--stop-after-loop2/g)?.length,
    1,
  );
  assert.match(packet.nextCommand, /--stop-after-loop2$/);
});

test("06 valid approval resumes at Loop 2 without rerunning Loop 1", async () => {
  const setup = options("resume", [issue(1)]);
  await firstPass(setup);
  let loop1Calls = 0;
  const result = await resume(
    setup,
    1,
    "develop independently",
    () => {},
    mockDeps({
      runLoop1: async () => {
        loop1Calls += 1;
        throw new Error("must not run");
      },
    }),
  );
  assert.equal(loop1Calls, 0);
  assert.equal(
    result.batch.results[0].processingStatus,
    "completed-waiting-for-human",
  );
});

for (const [index, field, mutate] of [
  ["07", "source fingerprint", (value) => (value.sourceContentSha256 = "f".repeat(64))],
  ["08", "workspace", (value) => (value.workspacePath = "/tmp/wrong")],
  ["09", "source processing commit", (value) => (value.sourceProcessingCommitSha = "f".repeat(40))],
  ["09b", "resume processing commit", (value) => (value.resumeProcessingCommitSha = "f".repeat(40))],
  ["10", "Loop 1 artifact", (value) => (value.loop1ResultSha256 = "f".repeat(64))],
]) {
  test(`${index} approval with wrong ${field} is rejected`, async () => {
    const setup = options(`wrong-${index}`, [issue(1)]);
    await firstPass(setup);
    const result = await resume(
      setup,
      1,
      "develop independently",
      mutate,
    );
    assert.equal(
      result.batch.results[0].processingStatus,
      "awaiting-loop1-review",
    );
    assert.equal(
      result.batch.results[0].failureCategory,
      "review-envelope-invalid",
    );
  });
}

test("11 approval with wrong recommendation issue is rejected", async () => {
  const setup = options("wrong-issue", [issue(1)]);
  await firstPass(setup);
  const result = await resume(setup, 1, "develop independently", (value) => {
    value.recommendation.issueNumber = 2;
  });
  assert.equal(
    result.batch.results[0].failureCategory,
    "review-envelope-invalid",
  );
});

test("12 unapproved recommendation is rejected", async () => {
  const setup = options("not-approved", [issue(1)]);
  await firstPass(setup);
  const result = await resume(setup, 1, "develop independently", (value) => {
    value.recommendation.humanApprovalStatus = "pending";
  });
  assert.equal(
    result.batch.results[0].failureCategory,
    "review-envelope-invalid",
  );
});

test("13 invalid approved recommendation is rejected", async () => {
  const setup = options("invalid-recommendation", [issue(1)]);
  await firstPass(setup);
  const result = await resume(setup, 1, "develop independently", (value) => {
    delete value.recommendation.rationale;
  });
  assert.equal(
    result.batch.results[0].failureCategory,
    "review-envelope-invalid",
  );
});

test("14 combine-first becomes a stable terminal outcome", async () => {
  const setup = options("combine", [issue(1)]);
  await firstPass(setup);
  const result = await resume(
    setup,
    1,
    "combine with overlapping material",
  );
  assert.equal(
    result.batch.results[0].processingStatus,
    "completed-combine-first",
  );
  assert.equal(result.batch.results[0].combineTarget, "#20");
});

test("15 governance stop becomes a distinct terminal outcome", async () => {
  const setup = options("governance", [issue(1)]);
  await firstPass(setup);
  const result = await resume(setup, 1, "needs human judgment");
  assert.equal(
    result.batch.results[0].processingStatus,
    "completed-governance-stop",
  );
});

test("16 other nondraft disposition becomes a stable terminal outcome", async () => {
  const setup = options("nondraft", [issue(1)]);
  await firstPass(setup);
  const result = await resume(setup, 1, "research before development");
  assert.equal(
    result.batch.results[0].processingStatus,
    "completed-other-nondraft-stop",
  );
});

test("17 notification is attempted only for eligible orchestration status", async () => {
  const setup = options("notify-eligible", [issue(1)]);
  await firstPass(setup);
  let calls = 0;
  await resume(
    setup,
    1,
    "develop independently",
    () => {},
    mockDeps({
      notifyReview: async () => {
        calls += 1;
        return { status: "dry-run", notificationKey: "key" };
      },
    }),
  );
  assert.equal(calls, 1);
});

test("18 notification is skipped for ineligible orchestration status", async () => {
  const setup = options("notify-ineligible", [issue(1)]);
  await firstPass(setup);
  let calls = 0;
  const deps = mockDeps({
    runOrchestration: async (context) => {
      const manifestPath = join(
        context.orchestrationDir,
        "loop3-5-1-manifest.json",
      );
      writeJson(manifestPath, {
        finalWorkflowStatus: "HOLD",
      });
      return { manifestPath };
    },
    notifyReview: async () => {
      calls += 1;
      return { status: "dry-run" };
    },
  });
  const result = await resume(
    setup,
    1,
    "develop independently",
    () => {},
    deps,
  );
  assert.equal(calls, 0);
  assert.equal(result.batch.results[0].notificationStatus, "not-eligible");
});

test("19 notification provider failure remains retriable", async () => {
  const setup = options("notify-failure", [issue(1)]);
  await firstPass(setup);
  const result = await resume(
    setup,
    1,
    "develop independently",
    () => {},
    mockDeps({
      notifyReview: async () => ({
        status: "provider-failed",
        message: "temporary provider error",
      }),
    }),
  );
  assert.equal(result.batch.results[0].processingStatus, "failed-retriable");
  assert.equal(result.batch.results[0].currentOrFinalStage, "notification");
});

test("20 notification retry does not rerun upstream stages", async () => {
  const setup = options("notify-retry", [issue(1)]);
  await firstPass(setup);
  await resume(
    setup,
    1,
    "develop independently",
    () => {},
    mockDeps({
      notifyReview: async () => ({ status: "provider-failed" }),
    }),
  );
  let upstream = 0;
  const result = await processBacklog(
    setup.value,
    mockDeps({
      runLoop1: async () => (upstream += 1),
      runLoop2: async () => (upstream += 1),
      runOrchestration: async () => (upstream += 1),
      notifyReview: async () => ({
        status: "sent",
        notificationKey: "retry-key",
      }),
    }),
  );
  assert.equal(upstream, 0);
  assert.equal(
    result.batch.results[0].processingStatus,
    "completed-waiting-for-human",
  );
});

test("21 unchanged completed issue is skipped on repeat", async () => {
  const setup = options("repeat-complete", [issue(1)]);
  await firstPass(setup);
  await resume(setup, 1);
  const result = await processBacklog(setup.value, mockDeps());
  assert.equal(result.batch.results.length, 0);
  assert.equal(result.batch.skipped[0].reason, "unchanged-completed");
});

test("22 awaiting review issue is skipped without approval", async () => {
  const setup = options("repeat-awaiting", [issue(1)]);
  await firstPass(setup);
  const result = await processBacklog(setup.value, mockDeps());
  assert.equal(result.batch.results.length, 0);
  assert.equal(result.batch.skipped[0].reason, "awaiting-loop1-review");
});

test("23 changed completed source requires explicit reprocessing", async () => {
  const setup = options("changed-skip", [issue(1)]);
  await firstPass(setup);
  await resume(setup, 1);
  writeJson(setup.snapshotPath, { issues: [issue(1, "Issue 1", "Changed")] });
  const result = await processBacklog(setup.value, mockDeps());
  assert.equal(
    result.batch.skipped[0].reason,
    "changed-requires-explicit-reprocess",
  );
});

test("24 explicit changed-source reprocessing preserves prior result", async () => {
  const setup = options("changed-run", [issue(1)]);
  await firstPass(setup);
  await resume(setup, 1);
  writeJson(setup.snapshotPath, { issues: [issue(1, "Issue 1", "Changed")] });
  const result = await processBacklog(
    { ...setup.value, reprocessChanged: true },
    mockDeps(),
  );
  assert.equal(
    result.batch.results[0].processingStatus,
    "awaiting-loop1-review",
  );
  assert.equal(readRegistry(setup).issues["1"].priorResults.length, 1);
});

test("25 batch limit is enforced exactly", async () => {
  const setup = options(
    "limit",
    [issue(1), issue(2), issue(3), issue(4)],
    { limit: 2 },
  );
  const result = await firstPass(setup);
  assert.equal(result.batch.results.length, 2);
  assert.equal(
    result.batch.skipped.filter((item) => item.reason === "batch-limit").length,
    2,
  );
});

test("26 deterministic v1 ordering is issue-number ascending", async () => {
  const setup = options("order", [issue(9), issue(3), issue(7)]);
  const result = await firstPass(setup);
  assert.deepEqual(
    result.batch.results.map((item) => item.issueNumber),
    [3, 7, 9],
  );
});

test("27 same-issue claim acquisition has one winner", () => {
  const directory = root("claim-race");
  const candidate = { ...issue(1), sourceContentSha256: "a".repeat(64) };
  const first = acquireIssueClaim({
    stateDir: directory,
    issue: candidate,
    runId: "one",
    timestamp: FIXED_NOW,
    timeoutMinutes: 120,
    recoverStaleClaims: false,
  });
  const second = acquireIssueClaim({
    stateDir: directory,
    issue: candidate,
    runId: "two",
    timestamp: FIXED_NOW,
    timeoutMinutes: 120,
    recoverStaleClaims: false,
  });
  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
});

test("28 active claims are skipped", async () => {
  const setup = options("active-claim", [issue(1)]);
  acquireIssueClaim({
    stateDir: setup.value.stateDir,
    issue: { ...issue(1), sourceContentSha256: "a".repeat(64) },
    runId: "other",
    timestamp: FIXED_NOW,
    timeoutMinutes: 120,
    recoverStaleClaims: false,
  });
  const result = await firstPass(setup);
  assert.equal(result.batch.skipped[0].reason, "actively-claimed");
});

test("29 stale claims are not reclaimed automatically", async () => {
  const setup = options("stale-no", [issue(1)]);
  acquireIssueClaim({
    stateDir: setup.value.stateDir,
    issue: { ...issue(1), sourceContentSha256: "a".repeat(64) },
    runId: "old",
    timestamp: "2026-07-20T00:00:00.000Z",
    timeoutMinutes: 120,
    recoverStaleClaims: false,
  });
  const result = await firstPass(setup);
  assert.equal(
    result.batch.skipped[0].reason,
    "stale-claim-requires-recovery",
  );
});

test("30 stale claims require and honor explicit recovery", async () => {
  const setup = options("stale-yes", [issue(1)], {
    recoverStaleClaims: true,
  });
  acquireIssueClaim({
    stateDir: setup.value.stateDir,
    issue: { ...issue(1), sourceContentSha256: "a".repeat(64) },
    runId: "old",
    timestamp: "2026-07-20T00:00:00.000Z",
    timeoutMinutes: 120,
    recoverStaleClaims: false,
  });
  const result = await firstPass(setup);
  assert.equal(result.batch.results.length, 1);
  assert.equal(
    readdirSync(join(setup.value.stateDir, "claims", "stale")).length,
    1,
  );
});

test("31 interrupted atomic write does not corrupt prior registry", () => {
  const directory = root("atomic");
  const path = join(directory, "registry.json");
  atomicWriteJson(path, { value: "before" });
  assert.throws(() =>
    atomicWriteJson(path, { value: "after" }, {
      beforeRename: () => {
        throw new Error("simulated interruption");
      },
    }),
  );
  assert.equal(JSON.parse(readFileSync(path, "utf8")).value, "before");
});

test("32 per-issue failure does not stop later issues", async () => {
  const setup = options("isolation", [issue(1), issue(2)]);
  const deps = mockDeps({
    runLoop1: async (context) => {
      if (context.issue.number === 1) {
        throw new StageError("fixture-transient", "fixture failure", true);
      }
      const resultPath = join(context.loop1Dir, "loop1-2-result.md");
      writeFileSync(resultPath, "success");
      return { resultPath };
    },
  });
  const result = await firstPass(setup, deps);
  assert.equal(result.batch.results[0].processingStatus, "failed-retriable");
  assert.equal(
    result.batch.results[1].processingStatus,
    "awaiting-loop1-review",
  );
});

test("32b missing Codex executable is durably diagnosed and remains retriable", async () => {
  const setup = options("missing-codex", [issue(1)]);
  const originalCodexBin = process.env.CODEX_BIN;
  const missingCodexBin = join(setup.directory, "codex-does-not-exist");
  process.env.CODEX_BIN = missingCodexBin;
  try {
    const result = await firstPass(
      setup,
      mockDeps({ runLoop1: defaultRunLoop1 }),
    );
    const failed = result.batch.results[0];
    assert.equal(failed.processingStatus, "failed-retriable");
    assert.equal(failed.failureCategory, "loop1-failed");
    assert.match(failed.failureMessage, /Codex executable not found/);
    assert.match(failed.failureMessage, /ENOENT/);
    assert.match(failed.failureMessage, new RegExp(missingCodexBin));
  } finally {
    if (originalCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = originalCodexBin;
  }
});

test("33 global registry invariant failure stops the batch", async () => {
  const setup = options("global-failure", [issue(1)]);
  const statePath = join(setup.value.stateDir, "registry.v1.json");
  atomicWriteJson(statePath, {
    contractVersion: "wrong",
    sourceRepository: SOURCE_REPO,
    issues: {},
  });
  await assert.rejects(() => firstPass(setup), /Registry invariant failed/);
});

test("34 batch summary is consistent with detailed records", async () => {
  const setup = options("summary", [issue(1), issue(2)], { limit: 1 });
  const result = await firstPass(setup);
  assert.equal(result.batch.summary.processed, result.batch.results.length);
  assert.equal(result.batch.summary.skipped, result.batch.skipped.length);
  assert.equal(
    result.batch.summary.processingStates["awaiting-loop1-review"],
    1,
  );
  assert.equal(result.batch.summary.skipReasons["batch-limit"], 1);
});

test("35 contracts validate and implementation contains no mutation or scheduler path", async () => {
  const setup = options("contracts", [issue(1)]);
  const result = await firstPass(setup);
  const ajv = new Ajv2020({ strict: false });
  ajv.addFormat("date-time", true);
  const sourceSchema = JSON.parse(
    readFileSync(
      join(REPO, "docs/contracts/backlog-source-snapshot.v1.schema.json"),
      "utf8",
    ),
  );
  const registrySchema = JSON.parse(
    readFileSync(
      join(REPO, "docs/contracts/backlog-registry.v2.schema.json"),
      "utf8",
    ),
  );
  const batchSchema = JSON.parse(
    readFileSync(
      join(REPO, "docs/contracts/backlog-batch-manifest.v1.schema.json"),
      "utf8",
    ),
  );
  const envelopeSchema = JSON.parse(
    readFileSync(
      join(
        REPO,
        "docs/contracts/backlog-loop1-review-envelope.v2.schema.json",
      ),
      "utf8",
    ),
  );
  const recommendationSchema = JSON.parse(
    readFileSync(
      join(REPO, "docs/contracts/loop1-reviewed-recommendation.v1.schema.json"),
      "utf8",
    ),
  );
  assert.equal(
    ajv.compile(sourceSchema)(
      JSON.parse(readFileSync(result.batch.sourceSnapshotPath, "utf8")),
    ),
    true,
  );
  assert.equal(ajv.compile(registrySchema)(readRegistry(setup)), true);
  assert.equal(ajv.compile(batchSchema)(result.batch), true);
  ajv.addSchema(recommendationSchema);
  const envelopePath = makeEnvelope(setup, 1, "develop independently");
  assert.equal(
    ajv.compile(envelopeSchema)(JSON.parse(readFileSync(envelopePath, "utf8"))),
    true,
  );
  const implementation = [
    readFileSync(join(REPO, "scripts/backlog-process.mjs"), "utf8"),
    readFileSync(
      join(REPO, "scripts/lib/backlog-processor.mjs"),
      "utf8",
    ),
  ].join("\n");
  assert.doesNotMatch(
    implementation,
    /\bgh\s+issue\s+(?:edit|close|comment|delete|reopen)\b/,
  );
  assert.doesNotMatch(
    implementation,
    /\b(?:cron|setInterval|scheduleJob|webhook)\b/i,
  );
});

test("36 repeated dry-runs have stable selection", async () => {
  const setup = options("dry-repeat", [issue(4), issue(2), issue(8)], {
    mode: "dry-run",
    limit: 2,
  });
  const first = await processBacklog(setup.value, mockDeps());
  const second = await processBacklog(setup.value, mockDeps());
  assert.deepEqual(first.batch.selected, second.batch.selected);
  assert.deepEqual(
    first.batch.skipped.map(({ issueNumber, reason }) => ({
      issueNumber,
      reason,
    })),
    second.batch.skipped.map(({ issueNumber, reason }) => ({
      issueNumber,
      reason,
    })),
  );
});

test("37 retriable process failure is selected again", async () => {
  const setup = options("retry-process", [issue(1)]);
  await firstPass(
    setup,
    mockDeps({
      runLoop1: async () => {
        throw new StageError("temporary-fixture", "retry me", true);
      },
    }),
  );
  const result = await firstPass(setup);
  assert.equal(
    result.batch.results[0].processingStatus,
    "awaiting-loop1-review",
  );
  assert.equal(readRegistry(setup).issues["1"].attemptCount, 2);
});

test("38 terminal process failure is not silently retried", async () => {
  const setup = options("terminal", [issue(1)]);
  await firstPass(
    setup,
    mockDeps({
      runLoop1: async () => ({
        resultPath: join(setup.directory, "missing-loop1.md"),
      }),
    }),
  );
  const result = await firstPass(setup);
  assert.equal(result.batch.results.length, 0);
  assert.equal(result.batch.skipped[0].reason, "failed-terminal");
});

test("39 concurrent global registry lock stops another run", async () => {
  const setup = options("global-lock", [issue(1)]);
  atomicWriteJson(join(setup.value.stateDir, "registry.v2.lock"), {
    runId: "active-run",
    claimedAt: FIXED_NOW,
  });
  await assert.rejects(
    () => firstPass(setup),
    /Global registry lock unavailable/,
  );
});

test("40 no explicit send flag reaches notifier as dry-run", async () => {
  const setup = options("notify-opt-in", [issue(1)]);
  await firstPass(setup);
  let observedSend;
  await resume(
    setup,
    1,
    "develop independently",
    () => {},
    mockDeps({
      notifyReview: async (context) => {
        observedSend = context.send;
        return {
          status: "dry-run",
          notificationKey: "dry-run-key",
        };
      },
    }),
  );
  assert.equal(observedSend, false);
});

test("41 notification dry-run metadata is recorded", async () => {
  const setup = options("notify-record", [issue(1)]);
  await firstPass(setup);
  const result = await resume(setup, 1);
  assert.equal(result.batch.results[0].notificationStatus, "dry-run");
  assert.equal(
    result.batch.results[0].notificationKey,
    "fixture-notification-key",
  );
});

test("42 notifier duplicate suppression result is preserved", async () => {
  const setup = options("notify-duplicate", [issue(1)]);
  await firstPass(setup);
  const result = await resume(
    setup,
    1,
    "develop independently",
    () => {},
    mockDeps({
      notifyReview: async () => ({
        status: "duplicate-suppressed",
        notificationKey: "stable-key",
      }),
    }),
  );
  assert.equal(
    result.batch.results[0].notificationStatus,
    "duplicate-suppressed",
  );
  assert.equal(result.batch.results[0].notificationKey, "stable-key");
});

test("43 issue workspaces do not share active state", async () => {
  const setup = options("workspace-isolation", [issue(1), issue(2)]);
  await firstPass(setup);
  const registry = readRegistry(setup);
  const first = registry.issues["1"];
  const second = registry.issues["2"];
  assert.notEqual(first.workspacePath, second.workspacePath);
  assert.match(first.issueSnapshotPath, /issues\/issue-1\//);
  assert.match(second.issueSnapshotPath, /issues\/issue-2\//);
  assert.equal(first.artifactPaths.includes(second.issueSnapshotPath), false);
});

test("44 source snapshot contains required metadata and recomputed fingerprint", async () => {
  const setup = options("source-metadata", [issue(1)], { mode: "dry-run" });
  const result = await processBacklog(setup.value, mockDeps());
  const snapshot = JSON.parse(
    readFileSync(result.batch.sourceSnapshotPath, "utf8"),
  );
  const source = snapshot.issues[0];
  for (const field of [
    "number",
    "title",
    "url",
    "state",
    "createdAt",
    "updatedAt",
    "body",
    "sourceContentSha256",
  ]) {
    assert.notEqual(source[field], undefined);
  }
  assert.match(source.sourceContentSha256, /^[a-f0-9]{64}$/);
});

test("45 tampered stored Loop 1 artifact cannot be resumed", async () => {
  const setup = options("tampered-loop1", [issue(1)]);
  await firstPass(setup);
  const record = readRegistry(setup).issues["1"];
  writeFileSync(record.loop1ResultPath, "tampered");
  const result = await resume(setup, 1);
  assert.equal(
    result.batch.results[0].failureCategory,
    "review-envelope-invalid",
  );
  assert.match(result.batch.results[0].failureMessage, /loop1ArtifactContent/);
});

test("46 awaiting review consumes capacity and prevents backlog spillover", async () => {
  const setup = options("review-capacity", [issue(1), issue(2)], { limit: 1 });
  await firstPass(setup);
  let loop1Calls = 0;
  const result = await processBacklog(
    setup.value,
    mockDeps({
      runLoop1: async () => {
        loop1Calls += 1;
        throw new Error("must not process a later issue");
      },
    }),
  );
  assert.equal(loop1Calls, 0);
  assert.equal(result.batch.results.length, 0);
  assert.equal(result.batch.skipped[0].reason, "awaiting-loop1-review");
  assert.equal(result.batch.skipped[0].consumesCapacity, true);
  assert.equal(result.batch.skipped[1].reason, "batch-limit");
  assert.equal(readRegistry(setup).issues["2"], undefined);
});

test("47 stale global lock requires and honors explicit recovery", async () => {
  const setup = options("stale-global", [issue(1)], {
    recoverStaleClaims: true,
  });
  atomicWriteJson(join(setup.value.stateDir, "registry.v2.lock"), {
    runId: "abandoned-run",
    claimedAt: "2026-07-20T00:00:00.000Z",
  });
  const result = await firstPass(setup);
  assert.equal(result.batch.results.length, 1);
  assert.equal(
    readdirSync(join(setup.value.stateDir, "claims", "stale")).some((name) =>
      name.startsWith("registry-"),
    ),
    true,
  );
});

test("48 approval without an awaiting registry record is rejected", async () => {
  const setup = options("orphan-approval", [issue(1)]);
  const path = join(setup.directory, "orphan-review.json");
  writeJson(path, {
    contractVersion: CONTRACTS.reviewEnvelope,
    issueNumber: 1,
    sourceContentSha256: "a".repeat(64),
    sourceProcessingCommitSha: COMMIT,
    resumeProcessingCommitSha: COMMIT,
    workspacePath: join(setup.directory, "missing"),
    loop1ResultSha256: "b".repeat(64),
    recommendation: recommendation(1),
  });
  await assert.rejects(
    () =>
      processBacklog(
        { ...setup.value, reviewedRecommendation: path },
        mockDeps(),
      ),
    /no matching issue is awaiting Loop 1 review/,
  );
});

test("49 resume accepts distinct correctly bound source and resume commits", async () => {
  const setup = options("dual-commit", [issue(1)]);
  await firstPass(
    setup,
    mockDeps({ processingCommitSha: COMMIT }),
  );
  let loop1Calls = 0;
  const result = await resume(
    setup,
    1,
    "not for publication",
    () => {},
    mockDeps({
      processingCommitSha: RESUME_COMMIT,
      runLoop1: async () => {
        loop1Calls += 1;
        throw new Error("completed Loop 1 must not rerun");
      },
    }),
  );
  const record = readRegistry(setup).issues["1"];
  assert.equal(loop1Calls, 0);
  assert.equal(
    result.batch.results[0].processingStatus,
    "completed-other-nondraft-stop",
  );
  assert.equal(record.sourceProcessingCommitSha, COMMIT);
  assert.equal(record.resumeProcessingCommitSha, RESUME_COMMIT);
  assert.equal(
    record.attemptHistory.at(-1).processorCommitSha,
    RESUME_COMMIT,
  );
});

test("50 legacy v1 review envelope fails safely", async () => {
  const setup = options("legacy-envelope", [issue(1)]);
  await firstPass(setup);
  const record = readRegistry(setup).issues["1"];
  const path = join(setup.directory, "legacy-envelope.json");
  writeJson(path, {
    contractVersion: "backlog-loop1-review-envelope.v1",
    issueNumber: 1,
    sourceContentSha256: record.sourceContentSha256,
    processingCommitSha: record.sourceProcessingCommitSha,
    workspacePath: record.workspacePath,
    loop1ResultSha256: record.loop1ResultSha256,
    recommendation: recommendation(1),
  });
  const result = await processBacklog(
    { ...setup.value, reviewedRecommendation: path },
    mockDeps(),
  );
  assert.equal(
    result.batch.results[0].processingStatus,
    "awaiting-loop1-review",
  );
  assert.equal(
    result.batch.results[0].failureCategory,
    "review-envelope-invalid",
  );
});

test("51 legacy v1 registry migrates without losing original commit", async () => {
  const setup = options("legacy-registry", [issue(1)]);
  await firstPass(setup);
  const registryV2 = readRegistry(setup);
  const recordV2 = registryV2.issues["1"];
  const registryV1 = structuredClone(registryV2);
  registryV1.contractVersion = "backlog-registry.v1";
  delete registryV1.migrationHistory;
  for (const record of Object.values(registryV1.issues)) {
    record.stateRecordVersion = 1;
    record.processingCommitSha = record.sourceProcessingCommitSha;
    delete record.sourceProcessingCommitSha;
    delete record.resumeProcessingCommitSha;
  }
  const v1Path = join(setup.value.stateDir, "registry.v1.json");
  const v2Path = join(setup.value.stateDir, "registry.v2.json");
  writeJson(v1Path, registryV1);
  unlinkSync(v2Path);

  const envelopePath = join(setup.directory, "migration-envelope.json");
  writeJson(envelopePath, {
    contractVersion: CONTRACTS.reviewEnvelope,
    issueNumber: 1,
    sourceContentSha256: recordV2.sourceContentSha256,
    sourceProcessingCommitSha: COMMIT,
    resumeProcessingCommitSha: RESUME_COMMIT,
    workspacePath: recordV2.workspacePath,
    loop1ResultSha256: recordV2.loop1ResultSha256,
    recommendation: recommendation(1, "not for publication"),
  });
  const result = await processBacklog(
    {
      ...setup.value,
      reviewedRecommendation: envelopePath,
    },
    mockDeps({ processingCommitSha: RESUME_COMMIT }),
  );
  const migrated = readRegistry(setup);
  assert.equal(
    result.batch.results[0].processingStatus,
    "completed-other-nondraft-stop",
  );
  assert.equal(migrated.contractVersion, "backlog-registry.v2");
  assert.equal(migrated.issues["1"].sourceProcessingCommitSha, COMMIT);
  assert.equal(
    migrated.issues["1"].resumeProcessingCommitSha,
    RESUME_COMMIT,
  );
  assert.equal(
    migrated.migrationHistory[0].fromContractVersion,
    "backlog-registry.v1",
  );
  assert.equal(existsSync(v1Path), true);
});

test("52 outer envelope issue-number mismatch is rejected", async () => {
  const setup = options("outer-issue-mismatch", [issue(1)]);
  await firstPass(setup);
  const path = makeEnvelope(
    setup,
    1,
    "develop independently",
    (value) => {
      value.issueNumber = 2;
    },
  );
  await assert.rejects(
    () =>
      processBacklog(
        { ...setup.value, reviewedRecommendation: path },
        mockDeps(),
      ),
    /no matching issue is awaiting Loop 1 review/,
  );
});

test("53 completed resume replay validates and performs no upstream work", async () => {
  const setup = options("completed-resume-replay", [issue(1)]);
  await firstPass(setup);
  const envelopePath = makeEnvelope(
    setup,
    1,
    "not for publication",
  );
  await processBacklog(
    { ...setup.value, reviewedRecommendation: envelopePath },
    mockDeps(),
  );
  const registryPath = join(setup.value.stateDir, "registry.v2.json");
  const registryBefore = readFileSync(registryPath, "utf8");
  let upstreamCalls = 0;
  const replay = await processBacklog(
    { ...setup.value, reviewedRecommendation: envelopePath },
    mockDeps({
      runLoop1: async () => {
        upstreamCalls += 1;
        throw new Error("Loop 1 must not rerun");
      },
      runLoop2: async () => {
        upstreamCalls += 1;
        throw new Error("Loop 2 must not rerun");
      },
      runOrchestration: async () => {
        upstreamCalls += 1;
        throw new Error("orchestration must not rerun");
      },
      notifyReview: async () => {
        upstreamCalls += 1;
        throw new Error("notification must not rerun");
      },
    }),
  );
  assert.equal(upstreamCalls, 0);
  assert.equal(replay.batch.results.length, 0);
  assert.equal(replay.batch.skipped[0].reason, "unchanged-completed");
  assert.equal(readFileSync(registryPath, "utf8"), registryBefore);
});

test("54 dry-run reads existing capacity state without mutating it", async () => {
  const setup = options("dry-existing-state", [issue(1), issue(2)], {
    limit: 1,
  });
  await firstPass(setup);
  const registryPath = join(setup.value.stateDir, "registry.v2.json");
  const registryBefore = readFileSync(registryPath, "utf8");
  const dryRun = await processBacklog(
    { ...setup.value, mode: "dry-run" },
    mockDeps(),
  );
  assert.equal(dryRun.batch.selected.length, 0);
  assert.deepEqual(
    dryRun.batch.skipped.map(({ issueNumber, reason, consumesCapacity }) => ({
      issueNumber,
      reason,
      consumesCapacity,
    })),
    [
      {
        issueNumber: 1,
        reason: "awaiting-loop1-review",
        consumesCapacity: true,
      },
      {
        issueNumber: 2,
        reason: "batch-limit",
        consumesCapacity: undefined,
      },
    ],
  );
  assert.equal(readFileSync(registryPath, "utf8"), registryBefore);
});

test("55 changed awaiting review still reserves batch capacity", async () => {
  const setup = options("changed-awaiting-capacity", [
    issue(1),
    issue(2),
    issue(3),
  ], {
    limit: 1,
  });
  await firstPass(setup);
  const changedIssues = [
    issue(1, "Issue 1", "Changed body"),
    issue(2),
    issue(3),
  ];
  writeJson(setup.snapshotPath, { issues: changedIssues });
  const dryRun = await processBacklog(
    { ...setup.value, mode: "dry-run", limit: 2 },
    mockDeps(),
  );
  assert.deepEqual(
    dryRun.batch.selected.map((item) => item.issueNumber),
    [2],
  );
  const awaiting = dryRun.batch.skipped.find(
    (item) => item.issueNumber === 1,
  );
  assert.equal(awaiting.reason, "awaiting-loop1-review");
  assert.equal(awaiting.consumesCapacity, true);
  assert.equal(awaiting.sourceChanged, true);
  assert.equal(typeof awaiting.previousFingerprint, "string");
  assert.equal(typeof awaiting.currentFingerprint, "string");
  assert.equal(
    dryRun.batch.skipped.find((item) => item.issueNumber === 3).reason,
    "batch-limit",
  );
});

test("56 explicit issue target excludes earlier eligible issues", async () => {
  const setup = options("issue-target", [issue(1), issue(2), issue(3)], {
    mode: "dry-run",
    limit: 1,
    issueNumber: 2,
  });
  const result = await processBacklog(setup.value, mockDeps());
  assert.deepEqual(
    result.batch.selected.map((item) => item.issueNumber),
    [2],
  );
  assert.equal(result.batch.targetIssueNumber, 2);
  assert.equal(result.batch.skipped.length, 0);
});

test("57 targeted changed awaiting issue reprocesses into new history", async () => {
  const setup = options("targeted-awaiting-reprocess", [issue(1), issue(2)]);
  await firstPass(setup);
  const registryBefore = readRegistry(setup);
  const priorIssue1 = structuredClone(registryBefore.issues["1"]);
  const priorIssue2 = structuredClone(registryBefore.issues["2"]);
  writeJson(setup.snapshotPath, {
    issues: [issue(1), issue(2, "Issue 2", "Changed body")],
  });
  const result = await processBacklog(
    {
      ...setup.value,
      limit: 1,
      issueNumber: 2,
      reprocessChanged: true,
    },
    mockDeps(),
  );
  const registryAfter = readRegistry(setup);
  const refreshed = registryAfter.issues["2"];
  assert.deepEqual(registryAfter.issues["1"], priorIssue1);
  assert.equal(result.batch.results[0].issueNumber, 2);
  assert.equal(refreshed.processingStatus, "awaiting-loop1-review");
  assert.notEqual(refreshed.workspacePath, priorIssue2.workspacePath);
  assert.notEqual(
    refreshed.sourceContentSha256,
    priorIssue2.sourceContentSha256,
  );
  assert.equal(refreshed.priorResults.length, 1);
  assert.equal(
    refreshed.priorResults[0].workspacePath,
    priorIssue2.workspacePath,
  );
  assert.equal(refreshed.attemptHistory.length, 2);
});

test("58 explicit Loop 2 stop records ready state without drafting", async () => {
  const setup = options("loop2-only", [issue(1)]);
  await firstPass(setup);
  const envelopePath = makeEnvelope(
    setup,
    1,
    "develop independently",
  );
  let loop1Calls = 0;
  let loop2Calls = 0;
  let orchestrationCalls = 0;
  let notificationCalls = 0;
  const deps = mockDeps();
  const result = await processBacklog(
    {
      ...setup.value,
      reviewedRecommendation: envelopePath,
      stopAfterLoop2: true,
    },
    {
      ...deps,
      runLoop1: async () => {
        loop1Calls += 1;
        throw new Error("Loop 1 must not rerun");
      },
      runLoop2: async (context) => {
        loop2Calls += 1;
        return deps.runLoop2(context);
      },
      runOrchestration: async () => {
        orchestrationCalls += 1;
        throw new Error("orchestration must not run");
      },
      notifyReview: async () => {
        notificationCalls += 1;
        throw new Error("notification must not run");
      },
    },
  );
  const record = readRegistry(setup).issues["1"];
  assert.equal(loop1Calls, 0);
  assert.equal(loop2Calls, 1);
  assert.equal(orchestrationCalls, 0);
  assert.equal(notificationCalls, 0);
  assert.equal(record.processingStatus, "completed-waiting-for-human");
  assert.equal(record.currentOrFinalStage, "loop2");
  assert.equal(record.finalWorkflowStatus, "ready");
  assert.equal(record.notificationEligibility, false);
  assert.equal(record.notificationStatus, "not-attempted");
  assert.equal(record.attemptCount, 2);
  assert.equal(existsSync(join(record.workspacePath, "orchestration")), false);
  assert.match(
    result.batch.results[0].recommendedNextAction,
    /explicitly authorize drafting/,
  );
});

test("58a failed Loop 2 retries in place without rerunning Loop 1", async () => {
  const { setup, record: failedRecord, retryEnvelope } =
    await failedLoop2Setup("loop2-retry");
  let loop1Calls = 0;
  let loop2Calls = 0;
  let laterCalls = 0;
  const deps = mockDeps({
    processingCommitSha: RESUME_COMMIT,
    repositoryIsClean: () => true,
    runLoop1: async () => {
      loop1Calls += 1;
      throw new Error("Loop 1 must not rerun");
    },
    runLoop2: async (context) => {
      loop2Calls += 1;
      const packetPath = join(context.loop2Dir, "loop2-1-packet.json");
      writeJson(packetPath, {
        contractVersion: "loop2-development-packet.v1",
        issueReference: { number: 1 },
        disposition: "develop independently",
        draftReadiness: "ready",
      });
      return { packetPath };
    },
    runOrchestration: async () => {
      laterCalls += 1;
      throw new Error("Loops 3-5 must not run");
    },
    notifyReview: async () => {
      laterCalls += 1;
      throw new Error("Publication or notification must not run");
    },
  });
  await processBacklog(
    {
      ...setup.value,
      reviewedRecommendation: retryEnvelope,
      retryLoop2: true,
      stopAfterLoop2: true,
      stopAfterLoop2Count: 1,
    },
    deps,
  );
  const record = readRegistry(setup).issues["1"];
  assert.equal(loop1Calls, 0);
  assert.equal(loop2Calls, 1);
  assert.equal(laterCalls, 0);
  assert.equal(record.workspacePath, failedRecord.workspacePath);
  assert.equal(record.loop1ResultSha256, failedRecord.loop1ResultSha256);
  assert.equal(record.processingStatus, "completed-waiting-for-human");
  assert.equal(record.currentOrFinalStage, "loop2");
  assert.equal(record.attemptCount, 3);
  assert.match(record.loop2PacketPath, /\/loop2\/retry-3\/loop2-1-packet\.json$/);
  const archived = JSON.parse(readFileSync(join(
    record.workspacePath,
    "loop1",
    "reviewed-recommendation.pre-loop2-retry.json",
  ), "utf8"));
  assert.equal(archived.suggestedArtifact, "seed pending sourcing");
  const corrected = JSON.parse(readFileSync(join(
    record.workspacePath,
    "loop1",
    "reviewed-recommendation.json",
  ), "utf8"));
  assert.equal(corrected.suggestedArtifact, "seed");
  assert.equal(corrected.artifactTreatment, "retain as seed pending sourcing");
  assert.equal(
    corrected.possibleFutureArtifact,
    "sourced field-report after research",
  );
  assert.equal(existsSync(join(record.workspacePath, "orchestration")), false);
});

test("58b Loop 2 retry rejects immutable binding changes", async () => {
  const { setup, retryEnvelope } = await failedLoop2Setup("loop2-retry-binding");
  const envelope = JSON.parse(readFileSync(retryEnvelope, "utf8"));
  envelope.loop1ResultSha256 = "b".repeat(64);
  writeJson(retryEnvelope, envelope);
  await assert.rejects(
    () => processBacklog({
      ...setup.value,
      reviewedRecommendation: retryEnvelope,
      retryLoop2: true,
      stopAfterLoop2: true,
      stopAfterLoop2Count: 1,
    }, mockDeps({
      processingCommitSha: RESUME_COMMIT,
      repositoryIsClean: () => true,
    })),
    /loop1ResultSha256/,
  );
});

test("58c Loop 2 retry rejects an existing packet", async () => {
  const { setup, record, retryEnvelope } = await failedLoop2Setup("loop2-retry-packet");
  writeJson(join(record.workspacePath, "loop2", "loop2-1-packet.json"), {});
  await assert.rejects(
    () => processBacklog({
      ...setup.value,
      reviewedRecommendation: retryEnvelope,
      retryLoop2: true,
      stopAfterLoop2: true,
      stopAfterLoop2Count: 1,
    }, mockDeps({
      processingCommitSha: RESUME_COMMIT,
      repositoryIsClean: () => true,
    })),
    /packet or downstream record already exists/,
  );
});

test("58d Loop 2 retry requires exactly one stop flag", async () => {
  const { setup, retryEnvelope } = await failedLoop2Setup("loop2-retry-stop");
  await assert.rejects(
    () => processBacklog({
      ...setup.value,
      reviewedRecommendation: retryEnvelope,
      retryLoop2: true,
      stopAfterLoop2: false,
      stopAfterLoop2Count: 0,
    }, mockDeps({
      processingCommitSha: RESUME_COMMIT,
      repositoryIsClean: () => true,
    })),
    /exactly one --stop-after-loop2/,
  );
});

test("58e Loop 2 retry requires a clean repository", async () => {
  const { setup, retryEnvelope } = await failedLoop2Setup("loop2-retry-clean");
  await assert.rejects(
    () => processBacklog({
      ...setup.value,
      reviewedRecommendation: retryEnvelope,
      retryLoop2: true,
      stopAfterLoop2: true,
      stopAfterLoop2Count: 1,
    }, mockDeps({
      processingCommitSha: RESUME_COMMIT,
      repositoryIsClean: () => false,
    })),
    /requires a clean repository/,
  );
});

test("59 completed Loop 2 stop replays without upstream work", async () => {
  const setup = options("loop2-only-replay", [issue(1)]);
  await firstPass(setup);
  const envelopePath = makeEnvelope(
    setup,
    1,
    "develop independently",
  );
  const runOptions = {
    ...setup.value,
    reviewedRecommendation: envelopePath,
    stopAfterLoop2: true,
  };
  await processBacklog(runOptions, mockDeps());
  const registryPath = join(setup.value.stateDir, "registry.v2.json");
  const registryBefore = readFileSync(registryPath, "utf8");
  let upstreamCalls = 0;
  const replay = await processBacklog(
    runOptions,
    mockDeps({
      runLoop1: async () => (upstreamCalls += 1),
      runLoop2: async () => (upstreamCalls += 1),
      runOrchestration: async () => (upstreamCalls += 1),
      notifyReview: async () => (upstreamCalls += 1),
    }),
  );
  assert.equal(upstreamCalls, 0);
  assert.equal(replay.batch.results.length, 0);
  assert.equal(replay.batch.skipped[0].reason, "unchanged-completed");
  assert.equal(readFileSync(registryPath, "utf8"), registryBefore);
});

let failed = 0;
for (const fixture of tests) {
  try {
    await fixture.run();
    process.stdout.write(`PASS ${fixture.name}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`FAIL ${fixture.name}\n${error.stack}\n`);
  }
}

process.stdout.write(
  `\nBacklog processor fixtures: ${tests.length - failed}/${tests.length} passed.\n`,
);
if (failed) process.exitCode = 1;
