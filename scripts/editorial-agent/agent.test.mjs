import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MODEL, checkWorkspace, writePrivate, seedBody, shortlist, chosenContext, invocation, resultSchema, validate, persistResult, reasoningPolicy, optionalContext, scratchpadCandidates } from './agent.mjs';

test('workspace rejects repository, publishing state, ancestors, and symlink aliases', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(),'dfw-editorial-test-'));
  const repo = path.join(base,'repo'); fs.mkdirSync(repo);
  const root = path.join(base,'editorial'); fs.mkdirSync(root);
  fs.symlinkSync(repo,path.join(base,'alias'));
  for (const forbidden of [repo,path.join(repo,'private'),base,path.join(base,'alias'),'/tmp/dfw-backlog-state','/tmp/dfw-backlog-work']) assert.throws(()=>checkWorkspace(forbidden,repo));
  assert.equal(checkWorkspace(root,repo),fs.realpathSync(root));
});

test('persistence cannot traverse paths, follow symlinks, or overwrite existing outputs', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'dfw-editorial-test-')));
  fs.symlinkSync(os.tmpdir(),path.join(root,'escape'));
  assert.throws(()=>writePrivate(root,'../outside','bad'));
  assert.throws(()=>writePrivate(root,'escape/outside','bad'));
  writePrivate(root,'runs/test/draft.md','original');
  assert.throws(()=>writePrivate(root,'runs/test/draft.md','overwrite'));
  assert.equal(fs.readFileSync(path.join(root,'runs/test/draft.md'),'utf8'),'original');
});

test('seed extraction removes intake wrapper without importing classification', () => {
  const body = '# Intake\nEmail: private\n### Body\nOriginal seed\n\n---\n\n## Initial agent classification\ncombine';
  assert.equal(seedBody(body),'Original seed');
  assert.equal(seedBody('A plain seed'),'A plain seed');
});

test('selective retrieval returns full source only for known chosen IDs', () => {
  const catalog = shortlist('memory permissions control',[
    {id:'a',title:'Memory control',body:'Inspect permissions'},
    {id:'b',title:'Other',body:'Unrelated weather'}
  ]);
  assert.equal(catalog[0].id,'a');
  assert.equal(chosenContext({selected:[{id:'a',reason:'relevant'}],editorialQuestions:[]},catalog)[0].body,'Inspect permissions');
  assert.throws(()=>chosenContext({selected:[{id:'../../loop1/result',reason:'bad'}],editorialQuestions:[]},catalog));
  assert.throws(()=>chosenContext({selected:[{id:'a',reason:'x'},{id:'a',reason:'y'}],editorialQuestions:[]},catalog));
});

test('invocation pins Astra with read-only execution, no shell/apps/hooks/plugins, configurable research', () => {
  const args = invocation('/private/editorial','schema','response',true);
  assert.equal(args[args.indexOf('--model')+1],MODEL);
  assert.equal(args[args.indexOf('--sandbox')+1],'read-only');
  for (const item of ['--ignore-user-config','--ignore-rules','--ephemeral','approval_policy="never"','web_search="live"']) assert.ok(args.includes(item));
  for (const feature of ['shell_tool','apps','plugins','hooks','multi_agent','computer_use']) assert.equal(args[args.indexOf(feature)-1],'--disable');
  assert.ok(invocation('x','s','o',false).includes('web_search="disabled"'));
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
});

test('contract persists scratchpad and KB proposals separately, always stops unapproved', () => {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'dfw-editorial-test-')));
  const branch={idea:'Adjacent idea',howItEmerged:'Evidence',relationshipToSeed:'Different question',suggestedNextAction:'Research'};
  const design={designQuestion:'Can this be tested?',relationshipToSeed:'Operational implication',suggestedNextAction:'Sketch'};
  const result={sourcePremise:'Original idea',editorialAssessment:{judgment:'Develop as written',rationale:'Useful',primaryDevelopment:'Test the premise'},recommendation:'develop',whyWorthPublishing:'Distinction',proposedArtifact:{documentType:'note',workingTitle:'Title',coreObservation:'Observe',scope:'Small'},draft:'# Title\n\nProse',researchBasis:[],developmentNotes:{candidateFramings:[],revisionNotes:[],researchNotes:''},unresolvedEdge:[],connections:[],scratchpadAdditions:['Next idea'],proposedKbUpdates:['Potential insight'],discoveredBranches:[branch],designPrototypeConnections:[design]};
  const stop=persistResult(root,'run',result,{runId:'run',sourceUrl:'https://example.test/16'});
  assert.equal(stop.status,'awaiting-human-editorial-review'); assert.equal(stop.approvalGranted,false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'scratchpad/run.json'))).runId,'run');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'runs/run/kb-proposals.json'))).canonical,false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'scratchpad/run.json'))).discoveredBranches,[branch]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'runs/run/design-connections.json'))).connections,[design]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'runs/run/branches.json'))).sourceUrl,'https://example.test/16');
  validate(resultSchema,{...result,discoveredBranches:[],designPrototypeConnections:[]});
  assert.throws(()=>validate(resultSchema,{...result,sourcePremise:undefined}));
  assert.throws(()=>validate(resultSchema,{...result,discoveredBranches:[{idea:'Missing provenance explanation'}]}));
  assert.throws(()=>validate(resultSchema,{...result,recommendation:'publish'}));
  assert.deepEqual(fs.readdirSync(root).sort(),['runs','scratchpad']);
});

test('phase defaults are Low/Medium, High requires explicit choice and invalid levels fail', () => {
  assert.deepEqual(reasoningPolicy(),{selection:'low',editorial:'medium'});
  for (const [phase,effort] of Object.entries(reasoningPolicy())) {
    assert.ok(invocation('x','s','o',phase==='editorial',effort).includes(`model_reasoning_effort="${effort}"`));
  }
  assert.deepEqual(reasoningPolicy('high','high'),{selection:'high',editorial:'high'});
  assert.ok(invocation('x','s','o',true,'high').includes('model_reasoning_effort="high"'));
  assert.throws(()=>reasoningPolicy('medium','medium'));
  assert.throws(()=>reasoningPolicy('low','low'));
  assert.throws(()=>invocation('x','s','o',true,'unknown'));
});

test('approved exports and both exemplar polarities remain selective read-only context', () => {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'dfw-context-test-')));
  const p=path.join(root,'export.md');fs.writeFileSync(p,'# Working models\n\n## Judgment\n\nA working model of judgment.\n\n## Authority\n\nA separate model of authority.');
  const entry={id:'model',path:p,source:'Fixture source',approvedBy:'Fixture reviewer',approvedAt:'2026-09-16'};
  const config={aiAdoptionContext:[entry],exemplars:[{...entry,id:'positive',polarity:'positive'},{...entry,id:'negative',polarity:'negative'}]};
  const before=fs.readFileSync(p,'utf8');
  const items=optionalContext(config);
  assert.equal(items.length,4);
  assert.equal(items[0].provenance.polarity,'positive');
  assert.equal(items[1].provenance.polarity,'negative');
  const judgment=items.find(item=>item.provenance.sectionHeading==='Judgment');
  const selected=chosenContext({selected:[{id:judgment.id,reason:'Relevant'}],editorialQuestions:[]},shortlist('judgment',items));
  assert.equal(selected.length,1);assert.match(selected[0].body,/working model of judgment/);assert.doesNotMatch(selected[0].body,/separate model of authority/);
  assert.equal(selected[0].provenance.sourceSha256,items.at(-1).provenance.sourceSha256);
  assert.equal(fs.readFileSync(p,'utf8'),before);
  assert.throws(()=>optionalContext({aiAdoptionContext:[{...entry,approvedBy:''}]}));
  assert.throws(()=>optionalContext({exemplars:[entry]}));
  assert.throws(()=>optionalContext({aiAdoptionContext:[entry,entry]}));
  assert.deepEqual(optionalContext({}),[]);
});

test('role keeps private KB context out of public prose and canonical KB state', () => {
  const role=fs.readFileSync(new URL('./role.md',import.meta.url),'utf8');
  assert.match(role,/Never quote or publicly cite its prose/);
  assert.match(role,/Verify public factual claims with appropriate external evidence/);
  assert.match(role,/Do not write back to the Knowledge Base/);
});

test('independent evaluation excludes prior scratchpad without altering it', () => {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'dfw-scratch-test-')));
  const p=writePrivate(root,'scratchpad/old.json','{"entries":["Prior experimental discovery"]}');
  assert.equal(scratchpadCandidates(root).length,1);
  assert.deepEqual(scratchpadCandidates(root,'disabled'),[]);
  assert.equal(fs.readFileSync(p,'utf8'),'{"entries":["Prior experimental discovery"]}');
  assert.throws(()=>scratchpadCandidates(root,'typo'));
});

test('controller has no publishing imports, baseline reads, or mutation commands', () => {
  const source=fs.readFileSync(new URL('./agent.mjs',import.meta.url),'utf8');
  assert.ok(!source.includes('review-packet.json'));
  assert.ok(!source.includes('loop1-16-result'));
  assert.ok(!source.includes("['commit'"));
  assert.ok(!source.includes("['issue', 'edit'"));
  assert.ok(!source.includes('backlog-process.mjs'));
});
