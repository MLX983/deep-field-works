#!/usr/bin/env node

import { processBacklog } from "./lib/backlog-processor.mjs";

function usage() {
  return `Usage:
  npm run backlog:process -- --dry-run --repo OWNER/REPO --repo-path PATH --limit N --state-dir PATH --work-root PATH
  npm run backlog:process -- --execute --repo OWNER/REPO --repo-path PATH --limit N --state-dir PATH --work-root PATH

Options:
  --source-snapshot PATH           Use an immutable local issue snapshot instead of GitHub.
  --reviewed-recommendation PATH   Resume one awaiting issue with a bound approval envelope.
  --reprocess-changed              Reprocess a completed issue whose source changed.
  --recover-stale-claims           Recover claims older than the configured timeout.
  --claim-timeout-minutes N        Stale threshold (default: 120).
  --send-notifications             Permit delivery by the existing notifier.
`;
}

function parseArgs(argv) {
  const options = {
    mode: null,
    sendNotification: false,
    reprocessChanged: false,
    recoverStaleClaims: false,
    claimTimeoutMinutes: 120,
  };
  const values = new Map([
    ["--repo", "sourceRepository"],
    ["--source-repo", "sourceRepository"],
    ["--repo-path", "repoPath"],
    ["--limit", "limit"],
    ["--state-dir", "stateDir"],
    ["--work-root", "workRoot"],
    ["--source-snapshot", "sourceSnapshot"],
    ["--reviewed-recommendation", "reviewedRecommendation"],
    ["--claim-timeout-minutes", "claimTimeoutMinutes"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run" || arg === "--execute") {
      if (options.mode) {
        throw new Error("Choose exactly one of --dry-run or --execute.");
      }
      options.mode = arg.slice(2);
    } else if (
      arg === "--send-notifications" ||
      arg === "--send-notification"
    ) {
      options.sendNotification = true;
    } else if (arg === "--reprocess-changed") {
      options.reprocessChanged = true;
    } else if (arg === "--recover-stale-claims") {
      options.recoverStaleClaims = true;
    } else if (values.has(arg)) {
      const value = argv[++index];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      options[values.get(arg)] = value;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  options.limit = Number(options.limit);
  options.claimTimeoutMinutes = Number(options.claimTimeoutMinutes);
  for (const required of [
    "mode",
    "sourceRepository",
    "repoPath",
    "stateDir",
    "workRoot",
  ]) {
    if (!options[required] && !options.help) {
      throw new Error(`Missing required option: ${required}.`);
    }
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
  } else {
    const result = await processBacklog(options, {
      onPlan: (plan) => {
        process.stderr.write(`Backlog batch plan:\n${JSON.stringify(plan, null, 2)}\n`);
      },
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          runId: result.batch.runId,
          mode: result.batch.mode,
          manifestPath: result.manifestPath,
          summaryPath: result.summaryPath,
          summary: result.batch.summary,
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = result.batch.results.some((item) =>
      item.processingStatus.startsWith("failed-"),
    )
      ? 2
      : 0;
  }
} catch (error) {
  process.stderr.write(`Backlog processor failed: ${error.message}\n\n${usage()}`);
  process.exitCode = 1;
}
