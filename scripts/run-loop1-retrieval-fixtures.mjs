#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  activeQueryFields,
  buildCandidate,
  callModel,
  likelyDuplicateOrSelfSource,
  normalizeLoop1ResultMarkdown,
  parseIssue,
  rankCandidates,
  retrievalQuery,
  scoreCandidate,
  semanticIssueTitle,
  toModelMatch,
} from './loop1-intake-understanding.mjs';

const root = process.cwd();
const fixtureRoot = path.join(root, 'scripts/fixtures/loop1-retrieval');
const fixturePath = (name) => path.join(fixtureRoot, name);

const issueSummary = parseIssue(
  await fs.readFile(fixturePath('active-issue.md'), 'utf8'),
  fixturePath('active-issue.md'),
);
const proposal = {
  documentType: 'note',
  domainPath: ['Interfaces for Judgment'],
  theme: 'agent evaluation',
  recommendedAction: 'develop as note',
};

const titleCasedResult = await fs.readFile(
  fixturePath('title-cased-loop1-result.md'),
  'utf8',
);
const normalizedResult = normalizeLoop1ResultMarkdown(titleCasedResult);
assert.match(normalizedResult, /^\*\*Recommendation:\*\* combine with other material$/m);
assert.match(normalizedResult, /^\*\*Document type:\*\* seed$/m);
assert.match(normalizedResult, /^\*\*Confidence:\*\* medium$/m);
assert.match(normalizedResult, /^\*\*Primary domain:\*\* Cognitive Infrastructure$/m);
assert.match(normalizedResult, /^\*\*Result:\*\* REVISE$/m);
assert.equal(normalizeLoop1ResultMarkdown(normalizedResult), normalizedResult);
assert.throws(
  () => normalizeLoop1ResultMarkdown(
    titleCasedResult.replace('Combine with other material', 'Combine With Other Material'),
  ),
  /invalid Recommendation: Combine With Other Material/,
);

const originalCodexBin = process.env.CODEX_BIN;
const missingCodexBin = path.join(
  '/tmp',
  'dfw-fixture-executable-that-does-not-exist',
);
process.env.CODEX_BIN = missingCodexBin;
try {
  assert.throws(
    () => callModel('proposal', { issueSummary }),
    (error) => {
      assert.equal(error.code, 'ENOENT');
      assert.equal(error.executable, missingCodexBin);
      assert.equal(error.category, 'executable-not-found');
      assert.match(error.message, /Codex executable not found/);
      assert.match(error.message, /ENOENT/);
      assert.match(error.message, /inherited PATH/);
      assert.equal(error.message.includes('logged in and has network access'), false);
      return true;
    },
  );
} finally {
  if (originalCodexBin === undefined) delete process.env.CODEX_BIN;
  else process.env.CODEX_BIN = originalCodexBin;
}

const candidateFiles = [
  'issue-body-match.md',
  'issue-distinct-boundary.md',
  'issue-distinct-ledger.md',
  'issue-generic-envelope.md',
  'issue-self-source.md',
  'repository-artifact.md',
];
const candidates = await Promise.all(
  candidateFiles.map((name) => buildCandidate(fixturePath(name))),
);
const byName = new Map(
  candidateFiles.map((name, index) => [name, candidates[index]]),
);

assert.equal(
  semanticIssueTitle('[DFW Intake] Agent evaluation loop'),
  'Agent evaluation loop',
);
assert.equal(
  semanticIssueTitle('Issue #21: [DFW Intake] Agent evaluation loop'),
  'Agent evaluation loop',
);
assert.equal(
  semanticIssueTitle('[DFW Intake] Issue #21: Agent evaluation loop'),
  'Agent evaluation loop',
);
assert.equal(
  semanticIssueTitle('An issue in agent evaluation'),
  'An issue in agent evaluation',
  'Ordinary editorial titles must not be broadly rewritten',
);
assert.equal(
  semanticIssueTitle('Issue framing: DFW Intake remains editorial context'),
  'Issue framing: DFW Intake remains editorial context',
);
assert.equal(
  semanticIssueTitle('Intake protocols: preserve punctuation?'),
  'Intake protocols: preserve punctuation?',
);
assert.equal(
  semanticIssueTitle('DFW field note: permissions & control'),
  'DFW field note: permissions & control',
);
assert.equal(
  semanticIssueTitle("[DFW Intake] Tools don't equal talent: skills & leverage?"),
  "Tools don't equal talent: skills & leverage?",
);

const activeFields = activeQueryFields(issueSummary, proposal);
assert.deepEqual(
  activeFields.map(({ name, weight }) => [name, weight]),
  [
    ['semanticTitle', 4],
    ['substantiveBody', 2],
    ['documentType', 1],
    ['theme', 1],
    ['recommendedAction', 1],
    ['domainPath', 1],
  ],
  'Equivalent title/subject and excerpt/raw-body fields must be represented once',
);

const exactTitleQuery = retrievalQuery(
  {
    ...issueSummary,
    title: 'Content   idea',
    subject: 'content idea',
    bodyExcerpt: 'Evaluation evidence',
    rawBody: 'Evaluation evidence',
  },
  {},
);
assert.equal(exactTitleQuery.get('content'), 4);
assert.equal(exactTitleQuery.get('idea'), 4);

const wrappedTitleQuery = retrievalQuery(
  {
    ...issueSummary,
    title: 'Issue #9810: [DFW Intake] Content idea',
    subject: 'Content idea',
    bodyExcerpt: 'Evaluation evidence',
    rawBody: 'Evaluation evidence',
  },
  {},
);
assert.equal(wrappedTitleQuery.get('content'), 4);
assert.equal(wrappedTitleQuery.get('idea'), 4);
assert.equal(wrappedTitleQuery.has('dfw'), false);
assert.equal(wrappedTitleQuery.has('intake'), false);
assert.equal(wrappedTitleQuery.has('issue'), false);

const distinctTitleFields = activeQueryFields(
  {
    ...issueSummary,
    title: 'Tools do not equal talent',
    subject: 'Skills and leverage',
    bodyExcerpt: 'Evaluation evidence',
    rawBody: 'Evaluation evidence',
  },
  {},
);
assert.deepEqual(
  distinctTitleFields.slice(0, 2).map(({ name, text, weight }) => ({
    name,
    text,
    weight,
  })),
  [
    { name: 'semanticTitle', text: 'Tools do not equal talent', weight: 4 },
    { name: 'subject', text: 'Skills and leverage', weight: 3 },
  ],
);

const exactBodyFields = activeQueryFields(
  {
    ...issueSummary,
    title: 'Evidence boundary',
    subject: 'Evidence boundary',
    bodyExcerpt: 'Measured result',
    rawBody: 'Measured result',
  },
  {},
);
assert.deepEqual(
  exactBodyFields.filter(({ name }) => /Body|body/.test(name)),
  [{ name: 'substantiveBody', text: 'Measured result', weight: 2 }],
);

const fullPrefixBody = `${'Measured result remains bounded. '.repeat(30)}Final observation.`;
const prefixBodyFields = activeQueryFields(
  {
    ...issueSummary,
    title: 'Evidence boundary',
    subject: 'Evidence boundary',
    bodyExcerpt: fullPrefixBody.slice(0, 700),
    rawBody: fullPrefixBody,
  },
  {},
);
assert.deepEqual(
  prefixBodyFields.filter(({ name }) => /Body|body/.test(name)),
  [{ name: 'substantiveBody', text: fullPrefixBody, weight: 2 }],
  'A truncated prefix must resolve to one complete substantive body',
);

const distinctBodyFields = activeQueryFields(
  {
    ...issueSummary,
    title: 'Evidence boundary',
    subject: 'Evidence boundary',
    bodyExcerpt: 'Direct observation',
    rawBody: 'Separate structured source note',
  },
  {},
);
assert.deepEqual(
  distinctBodyFields.filter(({ name }) => /Body|body/.test(name)),
  [
    { name: 'bodyExcerpt', text: 'Direct observation', weight: 2 },
    { name: 'rawBody', text: 'Separate structured source note', weight: 1 },
  ],
  'Genuinely distinct source fields must retain their existing field weights',
);

const sharedOpeningBodyFields = activeQueryFields(
  {
    ...issueSummary,
    title: 'Evidence boundary',
    subject: 'Evidence boundary',
    bodyExcerpt: 'Control',
    rawBody: 'Control systems require explicit permission boundaries.',
  },
  {},
);
assert.deepEqual(
  sharedOpeningBodyFields.filter(({ name }) => /Body|body/.test(name)),
  [
    { name: 'bodyExcerpt', text: 'Control', weight: 2 },
    {
      name: 'rawBody',
      text: 'Control systems require explicit permission boundaries.',
      weight: 1,
    },
  ],
  'A short structured field must not be collapsed merely because it prefixes another field',
);

const repeatedBodyQuery = retrievalQuery(
  {
    ...issueSummary,
    title: 'Evidence boundary',
    subject: 'Evidence boundary',
    bodyExcerpt: 'Judgment judgment',
    rawBody: 'Judgment judgment',
  },
  {},
);
assert.equal(
  repeatedBodyQuery.get('judgment'),
  4,
  'Internal repetition within one substantive body must retain ordinary term frequency',
);

const bodyMatch = byName.get('issue-body-match.md');
assert.match(bodyMatch.issueMetadata.bodyExcerpt, /^Teams use evaluation rubrics/);
assert.doesNotMatch(
  bodyMatch.issueMetadata.bodyExcerpt,
  /Number|URL|Email ID|Original subject|Raw capture/,
  'Substantive body extraction must exclude the cache envelope',
);

const bodyMatchScore = scoreCandidate(issueSummary, proposal, bodyMatch);
assert.deepEqual(
  Object.keys(bodyMatchScore.scoreByField),
  ['semanticTitle', 'substantiveBody'],
  'Cached issues must have exactly one title field and one body field',
);
assert.ok(
  bodyMatchScore.scoreByField.substantiveBody > 0,
  'Substantive cached-issue body text must contribute to retrieval score',
);
assert.deepEqual(
  bodyMatchScore.matchedTerms.filter((term) =>
    ['dfw', 'intake', 'issue', '9800', '9801'].includes(term)),
  [],
  'Transport wrappers and issue numbers must not contribute matched terms',
);
assert.equal(bodyMatchScore.bonuses, 0, 'Cached issues must receive no title bonus');
assert.equal(bodyMatchScore.penalties, 0);

const repeatedTitleCopies = {
  ...bodyMatch,
  metadata: {
    ...bodyMatch.metadata,
    title: '[DFW Intake] Permission record Permission record Permission record',
  },
  issueMetadata: {
    ...bodyMatch.issueMetadata,
    title: '[DFW Intake] Permission record Permission record Permission record',
  },
};
assert.deepEqual(
  scoreCandidate(issueSummary, proposal, repeatedTitleCopies),
  bodyMatchScore,
  'Duplicate cache title representations must not amplify title evidence',
);

const withoutSubstantiveBody = {
  ...bodyMatch,
  issueMetadata: { ...bodyMatch.issueMetadata, bodyExcerpt: '' },
};
assert.ok(
  bodyMatchScore.score >
    scoreCandidate(issueSummary, proposal, withoutSubstantiveBody).score,
  'Removing substantive body overlap must reduce the score',
);

const genericEnvelope = byName.get('issue-generic-envelope.md');
const genericScore = scoreCandidate(issueSummary, proposal, genericEnvelope);
assert.equal(genericScore.score, 0);
assert.deepEqual(genericScore.matchedTerms, []);
assert.ok(
  bodyMatchScore.score > genericScore.score,
  'Repeated transport metadata must not outrank substantive overlap',
);

const genericIssueSummary = parseIssue(
  await fs.readFile(fixturePath('active-generic-title.md'), 'utf8'),
  fixturePath('active-generic-title.md'),
);
const genericTitleCandidate = await buildCandidate(
  fixturePath('issue-generic-title.md'),
);
const genericRanking = rankCandidates(
  genericIssueSummary,
  proposal,
  [genericTitleCandidate, bodyMatch],
);
assert.ok(
  genericRanking[0].path.endsWith('issue-body-match.md'),
  'A duplicated generic query title must not outrank stronger substantive-body overlap',
);

const boundary = byName.get('issue-distinct-boundary.md');
const ledger = byName.get('issue-distinct-ledger.md');
assert.notEqual(
  semanticIssueTitle(boundary.issueMetadata.title),
  semanticIssueTitle(ledger.issueMetadata.title),
);
assert.ok(scoreCandidate(issueSummary, proposal, boundary).score > 0);
assert.ok(scoreCandidate(issueSummary, proposal, ledger).score > 0);

const selfSource = byName.get('issue-self-source.md');
assert.equal(likelyDuplicateOrSelfSource(issueSummary, selfSource), true);

const ranked = rankCandidates(issueSummary, proposal, candidates);
const rankedAgain = rankCandidates(issueSummary, proposal, [...candidates].reverse());
assert.deepEqual(
  ranked.map(({ path: candidatePath, score }) => [candidatePath, score]),
  rankedAgain.map(({ path: candidatePath, score }) => [candidatePath, score]),
  'Top-five output must be deterministic regardless of corpus input order',
);
assert.equal(ranked.length, 5);
assert.ok(ranked.some(({ path: candidatePath }) => candidatePath.endsWith('issue-distinct-boundary.md')));
assert.ok(ranked.some(({ path: candidatePath }) => candidatePath.endsWith('issue-distinct-ledger.md')));
assert.equal(
  ranked.find(({ path: candidatePath }) => candidatePath.endsWith('issue-self-source.md'))
    ?.relationType,
  'likely-duplicate-or-self-source',
);
assert.ok(
  !ranked.some(({ path: candidatePath }) => candidatePath.endsWith('issue-generic-envelope.md')),
  'Generic zero-overlap cache envelope must not enter the top five',
);

const modelMatch = toModelMatch(ranked[0]);
assert.deepEqual(Object.keys(modelMatch), [
  'path',
  'score',
  'relationType',
  'title',
  'description',
  'documentType',
  'theme',
  'status',
  'domainPath',
  'relatedConcepts',
  'headings',
  'excerpt',
  'sections',
  'matchedTerms',
]);
assert.equal(
  Object.hasOwn(modelMatch, 'scoreByField'),
  false,
  'Fixture diagnostics must not enter evaluator input',
);

const repositoryArtifact = byName.get('repository-artifact.md');
const repositoryScore = scoreCandidate(issueSummary, proposal, repositoryArtifact);
assert.deepEqual(repositoryScore.scoreByField, {
  title: 35,
  description: 40,
  documentType: 4,
  theme: 28,
  domainPath: 4,
  relatedConcepts: 14,
  headings: 14,
  excerpt: 34,
  sections: 17,
});
assert.deepEqual(Object.keys(repositoryScore.scoreByField), [
  'title',
  'description',
  'documentType',
  'theme',
  'domainPath',
  'relatedConcepts',
  'headings',
  'excerpt',
  'sections',
]);

console.log('PASS wrapper-normalization: transport prefixes do not contribute');
console.log('PASS cached-representation: one semantic title and one substantive body');
console.log('PASS active-query-representation: exact title and body overlap contributes once');
console.log('PASS generic-resistance: cache-envelope repetition contributes zero');
console.log('PASS existing-behavior: duplicate detection, deterministic top five, evaluator shape');
console.log('PASS subprocess-diagnostics: missing Codex executable preserves ENOENT and executable');
console.log('PASS result-vocabulary: fixed fields normalize to exact canonical casing');
console.log(
  `SCORES ${JSON.stringify({
    bodyMatch: bodyMatchScore,
    genericEnvelope: genericScore,
    genericTitleRanking: genericRanking.map(({ path: candidatePath, score }) => ({
      path: candidatePath,
      score,
    })),
    query: Object.fromEntries(retrievalQuery(issueSummary, proposal)),
    repositoryArtifact: repositoryScore,
    ranked: ranked.map(({ path: candidatePath, score }) => ({
      path: candidatePath,
      score,
    })),
  })}`,
);
