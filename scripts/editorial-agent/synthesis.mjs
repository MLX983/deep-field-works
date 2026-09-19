import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildBoundedEditorialContext, editorialContextPromptView, parseContextBudget } from './context-budget.mjs';
import { createOrReviseSynthesisCandidate, listScratchpadItems, listSynthesisCandidates, privateWorkspace, scratchpadContextRecords, updateScratchpadItem } from './editorial-memory.mjs';
import { DEFAULT_MODEL_POLICY, catalogView, checkWorkspace, command, exemplarGuidance, hash, invoke, modelPolicy, optionalContext, repoContext, scratchpadCandidates, seedBody, shortlist, validate, writePrivate } from './agent.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SYNTHESIS_VERSION = 'v0.4';
const text = { type: 'string' };
const list = { type: 'array', items: text };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const artifactType = { type: 'string', enum: ['seed','note','field-report','essay','experiment','prototype-note','concept','checkpoint','project-log','undetermined'] };
const stringSet = { type: 'array', uniqueItems: true, items: text };
const participantsSchema = object({ scratchpadItemIds: stringSet, seeds: stringSet, runs: stringSet, artifacts: stringSet, sourceReferences: stringSet });
const duplicateSchema = object({ checked: { type: 'boolean' }, overlapFound: { type: 'boolean' }, references: stringSet, assessment: text });
const rationaleSchema = object({ whyTogether: text, salienceNow: text, confidenceMaturity: text, unresolvedQuestions: stringSet, counterpressure: stringSet, researchNeeded: { type: 'boolean' }, duplicateCheck: duplicateSchema });
const criteriaSchema = object({ distinctQuestionOrTension: { type: 'boolean' }, multipleDirections: { type: 'boolean' }, strongerTogether: { type: 'boolean' }, concreteExample: { type: 'boolean' }, counterpressure: { type: 'boolean' }, notAlreadyCovered: { type: 'boolean' }, changedSignificance: { type: 'boolean' } });

export const detectionSchema = object({
  assessment: text,
  proposals: {
    type: 'array', maxItems: 8, items: object({
      workingPremise: text,
      participants: participantsSchema,
      sourceTypes: stringSet,
      rationale: rationaleSchema,
      criteria: criteriaSchema,
      candidateArtifactType: artifactType,
      status: { type: 'string', enum: ['emerging','research-needed','draft-worthy','dismissed','absorbed'] },
      selectedSourceIds: stringSet,
      draftRecommended: { type: 'boolean' },
    }),
  },
});

export const autonomousDraftSchema = object({
  synthesisRationale: text,
  proposedArtifact: object({ documentType: { type: 'string', enum: artifactType.enum.filter(type => type !== 'undetermined') }, workingTitle: text, coreObservation: text, scope: text }),
  draft: text,
  researchBasis: { type: 'array', items: object({ url: text, finding: text, limitation: text }) },
  unresolvedIssues: list,
  relatedExistingDfw: list,
  discoveredBranches: { type: 'array', items: object({ premiseOrQuestion: text, reasonForSeparation: text, likelyArtifactType: artifactType, supportingMaterial: list, suggestedNextAction: text }) },
});

const words = value => new Set((value.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter(word => !['that','this','with','from','have','what','they','their','into','about','when','does','should','would','could'].includes(word)));

export function existingCoverage(workingPremise, artifacts) {
  const premiseTerms = words(workingPremise);
  let best = { overlapFound: false, score: 0, reference: '', assessment: 'No substantial overlap found.' };
  for (const artifact of artifacts) {
    const artifactTerms = words(`${artifact.title} ${artifact.body}`);
    const intersection = [...premiseTerms].filter(term => artifactTerms.has(term)).length;
    const score = premiseTerms.size ? intersection / premiseTerms.size : 0;
    if (score > best.score) best = { overlapFound: premiseTerms.size >= 5 && score >= 0.7, score, reference: artifact.id, assessment: `${intersection} of ${premiseTerms.size} premise terms appear in ${artifact.id}.` };
  }
  return best;
}

export function shouldDraftCandidate(proposal) {
  const criteria = proposal.criteria;
  const passed = Object.values(criteria).filter(Boolean).length;
  return proposal.draftRecommended === true && proposal.status === 'draft-worthy' && proposal.participants.scratchpadItemIds.length >= 2 && criteria.distinctQuestionOrTension && criteria.multipleDirections && criteria.strongerTogether && criteria.concreteExample && criteria.counterpressure && criteria.notAlreadyCovered && passed >= 6 && proposal.rationale.duplicateCheck.checked && !proposal.rationale.duplicateCheck.overlapFound;
}

function publicDraftIsClean(draft) {
  return !/(the editorial system|semantic clustering suggests|the scratchpad contained|i found \d+ related notes)/i.test(draft);
}

function candidateInput(proposal, duplicate) {
  const overlapFound = duplicate.overlapFound || proposal.rationale.duplicateCheck.overlapFound;
  return {
    workingPremise: proposal.workingPremise,
    participants: proposal.participants,
    sourceTypes: proposal.sourceTypes,
    rationale: {
      ...proposal.rationale,
      duplicateCheck: {
        checked: true,
        overlapFound,
        references: [...new Set([...proposal.rationale.duplicateCheck.references, ...(duplicate.reference ? [duplicate.reference] : [])])],
        assessment: duplicate.overlapFound ? duplicate.assessment : proposal.rationale.duplicateCheck.assessment || duplicate.assessment,
      },
    },
    criteria: { ...proposal.criteria, notAlreadyCovered: !overlapFound && proposal.criteria.notAlreadyCovered },
    candidateArtifactType: proposal.candidateArtifactType,
    status: overlapFound ? 'absorbed' : proposal.status,
  };
}

function transitionScratchpadItems(root, itemIds, status, candidateId, additionalReference = null, now = new Date().toISOString()) {
  const latest = new Map(listScratchpadItems(root).map(item => [item.itemId, item]));
  for (const itemId of itemIds) {
    const item = latest.get(itemId);
    if (!item) continue;
    const candidateReference = { type:'synthesis-candidate', id:candidateId };
    const references = [...item.sourceReferences, candidateReference, ...(additionalReference ? [additionalReference] : [])];
    const hasCandidateReference = item.sourceReferences.some(reference => reference.type === candidateReference.type && reference.id === candidateReference.id);
    const hasAdditionalReference = !additionalReference || item.sourceReferences.some(reference => reference.type === additionalReference.type && reference.id === additionalReference.id);
    if (item.status === status && hasCandidateReference && hasAdditionalReference) continue;
    updateScratchpadItem(root, itemId, { status, sourceReferences: references }, now);
  }
}

export async function executeSynthesisPass({ workspace, scratchpadItems, sourceCatalog, detect, draft, contextBudgetChars = 24_000, contextBudgetOverrideUsed = false, runId = `synthesis-${SYNTHESIS_VERSION}-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomUUID().slice(0,8)}`, now = new Date().toISOString() }) {
  const root = privateWorkspace(workspace);
  contextBudgetChars = parseContextBudget(contextBudgetChars);
  const namespace = 'synthesis/runs';
  const write = (name, value) => writePrivate(root, `${namespace}/${runId}/${name}`, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  const activeItems = scratchpadItems.filter(item => !['discarded','absorbed','promoted'].includes(item.status));
  const diagnostics = {
    sourceTypesSearched: [...new Set(sourceCatalog.map(item => item.kind))].sort(),
    sourceTypesRepresentedInCandidates: [],
    scratchpadItemsConsidered: activeItems.map(item => item.itemId),
    seedsConsidered: sourceCatalog.filter(item => item.kind === 'intake').map(item => item.id),
    dfwEntriesConsidered: sourceCatalog.filter(item => item.kind === 'DFW context, not approved exemplar').map(item => item.id),
    aiAdoptionSectionsConsidered: sourceCatalog.filter(item => item.kind === 'ai-adoption-read-only-export').map(item => item.id),
    externalSourcesConsidered: [], selectedItems: [], rejectedItems: [], clusterMembership: [], duplicateChecks: [], researchAdded: [], contextBudgets: [], draftingDecisions: [],
  };
  write('started.json', { runId, version: SYNTHESIS_VERSION, status: 'running', approvalGranted: false, startedAt: now, contextBudget: { configuredChars: contextBudgetChars, operatorOverrideUsed: contextBudgetOverrideUsed } });
  const detection = activeItems.length < 2 ? { assessment: 'Fewer than two active scratchpad observations; no coalescence possible.', proposals: [] } : validate(detectionSchema, await detect({ scratchpadItems: activeItems, sourceCatalog }));
  write('detection.json', detection);
  const coverageCorpus = sourceCatalog.filter(item => ['DFW context, not approved exemplar','intake'].includes(item.kind));
  const storedCandidates = [];
  let drafted = null;
  const existingCandidates = listSynthesisCandidates(root);

  for (const proposal of detection.proposals) {
    const knownIds = new Set(activeItems.map(item => item.itemId));
    if (proposal.participants.scratchpadItemIds.some(itemId => !knownIds.has(itemId))) throw new Error('Synthesis proposal references an unknown scratchpad item');
    const duplicate = existingCoverage(proposal.workingPremise, coverageCorpus);
    const membershipKey = proposal.participants.scratchpadItemIds.slice().sort().join('|');
    const existingCandidate = existingCandidates.find(candidate => candidate.participants.scratchpadItemIds.slice().sort().join('|') === membershipKey);
    const input = { ...candidateInput(proposal, duplicate), ...(existingCandidate ? { candidateId: existingCandidate.candidateId } : {}) };
    const stored = createOrReviseSynthesisCandidate(root, input, now);
    storedCandidates.push(stored.candidate);
    if (input.status === 'absorbed') transitionScratchpadItems(root, proposal.participants.scratchpadItemIds, 'absorbed', stored.candidate.candidateId, duplicate.reference ? { type:'existing-coverage', id:duplicate.reference } : null, now);
    else if (['emerging','research-needed','draft-worthy'].includes(input.status)) transitionScratchpadItems(root, proposal.participants.scratchpadItemIds, 'candidate', stored.candidate.candidateId, null, now);
    diagnostics.sourceTypesRepresentedInCandidates.push(...proposal.sourceTypes);
    diagnostics.clusterMembership.push({ candidateId: stored.candidate.candidateId, scratchpadItemIds: proposal.participants.scratchpadItemIds, sourceIds: proposal.selectedSourceIds });
    diagnostics.duplicateChecks.push({ candidateId: stored.candidate.candidateId, ...stored.candidate.rationale.duplicateCheck, localScore: duplicate.score });
    const eligible = drafted === null && shouldDraftCandidate({ ...proposal, ...input });
    diagnostics.draftingDecisions.push({ candidateId: stored.candidate.candidateId, drafted: eligible, reason: eligible ? 'Passed conservative coalescence and duplicate gates.' : input.status === 'absorbed' ? 'Existing DFW coverage is substantially overlapping.' : 'Candidate did not pass every required drafting gate.' });
    if (!eligible) continue;

    const scratchContext = scratchpadContextRecords(root).filter(item => proposal.participants.scratchpadItemIds.includes(item.provenance.itemId));
    const selectedIds = new Set(proposal.selectedSourceIds);
    const selectedSources = [...scratchContext, ...sourceCatalog.filter(item => selectedIds.has(item.id))].map(item => ({ ...item, selectionReason: item.kind === 'editorial-scratchpad' ? 'Participating scratchpad observation' : 'Selected during synthesis detection' }));
    const boundedContext = buildBoundedEditorialContext({ seed: proposal.workingPremise, selectedSources, editorialQuestions: stored.candidate.rationale.unresolvedQuestions, budgetChars: contextBudgetChars, operatorOverrideUsed: contextBudgetOverrideUsed, candidateCount: sourceCatalog.length + activeItems.length });
    diagnostics.selectedItems.push(...boundedContext.includedSources.map(item => item.sourceId));
    diagnostics.rejectedItems.push(...boundedContext.excludedSources.map(item => item.sourceId));
    diagnostics.contextBudgets.push({ candidateId: stored.candidate.candidateId, configuredChars: boundedContext.configuredBudgetChars, availableChars: boundedContext.availableSelectedSourceChars, suppliedChars: boundedContext.suppliedContextChars, omittedBecauseBudgetChars: boundedContext.omittedBecauseBudgetChars, includedPassages: boundedContext.includedPassages.length, excludedPassages: boundedContext.excludedPassages.length });
    write(`context-${stored.candidate.candidateId}.json`, boundedContext);
    const draftResult = validate(autonomousDraftSchema, await draft({ candidate: stored.candidate, boundedContext, promptContext: editorialContextPromptView(boundedContext) }));
    if (!draftResult.draft.trim()) throw new Error('Draft-worthy synthesis returned an empty draft');
    if (!publicDraftIsClean(draftResult.draft)) throw new Error('Autonomous draft leaked private editorial machinery into public prose');
    diagnostics.externalSourcesConsidered.push(...draftResult.researchBasis.map(item => item.url));
    diagnostics.researchAdded.push(...draftResult.researchBasis);
    write(`draft-${stored.candidate.candidateId}.md`, draftResult.draft);
    write(`result-${stored.candidate.candidateId}.json`, draftResult);
    const revised = createOrReviseSynthesisCandidate(root, { ...input, candidateId: stored.candidate.candidateId, status: 'drafted' }, now).candidate;
    transitionScratchpadItems(root, proposal.participants.scratchpadItemIds, 'promoted', revised.candidateId, { type:'synthesis-run', id:runId }, now);
    drafted = { candidate: revised, result: draftResult };
  }

  diagnostics.sourceTypesRepresentedInCandidates = [...new Set(diagnostics.sourceTypesRepresentedInCandidates)].sort();
  diagnostics.selectedItems = [...new Set(diagnostics.selectedItems)];
  diagnostics.rejectedItems = [...new Set(diagnostics.rejectedItems)];
  write('diagnostics.json', diagnostics);
  const status = drafted ? 'awaiting-human-editorial-review' : 'completed-no-draft';
  const manifest = { runId, version: SYNTHESIS_VERSION, status, approvalGranted: false, candidateIds: storedCandidates.map(candidate => candidate.candidateId), draftedCandidateId: drafted?.candidate.candidateId ?? null, completedAt: now };
  write('manifest.json', manifest);
  write('review-report.json', drafted ? { runId, status, approvalGranted: false, candidateId: drafted.candidate.candidateId, proposedArtifact: drafted.result.proposedArtifact, whySynthesizedNow: drafted.result.synthesisRationale, contributingSourceCategories: drafted.candidate.sourceTypes, provenance: drafted.candidate.participants, unresolvedIssues: drafted.result.unresolvedIssues, relatedExistingDfw: drafted.result.relatedExistingDfw, discoveredBranches: drafted.result.discoveredBranches } : { runId, status, approvalGranted: false, assessment: detection.assessment, candidateIds: manifest.candidateIds });
  return { manifest, detection, diagnostics, drafted };
}

function compactScratchpadIndex(items) {
  return items.slice(0, 200).map(item => ({ itemId: item.itemId, status: item.status, title: item.observation.title, whyMayMatter: item.observation.whyMayMatter, originType: item.origin.type, relationships: item.relationships, sourceReferences: item.sourceReferences, retrieval: item.retrieval, editorialSignals: item.editorialSignals, contentSha256: item.fingerprints.contentSha256 }));
}

function priorEditorialMemory(root) {
  const runsRoot = path.join(root, 'runs');
  return fs.readdirSync(runsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort().slice(-50).flatMap(runId => {
    const resultPath = path.join(runsRoot, runId, 'result.json');
    if (!fs.existsSync(resultPath) || !resultPath.startsWith(runsRoot + path.sep) || !fs.realpathSync(resultPath).startsWith(fs.realpathSync(runsRoot) + path.sep)) return [];
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    const branches = (result.discoveredBranches ?? []).map((branch, index) => {
      const body = [branch.premiseOrQuestion ?? branch.idea, branch.reasonForSeparation, ...(branch.supportingMaterial ?? []), branch.relationshipToSeed, branch.suggestedNextAction].filter(Boolean).join('\n\n');
      return { id:`prior-run:${runId}:branch:${index+1}`, canonicalId:`prior-run:${runId}:branch:${index+1}:${hash(body)}`, title:branch.idea ?? branch.premiseOrQuestion ?? 'Prior discovered branch', body, kind:'prior editorial branch', provenance:{runId,index:index+1,sha256:hash(body)} };
    });
    const questions = (result.unresolvedEdge ?? []).map((question, index) => ({ id:`prior-run:${runId}:question:${index+1}`, canonicalId:`prior-run:${runId}:question:${index+1}:${hash(question)}`, title:`Prior unresolved question from ${runId}`, body:question, kind:'prior unresolved editorial question', provenance:{runId,index:index+1,sha256:hash(question)} }));
    return [...branches, ...questions];
  });
}

function parseArgs(argv) {
  const args = {};
  const allowed = new Set(['--workspace','--repo-path','--context-config','--model-config','--research','--selection-model','--selection-reasoning','--editorial-model','--editorial-reasoning','--editorial-context-chars']);
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowed.has(argv[index]) || !argv[index + 1] || args[argv[index]] !== undefined) throw new Error('Invalid editorial synthesis arguments');
    args[argv[index]] = argv[index + 1];
  }
  if (!args['--workspace'] || !args['--repo-path']) throw new Error('Synthesis requires --workspace and --repo-path');
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const repo = fs.realpathSync(args['--repo-path']);
  const config = args['--context-config'] ? JSON.parse(fs.readFileSync(args['--context-config'], 'utf8')) : { exemplars: [], aiAdoptionContext: [] };
  const modelConfig = args['--model-config'] ? JSON.parse(fs.readFileSync(args['--model-config'], 'utf8')) : {};
  const runtime = modelPolicy(modelConfig, {
    selection: Object.fromEntries(Object.entries({ model: args['--selection-model'], reasoning: args['--selection-reasoning'] }).filter(([, value]) => value !== undefined)),
    editorial: Object.fromEntries(Object.entries({ model: args['--editorial-model'], reasoning: args['--editorial-reasoning'] }).filter(([, value]) => value !== undefined)),
  });
  const research = args['--research'] ?? 'live';
  if (!['live','disabled'].includes(research)) throw new Error('Unknown research mode');
  const budget = parseContextBudget(args['--editorial-context-chars']);
  const approvedContext = optionalContext(config);
  const root = checkWorkspace(args['--workspace'], repo, [...(config.exemplars ?? []), ...(config.aiAdoptionContext ?? [])].map(item => item.path));
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  privateWorkspace(root);
  const scratchpadItems = listScratchpadItems(root);
  const index = compactScratchpadIndex(scratchpadItems);
  const issues = JSON.parse(command('gh', ['issue','list','--repo','MLX983/dfw-intake','--state','all','--limit','100','--json','number,title,body,url,createdAt,updatedAt']));
  const sources = issues.map(issue => ({ id:`intake:${issue.number}`, canonicalId:`issue:${issue.url}`, title:issue.title, body:seedBody(issue.body), kind:'intake', provenance:{url:issue.url,createdAt:issue.createdAt,updatedAt:issue.updatedAt,sha256:hash(issue.body)} }));
  const legacyMemory = scratchpadCandidates(root).filter(item => item.kind !== 'editorial-scratchpad');
  sources.push(...repoContext(repo), ...approvedContext, ...legacyMemory, ...priorEditorialMemory(root));
  const discoveryQuery = index.map(item => [item.title, ...item.retrieval.concepts, item.editorialSignals.question, item.editorialSignals.tension].join(' ')).join('\n');
  const sourceCatalog = shortlist(discoveryQuery || 'editorial observations', sources);
  const runId = `synthesis-${SYNTHESIS_VERSION}-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomUUID().slice(0,8)}`;
  const role = fs.readFileSync(path.join(HERE, 'role.md'), 'utf8');
  const bin = process.env.CODEX_BIN || 'codex';
  command(bin, ['--version']);
  command(bin, ['login','status']);
  const executions = {};
  const detect = async () => {
    const prompt = `${role}\n\nPerform low-cost editorial pattern detection. A repeated term is not a mature idea. Propose a cluster only when it has a distinct question or tension, multiple directions of support, a concrete case, counterpressure, and a reason the combination is stronger now. Check the catalog for an existing DFW entry, current draft, intake seed, or other development that already covers or should absorb the premise. It is valid and often preferable to return no proposals. Do not draft.\nPRIVATE SCRATCHPAD INDEX (metadata and short observations, not public prose):\n${JSON.stringify(index)}\nRELATED SOURCE CATALOG (excerpts only; no category is mandatory):\n${JSON.stringify(catalogView(sourceCatalog))}`;
    const result = invoke(root, runId, 'detection', prompt, detectionSchema, false, bin, runtime.selection, 'synthesis/runs');
    executions.detection = result.execution;
    return result.value;
  };
  const draft = async ({ candidate, promptContext }) => {
    const prompt = `${role}\n\nDevelop this private synthesis candidate only because it passed conservative detection and duplicate gates. ${research === 'live' ? 'Use focused external research only when it materially improves evidence.' : 'Research is disabled; state limitations privately.'} Write a normal DFW artifact. Never mention the scratchpad, clustering, retrieval, or editorial system in the public draft. Keep synthesis rationale and provenance in structured private fields. Stop at human editorial review.\nSYNTHESIS CANDIDATE:\n${JSON.stringify(candidate)}\nAPPROVED EXEMPLAR FUNCTIONS AND ANTI-PATTERNS:\n${JSON.stringify(exemplarGuidance(approvedContext))}\nBOUNDED SELECTED CONTEXT:\n${JSON.stringify(promptContext)}`;
    const result = invoke(root, runId, 'development', prompt, autonomousDraftSchema, research === 'live', bin, runtime.editorial, 'synthesis/runs');
    executions.development = result.execution;
    return result.value;
  };
  const result = await executeSynthesisPass({ workspace: root, scratchpadItems, sourceCatalog, detect, draft, contextBudgetChars: budget, contextBudgetOverrideUsed: args['--editorial-context-chars'] !== undefined, runId });
  writePrivate(root, `synthesis/runs/${runId}/model-policy.json`, JSON.stringify({ defaults: DEFAULT_MODEL_POLICY, requested: runtime, executions, fallbackOccurred: Object.values(executions).some(execution => execution.fallbackOccurred) }, null, 2));
  console.log(JSON.stringify({ ...result.manifest, workspace:path.join(root,'synthesis','runs',runId), modelPolicy:runtime, fallbackOccurred:false }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
