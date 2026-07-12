#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CONTRACT = 'loop5-revision-report.v1';
const STATUSES = new Set(['REVISED', 'PARTIALLY_REVISED_WAITING_FOR_HUMAN', 'WAITING_FOR_HUMAN', 'BLOCKED']);
const CLASSIFICATIONS = new Set(['AUTO_APPLY', 'HUMAN_INPUT_REQUIRED', 'UNSAFE_OR_OUT_OF_SCOPE']);
const GENERIC_PATTERNS = [
  /in today['’]s rapidly changing world/i, /as ai continues to evolve/i,
  /rapidly evolving landscape/i, /unlock(?:s|ing)? new possibilities/i,
  /leverage ai/i, /harness the power/i, /seamless integration/i,
  /transformative potential/i, /game[- ]changer/i, /unprecedented change/i,
  /boost productivity/i, /supercharge/i, /future-proof/i,
  /ai-powered revolution/i, /the possibilities are endless/i,
];

function parseArgs(argv) {
  const out = { packet: '', draft: '', report: '', evaluation: '', outDir: '', help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--packet') out.packet = argv[++i] ?? '';
    else if (value === '--draft') out.draft = argv[++i] ?? '';
    else if (value === '--draft-report') out.report = argv[++i] ?? '';
    else if (value === '--evaluation') out.evaluation = argv[++i] ?? '';
    else if (value === '--out-dir') out.outDir = argv[++i] ?? '';
    else if (value === '--help' || value === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return out;
}

function usage() {
  return `Usage: node scripts/loop5-bounded-revision.mjs \\
  --packet <loop2-packet.json> \\
  --draft <loop3-draft.md> \\
  --draft-report <loop3-draft-report.json> \\
  --evaluation <loop4-evaluation.json> \\
  --out-dir </tmp/output>`;
}

function resolve(value) { return path.isAbsolute(value) ? path.normalize(value) : path.join(ROOT, value); }
function normalize(value) { return String(value ?? '').toLowerCase().replace(/[“”"'’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function unique(items) { return [...new Set(items.filter(Boolean))]; }
function tokens(value) { return new Set(normalize(value).match(/[a-z0-9]{4,}/g) ?? []); }
function overlap(value, corpus) {
  const source = [...tokens(value)];
  if (!source.length) return true;
  const allowed = tokens(corpus);
  return source.filter((token) => allowed.has(token)).length / source.length >= 0.55;
}

function splitDraft(markdown) {
  if (!markdown.startsWith('---\n')) return { frontmatter: '', body: markdown, error: 'Draft has no YAML frontmatter.' };
  const end = markdown.indexOf('\n---', 4);
  if (end < 0) return { frontmatter: '', body: markdown, error: 'Draft frontmatter is not closed.' };
  return { frontmatter: markdown.slice(0, end + 4), body: markdown.slice(end + 4).trim(), error: '' };
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

function parseMetadata(frontmatter) {
  const data = {};
  let arrayKey = '';
  for (const line of frontmatter.replace(/^---\n|\n---$/g, '').split('\n')) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && arrayKey) { data[arrayKey].push(parseScalar(item[1])); continue; }
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!field) continue;
    const [, key, rest = ''] = field;
    if (!rest && ['domainPath', 'relatedConcepts', 'relatedPieces'].includes(key)) { data[key] = []; arrayKey = key; }
    else { data[key] = parseScalar(rest); arrayKey = ''; }
  }
  return data;
}

function sentences(body) {
  return body.split(/\n+/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('**'))
    .flatMap((line) => line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).map((item) => item.trim());
}

function classifyInstruction(instruction) {
  const text = normalize(instruction);
  if (/\b(?:turn|convert|change)\b.*\b(?:note|field report)\b.*\b(?:essay|field report|note)\b/.test(text) ||
      /\b(?:research|invent|add statistics|add facts|unsupported facts|unsupported factual claims|change the approved domain|change the domain|change the artifact type|reclassify|publish)\b/.test(text)) {
    return { instruction, classification: 'UNSAFE_OR_OUT_OF_SCOPE', reason: 'The instruction requires research, invention, publication, or a change to approved scope or classification.' };
  }
  if (/\b(?:concrete|workplace|training|company|personal) example\b/.test(text) ||
      /\b(?:personal experience|choose between|verify|missing source|provide source|supply source)\b/.test(text)) {
    return { instruction, classification: 'HUMAN_INPUT_REQUIRED', reason: 'The requested material is not present in the approved packet and must be supplied or chosen by a human.' };
  }
  if (/\b(?:remove|cut)\b.*\b(?:repeat|repetition|repeated|duplicate)\b/.test(text) ||
      /\b(?:replace|tighten|remove|cut)\b.*\b(?:generic|setup|language|prose)\b/.test(text) ||
      /\b(?:reorder|move)\b.*\bsection/.test(text) ||
      /\bexpand\b.*\bexisting\b/.test(text) ||
      /\b(?:strengthen|revise)\b.*\b(?:transition|opening)\b/.test(text) ||
      /\brecheck\b.*\bopening\b/.test(text)) {
    return { instruction, classification: 'AUTO_APPLY', reason: 'The instruction can be bounded to existing draft or packet-grounded material.' };
  }
  return { instruction, classification: 'HUMAN_INPUT_REQUIRED', reason: 'The instruction is not deterministic enough to apply without human clarification.' };
}

function gateProblems(packet, report, evaluation, draftPath, meta) {
  const problems = [];
  if (evaluation.contractVersion !== 'loop4-editorial-evaluation.v1') problems.push('Evaluation contract is not loop4-editorial-evaluation.v1.');
  if (evaluation.verdict !== 'REVISE') problems.push(`Loop 5 requires verdict REVISE; received ${evaluation.verdict ?? 'missing'}.`);
  if ((evaluation.blockingProblems ?? []).length) problems.push('Loop 4 evaluation contains blocking problems.');
  if (!Array.isArray(evaluation.revisionInstructions) || evaluation.revisionInstructions.length < 1 || evaluation.revisionInstructions.length > 5) problems.push('Loop 4 evaluation must contain 1–5 revision instructions.');
  if (report.contractVersion !== 'loop3-drafting-report.v1' || report.validationStatus !== 'passed') problems.push('Loop 3 drafting report did not pass.');
  const issue = packet.issueReference?.number;
  if (issue !== report.sourcePacketReference?.issueNumber || issue !== evaluation.issueAndDraftReference?.issueNumber) problems.push('Packet, Loop 3 report, and Loop 4 evaluation issue references do not match.');
  if (resolve(evaluation.issueAndDraftReference?.draftPath ?? '') !== draftPath) problems.push('The supplied draft path is not the draft path evaluated by Loop 4.');
  if (report.draftPath && resolve(report.draftPath) !== draftPath) problems.push('The supplied draft path is not the draft path produced by the Loop 3 report.');
  if (meta.documentType !== packet.approvedArtifactType || meta.documentType !== report.artifactType) problems.push('Draft artifact type is inconsistent with the packet or Loop 3 report.');
  return problems;
}

function removeRepeatedParagraphs(body) {
  const seen = new Set();
  const removed = [];
  const parts = body.split(/\n\n+/);
  const kept = parts.filter((part) => {
    if (part.startsWith('#')) return true;
    const key = normalize(part);
    if (!key || !seen.has(key)) { if (key) seen.add(key); return true; }
    removed.push(part.trim());
    return false;
  });
  return { body: kept.join('\n\n'), removed };
}

function removeGenericSentences(body) {
  const removed = [];
  const output = body.split('\n').map((line) => {
    if (!line.trim() || line.startsWith('#')) return line;
    const kept = (line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [line]).filter((sentence) => {
      if (GENERIC_PATTERNS.some((pattern) => pattern.test(sentence))) { removed.push(sentence.trim()); return false; }
      return true;
    });
    return kept.join(' ').trim();
  }).join('\n').replace(/\n{3,}/g, '\n\n');
  return { body: output.trim(), removed };
}

function packetCorpus(packet) {
  return [packet.workingTitle, packet.readerQuestion, packet.centralTension,
    ...(packet.verifiedObservations ?? []), ...(packet.inferences ?? []),
    ...(packet.speculation ?? []), ...(packet.unresolvedQuestions ?? []),
    ...(packet.evidenceGaps ?? [])].filter(Boolean).join(' ');
}

function applyInstruction(body, classification, packet) {
  const text = normalize(classification.instruction);
  if (/\b(?:repeat|repetition|repeated|duplicate)\b/.test(text)) {
    const result = removeRepeatedParagraphs(body);
    return { body: result.body, changed: result.removed.length > 0, change: 'Removed repeated paragraph content.', removed: result.removed, added: [] };
  }
  if (/\b(?:generic|setup|language|prose)\b/.test(text)) {
    const result = removeGenericSentences(body);
    return { body: result.body, changed: result.removed.length > 0, change: 'Removed configured generic-AI sentences while retaining grounded content.', removed: result.removed, added: [] };
  }
  if (/\bexpand\b.*\bexisting\b/.test(text)) {
    const candidate = [packet.centralTension, ...(packet.inferences ?? [])].find((item) => item && !normalize(body).includes(normalize(item)));
    if (!candidate) return { body, changed: false, change: '', removed: [], added: [] };
    const marker = body.includes('## Current interpretation') ? '## Current interpretation' : '## Why it may matter';
    const index = body.indexOf(marker);
    if (index < 0) return { body, changed: false, change: '', removed: [], added: [] };
    const next = body.indexOf('\n## ', index + marker.length);
    const insertAt = next < 0 ? body.length : next;
    const revised = `${body.slice(0, insertAt).trimEnd()}\n\n${candidate}\n${body.slice(insertAt)}`.trim();
    return { body: revised, changed: true, change: 'Expanded an existing section with a packet-grounded interpretation.', removed: [], added: [candidate] };
  }
  return { body, changed: false, change: '', removed: [], added: [] };
}

function validateRevision(source, revised, packet, classifications, applied) {
  const errors = [];
  const sourceMeta = parseMetadata(source.frontmatter);
  const revisedMeta = parseMetadata(revised.frontmatter);
  for (const key of ['title', 'documentType', 'theme', 'sourceNote', 'domainPath', 'relatedConcepts', 'relatedPieces', 'canonical', 'draft', 'status', 'draftDate']) {
    if (JSON.stringify(sourceMeta[key]) !== JSON.stringify(revisedMeta[key])) errors.push(`Protected metadata field changed: ${key}`);
  }
  if (revisedMeta.documentType !== packet.approvedArtifactType) errors.push('Artifact type changed or no longer matches the packet.');
  if (revisedMeta.domainPath?.[0] !== packet.primaryDomain) errors.push('Approved domain changed.');
  if (revisedMeta.canonical !== false || revisedMeta.draft !== true || revisedMeta.status !== 'draft' || revisedMeta.pubDate) errors.push('Draft is no longer noncanonical and unpublished.');
  const corpus = packetCorpus(packet);
  const sourceSentenceSet = new Set(sentences(source.body).map(normalize));
  for (const sentence of sentences(revised.body)) {
    if (sourceSentenceSet.has(normalize(sentence))) continue;
    if (!overlap(sentence, corpus)) errors.push(`New sentence is not packet-grounded: ${sentence.slice(0, 160)}`);
    for (const marker of sentence.match(/\b(?:Google|Meta|Microsoft|OpenAI|Tesla|Apple|Amazon|Anthropic)\b|\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?%\b|[“”][^“”]+|"[^"]{8,}"/g) ?? []) {
      if (!corpus.includes(marker)) errors.push(`New sentence introduces an unsupported entity, date, statistic, or quotation: ${marker}`);
    }
  }
  const blocked = classifications.filter((item) => item.classification !== 'AUTO_APPLY').map((item) => item.instruction);
  if (applied.some((instruction) => blocked.includes(instruction))) errors.push('A blocked or human-input instruction was applied.');
  return unique(errors);
}

function humanRequest(classification) {
  const text = normalize(classification.instruction);
  if (/\b(?:concrete|workplace|training|company|personal) example\b/.test(text)) {
    return 'Provide one real, sourceable workplace or training example: identify the tool-specific skill that decayed, the more durable judgment skill that remained useful, and enough context to state it without inventing facts.';
  }
  if (/\bchoose between\b/.test(text)) return `Choose the intended interpretation for: ${classification.instruction}`;
  if (/\b(?:verify|source)\b/.test(text)) return `Provide the verified source material required by: ${classification.instruction}`;
  return `Clarify or supply the missing human input required by: ${classification.instruction}`;
}

function baseReport(packet, evaluation, evaluationPath, draftPath, meta, classifications) {
  return {
    contractVersion: CONTRACT,
    issueAndDraftReference: { issueNumber: packet.issueReference.number, issueUrl: packet.issueReference.url, sourceDraftPath: draftPath, artifactType: meta.documentType ?? 'unknown' },
    sourceEvaluationReference: { path: evaluationPath, contractVersion: evaluation.contractVersion ?? 'unknown', verdict: evaluation.verdict ?? 'HOLD' },
    overallStatus: 'BLOCKED', instructionClassifications: classifications,
    instructionsApplied: [], instructionsNotApplied: classifications.map((item) => item.instruction),
    humanInputRequests: [], changesMade: [], claimsAdded: [], claimsRemoved: [], warnings: [],
  };
}

function validateReport(result) {
  if (result.contractVersion !== CONTRACT || !STATUSES.has(result.overallStatus)) throw new Error('Invalid Loop 5 report contract or status');
  if (!Array.isArray(result.instructionClassifications) || result.instructionClassifications.some((item) => !CLASSIFICATIONS.has(item.classification))) throw new Error('Invalid instruction classification');
  for (const key of ['instructionsApplied', 'instructionsNotApplied', 'humanInputRequests', 'changesMade', 'claimsAdded', 'claimsRemoved', 'warnings']) if (!Array.isArray(result[key])) throw new Error(`Invalid report field: ${key}`);
  if (result.overallStatus === 'REVISED' && !result.revisedDraftPath) throw new Error('REVISED report lacks revisedDraftPath');
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (input.help) { console.log(usage()); return; }
  if (!input.packet || !input.draft || !input.report || !input.evaluation || !input.outDir) throw new Error(`Missing required argument.\n${usage()}`);
  const packetPath = resolve(input.packet), draftPath = resolve(input.draft), reportPath = resolve(input.report), evaluationPath = resolve(input.evaluation), outDir = resolve(input.outDir);
  const [packet, markdown, report, evaluation] = await Promise.all([
    fs.readFile(packetPath, 'utf8').then(JSON.parse), fs.readFile(draftPath, 'utf8'),
    fs.readFile(reportPath, 'utf8').then(JSON.parse), fs.readFile(evaluationPath, 'utf8').then(JSON.parse),
  ]);
  const source = splitDraft(markdown), meta = parseMetadata(source.frontmatter);
  const classifications = (evaluation.revisionInstructions ?? []).map(classifyInstruction);
  const result = baseReport(packet, evaluation, evaluationPath, draftPath, meta, classifications);
  const gate = [...(source.error ? [source.error] : []), ...gateProblems(packet, report, evaluation, draftPath, meta)];
  const unsafe = classifications.filter((item) => item.classification === 'UNSAFE_OR_OUT_OF_SCOPE');
  if (gate.length || unsafe.length) {
    result.warnings.push(...gate, ...unsafe.map((item) => `Unsafe or out-of-scope instruction: ${item.instruction}`));
    validateReport(result); await fs.mkdir(outDir, { recursive: true });
    const outputPath = path.join(outDir, `loop5-${packet.issueReference.number}-revision-report.json`);
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ ok: false, status: result.overallStatus, outputPath }, null, 2)); process.exitCode = 2; return;
  }
  const human = classifications.filter((item) => item.classification === 'HUMAN_INPUT_REQUIRED');
  const auto = classifications.filter((item) => item.classification === 'AUTO_APPLY');
  result.humanInputRequests = unique(human.map(humanRequest));
  let revisedBody = source.body;
  const dependentOnHuman = human.length > 0 && auto.some((item) => /\b(?:expand|recheck|opening)\b/.test(normalize(item.instruction)));
  const safeAuto = dependentOnHuman ? auto.filter((item) => /\b(?:repeat|generic)\b/.test(normalize(item.instruction))) : auto;
  for (const item of safeAuto) {
    const applied = applyInstruction(revisedBody, item, packet);
    if (applied.changed) {
      revisedBody = applied.body; result.instructionsApplied.push(item.instruction); result.changesMade.push(applied.change);
      result.claimsAdded.push(...applied.added); result.claimsRemoved.push(...applied.removed);
    } else result.warnings.push(`No deterministic change was available for approved instruction: ${item.instruction}`);
  }
  result.instructionsNotApplied = classifications.map((item) => item.instruction).filter((item) => !result.instructionsApplied.includes(item));
  if (!result.instructionsApplied.length && human.length) result.overallStatus = 'WAITING_FOR_HUMAN';
  else if (result.instructionsApplied.length && human.length) result.overallStatus = 'PARTIALLY_REVISED_WAITING_FOR_HUMAN';
  else if (result.instructionsApplied.length && result.instructionsNotApplied.length === 0) result.overallStatus = 'REVISED';
  else result.overallStatus = 'BLOCKED';
  const revised = { frontmatter: source.frontmatter, body: revisedBody };
  const validationErrors = validateRevision(source, revised, packet, classifications, result.instructionsApplied);
  if (validationErrors.length) { result.overallStatus = 'BLOCKED'; result.warnings.push(...validationErrors); }
  await fs.mkdir(outDir, { recursive: true });
  const failedDir = path.join(outDir, 'failed');
  if (result.overallStatus === 'BLOCKED' && revisedBody !== source.body) {
    await fs.mkdir(failedDir, { recursive: true });
    result.revisedDraftPath = path.join(failedDir, `loop5-${packet.issueReference.number}-revised.md`);
    await fs.writeFile(result.revisedDraftPath, `${revised.frontmatter}\n\n${revised.body}\n`);
  } else if (result.instructionsApplied.length) {
    result.revisedDraftPath = path.join(outDir, `loop5-${packet.issueReference.number}-revised.md`);
    await fs.writeFile(result.revisedDraftPath, `${revised.frontmatter}\n\n${revised.body}\n`);
  }
  validateReport(result);
  const outputPath = path.join(result.overallStatus === 'BLOCKED' ? failedDir : outDir, `loop5-${packet.issueReference.number}-revision-report.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true }); await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ok: result.overallStatus !== 'BLOCKED', status: result.overallStatus, outputPath, revisedDraftPath: result.revisedDraftPath }, null, 2));
  if (result.overallStatus === 'BLOCKED') process.exitCode = 2;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
