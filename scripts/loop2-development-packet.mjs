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

const DISPOSITION_HINTS = {
  'develop independently': 'ready-candidate',
  'research before development': 'research-candidate',
  'combine with existing material': 'combine-candidate',
  'combine with overlapping material': 'combine-candidate',
  'preserve as seed': 'insufficient-candidate',
  defer: 'insufficient-candidate',
  'needs human judgment': 'insufficient-candidate',
  'not for publication': 'not-for-publication',
};

const UNVERIFIED_EXTERNAL_PATTERNS = [
  /\b(?:google|meta|microsoft|openai|anthropic|tesla|apple)\b/i,
  /\b(?:announced|announcement|reported|according to|the article|press release)\b/i,
  /\b(?:standard|protocol|specification|whitepaper)\b/i,
  /\b(?:ard|agentic resource discovery)\b/i,
  /\bverify\b/i,
];

const ARTIFACT_THRESHOLDS = {
  note: { min: 3, ready: 5 },
  seed: { min: 1, ready: 2 },
  'field-report': { min: 5, ready: 7 },
  essay: { min: 7, ready: 9 },
  default: { min: 2, ready: 4 },
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

function artifactThreshold(suggestedArtifact) {
  const lower = suggestedArtifact.toLowerCase();
  if (lower.includes('note')) return ARTIFACT_THRESHOLDS.note;
  if (lower.includes('field report') || lower.includes('field-report')) {
    return ARTIFACT_THRESHOLDS['field-report'];
  }
  if (lower.includes('essay')) return ARTIFACT_THRESHOLDS.essay;
  if (lower.includes('seed')) return ARTIFACT_THRESHOLDS.seed;
  return ARTIFACT_THRESHOLDS.default;
}

function computeSubstanceScore(claims, substantiveParagraphs, rawBody) {
  let score = 0;
  if (claims.verifiedObservations.length > 0) score += 2;
  if (claims.inferences.length > 0) score += 2;
  if (claims.unresolvedQuestions.length > 0) score += 1;
  if (claims.speculation.length > 0) score += 1;
  score += Math.min(substantiveParagraphs.length, 3);
  if (rawBody.replace(/\s+/g, ' ').trim().length >= 250) score += 1;
  if (rawBody.replace(/\s+/g, ' ').trim().length >= 600) score += 1;
  return score;
}

function detectUnverifiedExternalDeps(rawBody, claims) {
  const haystack = [
    rawBody,
    ...claims.verifiedObservations,
    ...claims.inferences,
    ...claims.speculation,
  ].join('\n');
  const hits = [];
  for (const pattern of UNVERIFIED_EXTERNAL_PATTERNS) {
    if (pattern.test(haystack)) hits.push(pattern.source);
  }
  if (
    /\b(?:announced|announcement|reported|according to|the article)\b/i.test(haystack) &&
    !/\bObservation:\b/i.test(rawBody)
  ) {
    hits.push('external-reference-without-local-verification');
  }
  return [...new Set(hits)];
}

function jaccardSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

function detectDuplicateCluster(issueMeta, targetIssue) {
  if (!targetIssue?.meta?.rawBody) return false;
  const sourceTokens = new Set(tokenize(issueMeta.rawBody));
  const targetTokens = new Set(tokenize(targetIssue.meta.rawBody));
  const similarity = jaccardSimilarity(sourceTokens, targetTokens);
  const sharedThemes = [
    'evaluation',
    'loop',
    'agent',
    'memory',
    'governance',
    'agile',
  ].filter((term) => issueMeta.rawBody.toLowerCase().includes(term) && targetIssue.meta.rawBody.toLowerCase().includes(term));
  return similarity >= 0.08 || sharedThemes.length >= 2;
}

function centralTensionFromSource(claims) {
  if (claims.inferences[0]) return { value: claims.inferences[0], invented: false };
  if (claims.verifiedObservations[0]) return { value: claims.verifiedObservations[0], invented: false };
  return { value: '', invented: true };
}

function assessSourceSufficiency({
  issueMeta,
  recommendation,
  claims,
  targetIssue,
  hasCombineTarget,
}) {
  const reasons = [];
  const missingElements = [];
  const substantiveParagraphs = extractSubstantiveParagraphs(issueMeta.rawBody);
  const rawBody = issueMeta.rawBody.replace(/\s+/g, ' ').trim();
  const threshold = artifactThreshold(recommendation.suggestedArtifact);
  const substanceScore = computeSubstanceScore(claims, substantiveParagraphs, issueMeta.rawBody);
  const unverifiedExternal = detectUnverifiedExternalDeps(issueMeta.rawBody, claims);
  const tension = centralTensionFromSource(claims);

  const hasClearClaim =
    claims.verifiedObservations.length > 0 ||
    claims.inferences.length > 0 ||
    claims.unresolvedQuestions.length > 0 ||
    substantiveParagraphs.length > 0;

  if (!hasClearClaim) {
    missingElements.push('clear observation, question, or claim');
  }

  if (substanceScore < threshold.min) {
    reasons.push(
      `Supporting material is below the minimum threshold for ${recommendation.suggestedArtifact}`,
    );
    missingElements.push(`enough substance for approved artifact type (${recommendation.suggestedArtifact})`);
  }

  if (tension.invented || !tension.value) {
    missingElements.push('identifiable central tension from source material');
  }

  if (unverifiedExternal.length > 0) {
    reasons.push('Key claims depend on unverified external evidence');
    missingElements.push('verified primary sources');
  }

  if (hasCombineTarget) {
    reasons.push('Related material should be combined with an existing cluster first');
    missingElements.push('merge into named destination before standalone development');
  }

  const speculationDraftingRisk =
    claims.speculation.length > 0 &&
    claims.verifiedObservations.length === 0 &&
    (unverifiedExternal.length > 0 || substanceScore < threshold.ready);

  if (speculationDraftingRisk) {
    reasons.push('Drafting would likely require speculation without verified support');
    missingElements.push('verified observations before drafting');
  }

  let status = 'sufficient';
  if (!hasClearClaim || substanceScore < threshold.min || (!tension.value && !recommendation.rationale)) {
    status = 'insufficient';
  } else if (
    unverifiedExternal.length > 0 ||
    substanceScore < threshold.ready ||
    speculationDraftingRisk ||
    hasCombineTarget
  ) {
    status = 'partial';
  }

  return {
    status,
    reasons: [...new Set(reasons)],
    missingElements: [...new Set(missingElements)],
    substanceScore,
    unverifiedExternal,
    hasClearClaim,
    tensionInvented: tension.invented,
    speculationDraftingRisk,
  };
}

function determineDraftReadiness(recommendation, sufficiency, targetRef, duplicateCluster) {
  const disposition = recommendation.disposition;

  if (disposition === 'not for publication') return 'not-for-publication';

  if (
    disposition === 'combine with existing material' ||
    disposition === 'combine with overlapping material'
  ) {
    return 'combine-first';
  }

  if (targetRef && duplicateCluster && disposition === 'develop independently') {
    return 'combine-first';
  }

  if (disposition === 'research before development') return 'research-required';

  if (sufficiency.unverifiedExternal.length > 0) return 'research-required';

  if (
    recommendation.uncertaintyOrReviewFlag &&
    /\b(verif|confirm|source|announcement|whether|primary)\b/i.test(
      recommendation.uncertaintyOrReviewFlag,
    )
  ) {
    return 'research-required';
  }

  if (
    disposition === 'preserve as seed' ||
    disposition === 'defer' ||
    disposition === 'needs human judgment'
  ) {
    return 'insufficient-material';
  }

  if (sufficiency.status === 'insufficient') return 'insufficient-material';

  if (
    disposition === 'develop independently' &&
    sufficiency.status === 'sufficient' &&
    !targetRef &&
    !sufficiency.speculationDraftingRisk
  ) {
    return 'ready';
  }

  if (disposition === 'develop independently' && sufficiency.status === 'partial') {
    if (sufficiency.unverifiedExternal.length > 0) return 'research-required';
    return 'insufficient-material';
  }

  return 'insufficient-material';
}

function deriveWorkingTitle(issueMeta, recommendation) {
  const title = issueMeta.title.replace(/^\[DFW Intake\]\s*/i, '').trim();
  if (title) return title;
  return recommendation.themeOrCluster || 'Untitled development packet';
}

function deriveCentralTension(claims, recommendation, sufficiency) {
  const fromSource = centralTensionFromSource(claims);
  if (fromSource.value) return fromSource.value;
  if (sufficiency?.status === 'sufficient' && recommendation.rationale) {
    return recommendation.rationale;
  }
  return recommendation.rationale || '';
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
    const gaps = packet.sourceSufficiency?.missingElements?.join('; ') || 'see sourceSufficiency';
    return `Loop 2 stopped before drafting because the source material is not yet sufficient for development. Missing: ${gaps}`;
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
  sourceSufficiency,
  draftReadiness,
}) {
  const workingTitle = deriveWorkingTitle(issueMeta, recommendation);
  const centralTension = deriveCentralTension(claims, recommendation, sourceSufficiency);
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
    sourceSufficiency: {
      status: sourceSufficiency.status,
      reasons: sourceSufficiency.reasons,
      missingElements: sourceSufficiency.missingElements,
    },
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
      recommendation.uncertaintyOrReviewFlag,
      'Optional strengtheners that do not block a bounded note draft',
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
    'sourceSufficiency',
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
  if (!packet.sourceSufficiency?.status) {
    throw new Error('Packet requires sourceSufficiency');
  }
  if (packet.draftReadiness === 'ready' && packet.sourceSufficiency.status !== 'sufficient') {
    throw new Error('ready packet requires sourceSufficiency.status = sufficient');
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

  if (packet.sourceSufficiency) {
    lines.push(
      '## Source sufficiency',
      `- **Status:** ${packet.sourceSufficiency.status}`,
      `- **Reasons:** ${packet.sourceSufficiency.reasons.join('; ') || '(none)'}`,
      `- **Missing elements:** ${packet.sourceSufficiency.missingElements.join('; ') || '(none)'}`,
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

  const pinned = [];
  const targetRef = parseIssueReference(recommendation);
  let targetIssue = null;
  if (targetRef?.number) {
    pinned.push(targetRef.number);
    targetIssue = await findIssueInCache(intakeCachePath, targetRef.number);
  }

  const duplicateCluster = detectDuplicateCluster(issueMeta, targetIssue);
  const sourceSufficiency = assessSourceSufficiency({
    issueMeta,
    recommendation,
    claims,
    targetIssue,
    hasCombineTarget: Boolean(targetRef),
  });
  const draftReadiness = determineDraftReadiness(
    recommendation,
    sourceSufficiency,
    targetRef,
    duplicateCluster,
  );

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
    sourceSufficiency,
    draftReadiness,
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
    sourceSufficiency: packet.sourceSufficiency.status,
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
