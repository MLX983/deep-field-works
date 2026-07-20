#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildCandidate,
  likelyDuplicateOrSelfSource,
  parseIssue,
  rankCandidates,
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
assert.equal(repositoryScore.score, 285);
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
console.log('PASS generic-resistance: cache-envelope repetition contributes zero');
console.log('PASS existing-behavior: duplicate detection, deterministic top five, evaluator shape');
console.log(
  `SCORES ${JSON.stringify({
    bodyMatch: bodyMatchScore,
    genericEnvelope: genericScore,
    repositoryArtifact: repositoryScore,
    ranked: ranked.map(({ path: candidatePath, score }) => ({
      path: candidatePath,
      score,
    })),
  })}`,
);
