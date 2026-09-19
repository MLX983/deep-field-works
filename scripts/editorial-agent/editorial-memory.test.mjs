import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createOrReviseSynthesisCandidate, createScratchpadItem, findStructuredCoalescence, listScratchpadItems, scratchpadContextRecords, updateScratchpadItem, verifyScratchpadItem } from './editorial-memory.mjs';

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dfw-memory-test-'));
  fs.mkdirSync(path.join(root, 'runs'));
  return root;
}

function observation(overrides = {}) {
  return {
    title: 'Authority becomes invisible',
    body: 'A delegated task can change state without making responsibility visible.',
    whyMayMatter: 'Interface state may need to expose authority, not only progress.',
    originType: 'intake-seed',
    originProvenance: { sourceIntakeId: 'MLX983/dfw-intake#101', runId: 'editorial-fixture-a' },
    relatedSeeds: ['MLX983/dfw-intake#101'], relatedRuns: ['editorial-fixture-a'], relatedArtifacts: [], relatedScratchpadItems: [],
    sourceReferences: [{ type: 'intake', id: 'MLX983/dfw-intake#101', url: 'https://example.test/101' }],
    themes: ['agent-governance'], concepts: ['authority','visibility'], entities: [], status: 'unformed',
    editorialSignals: { question: 'How should delegated authority remain visible?', tension: 'Automation can hide who now owns a decision.', concreteExample: 'A task moves to an agent without a visible handoff.', counterpressure: 'More status can produce supervision noise.', changedSignificance: '' },
    ...overrides,
  };
}

test('scratchpad records are private, fingerprinted, and append-only', () => {
  const root = workspace();
  const first = createScratchpadItem(root, observation(), '2026-09-19T10:00:00.000Z');
  assert.equal(first.item.revision, 1);
  assert.equal(fs.statSync(first.path).mode & 0o777, 0o400);
  assert.deepEqual(verifyScratchpadItem(JSON.parse(fs.readFileSync(first.path))), first.item);
  const bytes = fs.readFileSync(first.path, 'utf8');
  const revised = updateScratchpadItem(root, first.item.itemId, { status: 'accumulating', whyMayMatter: 'This has appeared in two operational settings.' }, '2026-09-19T11:00:00.000Z');
  assert.equal(revised.item.revision, 2);
  assert.equal(revised.item.createdAt, first.item.createdAt);
  assert.notEqual(revised.item.fingerprints.contentSha256, first.item.fingerprints.contentSha256);
  assert.equal(fs.readFileSync(first.path, 'utf8'), bytes);
  assert.equal(listScratchpadItems(root)[0].status, 'accumulating');
});

test('scratchpad provenance and retrieval records remain concise and stable', () => {
  const root = workspace();
  const first = createScratchpadItem(root, observation());
  const context = scratchpadContextRecords(root);
  assert.equal(context.length, 1);
  assert.equal(context[0].provenance.itemId, first.item.itemId);
  assert.equal(context[0].canonicalId, `scratchpad:${first.item.itemId}:r1`);
  assert.match(context[0].body, /delegated task/);
  assert.doesNotMatch(context[0].body, /sourceIntakeId/);
  assert.equal(first.item.relationships.seeds[0], 'MLX983/dfw-intake#101');
  assert.equal(first.item.sourceReferences[0].type, 'intake');
});

test('structured coalescence requires explicit shared editorial structure, evidence, and counterpressure', () => {
  const root = workspace();
  const first = createScratchpadItem(root, observation()).item;
  const second = createScratchpadItem(root, observation({
    title: 'Approval state in a prototype',
    body: 'A prototype exposed the decision owner beside the generated action.',
    originType: 'existing-dfw-artifact',
    originProvenance: { artifact: 'prototype-approval-state' },
    relatedSeeds: ['MLX983/dfw-intake#102'], relatedRuns: ['editorial-fixture-b'], relatedArtifacts: ['prototype-approval-state'],
    sourceReferences: [{ type: 'dfw-artifact', id: 'prototype-approval-state' }],
    editorialSignals: { ...observation().editorialSignals, concreteExample: 'A prototype displayed the approver next to an agent action.', changedSignificance: 'A working interface now makes the earlier question testable.' },
  })).item;
  const candidates = findStructuredCoalescence([first, second]);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].participants.scratchpadItemIds.sort(), [first.itemId, second.itemId].sort());
  assert.equal(candidates[0].status, 'emerging');

  const falseCluster = [first, { ...second, itemId: 'sp-unrelated000001', editorialSignals: { question: 'How should pricing tiers be named?', tension: '', concreteExample: '', counterpressure: '', changedSignificance: '' } }];
  assert.deepEqual(findStructuredCoalescence(falseCluster), []);
});

test('human and research origins are supported without requiring every optional relationship', () => {
  const root = workspace();
  const item = createScratchpadItem(root, { title: 'A human note', body: 'A weak signal worth retaining.', originType: 'human-added-note' }).item;
  assert.deepEqual(item.relationships, { seeds: [], runs: [], artifacts: [], scratchpadItems: [] });
  assert.deepEqual(item.retrieval, { themes: [], concepts: [], entities: [] });
  assert.equal(item.status, 'unformed');
});

test('manual add and read-only review commands operate on the private workspace', () => {
  const root = workspace();
  const bodyFile = path.join(root, 'human-note.md');
  fs.writeFileSync(bodyFile, 'A manually captured observation.');
  const cli = fileURLToPath(new URL('./scratchpad.mjs', import.meta.url));
  const added = spawnSync(process.execPath, [cli,'add','--workspace',root,'--title','Manual observation','--body-file',bodyFile,'--origin','human-added-note','--themes','interfaces'], { encoding:'utf8' });
  assert.equal(added.status,0,added.stderr);
  assert.equal(JSON.parse(added.stdout).created,true);
  const before = listScratchpadItems(root)[0].fingerprints.recordSha256;
  const reviewed = spawnSync(process.execPath, [cli,'review','--workspace',root,'--theme','interfaces','--include-candidates','true'], { encoding:'utf8' });
  assert.equal(reviewed.status,0,reviewed.stderr);
  assert.equal(JSON.parse(reviewed.stdout).itemCount,1);
  assert.equal(listScratchpadItems(root)[0].fingerprints.recordSha256,before);
});

test('synthesis candidates retain a stable ID across immutable revisions', () => {
  const root=workspace();
  const base={workingPremise:'A coherent premise.',participants:{scratchpadItemIds:['sp-example000001'],seeds:['seed:1'],runs:[],artifacts:[],sourceReferences:[]},sourceTypes:['intake-seed'],rationale:{whyTogether:'The observations address one question.',salienceNow:'',confidenceMaturity:'Emerging.',unresolvedQuestions:[],counterpressure:[],researchNeeded:true,duplicateCheck:{checked:true,overlapFound:false,references:[],assessment:'No overlap.'}},criteria:{distinctQuestionOrTension:true,multipleDirections:false,strongerTogether:true,concreteExample:false,counterpressure:false,notAlreadyCovered:true,changedSignificance:false},candidateArtifactType:'undetermined',status:'emerging'};
  const first=createOrReviseSynthesisCandidate(root,base,'2026-09-19T10:00:00.000Z');
  const bytes=fs.readFileSync(first.path,'utf8');
  const second=createOrReviseSynthesisCandidate(root,{...base,candidateId:first.candidate.candidateId,status:'research-needed'},'2026-09-19T11:00:00.000Z');
  assert.equal(second.candidate.candidateId,first.candidate.candidateId);assert.equal(second.candidate.revision,2);assert.equal(fs.readFileSync(first.path,'utf8'),bytes);
});
