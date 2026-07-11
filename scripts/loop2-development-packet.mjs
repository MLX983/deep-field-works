#!/usr/bin/env node

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  'docs/contracts/loop2-development-packet.v1.schema.json',
);
const SOT_ROOT = path.join(REPO_ROOT, 'docs/source-of-truth');
const TOP_MATCHES = 5;
const MAX_SNIPPET_CHARS = 700;

const BROAD_TERMS = new Set([
  'archive',
  'archives',
  'memory',
  'cognitive',
  'institution',
  'institutions',
  'process',
  'proof',
  'work',
  'works',
  'dfw',
  'intake',
  'issue',
  'open',
  'title',
  'seed',
  'note',
]);

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'for', 'from',
  'has', 'have', 'how', 'if', 'in', 'into', 'is', 'it', 'may', 'not', 'of', 'on',
  'or', 'that', 'the', 'this', 'to', 'what', 'when', 'where', 'why', 'with',
]);

const DISPOSITION_TO_READINESS = {
  'develop independently': 'ready',
  'research before development': 'research-required',
  'combine with existing material': 'combine-first',
  'combine with overlapping material': 'combine-first',
  'preserve as seed': 'insufficient-material',
  defer: 'insufficient-material',
  'needs human judgment': 'insufficient-material',
  'not for publication': 'not-for-publication',
};

function parseArgs(argv) {
  const args = {
    issue: '',
    recommendation: '',
    intakeCache: '',
    outDir: '',
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--issue') args.issue = argv[++i] ?? '';
    else if (arg === '--recommendation') args.recommendation = argv[++i] ?? '';
    else if (arg === '--intake-cache') args.intakeCache = argv[++i] ?? '';
    else if (arg === '--out-dir') args.outDir = argv[++i] ?? '';
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  npm run loop:packet -- \\
    --issue /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues/0018-....md \\
    --recommendation /tmp/dfw-loop2-eval/recommendations/issue-0018.json \\
    --intake-cache /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues \\
    --out-dir /tmp/dfw-loop2-eval/runs/0018

  npm run loop:packet -- \\
    --issue scripts/fixtures/intake-issues/issue-001-minimal-seed.md \\
    --recommendation scripts/fixtures/loop1-recommendations/issue-9001-minimal.json \\
    --out-dir /tmp/dfw-loop2-smoke`;
}

function resolveInputPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(REPO_ROOT, inputPath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function extractIssueMetadata(body) {
  const field = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bulletMatch = body.match(new RegExp(`^- \\*\\*${escaped}:\\*\\*\\s*(.*)$`, 'm'));
    const plainMatch = body.match(new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.*)$`, 'm'));
    return (bulletMatch?.[1] ?? plainMatch?.[1] ?? '').trim();
  };
  const issueHeading = body.match(/^# Issue #(\d+):\s*(.*)$/m);
  const intakeHeading = body.match(/^# Intake:\s*(.*)$/m);
  const rawBodyMatch = body.match(/### Body\s+([\s\S]*?)(?:\n---\n|$)/);
  const rawBody = (rawBodyMatch?.[1] ?? '').trim();

  return {
    number: Number(field('Number') || issueHeading?.[1] || 0),
    title: field('Title') || issueHeading?.[2] || intakeHeading?.[1] || '',
    url: field('URL'),
    rawBody,
    bodyExcerpt: rawBody.replace(/\s+/g, ' ').slice(0, 1200),
  };
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])
    .map((token) => token.replace(/^-+|-+$/g, ''))
    .filter((token) => token && !STOP_WORDS.has(token) && !BROAD_TERMS.has(token));
}

function weightedTokenMap(parts) {
  const map = new Map();
  for (const { text, weight } of parts) {
    for (const token of tokenize(text ?? '')) {
      map.set(token, (map.get(token) ?? 0) + weight);
    }
  }
  return map;
}

function parseLabeledClaims(rawBody) {
  const verifiedObservations = [];
  const inferences = [];
  const speculation = [];
  const unresolvedQuestions = [];

  const patterns = [
    { regex: /(?:^|\n)\s*Observation:\s*(.+)/gi, bucket: verifiedObservations },
    { regex: /(?:^|\n)\s*Working model:\s*(.+)/gi, bucket: inferences },
    { regex: /(?:^|\n)\s*Working thesis:\s*(.+)/gi, bucket: inferences },
    { regex: /(?:^|\n)\s*Possible claim:\s*(.+)/gi, bucket: speculation },
    { regex: /(?:^|\n)\s*Possible DFW framing:\s*(.+)/gi, bucket: speculation },
    { regex: /(?:^|\n)\s*Open question:\s*(.+)/gi, bucket: unresolvedQuestions },
    { regex: /(?:^|\n)\s*Questions to preserve:\s*([\s\S]*?)(?:\n\n|$)/gi, bucket: unresolvedQuestions },
  ];

  for (const { regex, bucket } of patterns) {
    for (const match of rawBody.matchAll(regex)) {
      const text = match[1].trim().replace(/\s+/g, ' ');
      if (!text) continue;
      if (regex.source.includes('Questions to preserve')) {
        for (const line of text.split('\n')) {
          const cleaned = line.replace(/^[-*]\s*/, '').trim();
          if (cleaned) bucket.push(cleaned);
        }
      } else {
        bucket.push(text);
      }
    }
  }

  if (verifiedObservations.length === 0) {
    const substantive = extractSubstantiveParagraphs(rawBody);
    if (substantive[0]) verifiedObservations.push(substantive[0].slice(0, 500));
  }

  return {
    verifiedObservations: [...new Set(verifiedObservations)].slice(0, 8),
    inferences: [...new Set(inferences)].slice(0, 8),
    speculation: [...new Set(speculation)].slice(0, 8),
    unresolvedQuestions: [...new Set(unresolvedQuestions)].slice(0, 10),
  };
}

function isExcludedParagraph(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length < 40) return true;

  const lower = normalized.toLowerCase();

  if (/^(possible title|or more dfw-like)\b/i.test(normalized)) return true;
  if (/\bi prefer (the )?(first|second|third|former|latter)\b/i.test(normalized)) return true;
  if (/^(thanks|thank you|fyi|note:)\b/i.test(lower)) return true;
  if (/^(i['’]ve been|i have been|i['’]d like|here is|this is interesting)\b/i.test(lower)) {
    return true;
  }
  if (
    /\b(review the|search the|investigate the|recommend the smallest|please:|do not want a)\b/i.test(
      lower,
    )
  ) {
    return true;
  }
  if (/^-\/-\/-$/.test(normalized)) return true;
  if (/^(the agent bottleneck is evaluation|more agents means more judgment work)$/i.test(normalized)) {
    return true;
  }
  if (/^(title:|subject:|seed:)\s/i.test(normalized) && normalized.length < 120) return true;

  return false;
}

function isSectionHeader(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return (
    normalized.length > 0 &&
    normalized.length < 100 &&
    !/[.!?]$/.test(normalized) &&
    !isExcludedParagraph(normalized)
  );
}

function normalizeParagraphBlocks(rawBody) {
  const rawParts = rawBody
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const merged = [];

  for (let i = 0; i < rawParts.length; i += 1) {
    let part = rawParts[i];
    if (i + 1 < rawParts.length && isSectionHeader(part)) {
      part = `${part}\n\n${rawParts[i + 1]}`;
      i += 1;
    }
    merged.push(part.replace(/\s+/g, ' ').trim());
  }

  return merged;
}

function extractSubstantiveParagraphs(rawBody) {
  return normalizeParagraphBlocks(rawBody)
    .filter((part) => !part.startsWith('#'))
    .filter((part) => !isExcludedParagraph(part))
    .map((part) => part.slice(0, 500));
}

function buildCarryForwardMaterial(recommendation, issueMeta, claims) {
  const items = [];

  for (const observation of claims.verifiedObservations) {
    if (!isExcludedParagraph(observation)) items.push(observation);
  }
  for (const inference of claims.inferences) {
    if (!isExcludedParagraph(inference)) items.push(inference);
  }
  for (const paragraph of extractSubstantiveParagraphs(issueMeta.rawBody)) {
    items.push(paragraph);
  }
  if (recommendation.rationale) items.push(recommendation.rationale);
  if (recommendation.nextAction) items.push(recommendation.nextAction);

  return [...new Set(items)].slice(0, 5);
}

function deriveWorkingTitle(issueMeta, recommendation) {
  const title = issueMeta.title.replace(/^\[DFW Intake\]\s*/i, '').trim();
  if (title) return title;
  return recommendation.themeOrCluster || 'Untitled development packet';
}

function deriveCentralTension(claims, recommendation) {
  if (claims.inferences[0]) return claims.inferences[0];
  if (claims.verifiedObservations[0]) return claims.verifiedObservations[0];
  return recommendation.rationale;
}

function deriveReaderQuestion(issueMeta, recommendation, draftReadiness) {
  if (draftReadiness === 'combine-first') {
    return `How should material from issue #${issueMeta.number} support an existing cluster without becoming a standalone artifact?`;
  }
  if (draftReadiness === 'research-required') {
    return 'What must be verified before this signal can support a field report or larger artifact?';
  }
  return `What should a reader understand about ${deriveWorkingTitle(issueMeta, recommendation)} within ${recommendation.primaryDomain}?`;
}

function parseIssueReference(recommendation) {
  const refs = recommendation.relatedMaterial ?? [];
  for (const item of refs) {
    const match = item.reference.match(/^#(\d+)$/);
    if (match) return { number: Number(match[1]), note: item.note ?? '' };
  }
  return null;
}

async function findIssueInCache(cacheDir, issueNumber) {
  if (!cacheDir || !issueNumber) return null;
  const files = await walkMarkdown(cacheDir);
  for (const filePath of files) {
    const body = await fs.readFile(filePath, 'utf8');
    const meta = extractIssueMetadata(body);
    if (meta.number === issueNumber) {
      return { path: filePath, meta, body };
    }
  }
  return null;
}

async function walkMarkdown(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMarkdown(fullPath)));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files;
}

async function loadSourceOfTruthSummaries() {
  const files = (await fs.readdir(SOT_ROOT))
    .filter((name) => name.endsWith('.md'))
    .sort();
  const summaries = [];
  for (const name of files) {
    const fullPath = path.join(SOT_ROOT, name);
    const text = await fs.readFile(fullPath, 'utf8');
    const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? name;
    const excerpt = text
      .replace(/^#.+$/m, '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    summaries.push({
      path: path.relative(REPO_ROOT, fullPath),
      title,
      excerpt,
    });
  }
  return summaries;
}

async function buildCorpusCandidate(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  const body = text.replace(/^---[\s\S]*?---\n?/, '');
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path.basename(filePath, '.md');
  const excerpt = body.replace(/^#.+$/m, '').replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET_CHARS);
  const issueMeta = extractIssueMetadata(text);
  return {
    path: path.relative(REPO_ROOT, filePath),
    title: issueMeta.title || title,
    excerpt,
    issueNumber: issueMeta.number || null,
    contentText: [title, excerpt, issueMeta.rawBody].filter(Boolean).join('\n'),
  };
}

async function collectCorpus(intakeCachePath, excludePath) {
  const roots = [
    path.join(REPO_ROOT, 'src/content/articles'),
    path.join(REPO_ROOT, 'src/content/field-notes'),
    path.join(REPO_ROOT, 'src/content/checkpoints'),
    path.join(REPO_ROOT, 'src/content/content-inbox/harvests'),
  ];
  if (intakeCachePath) roots.push(intakeCachePath);

  const exclude = path.resolve(excludePath);
  const files = (await Promise.all(roots.map((root) => walkMarkdown(root))))
    .flat()
    .filter((filePath) => path.resolve(filePath) !== exclude);

  return Promise.all(files.map((filePath) => buildCorpusCandidate(filePath)));
}

function rankCorpus(candidates, queryParts, pinnedIssueNumbers = []) {
  const query = weightedTokenMap(queryParts);
  const ranked = candidates
    .map((candidate) => {
      if (pinnedIssueNumbers.includes(candidate.issueNumber)) {
        return { ...candidate, score: 1000, matchedTerms: ['pinned-reference'] };
      }
      const parts = weightedTokenMap([
        { text: candidate.title, weight: 2 },
        { text: candidate.excerpt, weight: 4 },
        { text: candidate.contentText, weight: 3 },
      ]);
      let score = 0;
      const matched = [];
      for (const [token, queryWeight] of query.entries()) {
        const candidateWeight = parts.get(token) ?? 0;
        if (candidateWeight > 0) {
          score += queryWeight * candidateWeight;
          matched.push(token);
        }
      }
      return { ...candidate, score, matchedTerms: [...new Set(matched)].sort().slice(0, 12) };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, TOP_MATCHES);

  return ranked;
}

function validateRecommendation(rec) {
  if (rec.contractVersion !== 'loop1-reviewed-recommendation.v1') {
    throw new Error('Recommendation contractVersion must be loop1-reviewed-recommendation.v1');
  }
  if (rec.humanApprovalStatus !== 'approved') {
    throw new Error('Recommendation humanApprovalStatus must be approved');
  }
  const required = [
    'issueNumber',
    'disposition',
    'suggestedArtifact',
    'primaryDomain',
    'rationale',
    'nextAction',
  ];
  for (const key of required) {
    if (!rec[key]) throw new Error(`Recommendation missing required field: ${key}`);
  }
}

function buildRecommendedStructure(recommendation, draftReadiness, claims) {
  if (draftReadiness === 'combine-first') {
    return [
      'Preserve source issue examples and framing as supporting material',
      'Do not open a standalone article outline',
      recommendation.nextAction,
    ];
  }
  if (draftReadiness === 'research-required') {
    return [
      'Maintain as seed until primary sources are verified',
      'Separate verified observations from inference after source review',
    ];
  }
  return [
    'Observation',
    'Working model',
    'Open questions',
    'Explicit uncertainty boundaries',
  ].filter(Boolean);
}

function buildCombinationPlan(recommendation, issueMeta, claims, targetIssue) {
  const targetRef = parseIssueReference(recommendation);
  if (!targetRef) {
    throw new Error('combine-first requires a #N target in recommendation.relatedMaterial');
  }
  const carryForward = buildCarryForwardMaterial(recommendation, issueMeta, claims);
  return {
    targetReference: `#${targetRef.number}`,
    targetTitle: targetIssue?.meta.title?.replace(/^\[DFW Intake\]\s*/i, '') ?? '',
    materialToCarryForward: carryForward,
    doNotStandalone: true,
  };
}

function buildResearchPlan(recommendation, claims) {
  const claimsRequiringVerification = [
    recommendation.uncertaintyOrReviewFlag,
    ...claims.speculation.slice(0, 3),
    ...claims.inferences.filter((item) => /may|might|could|appears/i.test(item)).slice(0, 2),
  ].filter(Boolean);
  const evidenceNeededForReady = [
    'Primary source or announcement verified against the issue claims',
    'Clear distinction between capability discovery and authorization/governance',
    'Document what the standard exposes, authorizes, and leaves outside the protocol',
  ];
  return {
    claimsRequiringVerification: [...new Set(claimsRequiringVerification)].slice(0, 8),
    evidenceNeededForReady,
  };
}

function buildBlockingCondition(packet) {
  const { draftReadiness } = packet;
  if (draftReadiness === 'ready') return null;

  if (draftReadiness === 'research-required') {
    return [
      'Loop 2 stopped before drafting because source verification is required.',
      `Claims requiring verification: ${packet.researchPlan?.claimsRequiringVerification?.join('; ') || 'see sourceRequirements'}`,
      `Evidence needed for ready: ${packet.researchPlan?.evidenceNeededForReady?.join('; ') || 'see evidenceGaps'}`,
    ].join(' ');
  }

  if (draftReadiness === 'combine-first') {
    return [
      'Loop 2 stopped before drafting because this material must combine with existing work first.',
      `Combine target: ${packet.combinationPlan?.targetReference}${packet.combinationPlan?.targetTitle ? ` (${packet.combinationPlan.targetTitle})` : ''}`,
      `Carry forward: ${packet.combinationPlan?.materialToCarryForward?.join('; ') || 'see recommendedStructure'}`,
      'Do not create a standalone artifact from this issue.',
    ].join(' ');
  }

  if (draftReadiness === 'insufficient-material') {
    return 'Loop 2 stopped before drafting because the source material is not yet sufficient for development.';
  }

  if (draftReadiness === 'not-for-publication') {
    return 'Loop 2 stopped before drafting because the reviewed recommendation marks this item as not for publication.';
  }

  return 'Loop 2 stopped before drafting.';
}

function buildPacket({
  issueMeta,
  recommendation,
  claims,
  relatedMaterial,
  targetIssue,
  sotSummaries,
}) {
  const draftReadiness =
    DISPOSITION_TO_READINESS[recommendation.disposition] ?? 'insufficient-material';
  const workingTitle = deriveWorkingTitle(issueMeta, recommendation);
  const centralTension = deriveCentralTension(claims, recommendation);
  const readerQuestion = deriveReaderQuestion(issueMeta, recommendation, draftReadiness);

  const packet = {
    contractVersion: 'loop2-development-packet.v1',
    issueReference: {
      number: issueMeta.number || recommendation.issueNumber,
      title: workingTitle,
      url:
        issueMeta.url ||
        `https://github.com/MLX983/dfw-intake/issues/${recommendation.issueNumber}`,
    },
    approvedArtifactType: recommendation.suggestedArtifact,
    primaryDomain: recommendation.primaryDomain,
    theme: recommendation.themeOrCluster || '',
    workingTitle,
    readerQuestion,
    centralTension,
    verifiedObservations: claims.verifiedObservations,
    inferences: claims.inferences,
    speculation: claims.speculation,
    sourceRequirements: [],
    evidenceGaps: [],
    relatedMaterial,
    recommendedStructure: buildRecommendedStructure(recommendation, draftReadiness, claims),
    unresolvedQuestions: [
      ...claims.unresolvedQuestions,
      recommendation.uncertaintyOrReviewFlag,
    ].filter(Boolean),
    draftReadiness,
    nextAction: recommendation.nextAction,
  };

  if (draftReadiness === 'combine-first') {
    packet.combinationPlan = buildCombinationPlan(
      recommendation,
      issueMeta,
      claims,
      targetIssue,
    );
    packet.evidenceGaps = [
      recommendation.uncertaintyOrReviewFlag,
      'Confirm merged material adds evidence rather than restating the target piece',
    ].filter(Boolean);
  }

  if (draftReadiness === 'research-required') {
    packet.researchPlan = buildResearchPlan(recommendation, claims);
    packet.sourceRequirements = [
      'Primary announcement or specification for the cited standard',
      'Independent confirmation of authorization versus discovery scope',
      ...(recommendation.relatedMaterial ?? []).map((item) => item.reference),
    ];
    packet.evidenceGaps = [
      recommendation.uncertaintyOrReviewFlag,
      'What the standard exposes, authorizes, and leaves to external governance',
      ...packet.researchPlan.evidenceNeededForReady,
    ].filter(Boolean);
  }

  if (draftReadiness === 'ready') {
    packet.evidenceGaps = [
      'Measures for adaptation pace and proof distinguishing technique vs workflow vs judgment half-lives',
      recommendation.uncertaintyOrReviewFlag,
    ].filter(Boolean);
  }

  packet.relatedMaterial.push(
    ...sotSummaries.slice(0, 3).map((doc) => ({
      reference: doc.path,
      role: 'source-of-truth',
      note: doc.title,
    })),
  );

  packet.blockingCondition = buildBlockingCondition(packet);
  return packet;
}

function validatePacket(packet) {
  const required = [
    'contractVersion',
    'issueReference',
    'approvedArtifactType',
    'primaryDomain',
    'theme',
    'workingTitle',
    'readerQuestion',
    'centralTension',
    'verifiedObservations',
    'inferences',
    'speculation',
    'sourceRequirements',
    'evidenceGaps',
    'relatedMaterial',
    'recommendedStructure',
    'unresolvedQuestions',
    'draftReadiness',
    'nextAction',
  ];
  for (const key of required) {
    if (packet[key] === undefined) throw new Error(`Packet missing required field: ${key}`);
  }
  if (packet.contractVersion !== 'loop2-development-packet.v1') {
    throw new Error('Invalid contractVersion');
  }
  const allowed = [
    'ready',
    'research-required',
    'combine-first',
    'insufficient-material',
    'not-for-publication',
  ];
  if (!allowed.includes(packet.draftReadiness)) {
    throw new Error(`Invalid draftReadiness: ${packet.draftReadiness}`);
  }
  if (packet.draftReadiness === 'combine-first') {
    if (!packet.combinationPlan?.targetReference) {
      throw new Error('combine-first packet requires combinationPlan.targetReference');
    }
    if (!packet.combinationPlan.materialToCarryForward?.length) {
      throw new Error('combine-first packet requires combinationPlan.materialToCarryForward');
    }
    if (packet.combinationPlan.doNotStandalone !== true) {
      throw new Error('combine-first packet requires combinationPlan.doNotStandalone = true');
    }
  }
  if (packet.draftReadiness === 'research-required') {
    if (!packet.sourceRequirements.length) {
      throw new Error('research-required packet requires sourceRequirements');
    }
    if (!packet.evidenceGaps.length) {
      throw new Error('research-required packet requires evidenceGaps');
    }
    if (!packet.researchPlan?.claimsRequiringVerification?.length) {
      throw new Error('research-required packet requires researchPlan.claimsRequiringVerification');
    }
  }
  if (packet.draftReadiness !== 'ready' && !packet.blockingCondition) {
    throw new Error('Non-ready packet requires blockingCondition');
  }
}

function buildSummaryMarkdown(packet) {
  const lines = [
    `# Loop 2 Development Packet Summary`,
    '',
    `- **Issue:** #${packet.issueReference.number} — ${packet.issueReference.title}`,
    `- **Draft readiness:** ${packet.draftReadiness}`,
    `- **Approved artifact:** ${packet.approvedArtifactType}`,
    `- **Primary domain:** ${packet.primaryDomain}`,
    `- **Theme:** ${packet.theme || '(none)'}`,
    '',
    `## Next action`,
    packet.nextAction,
    '',
  ];

  if (packet.blockingCondition) {
    lines.push('## Blocking condition', packet.blockingCondition, '');
  }

  if (packet.combinationPlan) {
    lines.push(
      '## Combination plan',
      `- **Target:** ${packet.combinationPlan.targetReference}${packet.combinationPlan.targetTitle ? ` — ${packet.combinationPlan.targetTitle}` : ''}`,
      `- **Carry forward:** ${packet.combinationPlan.materialToCarryForward.join('; ')}`,
      `- **Do not standalone:** ${packet.combinationPlan.doNotStandalone}`,
      '',
    );
  }

  if (packet.researchPlan) {
    lines.push(
      '## Research plan',
      `- **Claims requiring verification:** ${packet.researchPlan.claimsRequiringVerification.join('; ')}`,
      `- **Evidence needed for ready:** ${packet.researchPlan.evidenceNeededForReady.join('; ')}`,
      '',
    );
  }

  lines.push(
    '## Packet output',
    'Structured JSON only. Loop 2 did not generate article prose.',
    '',
  );
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.issue || !args.recommendation || !args.outDir) {
    throw new Error(`Missing required arguments.\n${usage()}`);
  }

  const issuePath = resolveInputPath(args.issue);
  const recommendationPath = resolveInputPath(args.recommendation);
  const intakeCachePath = args.intakeCache ? resolveInputPath(args.intakeCache) : '';
  const outDir = resolveInputPath(args.outDir);

  if (!existsSync(issuePath)) throw new Error(`Issue file not found: ${issuePath}`);
  if (!existsSync(recommendationPath)) {
    throw new Error(`Recommendation file not found: ${recommendationPath}`);
  }
  if (!existsSync(SCHEMA_PATH)) throw new Error(`Schema file not found: ${SCHEMA_PATH}`);

  const issueBody = await fs.readFile(issuePath, 'utf8');
  const issueMeta = extractIssueMetadata(issueBody);
  const recommendation = await readJson(recommendationPath);
  validateRecommendation(recommendation);

  if (issueMeta.number && recommendation.issueNumber !== issueMeta.number) {
    throw new Error(
      `Issue number mismatch: issue=${issueMeta.number} recommendation=${recommendation.issueNumber}`,
    );
  }

  const claims = parseLabeledClaims(issueMeta.rawBody);
  const draftReadiness =
    DISPOSITION_TO_READINESS[recommendation.disposition] ?? 'insufficient-material';

  const pinned = [];
  const targetRef = parseIssueReference(recommendation);
  let targetIssue = null;
  if (targetRef?.number) {
    pinned.push(targetRef.number);
    targetIssue = await findIssueInCache(intakeCachePath, targetRef.number);
  }

  const queryParts = [
    { text: issueMeta.rawBody, weight: 5 },
    { text: recommendation.themeOrCluster, weight: 4 },
    { text: recommendation.rationale, weight: 3 },
    { text: recommendation.primaryDomain, weight: 2 },
    { text: targetIssue?.meta.rawBody ?? '', weight: 4 },
  ];

  const corpus = await collectCorpus(intakeCachePath, issuePath);
  const ranked = rankCorpus(corpus, queryParts, pinned);
  const sotSummaries = await loadSourceOfTruthSummaries();

  const relatedMaterial = [
    ...(recommendation.relatedMaterial ?? []).map((item) => ({
      reference: item.reference,
      role: item.reference.startsWith('#') ? 'combine-target' : 'related-theme',
      note: item.note ?? '',
    })),
    ...ranked.map((match) => ({
      reference: match.path,
      role: match.issueNumber ? 'related-backlog' : 'published-corpus',
      note: match.title,
    })),
  ];

  if (targetIssue) {
    relatedMaterial.unshift({
      reference: `#${targetIssue.meta.number}`,
      role: 'combine-target',
      note: targetIssue.meta.title.replace(/^\[DFW Intake\]\s*/i, ''),
    });
  }

  const packet = buildPacket({
    issueMeta,
    recommendation,
    claims,
    relatedMaterial,
    targetIssue,
    sotSummaries,
  });

  validatePacket(packet);

  await fs.mkdir(outDir, { recursive: true });
  const packetPath = path.join(outDir, `loop2-${packet.issueReference.number}-packet.json`);
  const summaryPath = path.join(outDir, `loop2-${packet.issueReference.number}-summary.md`);
  await fs.writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  await fs.writeFile(summaryPath, `${buildSummaryMarkdown(packet)}\n`, 'utf8');

  const result = {
    ok: true,
    issueNumber: packet.issueReference.number,
    draftReadiness: packet.draftReadiness,
    packetPath,
    summaryPath,
    blocked: packet.draftReadiness !== 'ready',
    combineTarget: packet.combinationPlan?.targetReference ?? null,
    blockingCondition: packet.blockingCondition ?? null,
  };

  console.log(JSON.stringify(result, null, 2));
  if (packet.draftReadiness !== 'ready') {
    console.error(packet.blockingCondition);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
