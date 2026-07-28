#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildNotificationPlan,
  notifyLoop1Review,
  parseLoop1ReviewSummary,
  readLedger,
  safeReviewInstruction,
  safeReviewPacketReference,
} from './lib/loop1-review-notification.mjs';

const root = process.cwd();
const base = path.resolve(process.argv[2] || '/tmp/dfw-loop1-review-notification-fixtures');
const fixtureRoot = path.join(root, 'scripts/fixtures/loop1-review-notification');
const fixtureResultPath = path.join(fixtureRoot, 'loop1-result.md');
const fixturePacketPath = path.join(fixtureRoot, 'review-packet.json');
const configuredEnv = {
  RESEND_API_KEY: 'fixture-key-not-sent',
  DFW_REVIEW_EMAIL_FROM: 'reviews@example.invalid',
  DFW_REVIEW_EMAIL_TO: 'editor@example.invalid',
};
let failures = 0;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

await fs.rm(base, { recursive: true, force: true });
await fs.mkdir(base, { recursive: true });

const sourcePacket = JSON.parse(await fs.readFile(fixturePacketPath, 'utf8'));
const sourceResult = await fs.readFile(fixtureResultPath);
sourcePacket.loop1ResultSha256 = sha256(sourceResult);
const sourceSummary = parseLoop1ReviewSummary(sourceResult.toString('utf8'));

async function writeFixture(name, { packetUpdate = {}, resultUpdate } = {}) {
  const directory = path.join(base, name);
  await fs.mkdir(directory, { recursive: true });
  const resultPath = path.join(directory, 'loop1-result.md');
  const result = resultUpdate ?? sourceResult.toString('utf8');
  await fs.writeFile(resultPath, result);
  const packet = {
    ...structuredClone(sourcePacket),
    ...packetUpdate,
    loop1ResultPath: resultPath,
    loop1ResultSha256: sha256(result),
  };
  const packetPath = path.join(directory, 'review-packet.json');
  await fs.writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`);
  return { packetPath, resultPath };
}

async function check(name, operation) {
  try {
    await operation();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.stack || error.message}`);
  }
}

await check('dry run previews bounded Loop 1 review fields', async () => {
  const fixture = await writeFixture('preview');
  const ledgerPath = path.join(base, 'preview-ledger.json');
  const result = await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath,
  });
  assert.equal(result.result, 'dry-run');
  assert.equal(result.plan.summary.recommendation, 'develop as note');
  assert.equal(result.plan.summary.disposition, 'develop independently');
  assert.equal(result.plan.summary.proposedArtifact, 'note');
  assert.equal(result.plan.summary.domain, 'Human-Machine Workflows');
  assert.equal(result.plan.summary.theme, 'bounded review notifications');
  assert.equal(result.plan.summary.confidence, 'medium');
  assert.match(result.content.text, /Repository commit: 2222/);
  assert.match(result.content.text, /Local review packet:/);
  assert.equal(
    result.content.text.match(/--stop-after-loop2/g)?.length,
    1,
  );
  assert.match(
    result.content.text,
    /--reviewed-recommendation '<local-review-envelope>' --stop-after-loop2/,
  );
  await assert.rejects(fs.access(ledgerPath));
});

await check('subject removes only the exact leading intake transport prefix', async () => {
  const exact = await writeFixture('subject-exact', {
    packetUpdate: { issueTitle: '[DFW Intake] Synthetic subject' },
  });
  const exactResult = await notifyLoop1Review({
    reviewPacketPath: exact.packetPath,
    ledgerPath: path.join(base, 'subject-exact-ledger.json'),
  });
  assert.equal(
    exactResult.plan.subject,
    '[Deep Field Works] Loop 1 review needed — #9902 Synthetic subject',
  );
  assert.match(exactResult.content.text, /Issue #9902: \[DFW Intake\] Synthetic subject/);

  const nearMatch = await writeFixture('subject-near-match', {
    packetUpdate: { issueTitle: '[DFW intake] Synthetic subject' },
  });
  const nearResult = await notifyLoop1Review({
    reviewPacketPath: nearMatch.packetPath,
    ledgerPath: path.join(base, 'subject-near-match-ledger.json'),
  });
  assert.equal(
    nearResult.plan.subject,
    '[Deep Field Works] Loop 1 review needed — #9902 [DFW intake] Synthetic subject',
  );
});

await check('email excludes source body and non-summary sections', async () => {
  const fixture = await writeFixture('privacy');
  const result = await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath: path.join(base, 'privacy-ledger.json'),
  });
  for (const content of [result.content.text, result.content.html]) {
    assert.equal(content.includes('SYNTHETIC PRIVATE SOURCE BODY'), false);
    assert.equal(content.includes('Related material'), false);
    assert.equal(content.includes('Agent notes'), false);
  }
});

await check('human-facing packet references redact unsafe local roots', async () => {
  const pathCases = [
    {
      input: '/Users/example-user/dfw/issues/issue-31/run-macos/loop1/review-packet.json',
      expected: 'Processor workspace: issues/issue-31/run-macos/loop1/review-packet.json',
    },
    {
      input: '/home/example-user/dfw/issues/issue-31/run-linux/loop1/review-packet.json',
      expected: 'Processor workspace: issues/issue-31/run-linux/loop1/review-packet.json',
    },
    {
      input: '/tmp/dfw/issues/issue-31/run-tmp/loop1/review-packet.json',
      expected: 'Processor workspace: issues/issue-31/run-tmp/loop1/review-packet.json',
    },
    {
      input: '/private/tmp/dfw/issues/issue-31/run-private-tmp/loop1/review-packet.json',
      expected: 'Processor workspace: issues/issue-31/run-private-tmp/loop1/review-packet.json',
    },
    {
      input: 'C:\\Users\\example-user\\dfw\\issues\\issue-31\\run-windows\\loop1\\review-packet.json',
      expected: 'Processor workspace: issues/issue-31/run-windows/loop1/review-packet.json',
    },
    {
      input: fixturePacketPath,
      expected: 'Repository-relative: scripts/fixtures/loop1-review-notification/review-packet.json',
    },
    {
      input: '/opt/opaque/review-packet.json',
      expected: 'Local Loop 1 review packet in the processor workspace',
    },
  ];
  for (const pathCase of pathCases) {
    const reference = safeReviewPacketReference(pathCase.input, root);
    assert.equal(reference, pathCase.expected);
    const plan = buildNotificationPlan({
      packet: sourcePacket,
      reviewPacketReference: reference,
      reviewPacketSha256: 'a'.repeat(64),
      summary: sourceSummary,
    });
    for (const rendered of [plan.subject, plan.text, plan.html]) {
      assert.equal(rendered.includes('example-user'), false);
      assert.equal(rendered.includes('/Users/'), false);
      assert.equal(rendered.includes('/home/'), false);
      assert.equal(rendered.includes('/tmp/'), false);
      assert.equal(rendered.includes('/private/tmp/'), false);
      assert.equal(/[a-z]:[\\/]Users[\\/]/i.test(rendered), false);
      assert.equal(rendered.includes('file://'), false);
    }
    assert.match(plan.text, /Open it through the operator environment/);
    assert.match(plan.html, /not a public link/);
  }
});

await check('review instruction removes known machine-specific command paths', async () => {
  const instruction = [
    'npm run backlog:process -- --execute',
    "--repo 'MLX983/dfw-intake'",
    "--repo-path '/Users/example-user/deep-field-works'",
    '--limit 1',
    '--issue-number 9902',
    "--state-dir '/home/example-user/dfw-state'",
    "--work-root '/private/tmp/dfw-work'",
    "--reviewed-recommendation 'C:\\Users\\example-user\\review.json'",
    '--stop-after-loop2',
  ].join(' ');
  const safe = safeReviewInstruction(instruction);
  assert.equal(safe.includes('example-user'), false);
  assert.equal(safe.includes('/Users/'), false);
  assert.equal(safe.includes('/home/'), false);
  assert.equal(safe.includes('/private/tmp/'), false);
  assert.equal(/[a-z]:[\\/]Users[\\/]/i.test(safe), false);
  assert.equal(safe.match(/--stop-after-loop2/g)?.length, 1);
  assert.match(safe, /--repo 'MLX983\/dfw-intake'/);
  assert.match(safe, /--repo-path '<local-repository>'/);
  assert.match(safe, /--state-dir '<local-processor-state>'/);
  assert.match(safe, /--work-root '<local-processor-workspace>'/);
  assert.match(safe, /--reviewed-recommendation '<local-review-envelope>'/);
});

await check('notification key is stable across packet paths and timestamps', async () => {
  const first = await writeFixture('stable-a');
  const second = await writeFixture('stable-b', {
    packetUpdate: { createdAt: '2026-07-27T19:00:00.000Z' },
  });
  const one = await notifyLoop1Review({
    reviewPacketPath: first.packetPath,
    ledgerPath: path.join(base, 'stable-ledger.json'),
  });
  const two = await notifyLoop1Review({
    reviewPacketPath: second.packetPath,
    ledgerPath: path.join(base, 'stable-ledger.json'),
  });
  assert.equal(one.plan.notificationKey, two.plan.notificationKey);
});

await check('notification key is stable across equivalent machine locations', async () => {
  const command = (repoPath, statePath, workPath, envelopePath) => [
    'npm run backlog:process -- --execute',
    "--repo 'MLX983/dfw-intake'",
    `--repo-path '${repoPath}'`,
    '--limit 1',
    '--issue-number 9902',
    `--state-dir '${statePath}'`,
    `--work-root '${workPath}'`,
    `--reviewed-recommendation '${envelopePath}'`,
    '--stop-after-loop2',
  ].join(' ');
  const first = await writeFixture('location-a', {
    packetUpdate: {
      nextCommand: command(
        '/Users/example-user/deep-field-works',
        '/Users/example-user/dfw-state',
        '/tmp/dfw-work',
        '/Users/example-user/review.json',
      ),
    },
  });
  const second = await writeFixture('location-b', {
    packetUpdate: {
      nextCommand: command(
        '/home/example-user/deep-field-works',
        '/home/example-user/dfw-state',
        '/private/tmp/dfw-work',
        '/home/example-user/review.json',
      ),
    },
  });
  const one = await notifyLoop1Review({
    reviewPacketPath: first.packetPath,
    ledgerPath: path.join(base, 'location-ledger.json'),
  });
  const two = await notifyLoop1Review({
    reviewPacketPath: second.packetPath,
    ledgerPath: path.join(base, 'location-ledger.json'),
  });
  assert.equal(one.plan.notificationKey, two.plan.notificationKey);
});

await check('legacy notification key remains locally suppressible', async () => {
  const fixture = await writeFixture('legacy-key');
  const ledgerPath = path.join(base, 'legacy-key-ledger.json');
  const legacyKey = 'fb51c8b563b711a703ab75715c0dc55c0fbf6d3bf3067293c17413fc7643fa7d';
  await fs.writeFile(ledgerPath, `${JSON.stringify({
    contractVersion: 'dfw-loop1-review-notification-ledger.v1',
    attempts: [],
    deliveries: [{
      notificationKey: legacyKey,
      issueNumber: 9902,
      provider: 'resend',
      recipient: `sha256:${'a'.repeat(64)}`,
      deliveredAt: '2026-07-27T20:00:00.000Z',
      result: 'sent',
      providerMessageId: 'legacy-fixture-message',
    }],
  }, null, 2)}\n`);
  const result = await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath,
    send: true,
    env: configuredEnv,
    provider: {
      sendReviewNotification: async () => {
        throw new Error('legacy delivery must suppress provider call');
      },
    },
  });
  assert.equal(result.result, 'duplicate-suppressed');
  assert.equal(result.plan.duplicate, true);
  assert.notEqual(result.plan.notificationKey, legacyKey);
});

await check('meaningful review-state change produces a new key', async () => {
  const first = await writeFixture('change-a');
  const changedMarkdown = sourceResult.toString('utf8').replace(
    '**Confidence:** medium',
    '**Confidence:** high',
  );
  const second = await writeFixture('change-b', { resultUpdate: changedMarkdown });
  const one = await notifyLoop1Review({
    reviewPacketPath: first.packetPath,
    ledgerPath: path.join(base, 'change-ledger.json'),
  });
  const two = await notifyLoop1Review({
    reviewPacketPath: second.packetPath,
    ledgerPath: path.join(base, 'change-ledger.json'),
  });
  assert.notEqual(one.plan.notificationKey, two.plan.notificationKey);
});

await check('successful duplicate is suppressed', async () => {
  const fixture = await writeFixture('duplicate');
  let calls = 0;
  let providerInput;
  const provider = {
    sendReviewNotification: async (input) => {
      providerInput = input;
      return { messageId: `fixture-${++calls}` };
    },
  };
  const ledgerPath = path.join(base, 'duplicate-ledger.json');
  const first = await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath,
    send: true,
    env: configuredEnv,
    provider,
  });
  const second = await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath,
    send: true,
    env: configuredEnv,
    provider,
  });
  assert.equal(first.result, 'sent');
  assert.equal(second.result, 'duplicate-suppressed');
  assert.equal(calls, 1);
  const providerPayload = JSON.stringify(providerInput);
  assert.equal(providerPayload.includes(base), false);
  assert.equal(providerPayload.includes('/tmp/'), false);
  assert.equal(providerPayload.includes('/Users/'), false);
  assert.equal(providerPayload.includes('/home/'), false);
  assert.equal(providerPayload.includes('/private/tmp/'), false);
  assert.equal(providerInput.idempotencyKey, `dfw-loop1-review-${first.plan.notificationKey}`);
  const ledger = await readLedger(ledgerPath);
  assert.equal(ledger.attempts.length, 1);
  assert.equal(ledger.attempts[0].reviewPacketPath, undefined);
  assert.equal(
    ledger.attempts[0].reviewPacketReference,
    'Local Loop 1 review packet in the processor workspace',
  );
  assert.equal(JSON.stringify(ledger).includes(base), false);
  assert.equal(JSON.stringify(ledger).includes('/tmp/'), false);
});

await check('changed state may be sent after earlier successful delivery', async () => {
  const first = await writeFixture('resend-a');
  const changedMarkdown = sourceResult.toString('utf8').replace(
    '**Theme:** bounded review notifications',
    '**Theme:** changed bounded review state',
  );
  const second = await writeFixture('resend-b', { resultUpdate: changedMarkdown });
  let calls = 0;
  const provider = {
    sendReviewNotification: async () => ({ messageId: `resend-${++calls}` }),
  };
  const ledgerPath = path.join(base, 'resend-ledger.json');
  const one = await notifyLoop1Review({
    reviewPacketPath: first.packetPath,
    ledgerPath,
    send: true,
    env: configuredEnv,
    provider,
  });
  const two = await notifyLoop1Review({
    reviewPacketPath: second.packetPath,
    ledgerPath,
    send: true,
    env: configuredEnv,
    provider,
  });
  assert.equal(one.result, 'sent');
  assert.equal(two.result, 'sent');
  assert.equal(calls, 2);
});

await check('failed provider attempt may be retried', async () => {
  const fixture = await writeFixture('retry');
  let calls = 0;
  const provider = {
    sendReviewNotification: async () => {
      calls += 1;
      if (calls === 1) throw new Error('synthetic provider failure');
      return { messageId: 'retry-success' };
    },
  };
  const ledgerPath = path.join(base, 'retry-ledger.json');
  const first = await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath,
    send: true,
    env: configuredEnv,
    provider,
  });
  const second = await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath,
    send: true,
    env: configuredEnv,
    provider,
  });
  assert.equal(first.result, 'provider-failed');
  assert.equal(second.result, 'sent');
  assert.equal(calls, 2);
});

await check('uncertain in-flight attempt is not retried', async () => {
  const fixture = await writeFixture('uncertain');
  const ledgerPath = path.join(base, 'uncertain-ledger.json');
  await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath,
    send: true,
    env: configuredEnv,
    provider: { sendReviewNotification: async () => ({ messageId: 'initial-success' }) },
  });
  const ledger = await readLedger(ledgerPath);
  ledger.attempts[0].result = 'sending';
  delete ledger.attempts[0].providerMessageId;
  ledger.deliveries = [];
  await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  let calls = 0;
  const result = await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath,
    send: true,
    env: configuredEnv,
    provider: {
      sendReviewNotification: async () => {
        calls += 1;
        return { messageId: 'must-not-send' };
      },
    },
  });
  assert.equal(result.result, 'delivery-uncertain');
  assert.equal(calls, 0);
});

await check('tampered Loop 1 result is rejected', async () => {
  const fixture = await writeFixture('tampered');
  await fs.appendFile(fixture.resultPath, '\ntampered\n');
  await assert.rejects(
    notifyLoop1Review({
      reviewPacketPath: fixture.packetPath,
      ledgerPath: path.join(base, 'tampered-ledger.json'),
    }),
    /fingerprint does not match/,
  );
});

await check('malformed packet and malformed ledger are rejected', async () => {
  const fixture = await writeFixture('malformed');
  const packet = JSON.parse(await fs.readFile(fixture.packetPath, 'utf8'));
  packet.approvalRequired = false;
  await fs.writeFile(fixture.packetPath, `${JSON.stringify(packet, null, 2)}\n`);
  await assert.rejects(
    notifyLoop1Review({
      reviewPacketPath: fixture.packetPath,
      ledgerPath: path.join(base, 'malformed-packet-ledger.json'),
    }),
    /approvalRequired/,
  );

  const valid = await writeFixture('malformed-ledger-input');
  const ledgerPath = path.join(base, 'malformed-ledger.json');
  const original = '{ definitely not json\n';
  await fs.writeFile(ledgerPath, original);
  await assert.rejects(
    notifyLoop1Review({ reviewPacketPath: valid.packetPath, ledgerPath }),
    /Malformed Loop 1 notification ledger/,
  );
  assert.equal(await fs.readFile(ledgerPath, 'utf8'), original);
});

await check('unbounded or duplicated Loop 2 review instructions are rejected', async () => {
  for (const [name, nextCommand] of [
    [
      'missing-stop',
      'npm run backlog:process -- --reviewed-recommendation /private/review.json',
    ],
    [
      'duplicate-stop',
      'npm run backlog:process -- --reviewed-recommendation /private/review.json --stop-after-loop2 --stop-after-loop2',
    ],
  ]) {
    const fixture = await writeFixture(name, {
      packetUpdate: { nextCommand },
    });
    await assert.rejects(
      notifyLoop1Review({
        reviewPacketPath: fixture.packetPath,
        ledgerPath: path.join(base, `${name}-ledger.json`),
      }),
      /exactly one --stop-after-loop2/,
    );
  }
});

await check('missing provider configuration fails before send', async () => {
  const fixture = await writeFixture('config');
  let calls = 0;
  await assert.rejects(
    notifyLoop1Review({
      reviewPacketPath: fixture.packetPath,
      ledgerPath: path.join(base, 'config-ledger.json'),
      send: true,
      env: {},
      provider: { sendReviewNotification: async () => { calls += 1; } },
    }),
    /Missing provider configuration/,
  );
  assert.equal(calls, 0);
});

await check('HTML escaping blocks injected markup', async () => {
  const fixture = await writeFixture('escaping', {
    packetUpdate: { issueTitle: '<img src=x onerror=alert(1)>' },
    resultUpdate: sourceResult.toString('utf8').replace(
      'bounded review notifications',
      '<script>alert("theme")</script>',
    ),
  });
  const result = await notifyLoop1Review({
    reviewPacketPath: fixture.packetPath,
    ledgerPath: path.join(base, 'escaping-ledger.json'),
  });
  assert.equal(result.content.html.includes('<script>'), false);
  assert.equal(result.content.html.includes('<img'), false);
  assert.match(result.content.html, /&lt;script&gt;/);
  assert.match(result.content.html, /&lt;img/);
});

await check('concurrent invocations do not duplicate provider send', async () => {
  const fixture = await writeFixture('concurrent');
  let calls = 0;
  const provider = {
    sendReviewNotification: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return { messageId: 'concurrent-success' };
    },
  };
  const ledgerPath = path.join(base, 'concurrent-ledger.json');
  const results = await Promise.all([
    notifyLoop1Review({
      reviewPacketPath: fixture.packetPath,
      ledgerPath,
      send: true,
      env: configuredEnv,
      provider,
    }),
    notifyLoop1Review({
      reviewPacketPath: fixture.packetPath,
      ledgerPath,
      send: true,
      env: configuredEnv,
      provider,
    }),
  ]);
  assert.equal(calls, 1);
  assert.ok(results.some((result) => result.result === 'sent'));
  assert.ok(results.some(
    (result) => ['concurrent-in-progress', 'duplicate-suppressed'].includes(result.result),
  ));
});

if (failures) process.exitCode = 1;
