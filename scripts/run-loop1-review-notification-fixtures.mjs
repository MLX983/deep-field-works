#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  notifyLoop1Review,
  readLedger,
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
  assert.match(result.content.text, /Review packet:/);
  await assert.rejects(fs.access(ledgerPath));
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
  const provider = {
    sendReviewNotification: async () => ({ messageId: `fixture-${++calls}` }),
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
