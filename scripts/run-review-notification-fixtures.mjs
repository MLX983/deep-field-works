#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { notifyReview, readLedger } from './lib/review-notification.mjs';

const root = process.cwd();
const base = path.resolve(process.argv[2] || '/tmp/dfw-review-notification-fixtures');
const fixturePath = path.join(root, 'scripts/fixtures/review-notification/eligible-manifest.json');
const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
const configuredEnv = { RESEND_API_KEY: 'fixture-key-not-sent', DFW_REVIEW_EMAIL_FROM: 'reviews@example.invalid', DFW_REVIEW_EMAIL_TO: 'editor@example.invalid' };
let failures = 0;

await fs.rm(base, { recursive: true, force: true });
await fs.mkdir(base, { recursive: true });

async function writeManifest(name, update = {}) {
  const target = path.join(base, `${name}.json`);
  const manifest = structuredClone(fixture);
  Object.assign(manifest, update);
  await fs.writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
  return target;
}

async function check(name, operation) {
  try {
    await operation();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

await check('eligible READY_FOR_HUMAN_EDITORIAL_REVIEW', async () => {
  const result = await notifyReview({ manifestPath: fixturePath, ledgerPath: path.join(base, 'ready-ledger.json') });
  assert.equal(result.result, 'dry-run'); assert.equal(result.plan.eligible, true);
});

await check('eligible WAITING_FOR_HUMAN', async () => {
  const manifestPath = await writeManifest('waiting', { finalWorkflowStatus: 'WAITING_FOR_HUMAN', stoppedAtStage: 'loop5', humanInputRequests: ['Supply a synthetic example.'] });
  const result = await notifyReview({ manifestPath, ledgerPath: path.join(base, 'waiting-ledger.json') });
  assert.equal(result.result, 'dry-run'); assert.equal(result.plan.eligible, true);
});

await check('eligible PARTIALLY_REVISED_WAITING_FOR_HUMAN', async () => {
  const manifestPath = await writeManifest('partial', { finalWorkflowStatus: 'PARTIALLY_REVISED_WAITING_FOR_HUMAN', stoppedAtStage: 'loop5', humanInputRequests: ['Verify the synthetic claim.'] });
  const result = await notifyReview({ manifestPath, ledgerPath: path.join(base, 'partial-ledger.json') });
  assert.equal(result.result, 'dry-run'); assert.equal(result.plan.eligible, true);
});

await check('ineligible status sends and records nothing', async () => {
  const manifestPath = await writeManifest('hold', { finalWorkflowStatus: 'HOLD' });
  let calls = 0;
  const ledgerPath = path.join(base, 'hold-ledger.json');
  const result = await notifyReview({ manifestPath, ledgerPath, send: true, env: configuredEnv, provider: { sendReviewNotification: async () => { calls += 1; } } });
  assert.equal(result.result, 'not-eligible'); assert.equal(calls, 0);
  await assert.rejects(fs.access(ledgerPath));
});

await check('dry run makes no provider call or ledger write', async () => {
  let calls = 0;
  const ledgerPath = path.join(base, 'dry-ledger.json');
  const result = await notifyReview({ manifestPath: fixturePath, ledgerPath, env: configuredEnv, provider: { sendReviewNotification: async () => { calls += 1; } } });
  assert.equal(result.result, 'dry-run'); assert.equal(calls, 0);
  await assert.rejects(fs.access(ledgerPath));
});

await check('email omits complete draft body', async () => {
  const secretDraft = 'FULL SYNTHETIC UNPUBLISHED DRAFT BODY MUST NEVER LEAVE THIS FILE';
  await fs.writeFile(path.join(base, 'synthetic-draft.md'), secretDraft);
  const result = await notifyReview({ manifestPath: fixturePath, ledgerPath: path.join(base, 'privacy-ledger.json') });
  assert.equal(result.content.text.includes(secretDraft), false); assert.equal(result.content.html.includes(secretDraft), false);
});

await check('notification key is stable', async () => {
  const first = await notifyReview({ manifestPath: fixturePath, ledgerPath: path.join(base, 'stable-ledger.json') });
  const second = await notifyReview({ manifestPath: fixturePath, ledgerPath: path.join(base, 'stable-ledger.json') });
  assert.equal(first.plan.notificationKey, second.plan.notificationKey);
});

await check('successful duplicate is suppressed', async () => {
  let calls = 0;
  const provider = { sendReviewNotification: async () => ({ messageId: `fixture-${++calls}` }) };
  const ledgerPath = path.join(base, 'duplicate-ledger.json');
  const first = await notifyReview({ manifestPath: fixturePath, ledgerPath, send: true, env: configuredEnv, provider });
  const second = await notifyReview({ manifestPath: fixturePath, ledgerPath, send: true, env: configuredEnv, provider });
  assert.equal(first.result, 'sent'); assert.equal(second.result, 'duplicate-suppressed'); assert.equal(calls, 1);
});

await check('failed provider attempt may be retried', async () => {
  let calls = 0;
  const provider = { sendReviewNotification: async () => { calls += 1; if (calls === 1) throw new Error('synthetic provider failure'); return { messageId: 'retry-success' }; } };
  const ledgerPath = path.join(base, 'retry-ledger.json');
  const first = await notifyReview({ manifestPath: fixturePath, ledgerPath, send: true, env: configuredEnv, provider });
  const second = await notifyReview({ manifestPath: fixturePath, ledgerPath, send: true, env: configuredEnv, provider });
  assert.equal(first.result, 'provider-failed'); assert.equal(second.result, 'sent'); assert.equal(calls, 2);
});

await check('uncertain in-flight attempt is not retried', async () => {
  const ledgerPath = path.join(base, 'uncertain-ledger.json');
  await notifyReview({ manifestPath: fixturePath, ledgerPath, send: true, env: configuredEnv, provider: { sendReviewNotification: async () => ({ messageId: 'synthetic-initial-success' }) } });
  const ledger = await readLedger(ledgerPath);
  ledger.attempts[0].result = 'sending'; delete ledger.attempts[0].providerMessageId; ledger.deliveries = [];
  await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  let calls = 0;
  const result = await notifyReview({ manifestPath: fixturePath, ledgerPath, send: true, env: configuredEnv, provider: { sendReviewNotification: async () => { calls += 1; return { messageId: 'must-not-send' }; } } });
  assert.equal(result.result, 'delivery-uncertain'); assert.equal(calls, 0);
});

await check('malformed manifest is rejected', async () => {
  const manifestPath = await writeManifest('malformed', { artifacts: 'not-an-array' });
  await assert.rejects(notifyReview({ manifestPath, ledgerPath: path.join(base, 'malformed-manifest-ledger.json') }), /Malformed manifest/);
});

await check('malformed ledger is rejected without overwrite', async () => {
  const ledgerPath = path.join(base, 'malformed-ledger.json');
  const original = '{ definitely not json\n'; await fs.writeFile(ledgerPath, original);
  await assert.rejects(notifyReview({ manifestPath: fixturePath, ledgerPath }), /Malformed notification ledger/);
  assert.equal(await fs.readFile(ledgerPath, 'utf8'), original);
});

await check('unsupported manifest contract is rejected', async () => {
  const manifestPath = await writeManifest('unsupported-manifest', { contractVersion: 'loop3-5-orchestration-manifest.v999' });
  await assert.rejects(notifyReview({ manifestPath, ledgerPath: path.join(base, 'unsupported-manifest-ledger.json') }), /Unsupported manifest contract/);
});

await check('unsupported ledger contract is rejected', async () => {
  const ledgerPath = path.join(base, 'unsupported-ledger.json');
  await fs.writeFile(ledgerPath, '{"contractVersion":"dfw-review-notification-ledger.v999","attempts":[],"deliveries":[]}\n');
  await assert.rejects(notifyReview({ manifestPath: fixturePath, ledgerPath }), /Unsupported notification ledger contract/);
});

await check('missing provider configuration fails before send', async () => {
  let calls = 0;
  await assert.rejects(notifyReview({ manifestPath: fixturePath, ledgerPath: path.join(base, 'config-ledger.json'), send: true, env: {}, provider: { sendReviewNotification: async () => { calls += 1; } } }), /Missing provider configuration/);
  assert.equal(calls, 0);
});

await check('provider response ID is recorded', async () => {
  const ledgerPath = path.join(base, 'provider-id-ledger.json');
  const result = await notifyReview({ manifestPath: fixturePath, ledgerPath, send: true, env: configuredEnv, provider: { sendReviewNotification: async () => ({ messageId: 'resend-fixture-id' }) } });
  const ledger = await readLedger(ledgerPath);
  assert.equal(result.providerMessageId, 'resend-fixture-id');
  assert.equal(ledger.attempts[0].providerMessageId, 'resend-fixture-id');
  assert.equal(ledger.deliveries[0].providerMessageId, 'resend-fixture-id');
});

await check('HTML escaping blocks injected markup', async () => {
  const manifestPath = await writeManifest('escaping', {
    issueReference: { number: 9901, title: '<img src=x onerror=alert(1)>', url: 'https://example.invalid/?x=<tag>' },
    warnings: ['<script>alert("warning")</script>'],
  });
  const result = await notifyReview({ manifestPath, ledgerPath: path.join(base, 'escaping-ledger.json') });
  assert.equal(result.content.html.includes('<script>'), false); assert.equal(result.content.html.includes('<img'), false);
  assert.match(result.content.html, /&lt;script&gt;/); assert.match(result.content.html, /&lt;img/);
});

await check('concurrent invocations do not duplicate provider send', async () => {
  let calls = 0;
  const provider = { sendReviewNotification: async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 40)); return { messageId: 'concurrent-success' }; } };
  const ledgerPath = path.join(base, 'concurrent-ledger.json');
  const results = await Promise.all([
    notifyReview({ manifestPath: fixturePath, ledgerPath, send: true, env: configuredEnv, provider }),
    notifyReview({ manifestPath: fixturePath, ledgerPath, send: true, env: configuredEnv, provider }),
  ]);
  assert.equal(calls, 1); assert.ok(results.some((result) => result.result === 'sent'));
  assert.ok(results.some((result) => ['concurrent-in-progress', 'duplicate-suppressed'].includes(result.result)));
});

if (failures) process.exitCode = 1;
