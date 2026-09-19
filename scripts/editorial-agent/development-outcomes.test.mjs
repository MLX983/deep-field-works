import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { persistResult, resultSchema, validate } from './agent.mjs';

function result(overrides = {}) {
  return {
    sourcePremise:'A seed is input rather than an artifact contract.',
    editorialAssessment:{judgment:'Develop selectively',rationale:'There is one useful distinction.',primaryDevelopment:'Develop the strongest direct premise.'},
    recommendation:'develop', seedDisposition:'develop-now',
    primaryDevelopment:{status:'drafted',premise:'Seeds do not imply articles.',relationshipToSeed:'Direct',proposedArtifactType:'note',workingTitle:'A Seed Is Not an Article',contributingSourceIds:['intake:fixture']},
    whyWorthPublishing:'It prevents forced drafting.', proposedArtifact:{documentType:'note',workingTitle:'A Seed Is Not an Article',coreObservation:'Editorial input and public artifacts are different units.',scope:'One distinction.'},
    draft:'# A Seed Is Not an Article\n\nA compact draft.', researchBasis:[], developmentNotes:{candidateFramings:[],revisionNotes:[],researchNotes:''}, unresolvedEdge:[],connections:[],scratchpadAdditions:[],scratchpadObservations:[],proposedKbUpdates:[],discoveredBranches:[],designPrototypeConnections:[], ...overrides,
  };
}

const observation = { title:'Research byproduct',body:'A separate operational example may matter later.',whyMayMatter:'It may connect to governance interfaces.',preservationRationale:'It has future analytical value but does not belong in this draft.',originType:'live-research',sourceReferences:[{type:'external',id:'example',title:'Example',url:'https://example.test',fingerprint:''}],themes:['governance'],concepts:['interfaces'],entities:[],editorialSignals:{question:'',tension:'',concreteExample:'An unrelated control panel.',counterpressure:'',changedSignificance:''} };
const branch = { idea:'A separate interface premise',premiseOrQuestion:'Do disappearing interaction surfaces require richer control surfaces?',howItEmerged:'The seed contained a second mechanism.',relationshipToSeed:'Adjacent but distinct.',reasonForSeparation:'Combining interface behavior with disclosure would blur both.',likelyArtifactType:'note',supportingMaterial:['Prototype observation'],suggestedNextAction:'Develop separately.' };

test('scenario A: one seed can yield one primary artifact without branch or scratchpad noise', () => {
  const value = validate(resultSchema, result());
  assert.equal(value.primaryDevelopment.status, 'drafted');
  assert.deepEqual(value.discoveredBranches, []);
  assert.deepEqual(value.scratchpadObservations, []);
});

test('scenario B: one seed can preserve a distinct branch without forcing a second draft', () => {
  const value = validate(resultSchema, result({ seedDisposition:'split-into-multiple-artifacts', discoveredBranches:[branch] }));
  assert.equal(value.discoveredBranches.length, 1);
  assert.match(value.discoveredBranches[0].reasonForSeparation, /blur/);
  assert.equal(value.draft.split(/^# /m).length - 1, 1);
});

test('scenario C: a weak seed can produce no draft and become a provenance-bearing scratchpad item', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'dfw-outcome-test-')));
  const weak = result({ recommendation:'preserve', seedDisposition:'scratchpad', primaryDevelopment:{status:'none',premise:'',relationshipToSeed:'',proposedArtifactType:'undetermined',workingTitle:'',contributingSourceIds:[]}, whyWorthPublishing:'', proposedArtifact:{documentType:'seed',workingTitle:'',coreObservation:'',scope:''}, draft:'', scratchpadObservations:[{...observation,originType:'editorial-analysis'}] });
  const stop = persistResult(root,'weak-run',weak,{runId:'weak-run',sourceIntakeId:'MLX983/dfw-intake#201',sourceUrl:'https://example.test/201',sourceBodySha256:'a'.repeat(64)});
  assert.equal(stop.status,'awaiting-human-editorial-review');
  assert.equal(stop.scratchpadItemIds.length,1);
  const stored = JSON.parse(fs.readFileSync(path.join(root,'scratchpad','items',stop.scratchpadItemIds[0],'r0001.json')));
  assert.deepEqual(stored.relationships.seeds,['MLX983/dfw-intake#201']);
  assert.equal(stored.origin.provenance.runId,'weak-run');
});

test('scenario D: a research byproduct stays in scratchpad observations rather than the public draft', () => {
  const value = validate(resultSchema, result({ scratchpadObservations:[observation] }));
  assert.equal(value.scratchpadObservations[0].originType,'live-research');
  assert.doesNotMatch(value.draft,/unrelated control panel/i);
});
