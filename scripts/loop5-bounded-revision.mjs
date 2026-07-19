#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { isSha256, sha256Bytes, sha256Combined } from './lib/content-fingerprint.mjs';

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
  const out = { packet: '', draft: '', report: '', evaluation: '', humanInput: '', outDir: '', help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--packet') out.packet = argv[++i] ?? '';
    else if (value === '--draft') out.draft = argv[++i] ?? '';
    else if (value === '--draft-report') out.report = argv[++i] ?? '';
    else if (value === '--evaluation') out.evaluation = argv[++i] ?? '';
    else if (value === '--human-input') out.humanInput = argv[++i] ?? '';
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
  [--human-input <loop5-human-input.json>] \\
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
  if (/\b(?:turn|convert|change)\b.*\b(?:note|field report|prototype note)\b.*\b(?:essay|field report|prototype note|note)\b/.test(text) ||
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
    ...(packet.evidenceGaps ?? []), packet.prototypeNote?.designProblem,
    packet.prototypeNote?.interactionChoice,
    ...(packet.prototypeNote?.interactionGroups ?? []).flatMap((group) => [group.title, ...group.items]),
    ...(packet.prototypeNote?.designPrinciples ?? []), packet.prototypeNote?.currentState].filter(Boolean).join(' ');
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
    const marker = body.includes('## Current interpretation')
      ? '## Current interpretation'
      : body.includes('## Why it matters')
        ? '## Why it matters'
        : '## Why it may matter';
    const index = body.indexOf(marker);
    if (index < 0) return { body, changed: false, change: '', removed: [], added: [] };
    const next = body.indexOf('\n## ', index + marker.length);
    const insertAt = next < 0 ? body.length : next;
    const revised = `${body.slice(0, insertAt).trimEnd()}\n\n${candidate}\n${body.slice(insertAt)}`.trim();
    return { body: revised, changed: true, change: 'Expanded an existing section with a packet-grounded interpretation.', removed: [], added: [candidate] };
  }
  return { body, changed: false, change: '', removed: [], added: [] };
}

function validateRevision(source, revised, packet, classifications, applied, humanGrounding = '') {
  const errors = [];
  const sourceMeta = parseMetadata(source.frontmatter);
  const revisedMeta = parseMetadata(revised.frontmatter);
  for (const key of ['title', 'documentType', 'theme', 'sourceNote', 'domainPath', 'relatedConcepts', 'relatedPieces', 'canonical', 'draft', 'status', 'draftDate']) {
    if (JSON.stringify(sourceMeta[key]) !== JSON.stringify(revisedMeta[key])) errors.push(`Protected metadata field changed: ${key}`);
  }
  if (revisedMeta.documentType !== packet.approvedArtifactType) errors.push('Artifact type changed or no longer matches the packet.');
  if (revisedMeta.domainPath?.[0] !== packet.primaryDomain) errors.push('Approved domain changed.');
  if (revisedMeta.canonical !== false || revisedMeta.draft !== true || revisedMeta.status !== 'draft' || revisedMeta.pubDate) errors.push('Draft is no longer noncanonical and unpublished.');
  const corpus = `${packetCorpus(packet)} ${humanGrounding}`;
  const sourceSentenceSet = new Set(sentences(source.body).map(normalize));
  for (const sentence of sentences(revised.body)) {
    if (sourceSentenceSet.has(normalize(sentence))) continue;
    if (!overlap(sentence, corpus)) errors.push(`New sentence is not packet-grounded: ${sentence.slice(0, 160)}`);
    for (const marker of sentence.match(/\b(?:Google|Meta|Microsoft|OpenAI|Tesla|Apple|Amazon|Anthropic)\b|\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?%\b|[“”][^“”]+|"[^"]{8,}"/g) ?? []) {
      if (!corpus.includes(marker)) errors.push(`New sentence introduces an unsupported entity, date, statistic, or quotation: ${marker}`);
    }
  }
  const blocked = classifications.filter((item) => item.classification !== 'AUTO_APPLY' && !item.satisfiedByHumanInput).map((item) => item.instruction);
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

function validateHumanInput(input, inputPath, packet, classifications) {
  const errors = [];
  const required = ['contractVersion', 'issueNumber', 'inputType', 'suppliedBy', 'requestedFor', 'content', 'usageScope'];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['Human-input file is malformed JSON or is not an object.'];
  const keys = Object.keys(input);
  for (const key of required) if (!(key in input)) errors.push(`Human-input field is missing: ${key}`);
  for (const key of keys) if (!required.includes(key)) errors.push(`Human-input field is not allowed: ${key}`);
  if (input.contractVersion !== 'loop5-human-input.v1') errors.push('Human-input contractVersion must be loop5-human-input.v1.');
  if (input.inputType !== 'editorial-example') errors.push('Human-input inputType must be editorial-example.');
  if (input.suppliedBy !== 'human-editor') errors.push('Human-input suppliedBy must be human-editor.');
  if (input.issueNumber !== packet.issueReference.number) errors.push('Human-input issue number does not match the revision issue.');
  for (const key of ['requestedFor', 'content', 'usageScope']) if (typeof input[key] !== 'string' || !input[key].trim()) errors.push(`Human-input ${key} must be a non-empty string.`);
  const humanInstructions = classifications.filter((item) => item.classification === 'HUMAN_INPUT_REQUIRED');
  if (!humanInstructions.length) errors.push('Human input was supplied, but no HUMAN_INPUT_REQUIRED instruction exists.');
  if (!humanInstructions.some((item) => item.instruction === input.requestedFor)) errors.push('Human-input requestedFor does not exactly match an existing HUMAN_INPUT_REQUIRED instruction.');
  const scope = normalize(input.usageScope);
  if (!scope.includes(`issue ${packet.issueReference.number}`) || !(scope.includes('concrete example') || scope.includes('concrete example revision instruction'))) {
    errors.push('Human-input usageScope does not permit the exact concrete-example revision for this issue.');
  }
  return errors;
}

function insertHumanExample(body, content) {
  const heading = '## Why it may matter';
  const start = body.indexOf(heading);
  if (start < 0) return { body, changed: false };
  const next = body.indexOf('\n## ', start + heading.length);
  const insertAt = next < 0 ? body.length : next;
  return { body: `${body.slice(0, insertAt).trimEnd()}\n\n${content.trim()}\n${body.slice(insertAt)}`.trim(), changed: true };
}

function baseReport(packet, evaluation, evaluationPath, draftPath, meta, classifications, fingerprints) {
  return {
    contractVersion: CONTRACT,
    issueAndDraftReference: { issueNumber: packet.issueReference.number, issueUrl: packet.issueReference.url, sourceDraftPath: draftPath, artifactType: meta.documentType ?? 'unknown' },
    sourceEvaluationReference: { path: evaluationPath, contractVersion: evaluation.contractVersion ?? 'unknown', verdict: evaluation.verdict ?? 'HOLD' },
    sourcePacketSha256: fingerprints.sourcePacketSha256,
    sourceDraftSha256: fingerprints.sourceDraftSha256,
    sourceDraftReportSha256: fingerprints.sourceDraftReportSha256,
    sourceEvaluationSha256: fingerprints.sourceEvaluationSha256,
    humanInputProvenance: [],
    overallStatus: 'BLOCKED', instructionClassifications: classifications,
    instructionsApplied: [], instructionsNotApplied: classifications.map((item) => item.instruction),
    humanInputRequests: [], changesMade: [], claimsAdded: [], claimsRemoved: [], warnings: [],
  };
}

function validateReport(result) {
  if (result.contractVersion !== CONTRACT || !STATUSES.has(result.overallStatus)) throw new Error('Invalid Loop 5 report contract or status');
  for (const key of ['sourcePacketSha256', 'sourceDraftSha256', 'sourceDraftReportSha256', 'sourceEvaluationSha256']) if (!isSha256(result[key])) throw new Error(`Invalid Loop 5 fingerprint: ${key}`);
  if (!Array.isArray(result.instructionClassifications) || result.instructionClassifications.some((item) => !CLASSIFICATIONS.has(item.classification))) throw new Error('Invalid instruction classification');
  if (!Array.isArray(result.humanInputProvenance) || result.humanInputProvenance.some((item) => !isSha256(item.sha256))) throw new Error('Invalid human-input provenance');
  for (const key of ['instructionsApplied', 'instructionsNotApplied', 'humanInputRequests', 'changesMade', 'claimsAdded', 'claimsRemoved', 'warnings']) if (!Array.isArray(result[key])) throw new Error(`Invalid report field: ${key}`);
  if (result.overallStatus === 'REVISED' && !result.revisedDraftPath) throw new Error('REVISED report lacks revisedDraftPath');
  if (result.revisedDraftPath && !isSha256(result.revisedDraftSha256)) throw new Error('Revised draft lacks a valid fingerprint');
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (input.help) { console.log(usage()); return; }
  if (!input.packet || !input.draft || !input.report || !input.evaluation || !input.outDir) throw new Error(`Missing required argument.\n${usage()}`);
  const packetPath = resolve(input.packet), draftPath = resolve(input.draft), reportPath = resolve(input.report), evaluationPath = resolve(input.evaluation), outDir = resolve(input.outDir);
  const [packetBytes, draftBytes, reportBytes, evaluationBytes] = await Promise.all([
    fs.readFile(packetPath), fs.readFile(draftPath), fs.readFile(reportPath), fs.readFile(evaluationPath),
  ]);
  const packet = JSON.parse(packetBytes.toString('utf8'));
  const markdown = draftBytes.toString('utf8');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const evaluation = JSON.parse(evaluationBytes.toString('utf8'));
  const fingerprints = {
    sourcePacketSha256: sha256Bytes(packetBytes), sourceDraftSha256: sha256Bytes(draftBytes),
    sourceDraftReportSha256: sha256Bytes(reportBytes), sourceEvaluationSha256: sha256Bytes(evaluationBytes),
  };
  const combinedInputs = sha256Combined([
    { label: 'loop2-packet', bytes: packetBytes }, { label: 'loop3-draft', bytes: draftBytes },
    { label: 'loop3-draft-report', bytes: reportBytes },
  ]);
  const integrityFailures = [];
  for (const [expected, actual, artifact, message] of [
    [report.sourcePacketSha256, fingerprints.sourcePacketSha256, 'Loop 2 packet', 'Packet bytes differ from the version fingerprinted by Loop 3.'],
    [report.generatedDraftSha256, fingerprints.sourceDraftSha256, 'Loop 3 draft', 'Draft bytes differ from the version generated by Loop 3.'],
    [evaluation.sourcePacketSha256, fingerprints.sourcePacketSha256, 'Loop 2 packet', 'Packet bytes differ from the version evaluated by Loop 4.'],
    [evaluation.sourceDraftSha256, fingerprints.sourceDraftSha256, 'Loop 3 draft', 'Draft bytes differ from the version evaluated by Loop 4.'],
    [evaluation.sourceDraftReportSha256, fingerprints.sourceDraftReportSha256, 'Loop 3 draft report', 'Loop 3 report bytes differ from the version evaluated by Loop 4.'],
    [evaluation.sourceEvaluationInputsSha256, combinedInputs, 'Loop 4 combined inputs', 'Current input bytes do not match the combined inputs evaluated by Loop 4.'],
  ]) {
    if (!isSha256(expected)) integrityFailures.push({ artifact, message: `Required upstream fingerprint is missing; legacy reports are rejected.`, expectedSha256: expected == null ? '' : String(expected), actualSha256: actual });
    else if (expected !== actual) integrityFailures.push({ artifact, message, expectedSha256: expected, actualSha256: actual });
  }
  const evaluationFingerprintPath = `${evaluationPath}.sha256`;
  let expectedEvaluationSha = '';
  try { expectedEvaluationSha = (await fs.readFile(evaluationFingerprintPath, 'utf8')).trim(); } catch {}
  if (!isSha256(expectedEvaluationSha)) integrityFailures.push({ artifact: 'Loop 4 evaluation', message: 'Evaluation fingerprint sidecar is missing or invalid; legacy evaluations are rejected.', expectedSha256: expectedEvaluationSha, actualSha256: fingerprints.sourceEvaluationSha256 });
  else if (expectedEvaluationSha !== fingerprints.sourceEvaluationSha256) integrityFailures.push({ artifact: 'Loop 4 evaluation', message: 'Evaluation bytes changed after Loop 4 wrote the fingerprint sidecar.', expectedSha256: expectedEvaluationSha, actualSha256: fingerprints.sourceEvaluationSha256 });
  const source = splitDraft(markdown), meta = parseMetadata(source.frontmatter);
  const classifications = (evaluation.revisionInstructions ?? []).map(classifyInstruction);
  const result = baseReport(packet, evaluation, evaluationPath, draftPath, meta, classifications, fingerprints);
  const humanInputPath = input.humanInput ? resolve(input.humanInput) : '';
  let humanInputBytes = null;
  let humanInput = null;
  let humanInputErrors = [];
  if (humanInputPath) {
    try {
      humanInputBytes = await fs.readFile(humanInputPath);
      try { humanInput = JSON.parse(humanInputBytes.toString('utf8')); } catch { humanInputErrors.push('Human-input file is malformed JSON.'); }
    } catch (error) {
      humanInputErrors.push(`Human-input file could not be read: ${error.message}`);
    }
    humanInputErrors.push(...validateHumanInput(humanInput, humanInputPath, packet, classifications));
  }
  await fs.mkdir(outDir, { recursive: true });
  if (integrityFailures.length) {
    const integrityPath = path.join(outDir, `loop5-${packet.issueReference.number}-integrity-failure.json`);
    const integrity = { contractVersion: 'loop-integrity-failure.v1', stage: 'loop5', status: 'BLOCKED', issueNumber: packet.issueReference.number, failures: integrityFailures };
    await fs.writeFile(integrityPath, `${JSON.stringify(integrity, null, 2)}\n`);
    console.log(JSON.stringify({ ok: false, status: 'BLOCKED', integrityPath }, null, 2)); process.exitCode = 2; return;
  }
  const gate = [...(source.error ? [source.error] : []), ...gateProblems(packet, report, evaluation, draftPath, meta)];
  const unsafe = classifications.filter((item) => item.classification === 'UNSAFE_OR_OUT_OF_SCOPE');
  if (gate.length || unsafe.length || humanInputErrors.length) {
    result.warnings.push(...gate, ...unsafe.map((item) => `Unsafe or out-of-scope instruction: ${item.instruction}`), ...humanInputErrors);
    validateReport(result);
    const outputPath = path.join(outDir, `loop5-${packet.issueReference.number}-revision-report.json`);
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ ok: false, status: result.overallStatus, outputPath }, null, 2)); process.exitCode = 2; return;
  }
  const humanMatch = humanInput ? classifications.find((item) => item.classification === 'HUMAN_INPUT_REQUIRED' && item.instruction === humanInput.requestedFor) : null;
  const human = classifications.filter((item) => item.classification === 'HUMAN_INPUT_REQUIRED' && item !== humanMatch);
  const auto = classifications.filter((item) => item.classification === 'AUTO_APPLY');
  result.humanInputRequests = unique(human.map(humanRequest));
  let revisedBody = source.body;
  if (humanMatch) {
    const inserted = insertHumanExample(revisedBody, humanInput.content);
    if (!inserted.changed) {
      result.overallStatus = 'BLOCKED';
      result.warnings.push('Human editorial example could not be placed because the required note section is missing.');
    } else {
      revisedBody = inserted.body;
      humanMatch.satisfiedByHumanInput = true;
      result.instructionsApplied.push(humanMatch.instruction);
      result.changesMade.push('Inserted the supplied human-editor example verbatim under “Why it may matter.”');
      result.claimsAdded.push(humanInput.content);
      result.humanInputProvenance.push({
        filePath: humanInputPath,
        sha256: sha256Bytes(humanInputBytes),
        inputType: humanInput.inputType,
        suppliedBy: humanInput.suppliedBy,
        instructionSatisfied: humanMatch.instruction,
        useMode: 'verbatim',
      });
    }
  }
  const dependentOnHuman = human.length > 0 && auto.some((item) => /\b(?:expand|recheck|opening)\b/.test(normalize(item.instruction)));
  const safeAuto = dependentOnHuman ? auto.filter((item) => /\b(?:repeat|generic)\b/.test(normalize(item.instruction))) : auto;
  for (const item of safeAuto) {
    if (humanMatch && /\bexpand\b.*\bexisting\b/.test(normalize(item.instruction))) {
      result.instructionsApplied.push(item.instruction);
      result.changesMade.push('The supplied example completed the approved bounded expansion without broadening the note.');
      continue;
    }
    if (humanMatch && /\brecheck\b.*\bopening\b/.test(normalize(item.instruction))) {
      result.instructionsApplied.push(item.instruction);
      result.changesMade.push('Reassessed the opening after insertion; the existing opening still establishes the central tension, so no opening text changed.');
      continue;
    }
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
  const validationErrors = validateRevision(source, revised, packet, classifications, result.instructionsApplied, humanInput?.content ?? '');
  if (validationErrors.length) { result.overallStatus = 'BLOCKED'; result.warnings.push(...validationErrors); }
  const failedDir = path.join(outDir, 'failed');
  if (result.overallStatus === 'BLOCKED' && revisedBody !== source.body) {
    await fs.mkdir(failedDir, { recursive: true });
    result.revisedDraftPath = path.join(failedDir, `loop5-${packet.issueReference.number}-revised.md`);
    const revisedBytes = Buffer.from(`${revised.frontmatter}\n\n${revised.body}\n`, 'utf8');
    await fs.writeFile(result.revisedDraftPath, revisedBytes);
    result.revisedDraftSha256 = sha256Bytes(revisedBytes);
  } else if (result.instructionsApplied.length) {
    result.revisedDraftPath = path.join(outDir, `loop5-${packet.issueReference.number}-revised.md`);
    const revisedBytes = Buffer.from(`${revised.frontmatter}\n\n${revised.body}\n`, 'utf8');
    await fs.writeFile(result.revisedDraftPath, revisedBytes);
    result.revisedDraftSha256 = sha256Bytes(revisedBytes);
  }
  validateReport(result);
  const outputPath = path.join(result.overallStatus === 'BLOCKED' ? failedDir : outDir, `loop5-${packet.issueReference.number}-revision-report.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true }); await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ok: result.overallStatus !== 'BLOCKED', status: result.overallStatus, outputPath, revisedDraftPath: result.revisedDraftPath }, null, 2));
  if (result.overallStatus === 'BLOCKED') process.exitCode = 2;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
