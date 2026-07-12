#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CONTRACT = 'loop4-editorial-evaluation.v1';
const VERDICTS = new Set(['PASS_TO_HUMAN', 'REVISE', 'HOLD']);
const TARGETS = { note: [200, 600], 'field-report': [500, 1200] };
const REQUIRED_SECTIONS = {
  note: [['why it may matter'], ['current interpretation'], ['open question']],
  'field-report': [['the signal'], ['why it may matter'], ['the deeper tension'], ['what to watch next']],
};
const SOURCE_OF_TRUTH = [
  'docs/source-of-truth/editorial-guidelines.md',
  'docs/source-of-truth/voice-and-style.md',
  'docs/source-of-truth/article-templates.md',
  'docs/source-of-truth/content-schema.md',
];
const GENERIC_PATTERNS = [
  /in today['’]s rapidly changing world/i,
  /as ai continues to evolve/i,
  /rapidly evolving landscape/i,
  /unlock(?:s|ing)? new possibilities/i,
  /leverage ai/i,
  /harness the power/i,
  /seamless integration/i,
  /transformative potential/i,
  /game[- ]changer/i,
  /unprecedented change/i,
  /boost productivity/i,
  /supercharge/i,
  /future-proof/i,
  /ai-powered revolution/i,
  /the possibilities are endless/i,
];

function args(argv) {
  const out = { packet: '', draft: '', report: '', outDir: '', help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--packet') out.packet = argv[++i] ?? '';
    else if (value === '--draft') out.draft = argv[++i] ?? '';
    else if (value === '--draft-report') out.report = argv[++i] ?? '';
    else if (value === '--out-dir') out.outDir = argv[++i] ?? '';
    else if (value === '--help' || value === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return out;
}

function usage() {
  return `Usage: node scripts/loop4-editorial-evaluation.mjs \\
  --packet <loop2-packet.json> \\
  --draft <loop3-draft.md> \\
  --draft-report <loop3-draft-report.json> \\
  --out-dir </tmp/output>`;
}

function resolve(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/[“”"'’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value) {
  return new Set((normalize(value).match(/[a-z0-9]{4,}/g) ?? []));
}

function overlap(value, corpus) {
  const itemTokens = [...tokens(value)];
  if (itemTokens.length === 0) return true;
  const corpusTokens = tokens(corpus);
  return itemTokens.filter((token) => corpusTokens.has(token)).length / itemTokens.length >= 0.55;
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === '[]') return [];
  if (value === '') return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    try { return JSON.parse(value); } catch { return value.slice(1, -1); }
  }
  return value;
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return { data: {}, body: markdown, error: 'Draft has no YAML frontmatter' };
  const end = markdown.indexOf('\n---', 4);
  if (end < 0) return { data: {}, body: markdown, error: 'Draft frontmatter is not closed' };
  const raw = markdown.slice(4, end);
  const data = {};
  let arrayKey = '';
  for (const line of raw.split('\n')) {
    const arrayItem = line.match(/^\s+-\s+(.+)$/);
    if (arrayItem && arrayKey) {
      data[arrayKey].push(parseScalar(arrayItem[1]));
      continue;
    }
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!field) continue;
    const [, key, rest = ''] = field;
    if (!rest && ['domainPath', 'relatedConcepts', 'relatedPieces'].includes(key)) {
      data[key] = [];
      arrayKey = key;
    } else {
      data[key] = parseScalar(rest);
      arrayKey = '';
    }
  }
  return { data, body: markdown.slice(end + 4).trim(), error: '' };
}

function headings(body) {
  return [...body.matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => normalize(match[1]));
}

function sentences(body) {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('**'))
    .flatMap((line) => line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((line) => line.trim());
}

function wordCount(body) {
  return (body.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) ?? []).length;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function validateInputs(packet, report) {
  const problems = [];
  if (packet.contractVersion !== 'loop2-development-packet.v1') problems.push('Packet contract is not loop2-development-packet.v1.');
  if (report.contractVersion !== 'loop3-drafting-report.v1') problems.push('Draft report contract is not loop3-drafting-report.v1.');
  if (packet.issueReference?.number !== report.sourcePacketReference?.issueNumber) problems.push('Packet and drafting report issue numbers do not match.');
  if (packet.draftReadiness !== 'ready' || packet.sourceSufficiency?.status !== 'sufficient' || packet.blockingCondition || (packet.sourceRequirements ?? []).length) {
    problems.push('Upstream packet is not consistently ready and source-sufficient for editorial evaluation.');
  }
  if (report.validationStatus !== 'passed') problems.push('Loop 3 drafting report did not pass deterministic drafting validation.');
  return problems;
}

function metadataProblems(meta, packet, report) {
  const errors = [];
  for (const key of ['title', 'description', 'draftDate', 'draft', 'documentType', 'theme', 'status', 'sourceNote', 'domainPath', 'relatedPieces', 'canonical']) {
    if (meta[key] === undefined || meta[key] === null || meta[key] === '') errors.push(`Metadata field ${key} is missing.`);
  }
  if (meta.draft !== true) errors.push('Loop 3 candidate metadata must keep draft: true.');
  if (meta.status !== 'draft') errors.push('Loop 3 candidate metadata must keep status: draft.');
  if (meta.canonical !== false) errors.push('Loop 3 candidate metadata must keep canonical: false.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(meta.draftDate ?? ''))) errors.push('draftDate must use YYYY-MM-DD.');
  if (meta.pubDate) errors.push('Loop 3 draft must not assign pubDate.');
  if (!Array.isArray(meta.domainPath) || !meta.domainPath.length) errors.push('domainPath must contain the approved primary domain.');
  if (meta.domainPath?.[0] !== packet.primaryDomain) errors.push('domainPath does not match the packet primary domain.');
  if (!Array.isArray(meta.relatedPieces)) errors.push('relatedPieces must be an array.');
  if (meta.documentType !== report.artifactType) errors.push('Draft metadata artifact type does not match the Loop 3 report.');
  if (meta.documentType !== packet.approvedArtifactType) errors.push('Draft metadata artifact type does not match the approved packet artifact type.');
  return errors;
}

function unsupportedClaims(body, packet) {
  const allowed = [
    packet.workingTitle,
    packet.readerQuestion,
    packet.centralTension,
    ...(packet.verifiedObservations ?? []),
    ...(packet.inferences ?? []),
    ...(packet.speculation ?? []),
    ...(packet.unresolvedQuestions ?? []),
    ...(packet.evidenceGaps ?? []),
  ].filter(Boolean).join(' ');
  const errors = [];
  for (const sentence of sentences(body)) {
    if (!overlap(sentence, allowed)) errors.push(`Unsupported sentence: ${sentence.slice(0, 160)}`);
  }
  const named = body.match(/\b(?:Google|Meta|Microsoft|OpenAI|Tesla|Apple|Amazon|Anthropic)\b|\b[A-Z][A-Za-z0-9&.-]+\s+[A-Z][A-Za-z0-9&.-]+(?:\s+[A-Z][A-Za-z0-9&.-]+){0,2}\b/g) ?? [];
  for (const entity of named) {
    if (!normalize(allowed).includes(normalize(entity))) errors.push(`Unsupported named entity: ${entity}`);
  }
  for (const match of body.match(/\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?%\b|[“”][^“”]+|"[^"]{8,}"/g) ?? []) {
    if (!allowed.includes(match)) errors.push(`Unsupported date, statistic, or quotation: ${match.slice(0, 100)}`);
  }
  return unique(errors);
}

function hasConcreteExample(body) {
  return /\b(?:for example|for instance|a manager|a (?:project )?team|an employee|a designer|a developer|a worker|in a workplace|in practice|when [a-z]+ (?:uses|reviews|learns|moves|delegates)|before\/after)\b/i.test(body);
}

function repetitionRisk(body) {
  const normalizedSentences = sentences(body).map(normalize).filter((item) => item.length > 30);
  return normalizedSentences.some((sentence, index) => normalizedSentences.indexOf(sentence) !== index);
}

function evaluate(packet, report, draftPath, markdown) {
  const parsed = parseFrontmatter(markdown);
  const meta = parsed.data;
  const body = parsed.body;
  const type = meta.documentType;
  const blockingProblems = [...validateInputs(packet, report)];
  const revisions = [];
  const strengths = [];
  const risks = [];
  if (parsed.error) blockingProblems.push(parsed.error);
  const metadata = metadataProblems(meta, packet, report);
  const wrongType = metadata.filter((item) => item.includes('artifact type'));
  if (wrongType.length) blockingProblems.push(...wrongType);
  revisions.push(...metadata.filter((item) => !wrongType.includes(item)).map((item) => `Correct metadata: ${item}`));

  const structure = REQUIRED_SECTIONS[type];
  if (!structure) blockingProblems.push(`Unsupported or wrong artifact type: ${type || 'missing'}.`);
  else {
    const draftHeadings = headings(body);
    for (const alternatives of structure) {
      if (!alternatives.some((required) => draftHeadings.includes(required))) revisions.push(`Add the missing “${alternatives[0]}” section and give it only that section's required function.`);
    }
  }

  const unsupported = unsupportedClaims(body, packet);
  if (unsupported.length) blockingProblems.push(...unsupported);
  else strengths.push('No unsupported factual claims were detected against the approved packet.');

  const corpus = `${packet.readerQuestion ?? ''} ${packet.centralTension ?? ''}`;
  const questionVisible = Boolean(packet.readerQuestion && overlap(packet.readerQuestion, body));
  const tensionVisible = Boolean(packet.centralTension && overlap(packet.centralTension, body));
  if (questionVisible) strengths.push('The central question remains visible.');
  if (!tensionVisible) revisions.push('State the packet’s central tension directly without broadening the claim.');
  else strengths.push('The central distinction is preserved.');

  const [min, max] = TARGETS[type] ?? [0, Infinity];
  const words = wordCount(body);
  if (!hasConcreteExample(body)) {
    risks.push('The abstract distinction lacks a concrete operational example.');
    revisions.push(packet.issueReference?.number === 18
      ? 'Add one concrete workplace or training example showing a tool-specific skill decaying while a more durable judgment skill remains useful.'
      : 'Add one concrete workplace or training example showing the central distinction in action; source the example from human editorial judgment rather than inventing it in Loop 4.');
  } else strengths.push('A concrete operational example makes the abstract shift visible.');

  if (words < min) {
    risks.push(`Body length is ${words} words, below the ${min}–${max} target for ${type}.`);
    revisions.push(`Expand only the existing ${type} functions enough to move toward the ${min}–${max} word target; do not broaden it into an essay or add unsupported evidence.`);
  } else if (words > max) {
    risks.push(`Body length is ${words} words, above the ${min}–${max} target for ${type}.`);
    revisions.push(`Cut repeated or nonfunctional passages to return the body to the ${min}–${max} word target.`);
  } else strengths.push(`Body length (${words} words) fits the ${type} target.`);

  if (!questionVisible && tensionVisible) {
    revisions.push('Recheck whether the opening creates enough tension after the example is added; revise only if the central question remains unclear.');
  } else if (!questionVisible) {
    revisions.push('State the packet’s reader question or its direct equivalent near the opening.');
  }

  const generic = GENERIC_PATTERNS.filter((pattern) => pattern.test(body)).map((pattern) => pattern.source);
  if (generic.length) {
    risks.push('Generic AI language weakens the DFW voice.');
    revisions.push('Replace the generic AI setup with the packet’s specific observation, changed work, and decision boundary.');
  } else strengths.push('The draft avoids the configured generic-AI phrases.');

  if (repetitionRisk(body)) {
    risks.push('The draft repeats at least one substantive sentence.');
    revisions.push('Remove the repeated sentence and keep the instance under the section where it performs a distinct function.');
  }

  if ((packet.speculation ?? []).length) {
    if (!/speculation\s*\(not verified\)|\bspeculat(?:ion|ive)\b/i.test(body)) revisions.push('Restore an explicit speculation label for the packet’s provisional claim.');
    else strengths.push('Speculation remains explicitly marked as unverified.');
  }
  const unresolved = [...(packet.unresolvedQuestions ?? []), ...(packet.evidenceGaps ?? [])].filter(Boolean);
  if (unresolved.length && !unresolved.some((item) => overlap(item, body))) revisions.push('Restore one packet-backed unresolved question or evidence boundary in the ending.');
  else if (unresolved.length) strengths.push('The ending preserves unresolved uncertainty.');

  const description = String(meta.description ?? '');
  if (/^what\b|what should a reader understand|\?$|\bpost about\b/i.test(description)) revisions.push('Replace the description with one sentence naming the core distinction and its significance.');
  else if (description && overlap(description, `${corpus} ${(packet.inferences ?? []).join(' ')}`)) strengths.push('The description states a packet-grounded core idea.');
  else if (description) revisions.push('Align the description with the packet’s central distinction without adding a new claim.');
  if (!String(meta.title ?? '').trim() || /^(untitled|draft|ai and work)$/i.test(String(meta.title))) revisions.push('Replace the generic title with the packet’s specific distinction or tension.');

  const orderedRevisions = unique(revisions).slice(0, 5);
  let verdict = 'PASS_TO_HUMAN';
  if (blockingProblems.length) verdict = 'HOLD';
  else if (orderedRevisions.length) verdict = 'REVISE';
  if (!VERDICTS.has(verdict)) throw new Error('Internal verdict error');
  const confidence = blockingProblems.length || (strengths.length >= 4 && orderedRevisions.length <= 2) ? 'high' : 'medium';
  return {
    contractVersion: CONTRACT,
    issueAndDraftReference: {
      issueNumber: packet.issueReference.number,
      issueUrl: packet.issueReference.url,
      draftPath,
      packetContract: packet.contractVersion,
      draftReportContract: report.contractVersion,
    },
    verdict,
    confidence,
    blockingProblems: unique(blockingProblems),
    revisionInstructions: verdict === 'HOLD' ? [] : orderedRevisions,
    strengths: unique(strengths),
    risks: unique(risks),
    evidenceUsed: [
      `Loop 2 packet: ${packet.contractVersion}`,
      `Loop 3 report: ${report.contractVersion} (${report.validationStatus})`,
      ...SOURCE_OF_TRUTH,
      `${type || 'unknown'} artifact requirements and target length`,
    ],
    humanReviewNotes: verdict === 'PASS_TO_HUMAN'
      ? ['This verdict advances the draft to human editorial review; it does not approve publication.']
      : verdict === 'REVISE'
        ? ['Apply only the bounded instructions above, then rerun Loop 4 before human editorial review.']
        : ['Resolve the blocking conditions upstream; do not revise or publish this draft as if it had passed.'],
  };
}

function validateEvaluationContract(result) {
  const required = [
    'contractVersion', 'issueAndDraftReference', 'verdict', 'confidence',
    'blockingProblems', 'revisionInstructions', 'strengths', 'risks',
    'evidenceUsed', 'humanReviewNotes',
  ];
  for (const key of required) {
    if (!(key in result)) throw new Error(`Evaluation contract missing field: ${key}`);
  }
  if (result.contractVersion !== CONTRACT) throw new Error('Evaluation contractVersion is invalid');
  if (!VERDICTS.has(result.verdict)) throw new Error('Evaluation verdict is invalid');
  if (!['high', 'medium', 'low'].includes(result.confidence)) throw new Error('Evaluation confidence is invalid');
  for (const key of ['blockingProblems', 'revisionInstructions', 'strengths', 'risks', 'evidenceUsed', 'humanReviewNotes']) {
    if (!Array.isArray(result[key]) || result[key].some((item) => typeof item !== 'string' || !item.trim())) {
      throw new Error(`Evaluation field ${key} must be an array of non-empty strings`);
    }
  }
  if (result.revisionInstructions.length > 5) throw new Error('Evaluation has more than five revision instructions');
  if (result.verdict === 'PASS_TO_HUMAN' && result.blockingProblems.length) throw new Error('PASS_TO_HUMAN cannot contain blocking problems');
}

async function main() {
  const input = args(process.argv.slice(2));
  if (input.help) { console.log(usage()); return; }
  if (!input.packet || !input.draft || !input.report || !input.outDir) throw new Error(`Missing required argument.\n${usage()}`);
  for (const source of SOURCE_OF_TRUTH) await fs.access(resolve(source));
  const packetPath = resolve(input.packet);
  const draftPath = resolve(input.draft);
  const reportPath = resolve(input.report);
  const outDir = resolve(input.outDir);
  const [packet, markdown, report] = await Promise.all([
    fs.readFile(packetPath, 'utf8').then(JSON.parse),
    fs.readFile(draftPath, 'utf8'),
    fs.readFile(reportPath, 'utf8').then(JSON.parse),
  ]);
  const result = evaluate(packet, report, draftPath, markdown);
  validateEvaluationContract(result);
  await fs.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `loop4-${packet.issueReference.number}-evaluation.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, verdict: result.verdict, outputPath }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
