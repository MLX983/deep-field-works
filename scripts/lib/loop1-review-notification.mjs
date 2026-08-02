import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  canonicalLoop1Recommendation,
  LOOP1_CONFIDENCE_VALUES,
  LOOP1_DOCUMENT_TYPES,
  LOOP1_DOMAINS,
  LOOP1_RECOMMENDATION_DISPOSITIONS,
} from './loop1-review-vocabulary.mjs';

export const NOTIFICATION_CONTRACT = 'dfw-loop1-review-notification.v1';
export const LEDGER_CONTRACT = 'dfw-loop1-review-notification-ledger.v1';
export const REVIEW_PACKET_CONTRACT = 'backlog-loop1-review-packet.v2';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function bounded(value, length = 500) {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}

function notificationSubjectTitle(value) {
  return String(value).replace(/^\[DFW Intake\]\s*/, '');
}

function hasUnsafeAbsolutePath(value) {
  return /(?:^|[\s'"(])(?:\/Users\/|\/home\/|\/private\/tmp\/|\/tmp\/|[a-z]:[\\/]+Users[\\/]+)/i
    .test(String(value));
}

export function safeReviewPacketReference(
  reviewPacketPath,
  repositoryRoot = process.cwd(),
) {
  const value = String(reviewPacketPath);
  const windowsAbsolute = /^[a-z]:[\\/]/i.test(value);
  if (!windowsAbsolute) {
    const relative = path.relative(
      path.resolve(repositoryRoot),
      path.resolve(value),
    );
    if (
      relative &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    ) {
      return `Repository-relative: ${relative.split(path.sep).join('/')}`;
    }
  }

  const normalized = value.replaceAll('\\', '/');
  const segments = normalized.split('/').filter(Boolean);
  for (let index = 0; index < segments.length - 4; index += 1) {
    const candidate = segments.slice(index).join('/');
    if (
      segments[index] === 'issues' &&
      /^issue-\d+$/.test(segments[index + 1]) &&
      /^issues\/issue-\d+\/[^/]+\/loop1\/review-packet\.json$/.test(candidate)
    ) {
      return `Processor workspace: ${candidate}`;
    }
  }

  return 'Local Loop 1 review packet in the processor workspace';
}

export function safeReviewInstruction(nextCommand) {
  const replacements = new Map([
    ['repo-path', '<local-repository>'],
    ['state-dir', '<local-processor-state>'],
    ['work-root', '<local-processor-workspace>'],
    ['reviewed-recommendation', '<local-review-envelope>'],
  ]);
  let instruction = String(nextCommand).trim();
  for (const [flag, replacement] of replacements) {
    instruction = instruction.replace(
      new RegExp(`(--${flag})\\s+.*?(?=\\s+--[a-z0-9-]+(?:\\s|$)|$)`, 'i'),
      `$1 '${replacement}'`,
    );
  }
  if (hasUnsafeAbsolutePath(instruction)) {
    return "Use the packet's local resume command through the operator environment with --reviewed-recommendation '<local-review-envelope>' --stop-after-loop2.";
  }
  return instruction;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Malformed Loop 1 review packet: ${label} must be a non-empty string.`);
  }
}

export function validateReviewPacket(packet) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    throw new Error('Malformed Loop 1 review packet: expected a JSON object.');
  }
  if (packet.contractVersion !== REVIEW_PACKET_CONTRACT) {
    throw new Error(`Unsupported Loop 1 review packet contract: ${packet.contractVersion ?? 'missing'}.`);
  }
  if (!Number.isInteger(packet.issueNumber) || packet.issueNumber < 1) {
    throw new Error('Malformed Loop 1 review packet: issueNumber must be a positive integer.');
  }
  for (const field of [
    'issueTitle', 'createdAt', 'sourceContentSha256', 'sourceProcessingCommitSha',
    'workspacePath', 'loop1ResultPath', 'loop1ResultSha256', 'nextCommand',
  ]) {
    assertString(packet[field], field);
  }
  if (Number.isNaN(Date.parse(packet.createdAt))) {
    throw new Error('Malformed Loop 1 review packet: createdAt must be an ISO date-time.');
  }
  for (const field of ['sourceContentSha256', 'loop1ResultSha256']) {
    if (!/^[a-f0-9]{64}$/.test(packet[field])) {
      throw new Error(`Malformed Loop 1 review packet: ${field} must be a SHA-256 fingerprint.`);
    }
  }
  if (!/^[a-f0-9]{40}$/.test(packet.sourceProcessingCommitSha)) {
    throw new Error('Malformed Loop 1 review packet: sourceProcessingCommitSha must be a Git commit SHA.');
  }
  if (packet.approvalRequired !== true) {
    throw new Error('Malformed Loop 1 review packet: approvalRequired must be true.');
  }
  if (packet.nextCommand.length > 4096) {
    throw new Error('Malformed Loop 1 review packet: nextCommand exceeds 4096 characters.');
  }
  const stopAfterLoop2Flags =
    packet.nextCommand.match(/(?:^|\s)--stop-after-loop2(?=\s|$)/g) ?? [];
  if (
    !/(?:^|\s)--reviewed-recommendation(?=\s|$)/.test(packet.nextCommand) ||
    stopAfterLoop2Flags.length !== 1
  ) {
    throw new Error(
      'Malformed Loop 1 review packet: nextCommand must contain --reviewed-recommendation and exactly one --stop-after-loop2.',
    );
  }
  return packet;
}

function markdownField(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.+)$`, 'mi'));
  return match?.[1]?.trim() ?? '';
}

function markdownSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^### ${escaped}\\s*\\n+([\\s\\S]*?)(?=^### |$(?![\\s\\S]))`, 'mi'));
  return match?.[1]?.trim() ?? '';
}

export function parseLoop1ReviewSummary(markdown) {
  if (typeof markdown !== 'string' || !/^## Loop 1 Intake Understanding\s*$/mi.test(markdown)) {
    throw new Error('Malformed Loop 1 result: missing Loop 1 Intake Understanding heading.');
  }
  const storedRecommendation = bounded(markdownField(markdown, 'Recommendation'), 160);
  const recommendation = canonicalLoop1Recommendation(storedRecommendation);
  const proposedArtifact = bounded(markdownField(markdown, 'Document type'), 80);
  const confidence = bounded(markdownField(markdown, 'Confidence'), 20);
  const domain = bounded(markdownField(markdown, 'Primary domain'), 120);
  const theme = bounded(markdownField(markdown, 'Theme'), 160);
  const rationale = bounded(markdownSection(markdown, 'Why this may matter'), 1000);
  if (!recommendation) {
    throw new Error(`Malformed Loop 1 result: unsupported Recommendation value ${storedRecommendation || 'missing'}.`);
  }
  if (!LOOP1_DOCUMENT_TYPES.has(proposedArtifact)) {
    throw new Error(`Malformed Loop 1 result: unsupported Document type ${proposedArtifact || 'missing'}.`);
  }
  if (!LOOP1_CONFIDENCE_VALUES.has(confidence)) {
    throw new Error(`Malformed Loop 1 result: unsupported Confidence value ${confidence || 'missing'}.`);
  }
  if (!LOOP1_DOMAINS.has(domain)) {
    throw new Error(`Malformed Loop 1 result: unsupported Primary domain ${domain || 'missing'}.`);
  }
  if (!rationale) {
    throw new Error('Malformed Loop 1 result: Why this may matter must not be empty.');
  }
  return {
    recommendation,
    disposition: LOOP1_RECOMMENDATION_DISPOSITIONS.get(recommendation),
    proposedArtifact,
    domain,
    theme: theme || 'Unassigned',
    confidence,
    rationale,
  };
}

function identityInput(packet, summary, { legacy = false } = {}) {
  return {
    notificationContractVersion: NOTIFICATION_CONTRACT,
    reviewPacketContractVersion: packet.contractVersion,
    issueNumber: packet.issueNumber,
    issueTitle: bounded(packet.issueTitle, 180),
    sourceContentSha256: packet.sourceContentSha256,
    sourceProcessingCommitSha: packet.sourceProcessingCommitSha,
    loop1ResultSha256: packet.loop1ResultSha256,
    nextCommand: legacy
      ? packet.nextCommand.trim()
      : safeReviewInstruction(packet.nextCommand),
    summary,
  };
}

export function notificationKey(packet, summary) {
  validateReviewPacket(packet);
  return sha256(JSON.stringify(canonicalize(identityInput(packet, summary))));
}

function legacyNotificationKey(packet, summary) {
  return sha256(JSON.stringify(canonicalize(
    identityInput(packet, summary, { legacy: true }),
  )));
}

export function buildNotificationPlan({
  packet,
  reviewPacketReference,
  reviewPacketSha256,
  summary,
  from = '',
  to = '',
}) {
  const key = notificationKey(packet, summary);
  const legacyKey = legacyNotificationKey(packet, summary);
  const issueLine = `Issue #${packet.issueNumber}: ${bounded(packet.issueTitle, 180)}`;
  const reviewInstruction = safeReviewInstruction(packet.nextCommand);
  const text = [
    'Deep Field Works Loop 1 review is required.',
    '',
    issueLine,
    `Recommendation: ${summary.recommendation}`,
    `Provisional disposition: ${summary.disposition}`,
    `Proposed artifact: ${summary.proposedArtifact}`,
    `Domain: ${summary.domain}`,
    `Theme: ${summary.theme}`,
    `Confidence: ${summary.confidence}`,
    '',
    'Brief rationale:',
    summary.rationale,
    '',
    `Local review packet: ${reviewPacketReference}`,
    'Open it through the operator environment; this is not a public link.',
    `Repository commit: ${packet.sourceProcessingCommitSha}`,
    `Review instruction: ${reviewInstruction}`,
    `Notification key: ${key}`,
    `Review packet SHA-256: ${reviewPacketSha256}`,
    '',
    'Review the bounded Loop 1 summary and packet locally. Human approval remains required before Loop 2.',
    'No unpublished draft, Loop 2 packet, prompt payload, or processor trace was sent.',
  ].join('\n');
  const html = [
    '<h1>Deep Field Works Loop 1 review is required</h1>',
    `<p><strong>${escapeHtml(issueLine)}</strong></p>`,
    '<dl>',
    `<dt>Recommendation</dt><dd>${escapeHtml(summary.recommendation)}</dd>`,
    `<dt>Provisional disposition</dt><dd>${escapeHtml(summary.disposition)}</dd>`,
    `<dt>Proposed artifact</dt><dd>${escapeHtml(summary.proposedArtifact)}</dd>`,
    `<dt>Domain</dt><dd>${escapeHtml(summary.domain)}</dd>`,
    `<dt>Theme</dt><dd>${escapeHtml(summary.theme)}</dd>`,
    `<dt>Confidence</dt><dd>${escapeHtml(summary.confidence)}</dd>`,
    '</dl>',
    `<h2>Brief rationale</h2><p>${escapeHtml(summary.rationale)}</p>`,
    `<p>Local review packet: <code>${escapeHtml(reviewPacketReference)}</code><br>`,
    'Open it through the operator environment; this is not a public link.<br>',
    `Repository commit: <code>${packet.sourceProcessingCommitSha}</code><br>`,
    `Review instruction: ${escapeHtml(reviewInstruction)}<br>`,
    `Notification key: <code>${key}</code><br>`,
    `Review packet SHA-256: <code>${reviewPacketSha256}</code></p>`,
    '<p><strong>Human approval remains required before Loop 2.</strong> No unpublished draft, Loop 2 packet, prompt payload, or processor trace was sent.</p>',
  ].join('');
  return {
    contractVersion: NOTIFICATION_CONTRACT,
    notificationKey: key,
    notificationKeyCandidates: [...new Set([key, legacyKey])],
    issueNumber: packet.issueNumber,
    issueTitle: packet.issueTitle,
    reviewPacketReference,
    reviewPacketSha256,
    sourceContentSha256: packet.sourceContentSha256,
    sourceProcessingCommitSha: packet.sourceProcessingCommitSha,
    loop1ResultSha256: packet.loop1ResultSha256,
    summary,
    provider: 'resend',
    fromConfigured: Boolean(from),
    toConfigured: Boolean(to),
    from,
    to,
    recipientRepresentation: to ? `sha256:${sha256(to.trim().toLowerCase())}` : 'not-configured',
    subject: `[Deep Field Works] Loop 1 review needed — #${packet.issueNumber} ${bounded(notificationSubjectTitle(packet.issueTitle), 120)}`,
    text,
    html,
  };
}

function emptyLedger() {
  return { contractVersion: LEDGER_CONTRACT, attempts: [], deliveries: [] };
}

export async function readLedger(ledgerPath) {
  let raw;
  try {
    raw = await fs.readFile(ledgerPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return emptyLedger();
    throw error;
  }
  let ledger;
  try {
    ledger = JSON.parse(raw);
  } catch {
    throw new Error(`Malformed Loop 1 notification ledger: ${ledgerPath}.`);
  }
  if (ledger?.contractVersion !== LEDGER_CONTRACT) {
    throw new Error(`Unsupported Loop 1 notification ledger contract: ${ledger?.contractVersion ?? 'missing'}.`);
  }
  if (!Array.isArray(ledger.attempts) || !Array.isArray(ledger.deliveries)) {
    throw new Error('Malformed Loop 1 notification ledger: attempts and deliveries must be arrays.');
  }
  for (const [index, attempt] of ledger.attempts.entries()) {
    if (!attempt || typeof attempt !== 'object' || !/^[a-f0-9]{64}$/.test(attempt.notificationKey ?? '')) {
      throw new Error(`Malformed Loop 1 notification ledger: attempts[${index}] has no valid notification key.`);
    }
    const validPacketReference =
      typeof attempt.reviewPacketReference === 'string' &&
      attempt.reviewPacketReference &&
      !hasUnsafeAbsolutePath(attempt.reviewPacketReference);
    const validLegacyPacketPath = typeof attempt.reviewPacketPath === 'string';
    if (!Number.isInteger(attempt.issueNumber)
      || (!validPacketReference && !validLegacyPacketPath)
      || !/^[a-f0-9]{64}$/.test(attempt.reviewPacketSha256 ?? '')
      || !/^[a-f0-9]{64}$/.test(attempt.loop1ResultSha256 ?? '')
      || typeof attempt.provider !== 'string'
      || typeof attempt.recipient !== 'string'
      || typeof attempt.attemptedAt !== 'string') {
      throw new Error(`Malformed Loop 1 notification ledger: attempts[${index}] has invalid metadata.`);
    }
    if (!['sending', 'sent', 'failed'].includes(attempt.result)) {
      throw new Error(`Malformed Loop 1 notification ledger: attempts[${index}] has an unsupported result.`);
    }
    if (attempt.result === 'sent' && (typeof attempt.providerMessageId !== 'string' || !attempt.providerMessageId)) {
      throw new Error(`Malformed Loop 1 notification ledger: attempts[${index}] is sent without a provider message ID.`);
    }
    if (attempt.result === 'failed'
      && (typeof attempt.failure?.category !== 'string' || typeof attempt.failure?.message !== 'string')) {
      throw new Error(`Malformed Loop 1 notification ledger: attempts[${index}] is failed without failure details.`);
    }
  }
  for (const [index, delivery] of ledger.deliveries.entries()) {
    if (!delivery || typeof delivery !== 'object'
      || !/^[a-f0-9]{64}$/.test(delivery.notificationKey ?? '')
      || delivery.result !== 'sent'
      || !Number.isInteger(delivery.issueNumber)
      || typeof delivery.provider !== 'string'
      || typeof delivery.recipient !== 'string'
      || typeof delivery.deliveredAt !== 'string'
      || typeof delivery.providerMessageId !== 'string'
      || !delivery.providerMessageId) {
      throw new Error(`Malformed Loop 1 notification ledger: deliveries[${index}] is invalid.`);
    }
  }
  return ledger;
}

async function writeLedgerAtomic(ledgerPath, ledger) {
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  const temporaryPath = `${ledgerPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
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
  await fs.unlink(lock.lockPath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
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
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
      });
      let body = {};
      try {
        body = await response.json();
      } catch {
        body = {};
      }
      if (!response.ok) {
        const error = new Error(
          `Resend request failed (${response.status}): ${bounded(body.message ?? response.statusText ?? 'provider error', 300)}`,
        );
        error.category = response.status === 401 || response.status === 403
          ? 'authentication'
          : response.status === 429 ? 'rate-limit' : 'provider';
        throw error;
      }
      if (typeof body.id !== 'string' || !body.id) {
        const error = new Error('Resend response did not include a message ID.');
        error.category = 'provider-response';
        throw error;
      }
      return { messageId: body.id };
    },
  };
}

export async function notifyLoop1Review({
  reviewPacketPath,
  ledgerPath,
  send = false,
  env = process.env,
  provider,
  now = () => new Date().toISOString(),
}) {
  const resolvedPacket = path.resolve(reviewPacketPath);
  const resolvedLedger = path.resolve(ledgerPath);
  const packetBytes = await fs.readFile(resolvedPacket);
  let packet;
  try {
    packet = JSON.parse(packetBytes);
  } catch {
    throw new Error(`Malformed Loop 1 review packet JSON: ${resolvedPacket}.`);
  }
  validateReviewPacket(packet);

  const resolvedResult = path.resolve(packet.loop1ResultPath);
  const resultBytes = await fs.readFile(resolvedResult);
  const resultFingerprint = sha256(resultBytes);
  if (resultFingerprint !== packet.loop1ResultSha256) {
    throw new Error('Loop 1 result fingerprint does not match the review packet.');
  }
  const summary = parseLoop1ReviewSummary(resultBytes.toString('utf8'));
  const reviewPacketReference = safeReviewPacketReference(resolvedPacket);
  const plan = buildNotificationPlan({
    packet,
    reviewPacketReference,
    reviewPacketSha256: sha256(packetBytes),
    summary,
    from: env.DFW_REVIEW_EMAIL_FROM ?? '',
    to: env.DFW_REVIEW_EMAIL_TO ?? '',
  });
  const ledger = await readLedger(resolvedLedger);
  const duplicate = ledger.deliveries.some(
    (entry) =>
      plan.notificationKeyCandidates.includes(entry.notificationKey) &&
      entry.result === 'sent',
  );
  const publicPlan = {
    mode: send ? 'send' : 'dry-run',
    duplicate,
    notificationKey: plan.notificationKey,
    provider: plan.provider,
    configuration: {
      apiKeyConfigured: Boolean(env.RESEND_API_KEY),
      fromConfigured: plan.fromConfigured,
      toConfigured: plan.toConfigured,
    },
    subject: plan.subject,
    summary: plan.summary,
    expectedLedgerAction: duplicate || !send ? 'none' : 'record attempt and provider result',
  };
  if (duplicate) return { result: 'duplicate-suppressed', plan: publicPlan };
  if (!send) {
    return {
      result: 'dry-run',
      plan: publicPlan,
      content: { text: plan.text, html: plan.html },
    };
  }

  const missing = [
    ['RESEND_API_KEY', env.RESEND_API_KEY],
    ['DFW_REVIEW_EMAIL_FROM', plan.from],
    ['DFW_REVIEW_EMAIL_TO', plan.to],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new Error(`Missing provider configuration: ${missing.join(', ')}.`);
  }

  const lock = await acquireLock(resolvedLedger);
  if (!lock) {
    return {
      result: 'concurrent-in-progress',
      plan: { ...publicPlan, expectedLedgerAction: 'none; another invocation holds the ledger lock' },
    };
  }
  try {
    const lockedLedger = await readLedger(resolvedLedger);
    if (lockedLedger.deliveries.some(
      (entry) =>
        plan.notificationKeyCandidates.includes(entry.notificationKey) &&
        entry.result === 'sent',
    )) {
      return {
        result: 'duplicate-suppressed',
        plan: { ...publicPlan, duplicate: true, expectedLedgerAction: 'none' },
      };
    }
    if (lockedLedger.attempts.some(
      (entry) =>
        plan.notificationKeyCandidates.includes(entry.notificationKey) &&
        entry.result === 'sending',
    )) {
      return {
        result: 'delivery-uncertain',
        plan: {
          ...publicPlan,
          expectedLedgerAction: 'none; an earlier provider attempt has no recorded outcome',
        },
      };
    }
    const attempt = {
      notificationKey: plan.notificationKey,
      issueNumber: plan.issueNumber,
      reviewPacketReference: plan.reviewPacketReference,
      reviewPacketSha256: plan.reviewPacketSha256,
      loop1ResultSha256: plan.loop1ResultSha256,
      provider: plan.provider,
      recipient: plan.recipientRepresentation,
      attemptedAt: now(),
      result: 'sending',
    };
    lockedLedger.attempts.push(attempt);
    await writeLedgerAtomic(resolvedLedger, lockedLedger);
    const selectedProvider = provider ?? createResendProvider({ apiKey: env.RESEND_API_KEY });
    let response;
    try {
      response = await selectedProvider.sendReviewNotification({
        from: plan.from,
        to: plan.to,
        subject: plan.subject,
        text: plan.text,
        html: plan.html,
        idempotencyKey: `dfw-loop1-review-${plan.notificationKey}`,
      });
      if (typeof response?.messageId !== 'string' || !response.messageId) {
        const error = new Error('Provider response did not include a message ID.');
        error.category = 'provider-response';
        throw error;
      }
    } catch (error) {
      attempt.result = 'failed';
      attempt.failure = failureDetails(error);
      await writeLedgerAtomic(resolvedLedger, lockedLedger);
      return { result: 'provider-failed', failure: attempt.failure, plan: publicPlan };
    }
    attempt.result = 'sent';
    attempt.providerMessageId = response.messageId;
    lockedLedger.deliveries.push({
      notificationKey: plan.notificationKey,
      issueNumber: plan.issueNumber,
      provider: plan.provider,
      recipient: plan.recipientRepresentation,
      deliveredAt: now(),
      result: 'sent',
      providerMessageId: response.messageId,
    });
    await writeLedgerAtomic(resolvedLedger, lockedLedger);
    return { result: 'sent', providerMessageId: response.messageId, plan: publicPlan };
  } finally {
    await releaseLock(lock);
  }
}
