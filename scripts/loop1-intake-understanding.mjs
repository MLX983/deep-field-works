#!/usr/bin/env node

import fs from 'node:fs/promises';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const REPO_ROOT = process.cwd();
const DEFAULT_CODEX_BIN = '/Applications/Codex.app/Contents/Resources/codex';
const MAX_SNIPPET_CHARS = 700;
const MAX_ACTIVE_BODY_EXCERPT_CHARS = 1200;
const KNOWN_BODY_EXCERPT_BOUNDARIES = new Set([
  MAX_SNIPPET_CHARS,
  MAX_ACTIVE_BODY_EXCERPT_CHARS,
]);
const TOP_MATCHES = 5;
const MODEL_TIMEOUT_MS = 120000;

const BROAD_DFW_TERMS = new Set([
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
]);

const KNOWN_FRONTMATTER_FIELDS = new Set([
  'title',
  'description',
  'pubDate',
  'draft',
  'documentType',
  'theme',
  'status',
  'sourceNote',
  'domainPath',
  'canonical',
  'relatedConcepts',
  'relatedPieces',
]);

const SECTION_HEADINGS = new Set([
  'why it matters',
  'larger pattern it may represent',
  'observations',
  'interpretations',
  'speculations',
  'related work',
  'open question',
  'open questions',
  'what remains unresolved',
  'drafting potential',
]);

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'can',
  'for',
  'from',
  'has',
  'have',
  'how',
  'if',
  'in',
  'into',
  'is',
  'it',
  'may',
  'not',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'what',
  'when',
  'where',
  'why',
  'with',
]);

const CANONICAL_GUIDANCE = {
  documentTypes: [
    'seed',
    'note',
    'field-report',
    'essay',
    'experiment',
    'prototype-note',
    'concept',
    'checkpoint',
    'project-log',
  ],
  statuses: ['seed', 'draft', 'review', 'published', 'archived', 'superseded'],
  domains: [
    'Cognitive Infrastructure',
    'Human-Machine Workflows',
    'Institutions in Transition',
    'Interfaces for Judgment',
    'Media, Memory, and Meaning',
  ],
  nextActions: [
    'preserve as-is',
    'defer',
    'combine with other material',
    'develop as note',
    'research as field report',
    'draft artifact',
    'needs human judgment',
    'not for publication',
  ],
  rule:
    'Use the smallest adequate artifact. Do not inflate material into essays. Preserve uncertainty. Human silence is never approval.',
};

function parseArgs(argv) {
  const args = {
    issue: '',
    intakeCache: '',
    out: '',
    trace: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--issue') args.issue = argv[++i] ?? '';
    else if (arg === '--intake-cache') args.intakeCache = argv[++i] ?? '';
    else if (arg === '--out') args.out = argv[++i] ?? '';
    else if (arg === '--trace') args.trace = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return `Usage:
  npm run loop:intake -- --issue scripts/fixtures/intake-issues/issue-001.md
  npm run loop:intake -- --issue scripts/fixtures/intake-issues/issue-001.md --intake-cache /tmp/dfw-intake-issues-cache-YYYYMMDD-HHMMSS/issues
  npm run loop:intake -- --issue scripts/fixtures/intake-issues/issue-001.md --trace
  npm run loop:intake -- --issue scripts/fixtures/intake-issues/issue-001.md --out /tmp/loop1-result.md`;
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function walkMarkdown(dir) {
  const files = [];
  if (!existsSync(dir)) return files;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return { frontmatter: null, body: text, warnings: [] };

  const end = text.indexOf('\n---', 4);
  if (end === -1) {
    return {
      frontmatter: null,
      body: text,
      warnings: ['Opening frontmatter delimiter found without a closing delimiter.'],
    };
  }

  const raw = text.slice(4, end).trim();
  const bodyStart = text.indexOf('\n', end + 4);
  const body = bodyStart === -1 ? '' : text.slice(bodyStart + 1);

  try {
    const parsed = yaml.load(raw) ?? {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        frontmatter: null,
        body,
        warnings: ['Frontmatter was not a mapping object.'],
      };
    }
    return { frontmatter: parsed, body, warnings: [] };
  } catch (error) {
    return {
      frontmatter: null,
      body,
      warnings: [`Frontmatter parse failed: ${error.message}`],
    };
  }
}

function keepKnownFrontmatter(raw, filePath) {
  const warnings = [];
  const kept = {};
  if (!raw) return { metadata: kept, warnings };

  for (const [key, value] of Object.entries(raw)) {
    if (!KNOWN_FRONTMATTER_FIELDS.has(key)) continue;

    if (['title', 'description', 'documentType', 'theme', 'status', 'sourceNote'].includes(key)) {
      if (typeof value === 'string') kept[key] = value;
      else warnings.push(`${filePath}: ignored ${key}; expected string.`);
    } else if (['draft', 'canonical'].includes(key)) {
      if (typeof value === 'boolean') kept[key] = value;
      else warnings.push(`${filePath}: ignored ${key}; expected boolean.`);
    } else if (key === 'pubDate') {
      if (value instanceof Date) kept[key] = value.toISOString().slice(0, 10);
      else if (typeof value === 'string') kept[key] = value;
      else warnings.push(`${filePath}: ignored pubDate; expected date or string.`);
    } else if (['domainPath', 'relatedConcepts', 'relatedPieces'].includes(key)) {
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        kept[key] = value;
      } else {
        warnings.push(`${filePath}: ignored ${key}; expected string list.`);
      }
    }
  }

  return { metadata: kept, warnings };
}

function normalizeHeading(text) {
  return text.replace(/^#+\s*/, '').trim().toLowerCase();
}

function extractHeadings(body) {
  return body
    .split('\n')
    .filter((line) => /^#{1,3}\s+/.test(line))
    .map((line) => line.replace(/^#{1,3}\s+/, '').trim())
    .slice(0, 16);
}

function firstMeaningfulExcerpt(body) {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line !== '---');
  return lines.join(' ').slice(0, MAX_SNIPPET_CHARS);
}

function extractSections(body) {
  const lines = body.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (/^#{2,3}\s+/.test(line)) {
      if (current) sections.push(current);
      const heading = line.replace(/^#{2,3}\s+/, '').trim();
      current = { heading, text: '' };
    } else if (current) {
      current.text += `${line}\n`;
    }
  }
  if (current) sections.push(current);

  return sections
    .filter((section) => SECTION_HEADINGS.has(normalizeHeading(section.heading)))
    .map((section) => ({
      heading: section.heading,
      excerpt: section.text.trim().replace(/\s+/g, ' ').slice(0, MAX_SNIPPET_CHARS),
    }))
    .filter((section) => section.excerpt)
    .slice(0, 6);
}

function extractHarvestTitle(body) {
  const match = body.match(/## Title\s+([\s\S]*?)(?:\n## |\n---|$)/);
  if (!match) return '';
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0] ?? '';
}

function extractIssueMetadata(body) {
  const field = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bulletMatch = body.match(new RegExp(`^- \\*\\*${escaped}:\\*\\*\\s*(.*)$`, 'm'));
    const plainMatch = body.match(new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.*)$`, 'm'));
    return (bulletMatch?.[1] ?? plainMatch?.[1] ?? '').trim();
  };
  const issueHeading = body.match(/^# Issue #(\d+):\s*(.*)$/m);
  const rawBodyMatch = body.match(/### Body\s+([\s\S]*?)(?:\n---\n|$)/);

  return {
    number: field('Number') || issueHeading?.[1] || '',
    title: field('Title') || issueHeading?.[2] || '',
    labels: field('Labels'),
    created: field('Created'),
    url: field('URL'),
    emailId: field('Email ID'),
    originalSubject: field('Original subject'),
    bodyExcerpt: (rawBodyMatch?.[1] ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_SNIPPET_CHARS),
  };
}

async function buildCandidate(filePath) {
  const raw = await readText(filePath);
  const { frontmatter, body, warnings: fmWarnings } = stripFrontmatter(raw);
  const { metadata, warnings: fieldWarnings } = keepKnownFrontmatter(frontmatter, filePath);
  const headings = extractHeadings(body);
  const sections = extractSections(body);
  const issueMetadata = extractIssueMetadata(body);

  if (!metadata.title) {
    const harvestTitle = issueMetadata.title || extractHarvestTitle(body);
    if (harvestTitle) metadata.title = harvestTitle;
  }

  return {
    path: path.relative(REPO_ROOT, filePath),
    metadata,
    headings,
    excerpt: firstMeaningfulExcerpt(body),
    sections,
    issueMetadata,
    warnings: [...fmWarnings, ...fieldWarnings],
  };
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])
    .map((token) => token.replace(/^-+|-+$/g, ''))
    .filter((token) => token && !STOP_WORDS.has(token));
}

function weightedTokenMap(parts) {
  const map = new Map();
  for (const { text, weight } of parts) {
    for (const token of tokenize(text ?? '')) {
      const adjustedWeight = BROAD_DFW_TERMS.has(token) ? weight * 0.25 : weight;
      map.set(token, (map.get(token) ?? 0) + adjustedWeight);
    }
  }
  return map;
}

function tokenSet(text) {
  return new Set(tokenize(text));
}

function jaccardSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap / (a.size + b.size - overlap);
}

function isIssueCacheCandidate(candidate) {
  return Boolean(candidate.issueMetadata?.number || candidate.issueMetadata?.url);
}

function semanticIssueTitle(title) {
  let normalized = (title ?? '').trim();
  const wrappers = [
    /^Issue\s+#\d+\s*:\s*/i,
    /^\[DFW Intake\]\s*/i,
  ];

  let previous;
  do {
    previous = normalized;
    for (const wrapper of wrappers) {
      normalized = normalized.replace(wrapper, '').trim();
    }
  } while (normalized !== previous);

  return normalized;
}

function likelyDuplicateOrSelfSource(issueSummary, candidate) {
  if (!isIssueCacheCandidate(candidate)) return false;

  if (
    issueSummary.emailId &&
    candidate.issueMetadata.emailId &&
    issueSummary.emailId === candidate.issueMetadata.emailId
  ) {
    return true;
  }

  const activeTitle = issueSummary.subject || issueSummary.title;
  const candidateTitle = candidate.issueMetadata.originalSubject || candidate.issueMetadata.title || candidate.metadata.title;
  const titleSimilarity = jaccardSimilarity(tokenSet(activeTitle), tokenSet(candidateTitle));
  const bodySimilarity = jaccardSimilarity(
    tokenSet(issueSummary.bodyExcerpt),
    tokenSet(candidate.issueMetadata.bodyExcerpt || candidate.excerpt),
  );

  return titleSimilarity >= 0.75 && bodySimilarity >= 0.55;
}

function candidateText(candidate) {
  return [
    candidate.metadata.title,
    candidate.metadata.description,
    candidate.metadata.documentType,
    candidate.metadata.theme,
    candidate.metadata.status,
    candidate.metadata.sourceNote,
    ...(candidate.metadata.domainPath ?? []),
    ...(candidate.metadata.relatedConcepts ?? []),
    ...(candidate.metadata.relatedPieces ?? []),
    ...candidate.headings,
    candidate.excerpt,
    ...candidate.sections.map((section) => `${section.heading} ${section.excerpt}`),
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizeSourceText(text) {
  return (text ?? '').trim().replace(/\s+/g, ' ');
}

function isTruncatedBodyExcerpt(normalizedExcerpt, normalizedRawBody) {
  return (
    KNOWN_BODY_EXCERPT_BOUNDARIES.has(normalizedExcerpt.length) &&
    normalizedRawBody.startsWith(normalizedExcerpt)
  );
}

function activeQueryFields(issueSummary, proposal) {
  const fields = [];
  const semanticTitle = semanticIssueTitle(issueSummary.title);
  const semanticSubject = semanticIssueTitle(issueSummary.subject);

  if (semanticTitle) {
    fields.push({ name: 'semanticTitle', text: semanticTitle, weight: 4 });
  }
  if (
    semanticSubject &&
    normalizeSourceText(semanticSubject).toLowerCase() !==
      normalizeSourceText(semanticTitle).toLowerCase()
  ) {
    fields.push({ name: 'subject', text: semanticSubject, weight: 3 });
  }

  const normalizedExcerpt = normalizeSourceText(issueSummary.bodyExcerpt);
  const normalizedRawBody = normalizeSourceText(issueSummary.rawBody);
  if (normalizedExcerpt && normalizedRawBody) {
    const isDuplicateBodyRepresentation =
      normalizedExcerpt === normalizedRawBody ||
      isTruncatedBodyExcerpt(normalizedExcerpt, normalizedRawBody);
    if (isDuplicateBodyRepresentation) {
      fields.push({
        name: 'substantiveBody',
        text:
          normalizedRawBody.length >= normalizedExcerpt.length
            ? issueSummary.rawBody
            : issueSummary.bodyExcerpt,
        weight: 2,
      });
    } else {
      fields.push({ name: 'bodyExcerpt', text: issueSummary.bodyExcerpt, weight: 2 });
      fields.push({ name: 'rawBody', text: issueSummary.rawBody, weight: 1 });
    }
  } else if (normalizedExcerpt) {
    fields.push({ name: 'bodyExcerpt', text: issueSummary.bodyExcerpt, weight: 2 });
  } else if (normalizedRawBody) {
    fields.push({ name: 'rawBody', text: issueSummary.rawBody, weight: 1 });
  }

  fields.push(
    { name: 'documentType', text: proposal?.documentType, weight: 1 },
    { name: 'theme', text: proposal?.theme, weight: 1 },
    { name: 'recommendedAction', text: proposal?.recommendedAction, weight: 1 },
    { name: 'domainPath', text: (proposal?.domainPath ?? []).join(' '), weight: 1 },
  );

  return fields;
}

function retrievalQuery(issueSummary, proposal) {
  return weightedTokenMap(activeQueryFields(issueSummary, proposal));
}

function candidateScoreFields(candidate) {
  if (isIssueCacheCandidate(candidate)) {
    const semanticTitle = [
      candidate.issueMetadata.originalSubject,
      candidate.issueMetadata.title,
      candidate.metadata.title,
    ]
      .map(semanticIssueTitle)
      .find(Boolean);

    return [
      { name: 'semanticTitle', text: semanticTitle, weight: 5 },
      { name: 'substantiveBody', text: candidate.issueMetadata.bodyExcerpt, weight: 1 },
    ];
  }

  return [
    { name: 'title', text: candidate.metadata.title, weight: 5 },
    { name: 'description', text: candidate.metadata.description, weight: 4 },
    { name: 'documentType', text: candidate.metadata.documentType, weight: 2 },
    { name: 'theme', text: candidate.metadata.theme, weight: 2 },
    { name: 'domainPath', text: (candidate.metadata.domainPath ?? []).join(' '), weight: 2 },
    {
      name: 'relatedConcepts',
      text: (candidate.metadata.relatedConcepts ?? []).join(' '),
      weight: 2,
    },
    { name: 'headings', text: candidate.headings.join(' '), weight: 2 },
    { name: 'excerpt', text: candidate.excerpt, weight: 1 },
    {
      name: 'sections',
      text: candidate.sections.map((section) => `${section.heading} ${section.excerpt}`).join(' '),
      weight: 1,
    },
  ];
}

function scoreCandidate(issueSummary, proposal, candidate) {
  const query = retrievalQuery(issueSummary, proposal);
  const scoreByField = {};
  const matched = new Set();

  for (const field of candidateScoreFields(candidate)) {
    const fieldTokens = weightedTokenMap([field]);
    let fieldScore = 0;
    for (const [token, queryWeight] of query.entries()) {
      const candidateWeight = fieldTokens.get(token) ?? 0;
      if (candidateWeight > 0) {
        fieldScore += queryWeight * candidateWeight;
        matched.add(token);
      }
    }
    scoreByField[field.name] = fieldScore;
  }

  return {
    score: Object.values(scoreByField).reduce((total, fieldScore) => total + fieldScore, 0),
    matchedTerms: [...matched].sort().slice(0, 18),
    scoreByField,
    bonuses: 0,
    penalties: 0,
  };
}

function rankCandidates(issueSummary, proposal, candidates) {
  const ranked = candidates.map((candidate) => {
    const { score, matchedTerms } = scoreCandidate(issueSummary, proposal, candidate);

    const relationType = likelyDuplicateOrSelfSource(issueSummary, candidate)
      ? 'likely-duplicate-or-self-source'
      : 'related';

    return {
      ...candidate,
      score,
      relationType,
      matchedTerms,
    };
  });

  return ranked
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, TOP_MATCHES);
}

function parseIssue(body, issuePath) {
  const lines = body.split('\n');
  const titleLine = lines.find((line) => line.startsWith('# '));
  const title = titleLine?.replace(/^#\s+/, '').trim() || path.basename(issuePath, '.md');
  const field = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = body.match(new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.*)$`, 'm'));
    return match?.[1]?.trim() ?? '';
  };
  const rawBodyMatch = body.match(/### Body\s+([\s\S]*?)(?:\n---\n|$)/);
  const rawBody = rawBodyMatch?.[1]?.trim() || body.slice(0, 3000);

  return {
    path: path.relative(REPO_ROOT, issuePath),
    title,
    source: field('Source'),
    emailId: field('Email ID'),
    from: field('From'),
    to: field('To'),
    received: field('Received'),
    subject: field('Original subject'),
    bodyExcerpt: rawBody.replace(/\s+/g, ' ').slice(0, MAX_ACTIVE_BODY_EXCERPT_CHARS),
    rawBody: rawBody.slice(0, 4000),
  };
}

function resolveInputPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(REPO_ROOT, inputPath);
}

async function collectCorpus(activeIssuePath, intakeCachePath = '') {
  const roots = [
    'src/content/articles',
    'src/content/field-notes',
    'src/content/checkpoints',
    'src/content/content-inbox/harvests',
    'scripts/fixtures/intake-issues',
  ];
  if (intakeCachePath) roots.push(intakeCachePath);

  const active = path.resolve(activeIssuePath);
  const files = (
    await Promise.all(roots.map((root) => walkMarkdown(resolveInputPath(root))))
  )
    .flat()
    .filter((filePath) => path.resolve(filePath) !== active)
    .sort();

  return Promise.all(files.map((filePath) => buildCandidate(filePath)));
}

function modelPrompt(kind, payload) {
  const shared = `You are running Deep Field Works Loop 1: Intake Understanding.

Return only the requested JSON or Markdown. Do not use tools. Do not draft an article. Do not publish. Do not mutate files.

Canonical guidance, minimized:
${JSON.stringify(CANONICAL_GUIDANCE, null, 2)}
`;

  if (kind === 'proposal') {
    return `${shared}
Task: make the provisional proposal BEFORE retrieval.

Use this exact JSON shape:
{
  "documentType": "seed | note | field-report | essay | experiment | prototype-note | concept | checkpoint | project-log",
  "domainPath": ["one or more canonical domains"],
  "theme": "one concise existing/likely theme, or empty string if uncertain",
  "confidence": "low | medium | high",
  "recommendedAction": "preserve as-is | defer | combine with other material | develop as note | research as field report | draft artifact | needs human judgment | not for publication",
  "rationale": "brief reason",
  "openQuestions": ["brief question"]
}

Issue summary:
${JSON.stringify(payload.issueSummary, null, 2)}
`;
  }

  if (kind === 'evaluation') {
    return `${shared}
Task: evaluate whether the provisional proposal survives contact with retrieved context.

Do not anchor to the provisional proposal. Replace the classification completely if retrieved context changes the interpretation.
Return one of PASS, REVISE, ESCALATE. Keep the evaluator narrow; do not write a long editorial essay.

Check specifically:
- artifact inflation
- duplication
- stronger cluster
- weak evidence
- wrong domain
- need for human intent/judgment

Use this exact JSON shape:
{
  "result": "PASS | REVISE | ESCALATE",
  "reason": "one or two sentences",
  "checks": {
    "artifactInflation": "pass | concern",
    "duplication": "pass | concern",
    "strongerCluster": "pass | concern",
    "weakEvidence": "pass | concern",
    "wrongDomain": "pass | concern",
    "humanIntentNeeded": "pass | concern"
  },
  "replacementGuidance": {
    "documentType": "same allowed values or empty string",
    "domainPath": ["canonical domains, or empty"],
    "theme": "string or empty",
    "recommendedAction": "allowed next action or empty string",
    "notes": "brief guidance"
  }
}

Issue summary:
${JSON.stringify(payload.issueSummary, null, 2)}

Provisional proposal:
${JSON.stringify(payload.proposal, null, 2)}

Retrieved snippets:
${JSON.stringify(payload.matches.map(toModelMatch), null, 2)}
`;
  }

  if (kind === 'final') {
    return `${shared}
Task: write the final clean Markdown result for the GitHub issue.

This is the one allowed autonomous revision. If evaluation.replacementGuidance conflicts with the provisional proposal, treat replacementGuidance as the correction to apply. The revision may fully replace documentType, domainPath, theme, or recommendedAction. Do not anchor to the provisional proposal.

Use exactly this structure:
## Loop 1 Intake Understanding

**Recommendation:** ...
**Document type:** ...
**Confidence:** ...
**Primary domain:** ...
**Theme:** ...

### Why this may matter

...

### Related material

- \`path\`: reason

### Evaluation

**Result:** PASS | REVISE | ESCALATE

...

### Suggested next action

...

### Open questions

- ...

### Agent notes

**Observation:** ...
**Inference:** ...
**Speculation:** ...
**Uncertainty / missing context:** ...

Issue summary:
${JSON.stringify(payload.issueSummary, null, 2)}

Provisional proposal:
${JSON.stringify(payload.proposal, null, 2)}

Evaluation:
${JSON.stringify(payload.evaluation, null, 2)}

Retrieved snippets:
${JSON.stringify(payload.matches.map(toModelMatch), null, 2)}
`;
  }

  throw new Error(`Unknown model prompt kind: ${kind}`);
}

function toModelMatch(match) {
  return {
    path: match.path,
    score: match.score,
    relationType: match.relationType,
    title: match.metadata.title ?? '',
    description: match.metadata.description ?? '',
    documentType: match.metadata.documentType ?? '',
    theme: match.metadata.theme ?? '',
    status: match.metadata.status ?? '',
    domainPath: match.metadata.domainPath ?? [],
    relatedConcepts: match.metadata.relatedConcepts ?? [],
    headings: match.headings.slice(0, 8),
    excerpt: match.excerpt,
    sections: match.sections.slice(0, 4),
    matchedTerms: match.matchedTerms,
  };
}

function codexBin() {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  if (existsSync(DEFAULT_CODEX_BIN)) return DEFAULT_CODEX_BIN;
  return 'codex';
}

function callModel(kind, payload) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'dfw-loop1-'));
  const outPath = path.join(tempDir, 'last-message.txt');
  const prompt = modelPrompt(kind, payload);
  const executable = codexBin();

  const result = spawnSync(
    executable,
    [
      'exec',
      '--cd',
      REPO_ROOT,
      '--sandbox',
      'read-only',
      '--ephemeral',
      '--output-last-message',
      outPath,
      '-',
    ],
    {
      input: prompt,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 12,
      timeout: MODEL_TIMEOUT_MS,
    },
  );

  const lastMessage = existsSync(outPath) ? readFileSync(outPath, 'utf8').trim() : '';
  rmSync(tempDir, { recursive: true, force: true });

  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
    throw new Error(
      `Model call timed out for ${kind} after ${MODEL_TIMEOUT_MS / 1000} seconds. No partial output was used.`,
    );
  }

  if (result.error) {
    const code = result.error.code || 'UNKNOWN';
    const error =
      code === 'ENOENT'
        ? new Error(
            `Codex executable not found for ${kind}: ${executable} (${code}). Set CODEX_BIN to a valid executable or ensure codex is discoverable in the inherited PATH.`,
          )
        : new Error(
            `Could not launch Codex executable for ${kind}: ${executable} (${code}). ${result.error.message}`,
          );
    error.code = code;
    error.executable = executable;
    error.category = code === 'ENOENT' ? 'executable-not-found' : 'spawn';
    error.cause = result.error;
    throw error;
  }

  if (result.status !== 0 || !lastMessage) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').slice(-4000);
    const normalized = detail.toLowerCase();
    const category =
      /\b(unauthenticated|unauthorized|authentication|login|log in|401)\b/.test(normalized)
        ? 'authentication'
        : /\b(econn|enotfound|dns|network|socket|timed? ?out|connection)\b/.test(normalized)
          ? 'network'
          : /\b(provider|rate.?limit|429|service unavailable|502|503|504)\b/.test(normalized)
            ? 'provider'
            : 'model';
    const error = new Error(
      `Codex ${category} failure for ${kind}; executable ${executable} exited ${result.status ?? 'without a status'}${lastMessage ? '' : ' without a final response'}.\n${detail}`,
    );
    error.category = category;
    error.executable = executable;
    error.exitCode = result.status;
    throw error;
  }

  return lastMessage;
}

function parseJsonResponse(text, label) {
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch {
        // Fall through.
      }
    }
  }
  throw new Error(`Could not parse ${label} JSON response:\n${text}`);
}

function validateProposal(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new Error('Proposal response must be a JSON object.');
  }
  if (!CANONICAL_GUIDANCE.documentTypes.includes(proposal.documentType)) {
    throw new Error(`Proposal returned invalid documentType: ${proposal.documentType}`);
  }
  if (
    !Array.isArray(proposal.domainPath) ||
    !proposal.domainPath.every((domain) => CANONICAL_GUIDANCE.domains.includes(domain))
  ) {
    throw new Error('Proposal returned invalid domainPath; expected canonical primary domains only.');
  }
  if (!CANONICAL_GUIDANCE.nextActions.includes(proposal.recommendedAction)) {
    throw new Error(`Proposal returned invalid recommendedAction: ${proposal.recommendedAction}`);
  }
  if (!['low', 'medium', 'high'].includes(proposal.confidence)) {
    throw new Error(`Proposal returned invalid confidence: ${proposal.confidence}`);
  }
  if (typeof proposal.rationale !== 'string') {
    throw new Error('Proposal returned invalid rationale; expected string.');
  }
  if (
    !Array.isArray(proposal.openQuestions) ||
    !proposal.openQuestions.every((question) => typeof question === 'string')
  ) {
    throw new Error('Proposal returned invalid openQuestions; expected string array.');
  }
  return proposal;
}

function validateEvaluation(evaluation) {
  if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
    throw new Error('Evaluation response must be a JSON object.');
  }
  if (!['PASS', 'REVISE', 'ESCALATE'].includes(evaluation.result)) {
    throw new Error(`Evaluation returned invalid result: ${evaluation.result}`);
  }
  if (typeof evaluation.reason !== 'string') {
    throw new Error('Evaluation returned invalid reason; expected string.');
  }

  const expectedChecks = [
    'artifactInflation',
    'duplication',
    'strongerCluster',
    'weakEvidence',
    'wrongDomain',
    'humanIntentNeeded',
  ];
  if (!evaluation.checks || typeof evaluation.checks !== 'object' || Array.isArray(evaluation.checks)) {
    throw new Error('Evaluation returned invalid checks; expected object.');
  }
  const checkKeys = Object.keys(evaluation.checks);
  const unexpected = checkKeys.filter((key) => !expectedChecks.includes(key));
  const missing = expectedChecks.filter((key) => !checkKeys.includes(key));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `Evaluation checks must contain exactly expected keys. Missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}.`,
    );
  }
  for (const key of expectedChecks) {
    if (!['pass', 'concern'].includes(evaluation.checks[key])) {
      throw new Error(`Evaluation check ${key} must be "pass" or "concern".`);
    }
  }

  if (evaluation.replacementGuidance !== undefined) {
    const guidance = evaluation.replacementGuidance;
    if (!guidance || typeof guidance !== 'object' || Array.isArray(guidance)) {
      throw new Error('Evaluation replacementGuidance must be an object when present.');
    }
    if (
      guidance.documentType &&
      !CANONICAL_GUIDANCE.documentTypes.includes(guidance.documentType)
    ) {
      throw new Error(`Evaluation replacementGuidance returned invalid documentType: ${guidance.documentType}`);
    }
    if (
      guidance.domainPath !== undefined &&
      (!Array.isArray(guidance.domainPath) ||
        !guidance.domainPath.every((domain) => CANONICAL_GUIDANCE.domains.includes(domain)))
    ) {
      throw new Error('Evaluation replacementGuidance returned invalid domainPath.');
    }
    if (
      guidance.recommendedAction &&
      !CANONICAL_GUIDANCE.nextActions.includes(guidance.recommendedAction)
    ) {
      throw new Error(
        `Evaluation replacementGuidance returned invalid recommendedAction: ${guidance.recommendedAction}`,
      );
    }
    if (guidance.theme !== undefined && typeof guidance.theme !== 'string') {
      throw new Error('Evaluation replacementGuidance returned invalid theme; expected string.');
    }
    if (guidance.notes !== undefined && typeof guidance.notes !== 'string') {
      throw new Error('Evaluation replacementGuidance returned invalid notes; expected string.');
    }
  }
  return evaluation;
}

function formatRelated(matches) {
  if (matches.length === 0) return '- No strong local matches found.';
  return matches
    .map((match) => {
      const title = match.metadata.title ? `: ${match.metadata.title}` : '';
      const terms = match.matchedTerms.length ? ` Matched: ${match.matchedTerms.join(', ')}.` : '';
      const relation =
        match.relationType === 'likely-duplicate-or-self-source'
          ? ' Likely duplicate/self-source; useful for provenance, not strong related-material evidence.'
          : '';
      return `- \`${match.path}\`${title}.${relation}${terms}`;
    })
    .join('\n');
}

function formatPassResult(issueSummary, proposal, evaluation, matches) {
  const primaryDomain = proposal.domainPath?.[0] ?? '';
  const openQuestions = (proposal.openQuestions ?? []).map((q) => `- ${q}`).join('\n') || '- None yet.';
  return `## Loop 1 Intake Understanding

**Recommendation:** ${proposal.recommendedAction}
**Document type:** ${proposal.documentType}
**Confidence:** ${proposal.confidence}
**Primary domain:** ${primaryDomain}
**Theme:** ${proposal.theme ?? ''}

### Why this may matter

${proposal.rationale}

### Related material

${formatRelated(matches)}

### Evaluation

**Result:** ${evaluation.result}

${evaluation.reason}

### Suggested next action

${proposal.recommendedAction}

### Open questions

${openQuestions}

### Agent notes

**Observation:** ${issueSummary.bodyExcerpt}
**Inference:** ${proposal.rationale}
**Speculation:** 
**Uncertainty / missing context:** ${evaluation.checks?.humanIntentNeeded === 'concern' ? 'Human intent may be needed.' : 'No additional uncertainty identified by this pass.'}
`;
}

function formatEscalateResult(proposal, evaluation, matches) {
  const guidanceQuestions = evaluation.replacementGuidance?.notes
    ? [`- ${evaluation.replacementGuidance.notes}`]
    : [];
  const openQuestions = [
    ...(proposal.openQuestions ?? []).map((question) => `- ${question}`),
    ...guidanceQuestions,
  ].join('\n') || '- Human intent or missing context is required before a reliable recommendation.';

  return `## Loop 1 Intake Understanding

**Recommendation:** needs human judgment
**Document type:** ${evaluation.replacementGuidance?.documentType || proposal.documentType}
**Confidence:** low
**Primary domain:** ${evaluation.replacementGuidance?.domainPath?.[0] || proposal.domainPath?.[0] || ''}
**Theme:** ${evaluation.replacementGuidance?.theme || proposal.theme || ''}

### Why this may matter

The evaluator escalated instead of substituting a confident recommendation.

### Related material

${formatRelated(matches)}

### Evaluation

**Result:** ESCALATE

${evaluation.reason}

### Suggested next action

Needs human judgment before classification, clustering, or development.

### Open questions

${openQuestions}

### Agent notes

**Observation:** Retrieved context or source material was not sufficient for a safe autonomous recommendation.
**Inference:** ${evaluation.reason}
**Speculation:** 
**Uncertainty / missing context:** Human intent, missing source context, or publication judgment is required.
`;
}

function traceMarkdown(proposal, matches, evaluation, finalMarkdown) {
  const matchLines =
    matches.length === 0
      ? 'No retrieved matches scored above zero.'
      : matches
          .map(
            (match, index) => `${index + 1}. \`${match.path}\`
   - score: ${match.score}
   - relation: ${match.relationType}
   - matched terms: ${match.matchedTerms.join(', ') || '(none)'}
   - snippet: ${(match.excerpt || match.sections[0]?.excerpt || '').slice(0, 300)}`,
          )
          .join('\n\n');

  return `# Loop 1 Dry Run Trace

## Provisional Proposal

\`\`\`json
${JSON.stringify(proposal, null, 2)}
\`\`\`

## Retrieved Matches

${matchLines}

## Evaluation Result

\`\`\`json
${JSON.stringify(evaluation, null, 2)}
\`\`\`

## Final Recommendation

${finalMarkdown}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.issue) throw new Error(`Missing --issue.\n${usage()}`);

  const issuePath = path.resolve(REPO_ROOT, args.issue);
  if (!existsSync(issuePath)) throw new Error(`Issue file not found: ${issuePath}`);
  const intakeCachePath = args.intakeCache ? resolveInputPath(args.intakeCache) : '';
  if (intakeCachePath) {
    const cacheStat = await fs.stat(intakeCachePath).catch(() => null);
    if (!cacheStat?.isDirectory()) {
      throw new Error(`Intake cache path must be a readable directory of Markdown files: ${intakeCachePath}`);
    }
  }

  const issueBody = await readText(issuePath);
  const issueSummary = parseIssue(issueBody, issuePath);

  const proposalText = callModel('proposal', { issueSummary });
  const proposal = validateProposal(parseJsonResponse(proposalText, 'proposal'));

  const candidates = await collectCorpus(issuePath, intakeCachePath);
  const matches = rankCandidates(issueSummary, proposal, candidates);

  const evaluationText = callModel('evaluation', { issueSummary, proposal, matches });
  const evaluation = validateEvaluation(parseJsonResponse(evaluationText, 'evaluation'));

  const finalMarkdown =
    evaluation.result === 'PASS'
      ? formatPassResult(issueSummary, proposal, evaluation, matches)
      : evaluation.result === 'ESCALATE'
        ? formatEscalateResult(proposal, evaluation, matches)
        : callModel('final', { issueSummary, proposal, evaluation, matches });

  const output = args.trace
    ? traceMarkdown(proposal, matches, evaluation, finalMarkdown)
    : finalMarkdown;

  if (args.out) {
    await fs.writeFile(path.resolve(REPO_ROOT, args.out), finalMarkdown, 'utf8');
  }

  console.log(output.trim());
}

export {
  activeQueryFields,
  buildCandidate,
  callModel,
  likelyDuplicateOrSelfSource,
  parseIssue,
  rankCandidates,
  retrievalQuery,
  scoreCandidate,
  semanticIssueTitle,
  toModelMatch,
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
