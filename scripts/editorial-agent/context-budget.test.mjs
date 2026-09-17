import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EDITORIAL_CONTEXT_CHARS, buildBoundedEditorialContext, editorialContextPromptView, parseContextBudget } from './context-budget.mjs';

function source(overrides = {}) {
  return {
    id: 'src/content/articles/example.md',
    canonicalId: 'source:stable-content-hash',
    aliases: ['src/content/articles/example.md'],
    title: 'Delegated work',
    body: '# Opening\n\n' + 'Delegated work requires visible recovery and clear authority. '.repeat(140) + '\n\n## Failure\n\n' + 'Silence hides the state of unfinished work. '.repeat(140),
    kind: 'DFW context, not approved exemplar',
    roles: ['ordinary context'],
    selectionReason: 'It sharpens the question of recovery.',
    provenance: { path: 'src/content/articles/example.md', sha256: 'a'.repeat(64) },
    provenanceRecords: [{ id: 'src/content/articles/example.md', kind: 'DFW context, not approved exemplar', provenance: { path: 'src/content/articles/example.md' } }],
    ...overrides,
  };
}

test('long selected sources become bounded passages with stable identity and provenance', () => {
  const selected = [source()];
  const result = buildBoundedEditorialContext({ seed: 'An assistant silently stopped delegated work.', selectedSources: selected, editorialQuestions: ['How should recovery become visible?'], budgetChars: 6_000, candidateCount: 22 });
  assert.equal(result.candidateCount, 22);
  assert.equal(result.selectedSourceCount, 1);
  assert.ok(result.availableSelectedSourceChars > result.suppliedContextChars);
  assert.ok(result.suppliedContextChars <= 6_000);
  assert.ok(result.excludedPassages.length > 0);
  assert.ok(result.omittedBecauseBudgetChars > 0);
  assert.equal(result.includedPassages[0].canonicalId, selected[0].canonicalId);
  assert.equal(result.includedPassages[0].sourceSha256, 'a'.repeat(64));
  assert.equal(result.includedPassages[0].provenance.path, 'src/content/articles/example.md');
  assert.ok(result.includedPassages[0].heading);
  const prompt = editorialContextPromptView(result);
  assert.equal(prompt[0].canonicalId, selected[0].canonicalId);
  assert.equal(prompt[0].sourceSha256, 'a'.repeat(64));
  assert.ok(!('provenance' in prompt[0]));
});

test('budget selection does not force a KB or exemplar category', () => {
  const dfw = source({ body: 'Recovery authority and visible unfinished work. '.repeat(70) });
  const kb = source({ id: 'kb:unrelated', canonicalId: 'section:kb:1', title: 'Unrelated taxonomy', body: 'Procurement categories and market segments. '.repeat(70), kind: 'ai-adoption-read-only-export', roles: ['KB context'], provenance: { sourceSha256: 'b'.repeat(64), sectionHeading: 'Taxonomy' } });
  const result = buildBoundedEditorialContext({ seed: 'Recovery authority for unfinished delegated work', selectedSources: [dfw, kb], budgetChars: 3_500 });
  assert.ok(result.includedSources.some(item => item.canonicalId === dfw.canonicalId));
  assert.ok(!result.includedSources.some(item => item.canonicalId === kb.canonicalId));
  assert.ok(result.excludedSources.some(item => item.canonicalId === kb.canonicalId));
});

test('context budget defaults, operator override, and invalid values are explicit', () => {
  assert.equal(parseContextBudget(), DEFAULT_EDITORIAL_CONTEXT_CHARS);
  assert.equal(parseContextBudget('32000'), 32_000);
  const result = buildBoundedEditorialContext({ seed: 'seed', selectedSources: [], budgetChars: 32_000, operatorOverrideUsed: true });
  assert.equal(result.configuredBudgetChars, 32_000);
  assert.equal(result.operatorOverrideUsed, true);
  assert.equal(result.selectedSourceCount, 0);
  assert.equal(result.suppliedContextChars, 0);
  for (const value of ['0', '999', '1.5', '-1', 'nope', '250001']) assert.throws(() => parseContextBudget(value));
});

test('private KB boundary metadata survives excerpting without changing source content', () => {
  const original = source({ id: 'kb:authority', canonicalId: 'section:kbhash:2:sectionhash', kind: 'ai-adoption-read-only-export', roles: ['KB context'], provenance: { source: 'Approved private export', sourceSha256: 'c'.repeat(64), sectionHeading: 'Authority', sectionIndex: 2, sectionSha256: 'd'.repeat(64) } });
  const before = original.body;
  const result = buildBoundedEditorialContext({ seed: 'delegated authority', selectedSources: [original], budgetChars: 4_000 });
  assert.equal(original.body, before);
  assert.equal(result.includedPassages[0].provenance.sectionHeading, 'Authority');
  assert.equal(result.includedPassages[0].canonicalId, original.canonicalId);
  assert.equal(result.includedPassages[0].sourceSha256, 'c'.repeat(64));
});
