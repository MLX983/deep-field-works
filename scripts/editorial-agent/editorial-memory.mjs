import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCRATCHPAD_SCHEMA_VERSION = 'editorial-scratchpad-item.v1';
export const SYNTHESIS_SCHEMA_VERSION = 'editorial-synthesis-candidate.v1';
export const SCRATCHPAD_STATUSES = Object.freeze(['unformed','accumulating','candidate','promoted','absorbed','discarded']);
export const SYNTHESIS_STATUSES = Object.freeze(['emerging','research-needed','draft-worthy','drafted','human-reviewed','dismissed','absorbed']);
export const ORIGIN_TYPES = Object.freeze(['intake-seed','editorial-analysis','live-research','ai-adoption-context','existing-dfw-artifact','discovered-branch','autonomous-synthesis-review','human-added-note']);
const scratchpadSchema = JSON.parse(fs.readFileSync(path.join(HERE, 'editorial-scratchpad-item.v1.schema.json'), 'utf8'));
const synthesisSchema = JSON.parse(fs.readFileSync(path.join(HERE, 'editorial-synthesis-candidate.v1.schema.json'), 'utf8'));
const ajv = new Ajv2020({ strict: false, formats: { 'date-time': value => !Number.isNaN(Date.parse(value)) } });
const validateScratchpadSchema = ajv.compile(scratchpadSchema);
const validateSynthesisSchema = ajv.compile(synthesisSchema);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function uniqueStrings(value = [], label = 'values') {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) throw new Error(`${label} must be nonblank strings`);
  return [...new Set(value.map(item => item.trim()))].sort();
}

function normalizeReferences(value = []) {
  if (!Array.isArray(value)) throw new Error('Source references must be an array');
  const normalized = value.map(reference => {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference) || typeof reference.type !== 'string' || !reference.type.trim() || typeof reference.id !== 'string' || !reference.id.trim()) throw new Error('Invalid source reference');
    const unknown = Object.keys(reference).filter(key => !['type','id','title','url','fingerprint'].includes(key));
    if (unknown.length || ['title','url','fingerprint'].some(key => reference[key] !== undefined && typeof reference[key] !== 'string')) throw new Error('Invalid source reference');
    return Object.fromEntries(Object.entries({ type: reference.type.trim(), id: reference.id.trim(), title: reference.title?.trim(), url: reference.url?.trim(), fingerprint: reference.fingerprint?.trim() }).filter(([, item]) => item !== undefined));
  });
  return [...new Map(normalized.map(item => [stableJson(item), item])).values()].sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
}

export function privateWorkspace(workspace) {
  if (!workspace || !fs.existsSync(workspace)) throw new Error('Existing private Editorial Agent workspace required');
  const root = fs.realpathSync(workspace);
  if ([path.parse(root).root, os.homedir(), '/tmp', '/private/tmp'].includes(root) || !fs.existsSync(path.join(root, 'runs'))) throw new Error('Refusing non-Editorial-Agent workspace');
  return root;
}

function safeDirectory(root, relative) {
  const target = path.join(root, relative);
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && !inside(fs.realpathSync(current), root)) throw new Error('Private editorial path escapes workspace');
  }
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  if (!inside(fs.realpathSync(target), root)) throw new Error('Private editorial path escapes workspace');
  return target;
}

function writeImmutable(root, relative, value) {
  const directory = safeDirectory(root, path.dirname(relative));
  const target = path.join(directory, path.basename(relative));
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  fs.chmodSync(target, 0o400);
  return target;
}

function loadJsonSecure(root, target) {
  if (!inside(fs.realpathSync(target), root)) throw new Error('Private editorial file escapes workspace');
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function revisionFiles(root, relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  if (!inside(fs.realpathSync(directory), root)) throw new Error('Private editorial directory escapes workspace');
  return fs.readdirSync(directory).filter(name => /^r\d{4}\.json$/.test(name)).sort().map(name => path.join(directory, name));
}

function fingerprintsForScratchpad(record) {
  const content = { observation: record.observation, retrieval: record.retrieval, editorialSignals: record.editorialSignals };
  const source = { origin: record.origin, relationships: record.relationships, sourceReferences: record.sourceReferences };
  const contentSha256 = sha256(stableJson(content));
  const sourceSha256 = sha256(stableJson(source));
  const recordWithoutFingerprints = { ...record, fingerprints: { contentSha256, sourceSha256 } };
  return { contentSha256, sourceSha256, recordSha256: sha256(stableJson(recordWithoutFingerprints)) };
}

export function verifyScratchpadItem(record) {
  if (!validateScratchpadSchema(record)) throw new Error(`Invalid EditorialScratchpadItem: ${ajv.errorsText(validateScratchpadSchema.errors)}`);
  const expected = fingerprintsForScratchpad(record);
  if (stableJson(expected) !== stableJson(record.fingerprints)) throw new Error('Scratchpad fingerprint mismatch');
  return record;
}

function normalizeScratchpadInput(input) {
  if (!input || typeof input !== 'object') throw new Error('Scratchpad input required');
  const observation = {
    title: typeof input.title === 'string' ? input.title : '',
    body: typeof input.body === 'string' ? input.body : '',
    whyMayMatter: typeof input.whyMayMatter === 'string' ? input.whyMayMatter : '',
  };
  if (!observation.title.trim() || !observation.body.trim()) throw new Error('Scratchpad title and body are required');
  if (!ORIGIN_TYPES.includes(input.originType)) throw new Error('Invalid scratchpad origin type');
  const relationships = {
    seeds: uniqueStrings(input.relatedSeeds, 'Related seeds'),
    runs: uniqueStrings(input.relatedRuns, 'Related runs'),
    artifacts: uniqueStrings(input.relatedArtifacts, 'Related artifacts'),
    scratchpadItems: uniqueStrings(input.relatedScratchpadItems, 'Related scratchpad items'),
  };
  const retrieval = {
    themes: uniqueStrings(input.themes, 'Themes'),
    concepts: uniqueStrings(input.concepts, 'Concepts'),
    entities: uniqueStrings(input.entities, 'Entities'),
  };
  const signals = input.editorialSignals ?? {};
  const editorialSignals = Object.fromEntries(['question','tension','concreteExample','counterpressure','changedSignificance'].map(key => [key, typeof signals[key] === 'string' ? signals[key] : '']));
  const status = input.status ?? 'unformed';
  if (!SCRATCHPAD_STATUSES.includes(status)) throw new Error('Invalid scratchpad status');
  return { observation, origin: { type: input.originType, provenance: input.originProvenance ?? {} }, relationships, sourceReferences: normalizeReferences(input.sourceReferences), retrieval, editorialSignals, status };
}

export function createScratchpadItem(workspace, input, now = new Date().toISOString()) {
  const root = privateWorkspace(workspace);
  if (Number.isNaN(Date.parse(now))) throw new Error('Invalid scratchpad timestamp');
  const normalized = normalizeScratchpadInput(input);
  const itemId = input.itemId ?? `sp-${sha256(stableJson({ observation: normalized.observation, origin: normalized.origin })).slice(0, 16)}`;
  if (!/^sp-[a-z0-9][a-z0-9-]{5,79}$/.test(itemId)) throw new Error('Invalid scratchpad item ID');
  const existing = loadScratchpadHistory(root, itemId);
  if (existing.length) {
    const latest = existing.at(-1);
    const candidate = { ...latest, ...normalized, revision: latest.revision, createdAt: latest.createdAt, lastUpdatedAt: latest.lastUpdatedAt };
    const candidateFingerprints = fingerprintsForScratchpad(candidate);
    if (candidateFingerprints.contentSha256 === latest.fingerprints.contentSha256 && candidateFingerprints.sourceSha256 === latest.fingerprints.sourceSha256 && normalized.status === latest.status) return { item: latest, path: existing.at(-1).__path, created: false };
    throw new Error('Scratchpad item ID already exists; create an explicit revision');
  }
  const base = { schemaVersion: SCRATCHPAD_SCHEMA_VERSION, itemId, revision: 1, createdAt: new Date(now).toISOString(), lastUpdatedAt: new Date(now).toISOString(), ...normalized };
  const item = { ...base, fingerprints: fingerprintsForScratchpad(base) };
  verifyScratchpadItem(item);
  const target = writeImmutable(root, `scratchpad/items/${itemId}/r0001.json`, item);
  return { item, path: target, created: true };
}

export function loadScratchpadHistory(workspace, itemId) {
  const root = privateWorkspace(workspace);
  if (!/^sp-[a-z0-9][a-z0-9-]{5,79}$/.test(itemId)) throw new Error('Invalid scratchpad item ID');
  return revisionFiles(root, `scratchpad/items/${itemId}`).map(target => {
    const item = verifyScratchpadItem(loadJsonSecure(root, target));
    return Object.defineProperty(item, '__path', { value: target, enumerable: false });
  });
}

export function updateScratchpadItem(workspace, itemId, changes, now = new Date().toISOString()) {
  const root = privateWorkspace(workspace);
  const history = loadScratchpadHistory(root, itemId);
  if (!history.length) throw new Error('Scratchpad item not found');
  const previous = history.at(-1);
  const input = {
    itemId,
    title: changes.title ?? previous.observation.title,
    body: changes.body ?? previous.observation.body,
    whyMayMatter: changes.whyMayMatter ?? previous.observation.whyMayMatter,
    originType: changes.originType ?? previous.origin.type,
    originProvenance: changes.originProvenance ?? previous.origin.provenance,
    relatedSeeds: changes.relatedSeeds ?? previous.relationships.seeds,
    relatedRuns: changes.relatedRuns ?? previous.relationships.runs,
    relatedArtifacts: changes.relatedArtifacts ?? previous.relationships.artifacts,
    relatedScratchpadItems: changes.relatedScratchpadItems ?? previous.relationships.scratchpadItems,
    sourceReferences: changes.sourceReferences ?? previous.sourceReferences,
    themes: changes.themes ?? previous.retrieval.themes,
    concepts: changes.concepts ?? previous.retrieval.concepts,
    entities: changes.entities ?? previous.retrieval.entities,
    editorialSignals: changes.editorialSignals ?? previous.editorialSignals,
    status: changes.status ?? previous.status,
  };
  const normalized = normalizeScratchpadInput(input);
  const base = { schemaVersion: SCRATCHPAD_SCHEMA_VERSION, itemId, revision: previous.revision + 1, createdAt: previous.createdAt, lastUpdatedAt: new Date(now).toISOString(), ...normalized };
  const item = { ...base, fingerprints: fingerprintsForScratchpad(base) };
  verifyScratchpadItem(item);
  const target = writeImmutable(root, `scratchpad/items/${itemId}/r${String(item.revision).padStart(4, '0')}.json`, item);
  return { item, path: target };
}

export function listScratchpadItems(workspace, filters = {}) {
  const root = privateWorkspace(workspace);
  const itemsRoot = path.join(root, 'scratchpad', 'items');
  if (!fs.existsSync(itemsRoot)) return [];
  if (!inside(fs.realpathSync(itemsRoot), root)) throw new Error('Scratchpad items directory escapes workspace');
  let items = fs.readdirSync(itemsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => loadScratchpadHistory(root, entry.name).at(-1)).filter(Boolean);
  if (filters.status) items = items.filter(item => item.status === filters.status);
  if (filters.theme) items = items.filter(item => item.retrieval.themes.includes(filters.theme));
  if (filters.origin) items = items.filter(item => item.origin.type === filters.origin);
  if (filters.relatedSeed) items = items.filter(item => item.relationships.seeds.includes(filters.relatedSeed));
  if (filters.recentDays !== undefined) {
    const days = Number(filters.recentDays);
    if (!Number.isFinite(days) || days < 0) throw new Error('Recent days must be nonnegative');
    const cutoff = Date.now() - days * 86_400_000;
    items = items.filter(item => Date.parse(item.lastUpdatedAt) >= cutoff);
  }
  return items.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt) || a.itemId.localeCompare(b.itemId));
}

const normalizedSignal = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function findStructuredCoalescence(items) {
  const groups = new Map();
  for (const item of items.filter(item => !['discarded','absorbed','promoted'].includes(item.status))) {
    const signals = [item.editorialSignals.question, item.editorialSignals.tension].map(normalizedSignal).filter(value => value.length >= 12);
    for (const signal of signals) {
      const group = groups.get(signal) ?? [];
      group.push(item);
      groups.set(signal, group);
    }
    for (const related of item.relationships.scratchpadItems) {
      const pairKey = [item.itemId, related].sort().join('|');
      const group = groups.get(`explicit:${pairKey}`) ?? [];
      group.push(item);
      const relatedItem = items.find(candidate => candidate.itemId === related);
      if (relatedItem) group.push(relatedItem);
      groups.set(`explicit:${pairKey}`, group);
    }
  }
  const seenMembership = new Set();
  const candidates = [];
  for (const [signal, rawItems] of groups) {
    const members = [...new Map(rawItems.map(item => [item.itemId, item])).values()];
    if (members.length < 2) continue;
    const membership = members.map(item => item.itemId).sort().join('|');
    if (seenMembership.has(membership)) continue;
    seenMembership.add(membership);
    const origins = new Set(members.flatMap(item => [item.origin.type, ...item.relationships.seeds, ...item.relationships.runs]));
    const hasConcrete = members.some(item => item.editorialSignals.concreteExample.trim());
    const hasCounterpressure = members.some(item => item.editorialSignals.counterpressure.trim());
    if (origins.size < 2 || !hasConcrete || !hasCounterpressure) continue;
    const question = members.map(item => item.editorialSignals.question).find(Boolean) ?? members.map(item => item.editorialSignals.tension).find(Boolean) ?? signal;
    candidates.push({
      workingPremise: question,
      participants: {
        scratchpadItemIds: members.map(item => item.itemId),
        seeds: members.flatMap(item => item.relationships.seeds),
        runs: members.flatMap(item => item.relationships.runs),
        artifacts: members.flatMap(item => item.relationships.artifacts),
        sourceReferences: members.flatMap(item => item.sourceReferences.map(reference => `${reference.type}:${reference.id}`)),
      },
      sourceTypes: members.map(item => item.origin.type),
      rationale: {
        whyTogether: 'Multiple independently sourced observations now share an explicit editorial question or relationship, with a concrete case and counterpressure.',
        salienceNow: members.map(item => item.editorialSignals.changedSignificance).filter(Boolean).join(' '),
        confidenceMaturity: 'Emerging; requires corpus overlap review and editorial detection before drafting.',
        unresolvedQuestions: members.map(item => item.editorialSignals.question).filter(Boolean),
        counterpressure: members.map(item => item.editorialSignals.counterpressure).filter(Boolean),
        researchNeeded: true,
        duplicateCheck: { checked: false, overlapFound: false, references: [], assessment: 'Not yet checked against the DFW corpus.' },
      },
      criteria: { distinctQuestionOrTension: true, multipleDirections: origins.size > 1, strongerTogether: true, concreteExample: hasConcrete, counterpressure: hasCounterpressure, notAlreadyCovered: false, changedSignificance: members.some(item => item.editorialSignals.changedSignificance.trim()) },
      candidateArtifactType: 'undetermined',
      status: 'emerging',
    });
  }
  return candidates;
}

export function scratchpadContextRecords(workspace, filters = {}) {
  return listScratchpadItems(workspace, filters).filter(item => !['discarded','absorbed'].includes(item.status)).map(item => ({
    id: `scratchpad:${item.itemId}`,
    canonicalId: `scratchpad:${item.itemId}:r${item.revision}`,
    title: item.observation.title,
    body: [item.observation.body, item.observation.whyMayMatter ? `Why this may matter: ${item.observation.whyMayMatter}` : '', item.editorialSignals.question ? `Question: ${item.editorialSignals.question}` : '', item.editorialSignals.tension ? `Tension: ${item.editorialSignals.tension}` : ''].filter(Boolean).join('\n\n'),
    kind: 'editorial-scratchpad',
    roles: ['scratchpad'],
    provenance: { itemId: item.itemId, revision: item.revision, originType: item.origin.type, contentSha256: item.fingerprints.contentSha256, sourceSha256: item.fingerprints.sourceSha256 },
  }));
}

function fingerprintsForSynthesis(record) {
  const content = { workingPremise: record.workingPremise, participants: record.participants, sourceTypes: record.sourceTypes, rationale: record.rationale, criteria: record.criteria, candidateArtifactType: record.candidateArtifactType, status: record.status };
  const contentSha256 = sha256(stableJson(content));
  return { contentSha256, recordSha256: sha256(stableJson({ ...record, fingerprints: { contentSha256 } })) };
}

export function verifySynthesisCandidate(record) {
  if (!validateSynthesisSchema(record)) throw new Error(`Invalid EditorialSynthesisCandidate: ${ajv.errorsText(validateSynthesisSchema.errors)}`);
  const expected = fingerprintsForSynthesis(record);
  if (stableJson(expected) !== stableJson(record.fingerprints)) throw new Error('Synthesis candidate fingerprint mismatch');
  return record;
}

function normalizeSynthesisInput(input) {
  const participants = {
    scratchpadItemIds: uniqueStrings(input.participants?.scratchpadItemIds, 'Scratchpad participants'),
    seeds: uniqueStrings(input.participants?.seeds, 'Seed participants'),
    runs: uniqueStrings(input.participants?.runs, 'Run participants'),
    artifacts: uniqueStrings(input.participants?.artifacts, 'Artifact participants'),
    sourceReferences: uniqueStrings(input.participants?.sourceReferences, 'Source participants'),
  };
  const rationale = input.rationale ?? {};
  const duplicateCheck = rationale.duplicateCheck ?? {};
  const normalizedRationale = {
    whyTogether: typeof rationale.whyTogether === 'string' ? rationale.whyTogether : '',
    salienceNow: typeof rationale.salienceNow === 'string' ? rationale.salienceNow : '',
    confidenceMaturity: typeof rationale.confidenceMaturity === 'string' ? rationale.confidenceMaturity : '',
    unresolvedQuestions: uniqueStrings(rationale.unresolvedQuestions, 'Unresolved questions'),
    counterpressure: uniqueStrings(rationale.counterpressure, 'Counterpressure'),
    researchNeeded: Boolean(rationale.researchNeeded),
    duplicateCheck: { checked: Boolean(duplicateCheck.checked), overlapFound: Boolean(duplicateCheck.overlapFound), references: uniqueStrings(duplicateCheck.references, 'Duplicate references'), assessment: typeof duplicateCheck.assessment === 'string' ? duplicateCheck.assessment : '' },
  };
  if (!normalizedRationale.whyTogether.trim()) throw new Error('Synthesis rationale required');
  const criteria = Object.fromEntries(['distinctQuestionOrTension','multipleDirections','strongerTogether','concreteExample','counterpressure','notAlreadyCovered','changedSignificance'].map(key => [key, Boolean(input.criteria?.[key])]));
  const candidateArtifactType = input.candidateArtifactType ?? 'undetermined';
  const allowedTypes = ['seed','note','field-report','essay','experiment','prototype-note','concept','checkpoint','project-log','undetermined'];
  if (!allowedTypes.includes(candidateArtifactType)) throw new Error('Invalid synthesis artifact type');
  const status = input.status ?? 'emerging';
  if (!SYNTHESIS_STATUSES.includes(status)) throw new Error('Invalid synthesis status');
  if (typeof input.workingPremise !== 'string' || !input.workingPremise.trim()) throw new Error('Synthesis premise required');
  return { workingPremise: input.workingPremise, participants, sourceTypes: uniqueStrings(input.sourceTypes, 'Source types'), rationale: normalizedRationale, criteria, candidateArtifactType, status };
}

export function loadSynthesisHistory(workspace, candidateId) {
  const root = privateWorkspace(workspace);
  if (!/^syn-[a-z0-9][a-z0-9-]{5,79}$/.test(candidateId)) throw new Error('Invalid synthesis candidate ID');
  return revisionFiles(root, `synthesis/candidates/${candidateId}`).map(target => {
    const item = verifySynthesisCandidate(loadJsonSecure(root, target));
    return Object.defineProperty(item, '__path', { value: target, enumerable: false });
  });
}

export function createOrReviseSynthesisCandidate(workspace, input, now = new Date().toISOString()) {
  const root = privateWorkspace(workspace);
  const normalized = normalizeSynthesisInput(input);
  const candidateId = input.candidateId ?? `syn-${sha256(stableJson({ premise: normalized.workingPremise, participants: normalized.participants })).slice(0, 16)}`;
  if (!/^syn-[a-z0-9][a-z0-9-]{5,79}$/.test(candidateId)) throw new Error('Invalid synthesis candidate ID');
  const history = loadSynthesisHistory(root, candidateId);
  const previous = history.at(-1);
  const base = { schemaVersion: SYNTHESIS_SCHEMA_VERSION, candidateId, revision: (previous?.revision ?? 0) + 1, createdAt: previous?.createdAt ?? new Date(now).toISOString(), lastUpdatedAt: new Date(now).toISOString(), ...normalized };
  const candidate = { ...base, fingerprints: fingerprintsForSynthesis(base) };
  verifySynthesisCandidate(candidate);
  if (previous && previous.fingerprints.contentSha256 === candidate.fingerprints.contentSha256) return { candidate: previous, path: previous.__path, created: false };
  const target = writeImmutable(root, `synthesis/candidates/${candidateId}/r${String(candidate.revision).padStart(4, '0')}.json`, candidate);
  return { candidate, path: target, created: true };
}

export function listSynthesisCandidates(workspace, filters = {}) {
  const root = privateWorkspace(workspace);
  const candidatesRoot = path.join(root, 'synthesis', 'candidates');
  if (!fs.existsSync(candidatesRoot)) return [];
  let candidates = fs.readdirSync(candidatesRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => loadSynthesisHistory(root, entry.name).at(-1)).filter(Boolean);
  if (filters.status) candidates = candidates.filter(candidate => candidate.status === filters.status);
  return candidates.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt) || a.candidateId.localeCompare(b.candidateId));
}
