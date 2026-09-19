import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createScratchpadItem, listScratchpadItems, listSynthesisCandidates } from './editorial-memory.mjs';
import { executeSynthesisPass, existingCoverage, shouldDraftCandidate } from './synthesis.mjs';

function workspace() { const root=fs.mkdtempSync(path.join(os.tmpdir(),'dfw-synthesis-test-'));fs.mkdirSync(path.join(root,'runs'));return root; }
function add(root, seed, title, originType='intake-seed') { return createScratchpadItem(root,{title,body:`${title} supplies a concrete operational observation.`,whyMayMatter:'Together these observations may reveal a larger governance pattern.',originType,originProvenance:{seed},relatedSeeds:[seed],sourceReferences:[{type:'seed',id:seed}],themes:['governance'],concepts:['authority','interfaces'],entities:[],status:'accumulating',editorialSignals:{question:'How should delegated authority remain visible?',tension:'Action can become easier while responsibility becomes harder to see.',concreteExample:`Concrete case from ${seed}.`,counterpressure:'More visibility can create noise.',changedSignificance:'A new event makes the older observation operational.'}}).item; }
function source(id,kind,body,title=id){return{id,canonicalId:`source:${id}`,title,body,kind,roles:[kind],provenance:{sha256:id.padEnd(64,'a').slice(0,64)}};}
function proposal(items, overrides={}) { return {workingPremise:'Delegated AI makes action easier while making responsibility harder to see.',participants:{scratchpadItemIds:items.map(item=>item.itemId),seeds:items.flatMap(item=>item.relationships.seeds),runs:[],artifacts:[],sourceReferences:[]},sourceTypes:['intake-seed','existing-dfw-artifact'],rationale:{whyTogether:'The observations expose the same governance problem from operational and interface directions.',salienceNow:'A new event makes the old pattern consequential.',confidenceMaturity:'Strong enough for a bounded note.',unresolvedQuestions:['How much state is useful?'],counterpressure:['Visibility can become noise.'],researchNeeded:false,duplicateCheck:{checked:true,overlapFound:false,references:[],assessment:'No existing coverage.'}},criteria:{distinctQuestionOrTension:true,multipleDirections:true,strongerTogether:true,concreteExample:true,counterpressure:true,notAlreadyCovered:true,changedSignificance:true},candidateArtifactType:'note',status:'draft-worthy',selectedSourceIds:['intake:old','src/content/articles/older.md','kb:authority'],draftRecommended:true,...overrides}; }
function draftResult(){return{synthesisRationale:'A recent case makes two older observations coherent now.',proposedArtifact:{documentType:'note',workingTitle:'Visible Authority',coreObservation:'Delegation needs an inspectable owner.',scope:'A bounded interface distinction.'},draft:'# Visible Authority\n\nDelegation can hide who owns the next decision.',researchBasis:[{url:'https://example.test/event',finding:'A concrete external event.',limitation:'Single case.'}],unresolvedIssues:['How much visibility is enough?'],relatedExistingDfw:['older.md'],discoveredBranches:[]};}
function catalog(){return[
  source('intake:old','intake','An older seed about delegated decisions and unclear ownership.'),
  source('src/content/articles/older.md','DFW context, not approved exemplar','A public piece about a different aspect of interface state.'),
  source('kb:authority','ai-adoption-read-only-export','An approved working model describes bounded authority.'),
];}

test('scenarios E, F, and J: cross-seed and cross-source material can coalesce into one provenance-rich candidate', async () => {
  const root=workspace();const a=add(root,'seed:one','First signal');const b=add(root,'seed:two','Second signal','existing-dfw-artifact');
  const detected={assessment:'One cluster crossed the threshold.',proposals:[proposal([a,b])]};
  const result=await executeSynthesisPass({workspace:root,scratchpadItems:[a,b],sourceCatalog:catalog(),detect:async()=>detected,draft:async()=>draftResult(),contextBudgetChars:4000,runId:'synthesis-v0.4-cross-source',now:'2026-09-19T12:00:00.000Z'});
  assert.equal(result.manifest.status,'awaiting-human-editorial-review');
  assert.deepEqual(result.drafted.candidate.participants.seeds,['seed:one','seed:two']);
  assert.ok(result.diagnostics.sourceTypesSearched.includes('ai-adoption-read-only-export'));
  assert.ok(result.diagnostics.contextBudgets[0].suppliedChars<=4000);
  assert.equal(result.manifest.approvalGranted,false);
  assert.equal(fs.existsSync(path.join(root,'approvals')),false);
  assert.ok(listScratchpadItems(root).every(item=>item.status==='promoted'));
});

test('scenario G: terminology overlap without editorial coherence creates no draft', async () => {
  const root=workspace();const a=add(root,'seed:one','Agent interface');const b=add(root,'seed:two','Agent pricing');let draftCalled=false;
  const weak=proposal([a,b],{status:'emerging',draftRecommended:false,criteria:{distinctQuestionOrTension:false,multipleDirections:false,strongerTogether:false,concreteExample:true,counterpressure:false,notAlreadyCovered:true,changedSignificance:false}});
  const result=await executeSynthesisPass({workspace:root,scratchpadItems:[a,b],sourceCatalog:catalog(),detect:async()=>({assessment:'Shared language only.',proposals:[weak]}),draft:async()=>{draftCalled=true;return draftResult();},runId:'synthesis-v0.4-false-cluster'});
  assert.equal(result.manifest.status,'completed-no-draft');assert.equal(draftCalled,false);
});

test('scenario H: substantial existing-artifact overlap is absorbed instead of redrafted', async () => {
  const root=workspace();const a=add(root,'seed:one','First');const b=add(root,'seed:two','Second');let draftCalled=false;
  const premise='Visible delegated authority needs clear responsibility during every operational decision';
  const existing=source('src/content/articles/existing.md','DFW context, not approved exemplar',`# Existing\n\n${premise} and additional explanation.`);
  assert.equal(existingCoverage(premise,[existing]).overlapFound,true);
  const p=proposal([a,b],{workingPremise:premise,selectedSourceIds:[existing.id]});
  const result=await executeSynthesisPass({workspace:root,scratchpadItems:[a,b],sourceCatalog:[existing],detect:async()=>({assessment:'Potential duplicate.',proposals:[p]}),draft:async()=>{draftCalled=true;return draftResult();},runId:'synthesis-v0.4-duplicate'});
  assert.equal(draftCalled,false);assert.equal(result.manifest.status,'completed-no-draft');assert.equal(listSynthesisCandidates(root)[0].status,'absorbed');assert.ok(listScratchpadItems(root).every(item=>item.status==='absorbed'));
});

test('scenario I: mature synthesis drafts autonomously and stops at human review', async () => {
  const root=workspace();const a=add(root,'seed:one','First');const b=add(root,'seed:two','Second');
  const result=await executeSynthesisPass({workspace:root,scratchpadItems:[a,b],sourceCatalog:catalog(),detect:async()=>({assessment:'Mature.',proposals:[proposal([a,b])]}),draft:async()=>draftResult(),runId:'synthesis-v0.4-autonomous'});
  assert.equal(result.manifest.status,'awaiting-human-editorial-review');assert.equal(result.manifest.approvalGranted,false);assert.match(result.drafted.result.draft,/Visible Authority/);
  assert.ok(shouldDraftCandidate(proposal([a,b])));
  assert.equal(fs.existsSync(path.join(root,'src')),false);
});

test('synthesis can correctly return no mature cluster', async () => {
  const root=workspace();const a=add(root,'seed:one','Only observation');let draftCalled=false;
  const result=await executeSynthesisPass({workspace:root,scratchpadItems:[a],sourceCatalog:catalog(),detect:async()=>{throw new Error('detector should be skipped');},draft:async()=>{draftCalled=true;},runId:'synthesis-v0.4-silence'});
  assert.equal(result.manifest.status,'completed-no-draft');assert.equal(result.detection.proposals.length,0);assert.equal(draftCalled,false);
});
