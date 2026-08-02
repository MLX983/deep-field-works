#!/usr/bin/env node

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  deriveAuthoritativeNarrative,
  reconcileSourceSufficiency,
  validateLoop2Consistency,
} from './lib/loop2-consistency.mjs';
import { canonicalReviewedArtifact } from './lib/artifact-vocabulary.mjs';

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

const COMBINE_DISPOSITIONS = new Set([
  'combine with existing material',
  'combine with overlapping material',
]);

const UNVERIFIED_EXTERNAL_PATTERNS = [
  /\b(?:google|meta|microsoft|openai|anthropic|tesla|apple)\b/i,
  /\b(?:announced|announcement|reported|according to|the article|press release)\b/i,
  /\b(?:standard|protocol|specification|whitepaper)\b/i,
  /\b(?:ard|agentic resource discovery)\b/i,
];

const REVIEW_FLAG_RESEARCH_PATTERNS = [
  /\b(?:research|evidence|verification|validation|sourcing|citations?|factual support|fact-checking)\s+(?:is|are|remains?)\s+(?:needed|required)\b/i,
  /\b(?:additional|more|further)\s+(?:research|evidence|verification|validation|sourcing|citations?|factual support|fact-checking)\b[^.!?;]{0,40}\b(?:needed|required)\b/i,
  /\b(?:verify|confirm|validate|fact-check|research)\b[^.!?;]{0,160}\b(?:before\s+(?:drafting|proceeding|development|developing)|(?:cited\s+)?(?:sources?|citations?|claims?|facts?|evidence|announcements?|specifications?))\b/i,
  /\b(?:find|gather|collect|locate|provide|add)\b[^.!?;]{0,120}\b(?:authoritative\s+)?(?:sources?|evidence|citations?)\b/i,
  /\b(?:factual\s+)?(?:claim|statement|assertion)\b[^.!?;]{0,80}\b(?:is|are|remains?)?\s*(?:unverified|unsupported|unconfirmed|uncited)\b/i,
  /\b(?:unverified|unsupported|unconfirmed|uncited)\s+(?:factual\s+)?(?:claim|statement|assertion)\b/i,
  /\b(?:requires?|needs?)\s+(?:additional\s+)?(?:research|evidence|verification|validation|sourcing|citations?|factual support|fact-checking)\b/i,
];

const EXPLICIT_RESEARCH_ACTION_PATTERN =
  /\b(?:verify|confirm|validate|fact-check|locate|gather|collect|find|document|compare|test|identify)\b/i;
const NEUTRAL_RESEARCH_CLAIM =
  'The source’s factual claims and cited evidence require verification.';
const NEUTRAL_RESEARCH_REQUIREMENTS = [
  'Verify the source’s factual claims and cited evidence',
  'Confirm quotation context and attribution where applicable',
  'Locate concrete examples and contrary evidence relevant to the central argument',
  'Distinguish documented observations from interpretation and speculation',
];

const NEGATED_REVIEW_FLAG_RESEARCH_PATTERNS = [
  /\bno\s+(?:additional\s+|more\s+|further\s+)?(?:research|evidence|verification|validation|sourcing|citations?|factual support|fact-checking)\s+(?:is|are)\s+(?:needed|required)\b/i,
  /\b(?:research|evidence|verification|validation|sourcing|citations?|factual support|fact-checking)\s+(?:is|are|remains?)\s+not\s+(?:needed|required)\b/i,
  /\b(?:sources?|evidence|claims?|facts?|citations?|announcements?|specifications?)\b[^.!?;]{0,80}\b(?:does|do)\s+not\s+require\s+(?:research|verification|validation|fact-checking|additional evidence|sourcing|citations?)\b/i,
  /\b(?:factual\s+)?(?:claim|statement|assertion)\s+(?:is|are|remains?)\s+(?:verified|supported|confirmed|cited)\b/i,
];

const ARTIFACT_THRESHOLDS = {
  note: { min: 3, ready: 5 },
  seed: { min: 1, ready: 2 },
  'field-report': { min: 5, ready: 7 },
  'prototype-note': { min: 5, ready: 7 },
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
  const contentBody = stripStructuralIntakePrelude(rawBody);

  return {
    number: Number(field('Number') || issueHeading?.[1] || 0),
    title: field('Title') || issueHeading?.[2] || intakeHeading?.[1] || '',
    url: field('URL'),
    rawBody,
    contentBody,
    bodyExcerpt: contentBody.replace(/\s+/g, ' ').slice(0, 1200),
  };
}

const INTAKE_STRUCTURAL_FIELDS = new Set([
  'title',
  'description',
  'pubdate',
  'updateddate',
  'draft',
  'documenttype',
  'theme',
  'status',
  'sourcenote',
  'domainpath',
  'relatedconcepts',
  'relatedpieces',
  'canonical',
  'source',
  'email id',
  'from',
  'to',
  'received',
  'original subject',
  'subject',
]);

function structuralFieldName(line) {
  const match = line.match(/^([A-Za-z][A-Za-z0-9 _-]*):(?:\s.*)?$/);
  return match?.[1].trim().toLowerCase() ?? '';
}

function isStructuralPreludeContinuation(line) {
  const value = line.trim();
  return (
    !value
    || /^[-*]\s+/.test(value)
    || /^["“][^"”]+["”],?$/.test(value)
    || /^\[[^\]]*\]$/.test(value)
    || /^(?:true|false|null|\d{4}-\d{2}-\d{2})$/i.test(value)
  );
}

function stripStructuralIntakePrelude(rawBody) {
  const lines = String(rawBody ?? '').split(/\r?\n/);
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;

  if (lines[index]?.trim() === '---') {
    const closing = lines.findIndex(
      (line, candidate) => candidate > index && line.trim() === '---',
    );
    if (closing > index) index = closing + 1;
  }

  let foundStructuralField = false;
  let lastWasStructuralField = false;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (/^(?:```|~~~|>)/.test(trimmed)) break;

    const fieldName = structuralFieldName(trimmed);
    if (INTAKE_STRUCTURAL_FIELDS.has(fieldName)) {
      foundStructuralField = true;
      lastWasStructuralField = true;
      continue;
    }
    if (foundStructuralField && isStructuralPreludeContinuation(line)) {
      if (trimmed) lastWasStructuralField = false;
      continue;
    }
    if (!trimmed && (foundStructuralField || lastWasStructuralField)) continue;
    break;
  }

  return lines.slice(index).join('\n').trim();
}

function extractLevelTwoSection(rawBody, heading) {
  const lines = rawBody.split(/\r?\n/);
  const normalizedHeading = heading.toLowerCase();
  const start = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+?)\s*$/);
    return match?.[1].trim().toLowerCase() === normalizedHeading;
  });
  if (start < 0) return '';

  const section = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,2}\s+/.test(lines[index])) break;
    section.push(lines[index]);
  }
  return section.join('\n').trim();
}

function firstExplicitParagraph(section) {
  return section
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) =>
      block &&
      !/^#{1,6}\s+/.test(block) &&
      !block.split(/\r?\n/).every((line) => /^\s*[-*]\s+/.test(line)),
    )
    ?.replace(/\s+/g, ' ')
    .trim() ?? '';
}

function explicitBullets(section) {
  return section
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1]?.trim() ?? '')
    .filter(Boolean);
}

function explicitInteractionGroups(section) {
  const groups = [];
  let current = null;

  for (const line of section.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/)?.[1]?.trim();
    if (heading) {
      current = { title: heading, items: [] };
      groups.push(current);
      continue;
    }

    const item = line.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1]?.trim();
    if (item && current) current.items.push(item);
  }

  return groups;
}

function extractPrototypeNote(rawBody) {
  return {
    designProblem: firstExplicitParagraph(
      extractLevelTwoSection(rawBody, 'The design problem'),
    ),
    interactionChoice: firstExplicitParagraph(
      extractLevelTwoSection(rawBody, 'The interaction choice'),
    ),
    interactionGroups: explicitInteractionGroups(
      extractLevelTwoSection(rawBody, 'How the control surface is grouped'),
    ),
    designPrinciples: explicitBullets(
      extractLevelTwoSection(rawBody, 'Design principles'),
    ),
    currentState: firstExplicitParagraph(
      extractLevelTwoSection(rawBody, 'Current state'),
    ),
  };
}

function missingPrototypeGrounding(prototypeNote) {
  const missing = [];
  if (!prototypeNote.designProblem) missing.push('designProblem');
  if (!prototypeNote.interactionChoice) missing.push('interactionChoice');
  if (prototypeNote.interactionGroups.length === 0) {
    missing.push('interactionGroups');
  } else {
    for (const [index, group] of prototypeNote.interactionGroups.entries()) {
      if (!group.title) missing.push(`interactionGroups[${index}].title`);
      if (group.items.length === 0) {
        missing.push(`interactionGroups[${index}].items`);
      }
    }
  }
  if (prototypeNote.designPrinciples.length === 0) {
    missing.push('designPrinciples');
  }
  if (!prototypeNote.currentState) missing.push('currentState');
  return missing;
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

const NON_VERIFIED_OBSERVATION_PATTERNS = [
  /\b(?:proposed|proposal|hypothetical|speculative|prediction|recommendation)\b/i,
  /\b(?:may|might|could|should|would)\b/i,
  /\b(?:not|never)\s+(?:been\s+)?(?:implemented|built|tested|measured|verified|validated|observed|documented)\b/i,
  /\bno\s+(?:test|measurement|verification|validation)\s+(?:has|had)\s+been\s+(?:run|performed|completed)\b/i,
  /\b(?:unimplemented|untested|unverified|unvalidated|unknown|unclear)\b/i,
  /\btoo early to know\b/i,
  /\b(?:which|therefore|so)\s+(?:suggests?|implies?|indicates?)\b/i,
  /\b(?:announced|announcement|reported|according to|press release)\b/i,
];

const EVIDENCE_LABEL =
  String.raw`(?:Observation|Observed|Verified (?:observation|fact)|Tested behavior|Test result|Measured result|Documented current state)`;
const EVIDENCE_LABEL_LINE = new RegExp(
  String.raw`^(?:[-*+][ \t]+)?(?:\*\*${EVIDENCE_LABEL}:\*\*|${EVIDENCE_LABEL}:)[ \t]*(.*)$`,
  'i',
);

function qualifiesAsVerifiedObservation(text) {
  return !NON_VERIFIED_OBSERVATION_PATTERNS.some((pattern) => pattern.test(text));
}

function parseLabeledClaims(rawBody) {
  const verifiedObservations = [];
  const inferences = [];
  const speculation = [];
  const unresolvedQuestions = [];

  for (const line of rawBody.split(/\r?\n/)) {
    const match = line.trimStart().match(EVIDENCE_LABEL_LINE);
    const text = match?.[1].trim().replace(/\s+/g, ' ') ?? '';
    if (text && qualifiesAsVerifiedObservation(text)) {
      verifiedObservations.push(text);
    }
  }

  const patterns = [
    { regex: /(?:^|\n)[ \t]*Working model:[ \t]*([^\r\n]+)/gi, bucket: inferences },
    { regex: /(?:^|\n)[ \t]*Working thesis:[ \t]*([^\r\n]+)/gi, bucket: inferences },
    { regex: /(?:^|\n)[ \t]*Possible claim:[ \t]*([^\r\n]+)/gi, bucket: speculation },
    { regex: /(?:^|\n)[ \t]*Possible DFW framing:[ \t]*([^\r\n]+)/gi, bucket: speculation },
    { regex: /(?:^|\n)[ \t]*Open question:[ \t]*([^\r\n]+)/gi, bucket: unresolvedQuestions },
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

  for (const paragraph of normalizeParagraphBlocks(rawBody)) {
    for (const sentence of paragraph.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? []) {
      const text = sentence.replace(/^#{1,6}\s+/, '').trim();
      const isUnlabeledSourceInquiry =
        /^(?:how|what|why|when|where|which|who)\b.*\?$/i.test(text)
        || /^the open question is whether\b/i.test(text);
      if (
        isUnlabeledSourceInquiry
        && !/^open question:/i.test(text)
        && !isWorkflowDirective(text)
        && !isExcludedParagraph(text)
      ) {
        unresolvedQuestions.push(text);
      }
    }
  }

  return {
    verifiedObservations: [...new Set(verifiedObservations)].slice(0, 8),
    inferences: [...new Set(inferences)].slice(0, 8),
    speculation: [...new Set(speculation)].slice(0, 8),
    unresolvedQuestions: [...new Set(unresolvedQuestions)].slice(0, 10),
  };
}

function isSupportedInquiry(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return /\?$/.test(text)
    || /^(?:how|what|why|when|where|which|who)\b/i.test(text)
    || /\bwhether\b/i.test(text)
    || /\b(?:remains?|is still) (?:unclear|unknown|unresolved)\b/i.test(text)
    || /\b(?:open|unresolved) (?:question|inquiry) (?:is|concerns?)\b/i.test(text);
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

function isWorkflowDirective(text) {
  return /^(?:keep|do not|don't|avoid|preserve|verify|confirm|validate|research|hold|defer|draft|develop|outline)\b/i
    .test(String(text ?? '').trim());
}

function developmentRole(text) {
  if (/^mechanism:/i.test(text)) return 'mechanism';
  if (/^working model:/i.test(text)) return 'framing';
  if (/^possible claim:/i.test(text)) return 'hypothesis';
  if (/^open question:/i.test(text)) return 'question';
  if (/\?$/.test(text)) return 'question';
  if (/\b(?:for example|for instance|a manager|a designer|a writer|a (?:project )?team|in practice)\b/i.test(text)) return 'example';
  if (/\b(?:versus|rather than|not simply|difference|distinction|while|but)\b/i.test(text)) return 'distinction';
  if (/\b(?:may|might|could|future|working (?:lens|hypothesis))\b/i.test(text)) return 'hypothesis';
  return 'mechanism';
}

function developmentPosture(text, role) {
  if (role === 'caution') return 'editorial-caution';
  if (role === 'hypothesis' || /\b(?:may|might|could)\b/i.test(text)) return 'speculation';
  if (role === 'question') return 'research-question';
  return 'source-assertion';
}

function buildDevelopmentMaterial(recommendation, issueMeta, claims) {
  const items = [];
  const add = (content, role, provenance, evidencePosture) => {
    const normalized = String(content ?? '')
      .replace(/^(?:observation|working model|mechanism|possible claim|open question):\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return;
    const existing = items.find((item) => item.content === normalized);
    if (existing) {
      if (existing.provenance !== provenance) existing.provenance = 'both';
      if (evidencePosture === 'speculation') existing.evidencePosture = 'speculation';
      return;
    }
    items.push({ content: normalized, role, evidencePosture, provenance });
  };

  if (!isWorkflowDirective(recommendation.rationale)) {
    add(
      recommendation.rationale,
      developmentRole(recommendation.rationale ?? ''),
      'reviewed-recommendation',
      'approved-claim',
    );
  }
  for (const inference of claims.inferences) {
    add(inference, developmentRole(inference), 'source', 'source-assertion');
  }
  for (const speculation of claims.speculation) {
    add(speculation, 'hypothesis', 'source', 'speculation');
  }
  for (const question of claims.unresolvedQuestions) {
    add(question, 'question', 'source', 'research-question');
  }

  const paragraphs = extractSubstantiveParagraphs(issueMeta.contentBody)
    .filter((paragraph) => !isWorkflowDirective(paragraph));
  const scopeTokens = new Set(tokenize([
    recommendation.rationale,
    recommendation.themeOrCluster,
    recommendation.nextAction,
  ].filter(Boolean).join(' ')));
  const approvedExamples = /\b(?:source(?:'s)?|concrete) examples?\b/i
    .test(recommendation.nextAction ?? '');

  if (approvedExamples) {
    for (const paragraph of paragraphs.filter((item) => developmentRole(item) === 'example').slice(0, 2)) {
      add(paragraph, 'example', 'source', developmentPosture(paragraph, 'example'));
    }
  }
  for (const paragraph of paragraphs) {
    const overlap = new Set(tokenize(paragraph).filter((token) => scopeTokens.has(token))).size;
    if (overlap < 2) continue;
    const role = developmentRole(paragraph);
    add(paragraph, role, 'source', developmentPosture(paragraph, role));
    if (items.filter((item) => item.role !== 'caution').length >= 7) break;
  }

  const boundedItems = items.slice(0, recommendation.uncertaintyOrReviewFlag ? 7 : 8);
  if (recommendation.uncertaintyOrReviewFlag) {
    const caution = {
      content: recommendation.uncertaintyOrReviewFlag.trim(),
      role: 'caution',
      evidencePosture: 'editorial-caution',
      provenance: 'reviewed-recommendation',
    };
    const existingIndex = boundedItems.findIndex(
      (item) => item.content === caution.content,
    );
    if (existingIndex >= 0) boundedItems[existingIndex] = caution;
    else boundedItems.push(caution);
  }
  return boundedItems;
}

function hasDraftableDevelopmentMaterial(material, artifactType) {
  if (artifactType !== 'note') return true;
  const readerFacing = material.filter((item) => item.role !== 'caution');
  const hasExplanation = readerFacing.some((item) =>
    ['mechanism', 'distinction', 'hypothesis'].includes(item.role));
  return readerFacing.length >= 3 && hasExplanation;
}

function buildCarryForwardMaterial(recommendation, issueMeta, claims) {
  const items = [];

  for (const observation of claims.verifiedObservations) {
    if (!isExcludedParagraph(observation)) items.push(observation);
  }
  for (const inference of claims.inferences) {
    if (!isExcludedParagraph(inference)) items.push(inference);
  }
  for (const paragraph of extractSubstantiveParagraphs(issueMeta.contentBody)) {
    items.push(paragraph);
  }
  if (recommendation.rationale) items.push(recommendation.rationale);
  if (recommendation.nextAction) items.push(recommendation.nextAction);

  return [...new Set(items)].slice(0, 5);
}

function artifactThreshold(suggestedArtifact) {
  const lower = suggestedArtifact.toLowerCase();
  if (lower.includes('prototype-note') || lower.includes('prototype note')) {
    return ARTIFACT_THRESHOLDS['prototype-note'];
  }
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
  if (
    claims.verifiedObservations.length === 0 &&
    claims.inferences.length === 0 &&
    claims.speculation.length === 0 &&
    substantiveParagraphs.length > 0
  ) {
    score += 2;
  }
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
  developmentMaterial,
  approvedArtifactType,
}) {
  const reasons = [];
  const missingElements = [];
  const substantiveParagraphs = extractSubstantiveParagraphs(issueMeta.contentBody);
  const rawBody = issueMeta.contentBody.replace(/\s+/g, ' ').trim();
  const threshold = artifactThreshold(recommendation.suggestedArtifact);
  const substanceScore = computeSubstanceScore(claims, substantiveParagraphs, issueMeta.contentBody);
  const unverifiedExternal = detectUnverifiedExternalDeps(issueMeta.contentBody, claims);
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

  const hasApprovedCentralTension = Boolean(
    tension.value || recommendation.rationale?.trim(),
  );
  if (!hasApprovedCentralTension) {
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

  const hasDevelopmentMaterial = hasDraftableDevelopmentMaterial(
    developmentMaterial,
    approvedArtifactType,
  );
  if (!hasDevelopmentMaterial) {
    reasons.push('Approved material does not yet support the required drafting functions');
    missingElements.push(`approved source-grounded development material for ${approvedArtifactType}`);
  }

  const speculationDraftingRisk =
    claims.speculation.length > 0 &&
    claims.verifiedObservations.length === 0 &&
    (unverifiedExternal.length > 0 || substanceScore < threshold.ready);

  if (speculationDraftingRisk) {
    reasons.push('Drafting would likely overstate speculative source material');
    missingElements.push('source support or narrower scope for speculative claims');
  }

  let status = 'sufficient';
  if (!hasClearClaim || substanceScore < threshold.min || (!tension.value && !recommendation.rationale)) {
    status = 'insufficient';
  } else if (
    unverifiedExternal.length > 0 ||
    substanceScore < threshold.ready ||
    speculationDraftingRisk ||
    hasCombineTarget
    || !hasDevelopmentMaterial
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
    hasDevelopmentMaterial,
  };
}

function reviewFlagRequiresResearch(flag) {
  if (!flag) return false;

  const clauses = flag
    .split(/(?:[.;!?]\s+|,\s+but\s+|\bhowever\b)/i)
    .map((clause) => clause.trim())
    .filter(Boolean);

  return clauses.some((clause) => {
    if (
      NEGATED_REVIEW_FLAG_RESEARCH_PATTERNS.some((pattern) =>
        pattern.test(clause))
    ) {
      return false;
    }
    return REVIEW_FLAG_RESEARCH_PATTERNS.some((pattern) => pattern.test(clause));
  });
}

function determineDraftReadiness(recommendation, sufficiency) {
  const disposition = recommendation.disposition;

  if (disposition === 'not for publication') return 'not-for-publication';

  if (COMBINE_DISPOSITIONS.has(disposition)) {
    return 'combine-first';
  }

  if (disposition === 'research before development') return 'research-required';

  if (sufficiency.unverifiedExternal.length > 0) return 'research-required';

  if (
    reviewFlagRequiresResearch(recommendation.nextAction) ||
    reviewFlagRequiresResearch(recommendation.uncertaintyOrReviewFlag)
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

function deriveReaderQuestion(
  issueMeta,
  recommendation,
  draftReadiness,
  claims,
  developmentMaterial,
  approvedArtifactType,
) {
  const authoritative = deriveAuthoritativeNarrative({
    issueNumber: issueMeta.number,
    artifactType: approvedArtifactType,
    disposition: recommendation.disposition,
    draftReadiness,
  });
  if (authoritative.readerQuestion) return authoritative.readerQuestion;
  const candidates = [
    ...(claims.unresolvedQuestions ?? []),
    ...(developmentMaterial ?? [])
      .filter((item) => item.role === 'question')
      .map((item) => item.content),
  ];
  return candidates.find((item) =>
    isSupportedInquiry(item) && !isWorkflowDirective(item)) ?? '';
}

function parseExactIssueReference(reference) {
  const match = reference?.match(/^#([1-9]\d*)$/);
  return match ? Number(match[1]) : null;
}

function resolveCombineTarget(recommendation) {
  if (!COMBINE_DISPOSITIONS.has(recommendation.disposition)) return null;

  if (recommendation.combineTargetReference) {
    const number = parseExactIssueReference(
      recommendation.combineTargetReference,
    );
    if (!number) {
      throw new Error('combineTargetReference must be an exact #N reference');
    }
    const matchingRelatedMaterial = (recommendation.relatedMaterial ?? [])
      .find((item) => parseExactIssueReference(item.reference) === number);
    return {
      number,
      reference: `#${number}`,
      note: matchingRelatedMaterial?.note ?? '',
    };
  }

  const issueReferences = [
    ...new Set(
      (recommendation.relatedMaterial ?? [])
        .map((item) => parseExactIssueReference(item.reference))
        .filter(Boolean),
    ),
  ];
  if (issueReferences.length === 1) {
    const number = issueReferences[0];
    const matchingRelatedMaterial = recommendation.relatedMaterial.find(
      (item) => parseExactIssueReference(item.reference) === number,
    );
    return {
      number,
      reference: `#${number}`,
      note: matchingRelatedMaterial?.note ?? '',
    };
  }
  if (issueReferences.length === 0) {
    throw new Error(
      'Combine disposition requires combineTargetReference or one exact #N related-material reference',
    );
  }
  throw new Error(
    'Combine disposition with multiple issue references requires combineTargetReference',
  );
}

function relatedMaterialIdentity(item) {
  if (Number.isInteger(item.issueNumber) && item.issueNumber > 0) {
    return `issue:${item.issueNumber}`;
  }

  if (typeof item.reference !== 'string' || !item.reference.trim()) {
    return null;
  }

  const reference = item.reference;
  const issueMatch = reference.match(/^#(\d+)$/);
  if (issueMatch) return `issue:${Number(issueMatch[1])}`;

  const normalizedReference = path.posix
    .normalize(reference.trim().replaceAll('\\', '/'))
    .replace(/^\.\//, '');
  return `reference:${normalizedReference}`;
}

function deduplicateRelatedMaterial(items) {
  const deduplicated = [];
  const indexesByIdentity = new Map();
  const notePrioritiesByIdentity = new Map();

  for (const item of items) {
    const identity = relatedMaterialIdentity(item);
    const outputItem = {
      reference: item.reference,
      role: item.role,
      note: item.note ?? '',
    };
    if (identity === null) {
      deduplicated.push(outputItem);
      continue;
    }

    const existingIndex = indexesByIdentity.get(identity);
    if (existingIndex === undefined) {
      indexesByIdentity.set(identity, deduplicated.length);
      notePrioritiesByIdentity.set(identity, item.notePriority ?? 0);
      deduplicated.push(outputItem);
      continue;
    }

    const existing = deduplicated[existingIndex];
    const incomingNote = item.note ?? '';
    const incomingNotePriority = item.notePriority ?? 0;
    if (
      incomingNote.trim() &&
      (
        !existing.note.trim() ||
        incomingNotePriority > notePrioritiesByIdentity.get(identity)
      )
    ) {
      existing.note = incomingNote;
      notePrioritiesByIdentity.set(identity, incomingNotePriority);
    }
  }

  return deduplicated;
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
  canonicalReviewedArtifact(rec.suggestedArtifact);
  if (
    rec.combineTargetReference &&
    !COMBINE_DISPOSITIONS.has(rec.disposition)
  ) {
    throw new Error(
      'combineTargetReference is only valid for an approved combine disposition',
    );
  }
}

function buildRecommendedStructure(
  recommendation,
  draftReadiness,
  claims,
  approvedArtifactType,
) {
  return deriveAuthoritativeNarrative({
    issueNumber: recommendation.issueNumber,
    artifactType: approvedArtifactType,
    disposition: recommendation.disposition,
    draftReadiness,
  }).recommendedStructure;
}

function buildCombinationPlan(
  recommendation,
  issueMeta,
  claims,
  targetIssue,
  targetRef,
) {
  if (!targetRef) {
    throw new Error('combine-first requires an approved combine target');
  }
  const carryForward = buildCarryForwardMaterial(recommendation, issueMeta, claims);
  return {
    targetReference: `#${targetRef.number}`,
    targetTitle: targetIssue?.meta.title?.replace(/^\[DFW Intake\]\s*/i, '') ?? '',
    materialToCarryForward: carryForward,
    doNotStandalone: true,
  };
}

function isExplicitResearchRequirement(value) {
  return Boolean(
    value &&
    EXPLICIT_RESEARCH_ACTION_PATTERN.test(value)
  );
}

function uniqueResearchItems(items, limit = 8) {
  return [...new Set(items.map((item) => item?.trim()).filter(Boolean))]
    .slice(0, limit);
}

function withCleanTerminalPunctuation(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';
  text = text
    .replace(/([.!?])[;:,]+$/, '$1')
    .replace(/(^|[^.])\.\.$/, '$1.');
  if (/[.!?]$/.test(text)) return text;
  return `${text.replace(/[;:,]+$/, '')}.`;
}

function joinCleanSentences(items) {
  return items
    .map(withCleanTerminalPunctuation)
    .filter(Boolean)
    .join(' ');
}

function buildResearchPlan(recommendation, claims) {
  const explicitRequirements = uniqueResearchItems(
    recommendation.researchRequirements ?? [],
    16,
  );
  const reviewedRequirements = uniqueResearchItems([
    recommendation.nextAction,
    recommendation.uncertaintyOrReviewFlag,
  ].filter(isExplicitResearchRequirement));
  const sourceRequirements = uniqueResearchItems(
    claims.unresolvedQuestions,
  );
  const sourceClaims = uniqueResearchItems([
    ...claims.speculation.slice(0, 3),
    ...claims.inferences.slice(0, 3),
  ]);

  let evidenceNeededForReady = NEUTRAL_RESEARCH_REQUIREMENTS;
  if (sourceRequirements.length > 0) {
    evidenceNeededForReady = sourceRequirements;
  }
  if (reviewedRequirements.length > 0) {
    evidenceNeededForReady = reviewedRequirements;
  }
  if (explicitRequirements.length > 0) {
    evidenceNeededForReady = explicitRequirements;
  }

  let claimsRequiringVerification = sourceClaims;
  if (claimsRequiringVerification.length === 0) {
    claimsRequiringVerification = [NEUTRAL_RESEARCH_CLAIM];
  }

  return {
    claimsRequiringVerification,
    evidenceNeededForReady,
  };
}

function buildBlockingCondition(packet, recommendation) {
  const { draftReadiness } = packet;
  if (draftReadiness === 'ready') return null;

  if (draftReadiness === 'research-required') {
    const claims = packet.researchPlan?.claimsRequiringVerification ?? [];
    const evidence = (packet.researchPlan?.evidenceNeededForReady ?? [])
      .filter((item) => !claims.includes(item));
    return joinCleanSentences([
      'Loop 2 stopped before drafting because source verification is required.',
      `Claims requiring verification: ${joinCleanSentences(claims) || 'see sourceRequirements'}`,
      evidence.length > 0
        ? `Evidence needed for ready: ${joinCleanSentences(evidence)}`
        : '',
    ]);
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
    if (
      packet.sourceSufficiency?.missingElements?.length === 0 &&
      (
        recommendation.disposition === 'preserve as seed' ||
        recommendation.disposition === 'defer' ||
        recommendation.disposition === 'needs human judgment'
      )
    ) {
      return 'Loop 2 stopped before drafting because the reviewed recommendation does not approve standalone development.';
    }
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
  approvedArtifactType,
  prototypeNote,
  targetRef,
  developmentMaterial,
}) {
  const workingTitle = deriveWorkingTitle(issueMeta, recommendation);
  const centralTension = deriveCentralTension(claims, recommendation, sourceSufficiency);
  const readerQuestion = deriveReaderQuestion(
    issueMeta,
    recommendation,
    draftReadiness,
    claims,
    developmentMaterial,
    approvedArtifactType,
  );

  const packet = {
    contractVersion: 'loop2-development-packet.v1',
    issueReference: {
      number: issueMeta.number || recommendation.issueNumber,
      title: workingTitle,
      url:
        issueMeta.url ||
        `https://github.com/MLX983/dfw-intake/issues/${recommendation.issueNumber}`,
    },
    approvedArtifactType,
    artifactTreatment: recommendation.artifactTreatment ?? '',
    possibleFutureArtifact: recommendation.possibleFutureArtifact ?? '',
    primaryDomain: recommendation.primaryDomain,
    theme: recommendation.themeOrCluster || '',
    workingTitle,
    readerQuestion,
    centralTension,
    verifiedObservations: claims.verifiedObservations,
    inferences: claims.inferences,
    speculation: claims.speculation,
    developmentMaterial,
    sourceRequirements: [],
    evidenceGaps: [],
    relatedMaterial,
    recommendedStructure: buildRecommendedStructure(
      recommendation,
      draftReadiness,
      claims,
      approvedArtifactType,
    ),
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

  if (approvedArtifactType === 'prototype-note') {
    packet.prototypeNote = prototypeNote;
  }

  if (draftReadiness === 'combine-first') {
    packet.combinationPlan = buildCombinationPlan(
      recommendation,
      issueMeta,
      claims,
      targetIssue,
      targetRef,
    );
    packet.evidenceGaps = [
      recommendation.uncertaintyOrReviewFlag,
      'Confirm merged material adds evidence rather than restating the target piece',
    ].filter(Boolean);
  }

  if (draftReadiness === 'research-required') {
    packet.researchPlan = buildResearchPlan(recommendation, claims);
    packet.sourceRequirements = [
      ...packet.researchPlan.evidenceNeededForReady,
    ];
    packet.evidenceGaps = uniqueResearchItems([
      ...packet.researchPlan.claimsRequiringVerification,
      ...packet.researchPlan.evidenceNeededForReady,
    ], 16);
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

  const blockingCondition = buildBlockingCondition(packet, recommendation);
  if (blockingCondition !== null) {
    packet.blockingCondition = blockingCondition;
  }
  return packet;
}

function validatePacket(packet, recommendation) {
  const required = [
    'contractVersion',
    'issueReference',
    'approvedArtifactType',
    'artifactTreatment',
    'possibleFutureArtifact',
    'primaryDomain',
    'theme',
    'workingTitle',
    'readerQuestion',
    'centralTension',
    'verifiedObservations',
    'inferences',
    'speculation',
    'developmentMaterial',
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
  if (
    packet.draftReadiness === 'ready' &&
    packet.approvedArtifactType === 'note' &&
    !hasDraftableDevelopmentMaterial(packet.developmentMaterial, 'note')
  ) {
    throw new Error('ready note packet requires approved developmentMaterial');
  }
  if (packet.approvedArtifactType === 'prototype-note') {
    const missing = missingPrototypeGrounding(packet.prototypeNote ?? {
      designProblem: '',
      interactionChoice: '',
      interactionGroups: [],
      designPrinciples: [],
      currentState: '',
    });
    if (missing.length > 0) {
      throw new Error(
        `Prototype-note grounding is incomplete. Missing: ${missing.join(', ')}`,
      );
    }
  }
  validateLoop2Consistency(packet, recommendation);
}

function buildSummaryMarkdown(packet) {
  const lines = [
    `# Loop 2 Development Packet Summary`,
    '',
    `- **Issue:** #${packet.issueReference.number} — ${packet.issueReference.title}`,
    `- **Draft readiness:** ${packet.draftReadiness}`,
    `- **Approved artifact:** ${packet.approvedArtifactType}`,
    `- **Artifact treatment:** ${packet.artifactTreatment || '(none)'}`,
    `- **Possible future artifact:** ${packet.possibleFutureArtifact || '(none)'}`,
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
      `- **Claims requiring verification:** ${joinCleanSentences(packet.researchPlan.claimsRequiringVerification)}`,
      `- **Evidence needed for ready:** ${joinCleanSentences(packet.researchPlan.evidenceNeededForReady)}`,
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
  const approvedArtifactType = canonicalReviewedArtifact(
    recommendation.suggestedArtifact,
  );

  if (issueMeta.number && recommendation.issueNumber !== issueMeta.number) {
    throw new Error(
      `Issue number mismatch: issue=${issueMeta.number} recommendation=${recommendation.issueNumber}`,
    );
  }

  const claims = parseLabeledClaims(issueMeta.contentBody);
  const developmentMaterial = buildDevelopmentMaterial(
    recommendation,
    issueMeta,
    claims,
  );
  const prototypeNote = approvedArtifactType === 'prototype-note'
    ? extractPrototypeNote(issueMeta.contentBody)
    : null;
  if (prototypeNote) {
    const missing = missingPrototypeGrounding(prototypeNote);
    if (missing.length > 0) {
      throw new Error(
        `Prototype-note grounding is incomplete. Missing: ${missing.join(', ')}`,
      );
    }
  }

  const pinned = [];
  const targetRef = resolveCombineTarget(recommendation);
  let targetIssue = null;
  if (targetRef?.number) {
    pinned.push(targetRef.number);
    targetIssue = await findIssueInCache(intakeCachePath, targetRef.number);
  }

  const assessedSourceSufficiency = assessSourceSufficiency({
    issueMeta,
    recommendation,
    claims,
    targetIssue,
    hasCombineTarget: Boolean(targetRef),
    developmentMaterial,
    approvedArtifactType,
  });
  const draftReadiness = determineDraftReadiness(
    recommendation,
    assessedSourceSufficiency,
  );
  const sourceSufficiency = reconcileSourceSufficiency(
    assessedSourceSufficiency,
    draftReadiness,
    recommendation.disposition,
  );

  const queryParts = [
    { text: issueMeta.contentBody, weight: 5 },
    { text: recommendation.themeOrCluster, weight: 4 },
    { text: recommendation.rationale, weight: 3 },
    { text: recommendation.primaryDomain, weight: 2 },
    { text: targetIssue?.meta.rawBody ?? '', weight: 4 },
  ];

  const corpus = await collectCorpus(intakeCachePath, issuePath);
  const ranked = rankCorpus(corpus, queryParts, pinned);
  const sotSummaries = await loadSourceOfTruthSummaries();

  const relatedMaterialCandidates = [
    ...(recommendation.relatedMaterial ?? []).map((item) => ({
      reference: item.reference,
      role:
        targetRef &&
        parseExactIssueReference(item.reference) === targetRef.number
          ? 'combine-target'
          : 'related-theme',
      note: item.note ?? '',
      notePriority: 2,
    })),
    ...ranked.map((match) => ({
      reference: match.issueNumber ? `#${match.issueNumber}` : match.path,
      role: match.issueNumber ? 'related-backlog' : 'published-corpus',
      note: match.title,
      issueNumber: match.issueNumber,
      notePriority: 0,
    })),
  ];

  if (targetRef) {
    relatedMaterialCandidates.unshift({
      reference: targetRef.reference,
      role: 'combine-target',
      note:
        targetIssue?.meta.title.replace(/^\[DFW Intake\]\s*/i, '') ??
        targetRef.note,
      issueNumber: targetRef.number,
      notePriority: 1,
    });
  }

  const relatedMaterial = deduplicateRelatedMaterial(relatedMaterialCandidates);

  const packet = buildPacket({
    issueMeta,
    recommendation,
    claims,
    relatedMaterial,
    targetIssue,
    sotSummaries,
    sourceSufficiency,
    draftReadiness,
    approvedArtifactType,
    prototypeNote,
    targetRef,
    developmentMaterial,
  });

  validatePacket(packet, recommendation);

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
