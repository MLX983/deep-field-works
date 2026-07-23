import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const NOTIFICATION_CONTRACT = 'dfw-review-notification.v1';
export const LEDGER_CONTRACT = 'dfw-review-notification-ledger.v1';
export const MANIFEST_CONTRACT = 'loop3-5-orchestration-manifest.v1';
export const ELIGIBLE_STATUSES = new Set([
  'READY_FOR_HUMAN_EDITORIAL_REVIEW',
  'WAITING_FOR_HUMAN',
  'PARTIALLY_REVISED_WAITING_FOR_HUMAN',
]);

const MANIFEST_STATUSES = new Set([
  'LOOP3_BLOCKED', 'READY_FOR_HUMAN_EDITORIAL_REVIEW', 'REVISED_PENDING_REEVALUATION',
  'REVISED_STILL_NEEDS_WORK', 'PARTIALLY_REVISED_WAITING_FOR_HUMAN',
  'WAITING_FOR_HUMAN', 'HOLD', 'BLOCKED',
]);
const REVIEW_KINDS = new Set(['draft', 'revised-draft', 'draft-report', 'evaluation', 'revision-report']);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function bounded(value, length = 500) {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Malformed manifest: ${label} must be a non-empty string.`);
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Malformed manifest: expected a JSON object.');
  if (manifest.contractVersion !== MANIFEST_CONTRACT) throw new Error(`Unsupported manifest contract: ${manifest.contractVersion ?? 'missing'}.`);
  if (!manifest.issueReference || !Number.isInteger(manifest.issueReference.number) || manifest.issueReference.number < 1) throw new Error('Malformed manifest: issueReference.number must be a positive integer.');
  assertString(manifest.issueReference.title, 'issueReference.title');
  if (manifest.issueReference.url !== undefined && typeof manifest.issueReference.url !== 'string') throw new Error('Malformed manifest: issueReference.url must be a string.');
  if (!MANIFEST_STATUSES.has(manifest.finalWorkflowStatus)) throw new Error(`Malformed manifest: unsupported finalWorkflowStatus ${manifest.finalWorkflowStatus ?? 'missing'}.`);
  for (const field of ['startedAt', 'completedAt']) {
    assertString(manifest[field], field);
    if (Number.isNaN(Date.parse(manifest[field]))) throw new Error(`Malformed manifest: ${field} must be an ISO date-time.`);
  }
  assertString(manifest.stopReason, 'stopReason');
  assertString(manifest.stoppedAtStage, 'stoppedAtStage');
  for (const field of ['stageExecutionSummary', 'artifacts', 'humanInputRequests', 'warnings']) {
    if (!Array.isArray(manifest[field])) throw new Error(`Malformed manifest: ${field} must be an array.`);
  }
  for (const [index, artifact] of manifest.artifacts.entries()) {
    if (!artifact || typeof artifact !== 'object') throw new Error(`Malformed manifest: artifacts[${index}] must be an object.`);
    for (const field of ['stage', 'kind', 'path']) assertString(artifact[field], `artifacts[${index}].${field}`);
    if (typeof artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error(`Malformed manifest: artifacts[${index}].sha256 must be a SHA-256 fingerprint.`);
  }
  for (const field of ['humanInputRequests', 'warnings']) {
    if (manifest[field].some((item) => typeof item !== 'string' || !item.trim())) throw new Error(`Malformed manifest: ${field} entries must be non-empty strings.`);
  }
  return manifest;
}

function identityInput(manifest) {
  return {
    notificationContractVersion: NOTIFICATION_CONTRACT,
    manifestContractVersion: manifest.contractVersion,
    issueNumber: manifest.issueReference.number,
    finalWorkflowStatus: manifest.finalWorkflowStatus,
    startedAt: manifest.startedAt,
    completedAt: manifest.completedAt,
    stoppedAtStage: manifest.stoppedAtStage,
    stopReason: manifest.stopReason,
    artifacts: manifest.artifacts.map(({ stage, kind, sha256: fingerprint }) => ({ stage, kind, fingerprint }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    humanInputRequests: [...manifest.humanInputRequests].sort(),
    warnings: [...manifest.warnings].sort(),
  };
}

export function notificationKey(manifest) {
  validateManifest(manifest);
  return sha256(JSON.stringify(canonicalize(identityInput(manifest))));
}

function listText(items, emptyMessage) {
  return items.length ? items.map((item) => `- ${bounded(item)}`).join('\n') : emptyMessage;
}

function listHtml(items, emptyMessage) {
  return items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(bounded(item))}</li>`).join('')}</ul>` : `<p>${escapeHtml(emptyMessage)}</p>`;
}

function selectedArtifacts(manifest) {
  return manifest.artifacts.filter((artifact) => REVIEW_KINDS.has(artifact.kind)).slice(0, 20);
}

export function buildNotificationPlan({ manifest, manifestPath, manifestSha256, from = '', to = '' }) {
  validateManifest(manifest);
  const key = notificationKey(manifest);
  const requests = manifest.humanInputRequests.slice(0, 10);
  const warnings = manifest.warnings.slice(0, 10);
  const artifacts = selectedArtifacts(manifest);
  const issue = manifest.issueReference;
  const issueLine = `Issue #${issue.number}: ${bounded(issue.title, 180)}`;
  const artifactText = artifacts.length
    ? artifacts.map((artifact) => `- ${artifact.kind}: ${path.basename(artifact.path)}\n  Local path: ${artifact.path}\n  SHA-256: ${artifact.sha256}`).join('\n')
    : 'No review artifacts were identified in the manifest.';
  const text = [
    'Deep Field Works human review is required.', '', issueLine,
    ...(issue.url ? [`Issue URL: ${issue.url}`] : []),
    `Workflow status: ${manifest.finalWorkflowStatus}`,
    `Stopped after: ${manifest.stoppedAtStage}`,
    `Reason: ${bounded(manifest.stopReason, 1000)}`,
    `Completed: ${manifest.completedAt}`,
    `Notification key: ${key}`,
    `Manifest SHA-256: ${manifestSha256}`,
    `Local manifest: ${manifestPath}`, '',
    'Human input requests:', listText(requests, 'None recorded.'), '',
    `Warnings (${manifest.warnings.length}):`, listText(warnings, 'None recorded.'), '',
    'Local review artifacts:', artifactText, '',
    'Review the draft and supporting artifacts locally. No draft body or attachment was sent with this notification.',
  ].join('\n');
  const artifactHtml = artifacts.length
    ? `<ul>${artifacts.map((artifact) => `<li><strong>${escapeHtml(artifact.kind)}</strong>: ${escapeHtml(path.basename(artifact.path))}<br>Local path: <code>${escapeHtml(artifact.path)}</code><br>SHA-256: <code>${escapeHtml(artifact.sha256)}</code></li>`).join('')}</ul>`
    : '<p>No review artifacts were identified in the manifest.</p>';
  const html = [
    '<h1>Deep Field Works human review is required</h1>',
    `<p><strong>${escapeHtml(issueLine)}</strong></p>`,
    ...(issue.url ? [`<p>Issue URL: ${escapeHtml(issue.url)}</p>`] : []),
    `<p>Workflow status: <code>${escapeHtml(manifest.finalWorkflowStatus)}</code><br>Stopped after: ${escapeHtml(manifest.stoppedAtStage)}<br>Reason: ${escapeHtml(bounded(manifest.stopReason, 1000))}<br>Completed: ${escapeHtml(manifest.completedAt)}</p>`,
    `<p>Notification key: <code>${key}</code><br>Manifest SHA-256: <code>${manifestSha256}</code><br>Local manifest: <code>${escapeHtml(manifestPath)}</code></p>`,
    '<h2>Human input requests</h2>', listHtml(requests, 'None recorded.'),
    `<h2>Warnings (${manifest.warnings.length})</h2>`, listHtml(warnings, 'None recorded.'),
    '<h2>Local review artifacts</h2>', artifactHtml,
    '<p><strong>Review the draft and supporting artifacts locally.</strong> No draft body or attachment was sent with this notification.</p>',
  ].join('');
  return {
    contractVersion: NOTIFICATION_CONTRACT,
    eligible: ELIGIBLE_STATUSES.has(manifest.finalWorkflowStatus),
    notificationKey: key,
    issueNumber: issue.number,
    issueTitle: issue.title,
    workflowStatus: manifest.finalWorkflowStatus,
    manifestPath,
    manifestSha256,
    artifactFingerprints: manifest.artifacts.map(({ kind, sha256: fingerprint }) => ({ kind, fingerprint })),
    provider: 'resend',
    fromConfigured: Boolean(from),
    toConfigured: Boolean(to),
    from,
    to,
    recipientRepresentation: to ? `sha256:${sha256(to.trim().toLowerCase())}` : 'not-configured',
    subject: `[Deep Field Works] Human review needed — #${issue.number} ${bounded(issue.title, 120)}`,
    text,
    html,
    summary: { humanInputRequestCount: manifest.humanInputRequests.length, warningCount: manifest.warnings.length, reviewArtifactCount: artifacts.length },
  };
}

function emptyLedger() {
  return { contractVersion: LEDGER_CONTRACT, attempts: [], deliveries: [] };
}

export async function readLedger(ledgerPath) {
  let raw;
  try { raw = await fs.readFile(ledgerPath, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return emptyLedger();
    throw error;
  }
  let ledger;
  try { ledger = JSON.parse(raw); }
  catch { throw new Error(`Malformed notification ledger: ${ledgerPath}.`); }
  if (ledger?.contractVersion !== LEDGER_CONTRACT) throw new Error(`Unsupported notification ledger contract: ${ledger?.contractVersion ?? 'missing'}.`);
  if (!Array.isArray(ledger.attempts) || !Array.isArray(ledger.deliveries)) throw new Error('Malformed notification ledger: attempts and deliveries must be arrays.');
  for (const [index, attempt] of ledger.attempts.entries()) {
    if (!attempt || typeof attempt !== 'object' || !/^[a-f0-9]{64}$/.test(attempt.notificationKey ?? '')) throw new Error(`Malformed notification ledger: attempts[${index}] has no valid notification key.`);
    if (!Number.isInteger(attempt.issueNumber) || typeof attempt.workflowStatus !== 'string' || typeof attempt.manifestPath !== 'string' || !/^[a-f0-9]{64}$/.test(attempt.manifestSha256 ?? '')) throw new Error(`Malformed notification ledger: attempts[${index}] has invalid review identity fields.`);
    if (!Array.isArray(attempt.artifactFingerprints) || typeof attempt.provider !== 'string' || typeof attempt.recipient !== 'string' || typeof attempt.attemptedAt !== 'string') throw new Error(`Malformed notification ledger: attempts[${index}] has invalid attempt metadata.`);
    if (!['sending', 'sent', 'failed'].includes(attempt.result)) throw new Error(`Malformed notification ledger: attempts[${index}] has an unsupported result.`);
    if (attempt.result === 'sent' && (typeof attempt.providerMessageId !== 'string' || !attempt.providerMessageId)) throw new Error(`Malformed notification ledger: attempts[${index}] is sent without a provider message ID.`);
    if (attempt.result === 'failed' && (typeof attempt.failure?.category !== 'string' || typeof attempt.failure?.message !== 'string')) throw new Error(`Malformed notification ledger: attempts[${index}] is failed without failure details.`);
  }
  for (const [index, delivery] of ledger.deliveries.entries()) {
    if (!delivery || typeof delivery !== 'object' || !/^[a-f0-9]{64}$/.test(delivery.notificationKey ?? '') || delivery.result !== 'sent') throw new Error(`Malformed notification ledger: deliveries[${index}] is not a valid successful delivery.`);
    if (!Number.isInteger(delivery.issueNumber) || typeof delivery.workflowStatus !== 'string' || typeof delivery.provider !== 'string' || typeof delivery.recipient !== 'string' || typeof delivery.deliveredAt !== 'string' || typeof delivery.providerMessageId !== 'string' || !delivery.providerMessageId) throw new Error(`Malformed notification ledger: deliveries[${index}] has invalid delivery metadata.`);
  }
  return ledger;
}

async function writeLedgerAtomic(ledgerPath, ledger) {
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  const temporaryPath = `${ledgerPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await fs.rename(temporaryPath, ledgerPath);
}

async function acquireLock(ledgerPath) {
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  const lockPath = `${ledgerPath}.lock`;
  try {
    const handle = await fs.open(lockPath, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`);
    return { handle, lockPath };
  } catch (error) {
    if (error.code === 'EEXIST') return null;
    throw error;
  }
}

async function releaseLock(lock) {
  await lock.handle.close();
  await fs.unlink(lock.lockPath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
}

function failureDetails(error) {
  return {
    category: bounded(error.category ?? (error.name === 'TypeError' ? 'network' : 'provider'), 80),
    message: bounded(error.message ?? 'Unknown provider failure.', 500),
  };
}

export function createResendProvider({ apiKey, fetchImpl = globalThis.fetch } = {}) {
  return {
    name: 'resend',
    async sendReviewNotification({ from, to, subject, text, html, idempotencyKey }) {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
      });
      let body = {};
      try { body = await response.json(); } catch { body = {}; }
      if (!response.ok) {
        const error = new Error(`Resend request failed (${response.status}): ${bounded(body.message ?? response.statusText ?? 'provider error', 300)}`);
        error.category = response.status === 401 || response.status === 403 ? 'authentication' : response.status === 429 ? 'rate-limit' : 'provider';
        throw error;
      }
      if (typeof body.id !== 'string' || !body.id) {
        const error = new Error('Resend response did not include a message ID.'); error.category = 'provider-response'; throw error;
      }
      return { messageId: body.id };
    },
  };
}

export async function notifyReview({ manifestPath, ledgerPath, send = false, env = process.env, provider, now = () => new Date().toISOString() }) {
  const resolvedManifest = path.resolve(manifestPath);
  const resolvedLedger = path.resolve(ledgerPath);
  const manifestBytes = await fs.readFile(resolvedManifest);
  let manifest;
  try { manifest = JSON.parse(manifestBytes); } catch { throw new Error(`Malformed manifest JSON: ${resolvedManifest}.`); }
  validateManifest(manifest);
  const plan = buildNotificationPlan({
    manifest, manifestPath: resolvedManifest, manifestSha256: sha256(manifestBytes),
    from: env.DFW_REVIEW_EMAIL_FROM ?? '', to: env.DFW_REVIEW_EMAIL_TO ?? '',
  });
  const ledger = await readLedger(resolvedLedger);
  const duplicate = ledger.deliveries.some((entry) => entry.notificationKey === plan.notificationKey && entry.result === 'sent');
  const publicPlan = {
    mode: send ? 'send' : 'dry-run', eligible: plan.eligible, duplicate,
    notificationKey: plan.notificationKey, provider: plan.provider,
    configuration: { apiKeyConfigured: Boolean(env.RESEND_API_KEY), fromConfigured: plan.fromConfigured, toConfigured: plan.toConfigured },
    subject: plan.subject, summary: plan.summary,
    expectedLedgerAction: !plan.eligible || duplicate || !send ? 'none' : 'record attempt and provider result',
  };
  if (!plan.eligible) return { result: 'not-eligible', plan: publicPlan };
  if (duplicate) return { result: 'duplicate-suppressed', plan: publicPlan };
  if (!send) return { result: 'dry-run', plan: publicPlan, content: { text: plan.text, html: plan.html } };
  const missing = [
    ['RESEND_API_KEY', env.RESEND_API_KEY], ['DFW_REVIEW_EMAIL_FROM', plan.from], ['DFW_REVIEW_EMAIL_TO', plan.to],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing provider configuration: ${missing.join(', ')}.`);

  const lock = await acquireLock(resolvedLedger);
  if (!lock) return { result: 'concurrent-in-progress', plan: { ...publicPlan, expectedLedgerAction: 'none; another invocation holds the ledger lock' } };
  try {
    const lockedLedger = await readLedger(resolvedLedger);
    if (lockedLedger.deliveries.some((entry) => entry.notificationKey === plan.notificationKey && entry.result === 'sent')) {
      return { result: 'duplicate-suppressed', plan: { ...publicPlan, duplicate: true, expectedLedgerAction: 'none' } };
    }
    if (lockedLedger.attempts.some((entry) => entry.notificationKey === plan.notificationKey && entry.result === 'sending')) {
      return { result: 'delivery-uncertain', plan: { ...publicPlan, expectedLedgerAction: 'none; an earlier provider attempt has no recorded outcome' } };
    }
    const attempt = {
      notificationKey: plan.notificationKey, issueNumber: plan.issueNumber, workflowStatus: plan.workflowStatus,
      manifestPath: plan.manifestPath, manifestSha256: plan.manifestSha256, artifactFingerprints: plan.artifactFingerprints,
      provider: plan.provider, recipient: plan.recipientRepresentation, attemptedAt: now(), result: 'sending',
    };
    lockedLedger.attempts.push(attempt);
    await writeLedgerAtomic(resolvedLedger, lockedLedger);
    const selectedProvider = provider ?? createResendProvider({ apiKey: env.RESEND_API_KEY });
    let response;
    try {
      response = await selectedProvider.sendReviewNotification({
        from: plan.from, to: plan.to, subject: plan.subject, text: plan.text, html: plan.html,
        idempotencyKey: `dfw-review-${plan.notificationKey}`,
      });
      if (typeof response?.messageId !== 'string' || !response.messageId) {
        const error = new Error('Provider response did not include a message ID.'); error.category = 'provider-response'; throw error;
      }
    } catch (error) {
      attempt.result = 'failed'; attempt.failure = failureDetails(error);
      await writeLedgerAtomic(resolvedLedger, lockedLedger);
      return { result: 'provider-failed', failure: attempt.failure, plan: publicPlan };
    }
    attempt.result = 'sent'; attempt.providerMessageId = response.messageId;
    lockedLedger.deliveries.push({
      notificationKey: plan.notificationKey, issueNumber: plan.issueNumber, workflowStatus: plan.workflowStatus,
      provider: plan.provider, recipient: plan.recipientRepresentation, deliveredAt: now(), result: 'sent', providerMessageId: response.messageId,
    });
    await writeLedgerAtomic(resolvedLedger, lockedLedger);
    return { result: 'sent', providerMessageId: response.messageId, plan: publicPlan };
  } finally {
    await releaseLock(lock);
  }
}
