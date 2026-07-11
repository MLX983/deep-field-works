#!/usr/bin/env node

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const PACKET_SCHEMA_REQUIRED = [
  'contractVersion',
  'issueReference',
  'approvedArtifactType',
  'primaryDomain',
  'theme',
  'draftReadiness',
  'sourceSufficiency',
  'verifiedObservations',
  'inferences',
  'speculation',
  'sourceRequirements',
  'evidenceGaps',
  'unresolvedQuestions',
  'centralTension',
];

const SUPPORTED_ARTIFACTS = new Set(['note', 'field-report']);
const TARGET_WORD_RANGES = {
  note: { min: 200, max: 600 },
  'field-report': { min: 500, max: 1200 },
};

const NOTE_SECTIONS = [
  'title',
  'opening observation or question',
  'why it may matter',
  'current interpretation',
  'open question',
];

const FIELD_REPORT_SECTIONS = [
  'title',
  'the signal',
  'why it may matter',
  'the deeper tension',
  'what is not being said',
  'what to watch next',
];

function parseArgs(argv) {
  const args = {
    packet: '',
    issue: '',
    recommendation: '',
    relatedDir: '',
    outDir: '',
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--packet') args.packet = argv[++i] ?? '';
    else if (arg === '--issue') args.issue = argv[++i] ?? '';
    else if (arg === '--recommendation') args.recommendation = argv[++i] ?? '';
    else if (arg === '--related-dir') args.relatedDir = argv[++i] ?? '';
    else if (arg === '--out-dir') args.outDir = argv[++i] ?? '';
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  npm run loop:draft -- \\
    --packet /tmp/dfw-loop2-precommit/reg/0018/loop2-18-packet.json \\
    --issue /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues/0018-....md \\
    --recommendation /tmp/dfw-loop2-eval/recommendations/issue-0018.json \\
    --out-dir /tmp/dfw-loop3-eval/0018

  npm run loop:draft -- \\
    --packet scripts/fixtures/loop3/packet-ready-note.json \\
    --issue scripts/fixtures/loop3/issue-ready-note.md \\
    --recommendation scripts/fixtures/loop3/recommendation-ready-note.json \\
    --out-dir /tmp/dfw-loop3-smoke/ready`;
}

function resolveInputPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(REPO_ROOT, inputPath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function slugifyTheme(theme) {
  return (theme || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function draftDateConvention() {
  return new Date().toISOString().slice(0, 10);
}

const EDITORIAL_WORKFLOW_PATTERNS = [
  /keep observation,\s*inference,\s*and speculation/i,
  /optional strengtheners/i,
  /non-blocking uncertainty/i,
  /clearly separated/i,
  /does not block a bounded/i,
];

function isEditorialWorkflowNote(text) {
  const value = String(text || '').trim();
  if (!value) return true;
  return EDITORIAL_WORKFLOW_PATTERNS.some((pattern) => pattern.test(value));
}

function readerFacingItems(items) {
  return (items ?? []).filter((item) => !isEditorialWorkflowNote(item));
}

function dedupeAgainst(items, referenceText) {
  if (!referenceText) return [...items];
  const referenceKey = normalizeText(referenceText);
  return items.filter((item) => normalizeText(item) !== referenceKey);
}

function partitionPacketGaps(packet) {
  const unresolvedQuestions = packet.unresolvedQuestions ?? [];
  const evidenceGaps = packet.evidenceGaps ?? [];
  const readerFacing = [
    ...readerFacingItems(unresolvedQuestions),
    ...readerFacingItems(evidenceGaps),
  ];
  const editorialWorkflowNotes = [
    ...unresolvedQuestions.filter((item) => isEditorialWorkflowNote(item)),
    ...evidenceGaps.filter((item) => isEditorialWorkflowNote(item)),
  ];
  return {
    readerFacing: [...new Set(readerFacing)],
    editorialWorkflowNotes: [...new Set(editorialWorkflowNotes)],
  };
}

function validatePacketSchema(packet) {
  if (packet.contractVersion !== 'loop2-development-packet.v1') {
    throw new Error('Packet contractVersion must be loop2-development-packet.v1');
  }
  for (const key of PACKET_SCHEMA_REQUIRED) {
    if (packet[key] === undefined) {
      throw new Error(`Packet missing required field: ${key}`);
    }
  }
}

function normalizeArtifactType(approvedArtifactType) {
  const lower = approvedArtifactType.toLowerCase().trim();
  if (lower === 'note') return 'note';
  if (lower === 'field-report' || lower === 'field report') return 'field-report';
  return null;
}

function evaluateHardGate(packet, recommendation) {
  const failures = [];

  if (packet.draftReadiness !== 'ready') {
    failures.push(`draftReadiness is "${packet.draftReadiness}", not "ready"`);
  }
  if (packet.sourceSufficiency?.status !== 'sufficient') {
    failures.push(
      `sourceSufficiency.status is "${packet.sourceSufficiency?.status}", not "sufficient"`,
    );
  }
  if (!recommendation) {
    failures.push('Loop 1 recommendation not provided for human approval verification');
  } else if (recommendation.humanApprovalStatus !== 'approved') {
    failures.push('Loop 1 recommendation humanApprovalStatus is not approved');
  } else if (
    recommendation.issueNumber &&
    packet.issueReference?.number &&
    recommendation.issueNumber !== packet.issueReference.number
  ) {
    failures.push('Loop 1 recommendation issue number does not match packet');
  }
  if (packet.blockingCondition) {
    failures.push(`blockingCondition present: ${packet.blockingCondition}`);
  }
  if ((packet.sourceRequirements ?? []).length > 0) {
    failures.push(
      `unresolved sourceRequirements remain: ${packet.sourceRequirements.join('; ')}`,
    );
  }
  const artifactType = normalizeArtifactType(packet.approvedArtifactType);
  if (!artifactType) {
    failures.push(
      `approved artifact type "${packet.approvedArtifactType}" is not supported in Loop 3 MVP`,
    );
  }

  return { passed: failures.length === 0, failures, artifactType };
}

function relatedPiecesFromPacket(packet) {
  return (packet.relatedMaterial ?? [])
    .filter((item) => item.role === 'related-piece' || item.approvedRelatedPiece === true)
    .map((item) => item.reference)
    .filter(isStableRelatedPieceReference)
    .filter((item, index, items) => items.indexOf(item) === index)
    .slice(0, 8);
}

function isStableRelatedPieceReference(reference) {
  const value = String(reference || '').trim();
  if (!value || path.isAbsolute(value)) return false;
  if (/^(?:file:|~[/\\]|[A-Za-z]:[/\\])/.test(value)) return false;
  if (/(?:^|[/\\])(?:tmp|private\/tmp)(?:[/\\]|$)/i.test(value)) return false;
  if (/intake-cache|issues-cache|cache-\d|\.cache/i.test(value)) return false;
  if (/^#\d+$/.test(value) || /github\.com\/.+\/issues\/\d+/i.test(value)) return false;
  if (/\.md(?:#.*)?$/i.test(value) && !/^(?:src\/content\/|content\/)/.test(value)) return false;
  return /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|(?:src\/content\/|content\/)[a-z0-9_./-]+)$/i.test(value);
}

function substantiveDescription(packet, artifactType) {
  const candidates = [
    packet.centralTension,
    ...(packet.inferences ?? []),
    ...(packet.verifiedObservations ?? []),
  ].filter(Boolean);
  const core = candidates.find((item) => !/^what\b|\?$/i.test(String(item).trim())) || candidates[0];
  if (!core) return `A bounded ${artifactType} preserving the packet's central observation for editorial review.`;
  const sentences = String(core).trim().replace(/\?$/, '.').match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  let description = '';
  for (const sentence of sentences) {
    const candidate = `${description} ${sentence.trim()}`.trim();
    if (candidate.length > 180) break;
    description = candidate;
  }
  return description || String(core).trim().slice(0, 180).trimEnd();
}

function buildFrontmatter(packet, artifactType, issueMeta) {
  const title = packet.workingTitle || packet.issueReference.title;
  const description = substantiveDescription(packet, artifactType);
  const themeSlug = slugifyTheme(packet.theme);
  const sourceNote = `Intake issue #${packet.issueReference.number}${issueMeta?.url ? ` — ${issueMeta.url}` : ''}`;

  return {
    title,
    description,
    draftDate: draftDateConvention(),
    updatedDate: null,
    draft: true,
    documentType: artifactType,
    theme: themeSlug,
    status: 'draft',
    sourceNote,
    domainPath: [packet.primaryDomain],
    relatedConcepts: packet.theme ? [packet.theme] : [],
    relatedPieces: relatedPiecesFromPacket(packet),
    canonical: false,
  };
}

function yamlValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `\n${value.map((item) => `  - ${JSON.stringify(item)}`).join('\n')}`;
  }
  const text = String(value);
  if (text.includes(':') || text.includes('"') || text.includes('\n')) {
    return JSON.stringify(text);
  }
  return text;
}

function renderFrontmatter(meta) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    if (value === null && key === 'updatedDate') {
      lines.push(`${key}:`);
      continue;
    }
    const renderedValue = yamlValue(value);
    lines.push(`${key}:${renderedValue.startsWith('\n') ? '' : ' '}${renderedValue}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function paragraphize(items, prefix = '') {
  return items
    .filter(Boolean)
    .map((item) => (prefix ? `${prefix}${item}` : item))
    .join('\n\n');
}

function buildNoteBody(packet) {
  const title = packet.workingTitle || packet.issueReference.title;
  const opening =
    packet.verifiedObservations[0] ||
    packet.unresolvedQuestions[0] ||
    packet.readerQuestion;
  const why =
    packet.centralTension ||
    packet.readerQuestion ||
    'The distinction may matter for how teams train and adapt in AI-supported work.';
  const interpretationInferences = dedupeAgainst(packet.inferences, why);
  const interpretationParts = [
    ...interpretationInferences.map((item) => item),
    ...(packet.speculation.length > 0
      ? ['**Speculation (not verified):**', ...packet.speculation.map((item) => item)]
      : []),
  ];
  const { readerFacing, editorialWorkflowNotes } = partitionPacketGaps(packet);
  const openQuestion =
    readerFacingItems(packet.unresolvedQuestions).join('\n\n') ||
    readerFacingItems(packet.evidenceGaps).join('\n\n');

  const markdownParts = [
    `# ${title}`,
    '',
    opening,
    '',
    '## Why it may matter',
    '',
    why,
    '',
  ];

  if (interpretationInferences.length > 0 || packet.speculation.length > 0) {
    markdownParts.push(
      '## Current interpretation',
      '',
      paragraphize(interpretationParts),
      '',
    );
  }

  if (openQuestion) {
    markdownParts.push('## Open question', '', openQuestion, '');
  }

  const sections = ['title', 'opening observation or question', 'why it may matter'];
  if (interpretationInferences.length > 0 || packet.speculation.length > 0) {
    sections.push('current interpretation');
  }
  if (openQuestion) sections.push('open question');

  return {
    sections,
    markdown: markdownParts.join('\n'),
    claimsUsed: [
      ...packet.verifiedObservations,
      ...packet.inferences,
    ],
    speculationIncluded: [...packet.speculation],
    readerFacingGapsPreserved: readerFacing,
    editorialWorkflowNotesOmitted: editorialWorkflowNotes,
    blockedContentOmitted: [
      ...(packet.sourceRequirements ?? []),
      ...(packet.combinationPlan ? ['combination plan material'] : []),
      ...(packet.researchPlan ? ['research plan material'] : []),
    ].filter(Boolean),
  };
}

function buildFieldReportBody(packet) {
  const title = packet.workingTitle || packet.issueReference.title;
  const signal = paragraphize(packet.verifiedObservations);
  const why =
    packet.centralTension ||
    packet.readerQuestion ||
    paragraphize(packet.inferences.slice(0, 1));
  const tensionInferences = dedupeAgainst(packet.inferences, why);
  const tension = paragraphize(tensionInferences);
  const { readerFacing, editorialWorkflowNotes } = partitionPacketGaps(packet);
  const readerFacingGaps = readerFacingItems(packet.evidenceGaps);
  const readerFacingQuestions = readerFacingItems(packet.unresolvedQuestions);

  const interpretationExtras =
    packet.speculation.length > 0
      ? `\n\n**Speculation (not verified):**\n\n${paragraphize(packet.speculation)}`
      : '';

  const sections = ['title', 'the signal', 'why it may matter'];
  const markdownParts = [
    `# ${title}`,
    '',
    '## The signal',
    '',
    signal,
    '',
    '## Why it may matter',
    '',
    why,
    '',
  ];

  if (tension || packet.speculation.length > 0) {
    sections.push('the deeper tension');
    markdownParts.push(
      '## The deeper tension',
      '',
      (tension || '') + interpretationExtras,
      '',
    );
  }

  if (readerFacingGaps.length > 0) {
    sections.push('what is not being said');
    markdownParts.push('## What is not being said', '', paragraphize(readerFacingGaps), '');
  }

  if (readerFacingQuestions.length > 0) {
    sections.push('what to watch next');
    markdownParts.push('## What to watch next', '', paragraphize(readerFacingQuestions), '');
  }

  return {
    sections,
    markdown: markdownParts.join('\n'),
    claimsUsed: [
      ...packet.verifiedObservations,
      ...packet.inferences,
    ],
    speculationIncluded: [...packet.speculation],
    readerFacingGapsPreserved: readerFacing,
    editorialWorkflowNotesOmitted: editorialWorkflowNotes,
    blockedContentOmitted: [...(packet.sourceRequirements ?? [])],
  };
}

function buildDraft(packet, artifactType, issueMeta) {
  const frontmatter = buildFrontmatter(packet, artifactType, issueMeta);
  const body =
    artifactType === 'field-report' ? buildFieldReportBody(packet) : buildNoteBody(packet);
  const markdown = `${renderFrontmatter(frontmatter)}\n\n${body.markdown}`;
  return { frontmatter, ...body, markdown };
}

function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function allowedClaimCorpus(packet, relatedTexts = []) {
  const chunks = [
    packet.workingTitle,
    packet.centralTension,
    packet.readerQuestion,
    ...packet.verifiedObservations,
    ...packet.inferences,
    ...packet.speculation,
    ...packet.unresolvedQuestions,
    ...packet.evidenceGaps,
    ...(packet.relatedMaterial ?? []).map((item) => `${item.reference} ${item.note ?? ''}`),
    ...relatedTexts,
  ];
  return chunks.filter(Boolean).map(normalizeText);
}

function sentenceSplit(body) {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('**Speculation'));
}

function overlapsCorpus(sentence, corpus) {
  const normalized = normalizeText(sentence.replace(/\*\*/g, ''));
  if (normalized.length < 20) return true;
  if (corpus.some((chunk) => chunk.includes(normalized) || normalized.includes(chunk))) {
    return true;
  }
  const tokens = normalized.match(/[a-z0-9]{4,}/g) ?? [];
  if (tokens.length === 0) return true;
  let hits = 0;
  for (const token of tokens) {
    if (corpus.some((chunk) => chunk.includes(token))) hits += 1;
  }
  return hits / tokens.length >= 0.55;
}

function validateDraftContent(draftMarkdown, packet, relatedTexts = []) {
  const errors = [];
  const warnings = [];
  const body = draftMarkdown.split('---').slice(2).join('---').trim();
  const corpus = allowedClaimCorpus(packet, relatedTexts);
  const frontmatter = draftMarkdown.split('---')[1] ?? '';

  const relatedPiecesBlock = frontmatter.match(/(?:^|\n)relatedPieces:\s*([^\n]*(?:\n  - [^\n]+)*)/);
  const relatedPieceValues = relatedPiecesBlock
    ? relatedPiecesBlock[1]
        .split('\n')
        .map((line) => line.replace(/^\s*-\s*/, '').replace(/^\[\]$/, '').replace(/^['"]|['"]$/g, '').trim())
        .filter(Boolean)
    : [];
  for (const reference of relatedPieceValues) {
    if (!isStableRelatedPieceReference(reference)) {
      errors.push(`relatedPieces contains an unstable or unapproved reference: ${reference}`);
    }
  }

  const description = frontmatter.match(/(?:^|\n)description:\s*(.+)/)?.[1]?.trim() ?? '';
  if (!description || /^what\b|\?\s*$|what should a reader understand/i.test(description)) {
    errors.push('Description must state the core idea rather than use a generic question template');
  }
  if (/readerQuestion|centralTension|verifiedObservations|draftReadiness|sourceSufficiency/i.test(description)) {
    errors.push('Description mentions internal workflow fields');
  }
  if (description && !overlapsCorpus(description, corpus)) {
    errors.push('Description contains a claim not supported by the packet');
  }

  if (/\d+%/.test(body)) {
    errors.push('Draft contains statistics not present in the packet');
  }
  if (/“[^”]+”|"[^"]{8,}"/.test(body)) {
    errors.push('Draft contains quotations not present in the packet');
  }

  const namedEntityPattern = /\b(?:Google|Meta|Microsoft|OpenAI|Robinhood|Tesla|Apple|ARD)\b/;
  const corpusJoined = corpus.join(' ');
  if (namedEntityPattern.test(body) && !namedEntityPattern.test(corpusJoined)) {
    errors.push('Draft introduces named entities not present in allowed claim corpus');
  }

  for (const sentence of sentenceSplit(body)) {
    if (sentence.startsWith('Gap:')) continue;
    if (sentence.startsWith('_') && sentence.endsWith('_')) continue;
    if (!overlapsCorpus(sentence, corpus)) {
      errors.push(`Unsupported sentence: ${sentence.slice(0, 120)}`);
    }
  }

  if (readerFacingItems(packet.unresolvedQuestions).length > 0) {
    const preserved = readerFacingItems(packet.unresolvedQuestions).some((q) =>
      body.includes(q.slice(0, 40)),
    );
    if (!preserved) warnings.push('Not all reader-facing unresolved questions visibly preserved in draft');
  }

  if (readerFacingItems(packet.evidenceGaps).length > 0) {
    const gapPreserved = readerFacingItems(packet.evidenceGaps).some((g) =>
      body.toLowerCase().includes(g.slice(0, 25).toLowerCase()),
    );
    if (!gapPreserved) warnings.push('Not all reader-facing evidence gaps visibly preserved in draft');
  }

  if ((packet.sourceRequirements ?? []).length > 0) {
    errors.push('Packet still has sourceRequirements; cannot treat sources as satisfied');
  }

  const wordCount = (body.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) ?? []).length;
  const artifactType = normalizeArtifactType(packet.approvedArtifactType);
  const target = artifactType ? TARGET_WORD_RANGES[artifactType] : null;
  if (target && wordCount < target.min) {
    warnings.push(
      `Bounded first draft / draft scaffold: ${wordCount} body words is below the ${target.min}–${target.max} word target for ${artifactType}; no padding was added.`,
    );
  }

  return { passed: errors.length === 0, errors, warnings };
}

async function loadRelatedTexts(relatedDir) {
  if (!relatedDir || !existsSync(relatedDir)) return [];
  const files = await fs.readdir(relatedDir);
  const texts = [];
  for (const name of files) {
    if (name.endsWith('.md') || name.endsWith('.json')) {
      texts.push(await fs.readFile(path.join(relatedDir, name), 'utf8'));
    }
  }
  return texts;
}

function buildReport({
  packet,
  artifactType,
  draftResult,
  validation,
  status,
  gateMessage = '',
  draftPath = '',
  failedDraftPath = '',
}) {
  return {
    contractVersion: 'loop3-drafting-report.v1',
    sourcePacketReference: {
      issueNumber: packet.issueReference.number,
      packetContract: packet.contractVersion,
      issueUrl: packet.issueReference.url,
    },
    artifactType: artifactType || normalizeArtifactType(packet.approvedArtifactType) || 'note',
    validationStatus: status,
    sectionsGenerated: draftResult?.sections ?? [],
    claimsUsed: draftResult?.claimsUsed ?? [],
    speculationIncluded: draftResult?.speculationIncluded ?? [],
    unresolvedGapsPreserved: draftResult?.readerFacingGapsPreserved ?? [],
    editorialWorkflowNotesOmitted: [...new Set(draftResult?.editorialWorkflowNotesOmitted ?? [])],
    warnings: validation?.warnings ?? [],
    blockedContentOmitted: draftResult?.blockedContentOmitted ?? [],
    validationErrors: validation?.errors ?? [],
    gateBlockingMessage: gateMessage || undefined,
    draftPath: draftPath || undefined,
    failedDraftPath: failedDraftPath || undefined,
  };
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.packet || !args.issue || !args.outDir) {
    throw new Error(`Missing required arguments.\n${usage()}`);
  }

  const packetPath = resolveInputPath(args.packet);
  const issuePath = resolveInputPath(args.issue);
  const outDir = resolveInputPath(args.outDir);
  const recommendationPath = args.recommendation ? resolveInputPath(args.recommendation) : '';
  const relatedDir = args.relatedDir ? resolveInputPath(args.relatedDir) : '';

  const packet = await readJson(packetPath);
  validatePacketSchema(packet);
  const issueBody = await fs.readFile(issuePath, 'utf8');
  const issueMeta = {
    url: packet.issueReference?.url,
  };
  const recommendation = recommendationPath ? await readJson(recommendationPath) : null;

  const gate = evaluateHardGate(packet, recommendation);
  const issueNumber = packet.issueReference.number;

  await fs.mkdir(outDir, { recursive: true });
  const failedDir = path.join(outDir, 'failed');

  if (!gate.passed) {
    const message = `Loop 3 refused to draft: ${gate.failures.join('; ')}`;
    const report = buildReport({
      packet,
      artifactType: gate.artifactType,
      status: 'blocked',
      gateMessage: message,
    });
    const reportPath = path.join(outDir, `loop3-${issueNumber}-gate-blocked.json`);
    await writeJson(reportPath, report);
    console.log(JSON.stringify({ ok: false, blocked: true, issueNumber, message, reportPath }, null, 2));
    console.error(message);
    process.exitCode = 2;
    return;
  }

  const relatedTexts = await loadRelatedTexts(relatedDir);
  const draftResult = buildDraft(packet, gate.artifactType, issueMeta);
  const validation = validateDraftContent(draftResult.markdown, packet, relatedTexts);

  const draftFileName = `loop3-${issueNumber}-draft.md`;
  const reportFileName = `loop3-${issueNumber}-draft-report.json`;

  if (!validation.passed) {
    await fs.mkdir(failedDir, { recursive: true });
    const failedDraftPath = path.join(failedDir, draftFileName);
    const reportPath = path.join(failedDir, reportFileName);
    await fs.writeFile(failedDraftPath, draftResult.markdown, 'utf8');
    const report = buildReport({
      packet,
      artifactType: gate.artifactType,
      draftResult,
      validation,
      status: 'failed',
      failedDraftPath,
    });
    await writeJson(reportPath, report);
    console.log(
      JSON.stringify(
        {
          ok: false,
          issueNumber,
          validationStatus: 'failed',
          errors: validation.errors,
          failedDraftPath,
          reportPath,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const draftPath = path.join(outDir, draftFileName);
  const reportPath = path.join(outDir, reportFileName);
  await fs.writeFile(draftPath, draftResult.markdown, 'utf8');
  const report = buildReport({
    packet,
    artifactType: gate.artifactType,
    draftResult,
    validation,
    status: 'passed',
    draftPath,
  });
  await writeJson(reportPath, report);

  console.log(
    JSON.stringify(
      {
        ok: true,
        issueNumber,
        artifactType: gate.artifactType,
        validationStatus: 'passed',
        draftPath,
        reportPath,
        warnings: validation.warnings,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
