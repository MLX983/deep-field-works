#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const root = process.cwd();
const fixtureRoot = path.join(root, 'scripts/fixtures/loop3');
const readinessFixtureRoot = path.join(
  root,
  'scripts/fixtures/loop2-readiness',
);
const adversarialFixtureRoot = path.join(
  root,
  'scripts/fixtures/loop2-adversarial',
);
const schemaPath = path.join(
  root,
  'docs/contracts/loop2-development-packet.v1.schema.json',
);
const runnerPath = path.join(root, 'scripts/loop2-development-packet.mjs');

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dfw-loop2-prototype-'));

try {
  const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
  const expectedPacket = JSON.parse(
    await fs.readFile(
      path.join(fixtureRoot, 'packet-ready-prototype-note.json'),
      'utf8',
    ),
  );
  const recommendation = JSON.parse(
    await fs.readFile(
      path.join(fixtureRoot, 'recommendation-ready-prototype-note.json'),
      'utf8',
    ),
  );
  const reviewFlagCases = JSON.parse(
    await fs.readFile(
      path.join(readinessFixtureRoot, 'review-flag-cases.json'),
      'utf8',
    ),
  );

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  assert.equal(
    validate(expectedPacket),
    true,
    `Tracked prototype packet fixture must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
  );

  const validOut = path.join(tempRoot, 'valid');
  const validRun = await runNode([
    runnerPath,
    '--issue',
    path.join(fixtureRoot, 'issue-ready-prototype-note.md'),
    '--recommendation',
    path.join(fixtureRoot, 'recommendation-ready-prototype-note.json'),
    '--out-dir',
    validOut,
  ]);
  assert.equal(validRun.code, 0, validRun.stderr || validRun.stdout);

  const generatedPacketPath = path.join(validOut, 'loop2-9601-packet.json');
  const generatedPacket = JSON.parse(
    await fs.readFile(generatedPacketPath, 'utf8'),
  );
  assert.equal(
    validate(generatedPacket),
    true,
    `Generated prototype packet must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
  );
  assert.equal(
    Object.hasOwn(generatedPacket, 'blockingCondition'),
    false,
    'Ready prototype packet must omit blockingCondition',
  );
  assert.deepEqual(
    generatedPacket.verifiedObservations,
    [
      'A review control is difficult to use when pending actions and their approval states are separated.',
    ],
    'Proposed, unimplemented, and untested prototype behavior must not become verified observation',
  );
  assert.equal(generatedPacket.approvedArtifactType, 'prototype-note');
  assert.deepEqual(generatedPacket.prototypeNote, expectedPacket.prototypeNote);
  assert.match(generatedPacket.prototypeNote.currentState, /proposed interaction/);
  assert.match(generatedPacket.prototypeNote.currentState, /not been implemented or tested/);
  assert.match(generatedPacket.prototypeNote.currentState, /too early to know/);
  await fs.access(path.join(validOut, 'loop2-9601-summary.md'));
  console.log('PASS valid-prototype-note: generated packet is schema-valid');

  for (const [expectedReadiness, expectedCode, cases] of [
    ['ready', 0, reviewFlagCases.nonBlocking],
    ['research-required', 2, reviewFlagCases.blocking],
  ]) {
    for (const fixture of cases) {
      const caseRecommendationPath = path.join(
        tempRoot,
        `recommendation-${fixture.name}.json`,
      );
      await fs.writeFile(
        caseRecommendationPath,
        `${JSON.stringify({
          ...recommendation,
          uncertaintyOrReviewFlag: fixture.flag,
        }, null, 2)}\n`,
      );

      const caseOut = path.join(tempRoot, `review-flag-${fixture.name}`);
      const caseRun = await runNode([
        runnerPath,
        '--issue',
        path.join(fixtureRoot, 'issue-ready-prototype-note.md'),
        '--recommendation',
        caseRecommendationPath,
        '--out-dir',
        caseOut,
      ]);
      assert.equal(
        caseRun.code,
        expectedCode,
        `${fixture.name}: ${caseRun.stderr || caseRun.stdout}`,
      );

      const casePacket = JSON.parse(
        await fs.readFile(path.join(caseOut, 'loop2-9601-packet.json'), 'utf8'),
      );
      assert.equal(
        validate(casePacket),
        true,
        `${fixture.name}: packet must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
      );
      assert.equal(casePacket.draftReadiness, expectedReadiness, fixture.name);
      assert.equal(
        casePacket.prototypeNote.currentState,
        expectedPacket.prototypeNote.currentState,
        `${fixture.name}: current-state grounding must be preserved`,
      );
      await fs.access(path.join(caseOut, 'loop2-9601-summary.md'));
      console.log(
        `PASS review-flag-${fixture.name}: ${expectedReadiness}`,
      );
    }
  }

  const missingRecommendationPath = path.join(
    tempRoot,
    'recommendation-missing-grounding.json',
  );
  await fs.writeFile(
    missingRecommendationPath,
    `${JSON.stringify({ ...recommendation, issueNumber: 9602 }, null, 2)}\n`,
  );
  const invalidOut = path.join(tempRoot, 'invalid');
  const invalidRun = await runNode([
    runnerPath,
    '--issue',
    path.join(fixtureRoot, 'issue-missing-prototype-grounding.md'),
    '--recommendation',
    missingRecommendationPath,
    '--out-dir',
    invalidOut,
  ]);
  assert.equal(invalidRun.code, 1, invalidRun.stderr || invalidRun.stdout);
  assert.match(invalidRun.stderr, /interactionGroups/);
  assert.match(invalidRun.stderr, /currentState/);

  const invalidFiles = await fs.readdir(invalidOut).catch(() => []);
  assert.deepEqual(
    invalidFiles,
    [],
    'Incomplete grounding must write no packet or summary',
  );
  console.log(
    'PASS missing-prototype-grounding: named all missing fields and wrote no output',
  );

  const nonPrototypeCases = [
    {
      name: 'ready-note',
      issue: 'issue-ready-note.md',
      recommendation: 'recommendation-ready-note.json',
      issueNumber: 9103,
      expectedCode: 0,
      expectedReadiness: 'ready',
    },
    {
      name: 'verification-concepts',
      issue: 'issue-verification-concepts.md',
      recommendation: 'recommendation-verification-concepts.json',
      issueNumber: 9113,
      expectedCode: 0,
      expectedReadiness: 'ready',
    },
    {
      name: 'developed-conceptual-note',
      issue: 'issue-developed-conceptual-note.md',
      recommendation: 'recommendation-developed-conceptual-note.json',
      issueNumber: 9115,
      expectedCode: 0,
      expectedReadiness: 'ready',
    },
    {
      name: 'development-material-missing',
      issue: 'issue-development-material-missing.md',
      recommendation: 'recommendation-development-material-missing.json',
      issueNumber: 9116,
      expectedCode: 2,
      expectedReadiness: 'insufficient-material',
    },
    {
      name: 'verification-reviewed-action',
      issue: 'issue-verification-concepts.md',
      recommendation: 'recommendation-verification-reviewed-action.json',
      issueNumber: 9113,
      expectedCode: 2,
      expectedReadiness: 'research-required',
    },
    {
      name: 'verification-mixed-external',
      issue: 'issue-verification-mixed-external.md',
      recommendation: 'recommendation-verification-mixed-external.json',
      issueNumber: 9114,
      expectedCode: 2,
      expectedReadiness: 'research-required',
    },
    {
      name: 'thin-body',
      issue: 'issue-thin-body.md',
      recommendation: 'recommendation-thin-body.json',
      issueNumber: 9101,
      expectedCode: 2,
      expectedReadiness: 'insufficient-material',
    },
    {
      name: 'unverified-external',
      issue: 'issue-unverified-external.md',
      recommendation: 'recommendation-unverified-external.json',
      issueNumber: 9102,
      expectedCode: 2,
      expectedReadiness: 'research-required',
    },
    {
      name: 'research-legitimacy',
      issue: 'issue-research-legitimacy.md',
      recommendation: 'recommendation-research-legitimacy.json',
      issueNumber: 9110,
      expectedCode: 2,
      expectedReadiness: 'research-required',
    },
    {
      name: 'research-sparse',
      issue: 'issue-research-sparse.md',
      recommendation: 'recommendation-research-sparse.json',
      issueNumber: 9111,
      expectedCode: 2,
      expectedReadiness: 'research-required',
    },
    {
      name: 'research-source-question',
      issue: 'issue-unverified-external.md',
      recommendation: 'recommendation-research-source-question.json',
      issueNumber: 9102,
      expectedCode: 2,
      expectedReadiness: 'research-required',
    },
    {
      name: 'research-mixed-action-claim',
      issue: 'issue-unverified-external.md',
      recommendation: 'recommendation-research-mixed-action-claim.json',
      issueNumber: 9102,
      expectedCode: 2,
      expectedReadiness: 'research-required',
    },
    {
      name: 'research-reviewed-precedence',
      issue: 'issue-research-reviewed-precedence.md',
      recommendation: 'recommendation-research-reviewed-precedence.json',
      issueNumber: 9112,
      expectedCode: 2,
      expectedReadiness: 'research-required',
    },
  ];

  for (const fixture of nonPrototypeCases) {
    const recommendationPath = path.join(
      adversarialFixtureRoot,
      fixture.recommendation,
    );
    const caseRecommendation = JSON.parse(
      await fs.readFile(recommendationPath, 'utf8'),
    );
    const caseOut = path.join(tempRoot, `non-prototype-${fixture.name}`);
    const caseRun = await runNode([
      runnerPath,
      '--issue',
      path.join(adversarialFixtureRoot, fixture.issue),
      '--recommendation',
      recommendationPath,
      '--out-dir',
      caseOut,
    ]);
    assert.equal(
      caseRun.code,
      fixture.expectedCode,
      `${fixture.name}: ${caseRun.stderr || caseRun.stdout}`,
    );

    const casePacket = JSON.parse(
      await fs.readFile(
        path.join(caseOut, `loop2-${fixture.issueNumber}-packet.json`),
        'utf8',
      ),
    );
    const caseSummary = await fs.readFile(
      path.join(caseOut, `loop2-${fixture.issueNumber}-summary.md`),
      'utf8',
    );
    assert.equal(
      casePacket.draftReadiness,
      fixture.expectedReadiness,
      fixture.name,
    );
    assert.equal(
      validate(casePacket),
      true,
      `${fixture.name}: packet must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
    );
    if (fixture.expectedReadiness === 'ready') {
      assert.equal(
        Object.hasOwn(casePacket, 'blockingCondition'),
        false,
        `${fixture.name}: ready packet must omit blockingCondition`,
      );
    } else {
      assert.equal(
        typeof casePacket.blockingCondition,
        'string',
        `${fixture.name}: blocked packet must include a string blockingCondition`,
      );
      assert.ok(
        casePacket.blockingCondition.length > 0,
        `${fixture.name}: blockingCondition must be non-empty`,
      );
    }
    if (fixture.name === 'unverified-external') {
      assert.deepEqual(
        casePacket.verifiedObservations,
        [],
        'An external announcement awaiting research must not be labeled verified',
      );
      assert.ok(
        casePacket.sourceRequirements.some((item) =>
          /announcement/i.test(item)),
        'A protocol source must retain its reviewed announcement requirement',
      );
      assert.ok(
        casePacket.evidenceGaps.some((item) =>
          /standard authorizes/i.test(item)),
        'Grounded protocol and authorization language must remain available',
      );
      assert.ok(
        casePacket.researchPlan.claimsRequiringVerification.includes(
          'Agents could discover more tools than organizations intend to expose.',
        ),
        'An explicitly labeled unsupported source claim must remain a claim',
      );
    }
    if (fixture.name === 'verification-concepts') {
      assert.equal(casePacket.approvedArtifactType, 'note');
      assert.equal(casePacket.primaryDomain, 'Cognitive Infrastructure');
      assert.equal(
        casePacket.theme,
        'context inequality and judgment legibility',
      );
      assert.deepEqual(casePacket.verifiedObservations, []);
      assert.deepEqual(casePacket.inferences, []);
      assert.deepEqual(casePacket.speculation, []);
      assert.deepEqual(casePacket.sourceRequirements, []);
      assert.equal(Object.hasOwn(casePacket, 'researchPlan'), false);
      assert.equal(Object.hasOwn(casePacket, 'blockingCondition'), false);
      assert.equal(Object.hasOwn(casePacket, 'combinationPlan'), false);
      assert.equal(
        casePacket.sourceSufficiency.status,
        'sufficient',
        'Conceptual verification language must not downgrade source sufficiency',
      );
      assert.ok(
        casePacket.developmentMaterial.length >= 3,
        'Conceptual source material must remain draftable without becoming verified evidence',
      );
      assert.equal(
        casePacket.evidenceGaps.some((item) =>
          /verify|verification|quotation|primary sources/i.test(item)),
        false,
        'Conceptual verification language must not create a research evidence gap',
      );
      assert.equal(
        casePacket.relatedMaterial.some((item) => item.reference === '#9113'),
        false,
        'The active conceptual source must not relate to itself',
      );
      assert.deepEqual(
        casePacket.relatedMaterial
          .filter((item) => item.role === 'related-theme')
          .map((item) => item.reference),
        [
          'src/content/field-notes/skills-half-life.md',
          'src/content/articles/my-ai-rules.md',
        ],
        'Reviewed material must remain related rather than becoming a combine target',
      );
      assert.equal(
        new Set(casePacket.relatedMaterial.map((item) => item.reference)).size,
        casePacket.relatedMaterial.length,
        'Conceptual verification packet must retain unique stable relationships',
      );
    }
    if (fixture.name === 'developed-conceptual-note') {
      assert.deepEqual(casePacket.verifiedObservations, []);
      assert.ok(casePacket.developmentMaterial.some((item) => item.role === 'mechanism'));
      assert.equal(
        casePacket.developmentMaterial.filter((item) => item.role === 'example').length,
        2,
      );
      assert.ok(casePacket.developmentMaterial.some((item) => item.role === 'hypothesis'));
      assert.ok(casePacket.developmentMaterial.some((item) => item.role === 'caution'));
      assert.ok(casePacket.developmentMaterial.every((item) =>
        ['source', 'reviewed-recommendation', 'both'].includes(item.provenance)));
    }
    if (fixture.name === 'development-material-missing') {
      assert.equal(casePacket.sourceSufficiency.status, 'partial');
      assert.equal(Object.hasOwn(casePacket, 'researchPlan'), false);
      assert.ok(casePacket.sourceSufficiency.missingElements.some((item) =>
        /approved source-grounded development material/.test(item)));
    }
    if (fixture.name === 'verification-reviewed-action') {
      assert.deepEqual(
        casePacket.sourceRequirements,
        [caseRecommendation.nextAction],
        'An explicit reviewed research action must remain authoritative',
      );
      assert.equal(
        casePacket.researchPlan.evidenceNeededForReady.includes(
          caseRecommendation.nextAction,
        ),
        true,
        'Reviewed source-specific guidance must enter the research plan',
      );
    }
    if (fixture.name === 'verification-mixed-external') {
      assert.deepEqual(
        casePacket.sourceRequirements,
        [
          'Has the cited Northstar Report methodology and dataset been checked?',
        ],
        'The explicit unresolved citation must ground the research requirement',
      );
      assert.ok(
        casePacket.researchPlan.claimsRequiringVerification.includes(
          'The Northstar Report found a forty percent increase in delegated decisions.',
        ),
        'The named unresolved external claim must remain available for verification',
      );
      assert.equal(
        /who can verify sources|verification affects trust/i.test(
          JSON.stringify({
            sourceRequirements: casePacket.sourceRequirements,
            evidenceGaps: casePacket.evidenceGaps,
            researchPlan: casePacket.researchPlan,
            blockingCondition: casePacket.blockingCondition,
          }),
        ),
        false,
        'Conceptual verification language must not be serialized as a research task',
      );
    }
    if (fixture.name === 'research-legitimacy') {
      assert.deepEqual(
        casePacket.sourceRequirements,
        [
          'Verify the cited public-opinion findings and quotation context, then locate concrete institutional examples.',
          'Confirm whether the cited survey measures adoption, trust, or legitimacy.',
        ],
        'Reviewed source-specific research direction must determine source requirements',
      );
      assert.equal(
        casePacket.sourceRequirements.includes(
          'src/content/articles/my-ai-rules.md',
        ),
        false,
        'Related material must not become a source requirement',
      );
      assert.equal(
        /protocol|standard|capability discovery|authorization|governance/i.test(
          JSON.stringify({
            sourceRequirements: casePacket.sourceRequirements,
            evidenceGaps: casePacket.evidenceGaps,
            researchPlan: casePacket.researchPlan,
            blockingCondition: casePacket.blockingCondition,
          }),
        ),
        false,
        'A non-protocol source must not inherit protocol-specific guidance',
      );
    }
    if (fixture.name === 'research-sparse') {
      assert.deepEqual(
        casePacket.sourceRequirements,
        [
          'Verify the source’s factual claims and cited evidence',
          'Confirm quotation context and attribution where applicable',
          'Locate concrete examples and contrary evidence relevant to the central argument',
          'Distinguish documented observations from interpretation and speculation',
        ],
        'A sparse research-required source must receive neutral fallback guidance',
      );
      assert.equal(
        /protocol|standard|capability discovery|authorization|governance|technical interface/i.test(
          JSON.stringify(casePacket.researchPlan),
        ),
        false,
        'Neutral fallback guidance must not assume a topic',
      );
      assert.ok(
        casePacket.blockingCondition.includes(
          'Verify the source’s factual claims and cited evidence.',
        ),
        'Unpunctuated fallback requirements must receive clean terminal punctuation',
      );
    }
    if (fixture.name === 'research-source-question') {
      assert.deepEqual(
        casePacket.sourceRequirements,
        [
          'What does the announced standard actually authorize versus merely expose?',
        ],
        'A labeled source question must supply guidance when review is not specific',
      );
      assert.equal(
        casePacket.sourceRequirements.includes('Hold this seed for research.'),
        false,
        'A non-specific reviewed action must not displace source-grounded guidance',
      );
    }
    if (fixture.name === 'research-mixed-action-claim') {
      assert.deepEqual(
        casePacket.sourceRequirements,
        [caseRecommendation.nextAction],
        'A mixed reviewed sentence must remain available as a research requirement',
      );
      assert.equal(
        casePacket.researchPlan.claimsRequiringVerification.includes(
          caseRecommendation.nextAction,
        ),
        false,
        'A mixed imperative sentence must not be copied wholesale into claims',
      );
      assert.ok(
        casePacket.researchPlan.claimsRequiringVerification.includes(
          'Agents could discover more tools than organizations intend to expose.',
        ),
        'Structurally extracted source claims must survive beside a mixed action',
      );
    }
    if (fixture.name === 'research-reviewed-precedence') {
      assert.deepEqual(
        casePacket.sourceRequirements,
        [
          'Verify the municipal survey dataset and compare documented trust outcomes with reported adoption rates.',
          'Confirm the survey sample and attribution before developing the note.',
        ],
        'Reviewed requirements must take precedence over source-level questions',
      );
      assert.equal(
        /protocol|capabilit|authorization/i.test(
          JSON.stringify(casePacket.researchPlan),
        ),
        false,
        'A source question outside the reviewed direction must not override human review',
      );
    }
    if (fixture.expectedReadiness === 'research-required') {
      assert.deepEqual(
        casePacket.sourceRequirements,
        casePacket.researchPlan.evidenceNeededForReady,
        `${fixture.name}: source requirements and research plan must stay aligned`,
      );
      assert.equal(
        new Set(casePacket.sourceRequirements).size,
        casePacket.sourceRequirements.length,
        `${fixture.name}: source requirements must be deduplicated`,
      );
      for (const reviewedAction of [
        caseRecommendation.nextAction,
        caseRecommendation.uncertaintyOrReviewFlag,
      ].filter((item) => casePacket.sourceRequirements.includes(item))) {
        assert.equal(
          casePacket.researchPlan.claimsRequiringVerification.includes(
            reviewedAction,
          ),
          false,
          `${fixture.name}: reviewed actions must not become claims`,
        );
      }
      assert.equal(
        /\.;|\?;|!;|\.\.|;;/.test(casePacket.blockingCondition),
        false,
        `${fixture.name}: blocker must not contain malformed punctuation boundaries`,
      );
      assert.match(
        casePacket.blockingCondition,
        /[.!?]$/,
        `${fixture.name}: blocker must end with terminal punctuation`,
      );
      assert.equal(
        /\.;|\?;|!;|\.\.|;;/.test(caseSummary),
        false,
        `${fixture.name}: generated summary must not contain malformed research punctuation`,
      );
      for (const item of [
        ...casePacket.researchPlan.claimsRequiringVerification,
        ...casePacket.researchPlan.evidenceNeededForReady,
      ]) {
        assert.ok(
          casePacket.evidenceGaps.includes(item),
          `${fixture.name}: evidence gaps must contain each research-plan item`,
        );
        assert.ok(
          casePacket.blockingCondition.includes(item),
          `${fixture.name}: blocking condition must describe each research-plan item`,
        );
      }
    }
    if (fixture.name === 'ready-note') {
      assert.equal(
        Object.hasOwn(casePacket, 'researchPlan'),
        false,
        'A ready packet must not receive a fallback research plan',
      );
      assert.deepEqual(casePacket.sourceRequirements, []);
      assert.equal(Object.hasOwn(casePacket, 'blockingCondition'), false);
    }
    console.log(
      `PASS non-prototype-${fixture.name}: ${fixture.expectedReadiness}`,
    );
  }

  const evidencePostureOut = path.join(tempRoot, 'evidence-posture');
  const evidencePostureRun = await runNode([
    runnerPath,
    '--issue',
    path.join(adversarialFixtureRoot, 'issue-evidence-posture.md'),
    '--recommendation',
    path.join(adversarialFixtureRoot, 'recommendation-evidence-posture.json'),
    '--out-dir',
    evidencePostureOut,
  ]);
  assert.equal(
    evidencePostureRun.code,
    0,
    evidencePostureRun.stderr || evidencePostureRun.stdout,
  );

  const evidencePosturePacket = JSON.parse(
    await fs.readFile(
      path.join(evidencePostureOut, 'loop2-9106-packet.json'),
      'utf8',
    ),
  );
  assert.equal(
    validate(evidencePosturePacket),
    true,
    `Generated evidence-posture packet must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
  );
  assert.equal(evidencePosturePacket.draftReadiness, 'ready');
  assert.deepEqual(
    evidencePosturePacket.verifiedObservations,
    [
      'During the documented fixture run, the packet writer emitted one JSON file and one Markdown summary.',
      'In the fixture run, the status panel kept the review state beside each generated action.',
      'The checked repository snapshot contains both the packet writer and its fixture runner.',
    ],
    'Only explicitly observed or verified source statements may enter verifiedObservations',
  );
  assert.deepEqual(
    evidencePosturePacket.inferences,
    [
      'A compact status panel may help reviewers distinguish completed work from work that still needs judgment.',
    ],
  );
  assert.deepEqual(
    evidencePosturePacket.speculation,
    ['A future panel could make every delegated workflow trustworthy.'],
  );
  assert.ok(
    evidencePosturePacket.unresolvedQuestions.some((item) =>
      item.includes('has not been tested') &&
      item.includes('too early to know'),
    ),
    'The reviewed uncertainty boundary must remain in serialized output',
  );
  assert.equal(
    evidencePosturePacket.verifiedObservations.some((item) =>
      /right interface|easier to trust|proposed|not been tested|not been verified|no test has been run|too early to know/i.test(item),
    ),
    false,
    'Conceptual, mixed-interpretation, proposed, untested, unverified, and premature claims must not be verified',
  );
  console.log(
    'PASS evidence-posture: serialized packet preserves observation, interpretation, speculation, and uncertainty boundaries',
  );

  const conceptualAssertionOut = path.join(tempRoot, 'conceptual-assertion');
  const conceptualAssertionRun = await runNode([
    runnerPath,
    '--issue',
    path.join(adversarialFixtureRoot, 'issue-conceptual-assertion.md'),
    '--recommendation',
    path.join(
      adversarialFixtureRoot,
      'recommendation-conceptual-assertion.json',
    ),
    '--intake-cache',
    path.join(adversarialFixtureRoot, 'related-material-cache'),
    '--out-dir',
    conceptualAssertionOut,
  ]);
  assert.equal(
    conceptualAssertionRun.code,
    2,
    conceptualAssertionRun.stderr || conceptualAssertionRun.stdout,
  );

  const conceptualAssertionPacket = JSON.parse(
    await fs.readFile(
      path.join(conceptualAssertionOut, 'loop2-9107-packet.json'),
      'utf8',
    ),
  );
  assert.equal(
    validate(conceptualAssertionPacket),
    true,
    `Generated conceptual combine-first packet must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
  );
  assert.equal(conceptualAssertionPacket.draftReadiness, 'combine-first');
  assert.equal(conceptualAssertionPacket.sourceSufficiency.status, 'partial');
  assert.deepEqual(conceptualAssertionPacket.verifiedObservations, []);
  assert.deepEqual(conceptualAssertionPacket.inferences, []);
  assert.deepEqual(conceptualAssertionPacket.speculation, []);
  assert.ok(
    conceptualAssertionPacket.combinationPlan.materialToCarryForward.some(
      (item) => item.includes('disclosure label') &&
        item.includes('control surface'),
    ),
    'Conceptual source material must remain in the existing combination plan',
  );
  assert.equal(
    conceptualAssertionPacket.sourceSufficiency.missingElements.some(
      (item) => item.includes('verified observation'),
    ),
    false,
    'A conceptual note must not require research merely to populate verifiedObservations',
  );
  console.log(
    'PASS conceptual-assertion: empty verified observations preserve sufficiency and combine carry-forward material',
  );

  const relatedSeparateOut = path.join(tempRoot, 'related-separate');
  const relatedSeparateRun = await runNode([
    runnerPath,
    '--issue',
    path.join(adversarialFixtureRoot, 'issue-related-separate.md'),
    '--recommendation',
    path.join(
      adversarialFixtureRoot,
      'recommendation-related-separate.json',
    ),
    '--intake-cache',
    path.join(adversarialFixtureRoot, 'related-material-cache'),
    '--out-dir',
    relatedSeparateOut,
  ]);
  assert.equal(
    relatedSeparateRun.code,
    2,
    relatedSeparateRun.stderr || relatedSeparateRun.stdout,
  );

  const relatedSeparatePacket = JSON.parse(
    await fs.readFile(
      path.join(relatedSeparateOut, 'loop2-9108-packet.json'),
      'utf8',
    ),
  );
  assert.equal(
    validate(relatedSeparatePacket),
    true,
    `Generated related-but-separate packet must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
  );
  assert.equal(relatedSeparatePacket.approvedArtifactType, 'seed');
  assert.equal(
    relatedSeparatePacket.primaryDomain,
    'Human-Machine Workflows',
  );
  assert.equal(
    relatedSeparatePacket.theme,
    'capability versus expertise and review burden',
  );
  assert.equal(relatedSeparatePacket.draftReadiness, 'insufficient-material');
  assert.equal(
    Object.hasOwn(relatedSeparatePacket, 'combinationPlan'),
    false,
    'Related issue identity must not create a combination plan',
  );
  assert.deepEqual(relatedSeparatePacket.verifiedObservations, []);
  assert.ok(
    relatedSeparatePacket.centralTension.includes(
      'capability-versus-judgment tension',
    ),
    'Approved rationale must provide the conceptual central tension',
  );
  assert.equal(
    relatedSeparatePacket.sourceSufficiency.missingElements.includes(
      'identifiable central tension from source material',
    ),
    false,
    'Sufficiency must recognize the approved central tension without treating it as verified evidence',
  );
  assert.equal(
    relatedSeparatePacket.sourceSufficiency.reasons.some((reason) =>
      /combin/i.test(reason)),
    false,
    'Ordinary related material must not introduce combine sufficiency reasons',
  );
  assert.equal(
    relatedSeparatePacket.sourceSufficiency.missingElements.some((item) =>
      /merge|destination/i.test(item)),
    false,
    'Ordinary related material must not introduce merge requirements',
  );
  assert.equal(
    /combine|merge/i.test(relatedSeparatePacket.blockingCondition),
    false,
    'Related-but-separate blocker must not require combination',
  );

  const issue3Entries = relatedSeparatePacket.relatedMaterial.filter(
    (item) => item.reference === '#3',
  );
  assert.equal(issue3Entries.length, 1);
  assert.equal(issue3Entries[0].role, 'related-theme');
  assert.match(issue3Entries[0].note, /not a combine target/);
  assert.equal(
    relatedSeparatePacket.relatedMaterial.some(
      (item) => item.reference === '#9108',
    ),
    false,
    'Active source issue must not relate to itself',
  );
  assert.equal(
    relatedSeparatePacket.relatedMaterial.some(
      (item) => item.reference.includes('related-material-cache'),
    ),
    false,
    'Known cached issues must serialize with stable issue identity, not cache paths',
  );
  assert.ok(
    relatedSeparatePacket.relatedMaterial.some(
      (item) =>
        item.reference === 'src/content/field-notes/skills-half-life.md' &&
        item.role === 'related-theme',
    ),
    'Repository artifact references must preserve their stable repository path',
  );
  assert.equal(
    relatedSeparatePacket.nextAction,
    'Preserve this as a separate seed linked to Issue #3 and Skills half-life.',
  );
  console.log(
    'PASS related-separate: exact issue identity remains related, central tension is consistent, and cached paths are portable',
  );

  const selfSourceRecommendationPath = path.join(
    tempRoot,
    'recommendation-self-source.json',
  );
  await fs.writeFile(
    selfSourceRecommendationPath,
    `${JSON.stringify({
      contractVersion: 'loop1-reviewed-recommendation.v1',
      issueNumber: 3,
      disposition: 'preserve as seed',
      suggestedArtifact: 'seed',
      primaryDomain: 'Institutions in Transition',
      rationale:
        'The management-role question remains a separate seed related to, but not combined with, Issue #22.',
      relatedMaterial: [
        {
          reference: '#22',
          note: 'Related field record, not a combine target.',
        },
      ],
      nextAction: 'Preserve the source as a separate seed.',
      humanApprovalStatus: 'approved',
    }, null, 2)}\n`,
  );
  const selfSourceOut = path.join(tempRoot, 'self-source');
  const selfSourceRun = await runNode([
    runnerPath,
    '--issue',
    path.join(
      adversarialFixtureRoot,
      'related-material-cache',
      '0003-changing-management-roles.md',
    ),
    '--recommendation',
    selfSourceRecommendationPath,
    '--intake-cache',
    path.join(adversarialFixtureRoot, 'related-material-cache'),
    '--out-dir',
    selfSourceOut,
  ]);
  assert.equal(
    selfSourceRun.code,
    2,
    selfSourceRun.stderr || selfSourceRun.stdout,
  );
  const selfSourcePacket = JSON.parse(
    await fs.readFile(
      path.join(selfSourceOut, 'loop2-3-packet.json'),
      'utf8',
    ),
  );
  assert.equal(
    selfSourcePacket.relatedMaterial.some(
      (item) => item.reference === '#3',
    ),
    false,
    'An issue read directly from the intake cache must remain excluded from its own related material',
  );
  console.log(
    'PASS self-source: stable cached identity serialization does not reintroduce the active issue',
  );

  const relatedMaterialOut = path.join(tempRoot, 'related-material-dedup');
  const relatedMaterialRun = await runNode([
    runnerPath,
    '--issue',
    path.join(adversarialFixtureRoot, 'issue-related-material-dedup.md'),
    '--recommendation',
    path.join(
      adversarialFixtureRoot,
      'recommendation-related-material-dedup.json',
    ),
    '--intake-cache',
    path.join(adversarialFixtureRoot, 'related-material-cache'),
    '--out-dir',
    relatedMaterialOut,
  ]);
  assert.equal(
    relatedMaterialRun.code,
    2,
    relatedMaterialRun.stderr || relatedMaterialRun.stdout,
  );

  const relatedMaterialPacket = JSON.parse(
    await fs.readFile(
      path.join(relatedMaterialOut, 'loop2-9105-packet.json'),
      'utf8',
    ),
  );
  assert.equal(
    validate(relatedMaterialPacket),
    true,
    `Generated combine-first packet must pass Loop 2 schema: ${ajv.errorsText(validate.errors)}`,
  );
  assert.equal(relatedMaterialPacket.draftReadiness, 'combine-first');

  const issue21Entries = relatedMaterialPacket.relatedMaterial.filter(
    (item) => item.reference === '#21',
  );
  assert.equal(
    issue21Entries.length,
    1,
    'Resolved target and reviewed recommendation must produce one #21 entry',
  );
  assert.equal(issue21Entries[0].role, 'combine-target');
  assert.equal(
    issue21Entries[0].note,
    'The established cluster supplies the operating context and evaluation boundary.',
    'Preferred entry must retain the richer reviewed-recommendation note without repeating the cached title',
  );
  assert.deepEqual(
    Object.keys(issue21Entries[0]).sort(),
    ['note', 'reference', 'role'],
    'Internal identity and precedence metadata must not reach packet output',
  );

  const similarTitleIssueEntries = relatedMaterialPacket.relatedMaterial.filter(
    (item) => item.reference === '#21' || item.reference === '#22',
  );
  assert.deepEqual(
    similarTitleIssueEntries.map((item) => item.reference),
    ['#21', '#22'],
    'Distinct issue identities must remain despite overlapping titles',
  );
  assert.match(
    similarTitleIssueEntries[1].note,
    /distinct field record/,
  );
  assert.equal(
    similarTitleIssueEntries[1].role,
    'related-theme',
    'Only the explicit target may receive combine-target role',
  );
  assert.equal(
    relatedMaterialPacket.combinationPlan.targetReference,
    '#21',
  );
  assert.equal(
    relatedMaterialPacket.sourceSufficiency.reasons.some((reason) =>
      /combined/i.test(reason)),
    true,
    'Genuine combine recommendation must retain its combine requirement',
  );
  assert.equal(
    relatedMaterialPacket.relatedMaterial.some(
      (item) => item.reference.includes('related-material-cache'),
    ),
    false,
    'Ranked cached issues must serialize as stable #N identities',
  );
  console.log(
    'PASS related-material-dedup: merged duplicate issue identity and preserved distinct similar title',
  );

  const ambiguousRecommendationPath = path.join(
    tempRoot,
    'recommendation-ambiguous-combine.json',
  );
  const ambiguousRecommendation = JSON.parse(
    await fs.readFile(
      path.join(
        adversarialFixtureRoot,
        'recommendation-related-material-dedup.json',
      ),
      'utf8',
    ),
  );
  delete ambiguousRecommendation.combineTargetReference;
  await fs.writeFile(
    ambiguousRecommendationPath,
    `${JSON.stringify(ambiguousRecommendation, null, 2)}\n`,
  );
  const ambiguousOut = path.join(tempRoot, 'ambiguous-combine');
  const ambiguousRun = await runNode([
    runnerPath,
    '--issue',
    path.join(adversarialFixtureRoot, 'issue-related-material-dedup.md'),
    '--recommendation',
    ambiguousRecommendationPath,
    '--intake-cache',
    path.join(adversarialFixtureRoot, 'related-material-cache'),
    '--out-dir',
    ambiguousOut,
  ]);
  assert.equal(ambiguousRun.code, 1);
  assert.match(
    ambiguousRun.stderr,
    /multiple issue references requires combineTargetReference/,
  );
  assert.deepEqual(
    await fs.readdir(ambiguousOut).catch(() => []),
    [],
    'Ambiguous combine recommendation must write no packet or summary',
  );
  console.log(
    'PASS ambiguous-combine: multiple related issues require an explicit target',
  );
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
