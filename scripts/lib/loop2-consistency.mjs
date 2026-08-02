import { canonicalReviewedArtifact } from './artifact-vocabulary.mjs';

const COMBINE_DISPOSITIONS = new Set([
  'combine with existing material',
  'combine with overlapping material',
]);

const PRESERVATION_DISPOSITIONS = new Set([
  'preserve as seed',
  'defer',
  'needs human judgment',
]);

function artifactLabel(artifactType) {
  return String(artifactType ?? '').replaceAll('-', ' ');
}

export function reconcileSourceSufficiency(
  sourceSufficiency,
  draftReadiness,
  disposition,
) {
  const reconciled = {
    ...sourceSufficiency,
    reasons: [...(sourceSufficiency.reasons ?? [])],
    missingElements: [...(sourceSufficiency.missingElements ?? [])],
  };

  if (draftReadiness === 'ready') {
    if (reconciled.status !== 'sufficient') {
      throw new Error(
        'Loop 2 consistency error: ready requires sourceSufficiency.status = sufficient',
      );
    }
    return reconciled;
  }

  if (draftReadiness === 'research-required' && reconciled.status === 'sufficient') {
    reconciled.status = 'partial';
    reconciled.reasons.push(
      'The reviewed disposition requires evidence verification before development',
    );
    reconciled.missingElements.push(
      'evidence required by the reviewed recommendation',
    );
  }

  if (
    draftReadiness === 'insufficient-material' &&
    reconciled.status === 'sufficient'
  ) {
    reconciled.status = PRESERVATION_DISPOSITIONS.has(disposition)
      ? 'partial'
      : 'insufficient';
    reconciled.reasons.push(
      PRESERVATION_DISPOSITIONS.has(disposition)
        ? 'The reviewed disposition preserves the material without authorizing development'
        : 'The material is not sufficient for the approved development posture',
    );
    reconciled.missingElements.push(
      PRESERVATION_DISPOSITIONS.has(disposition)
        ? 'explicit later authorization before independent development'
        : 'material required for the approved development posture',
    );
  }

  return {
    ...reconciled,
    reasons: [...new Set(reconciled.reasons)],
    missingElements: [...new Set(reconciled.missingElements)],
  };
}

export function deriveAuthoritativeNarrative({
  issueNumber,
  artifactType,
  disposition,
  draftReadiness,
}) {
  const label = artifactLabel(artifactType);

  if (draftReadiness === 'combine-first') {
    return {
      readerQuestion:
        `How should material from issue #${issueNumber} support the approved combine target without becoming a standalone ${label}?`,
      recommendedStructure: [
        'Preserve the distinct source contribution as supporting material',
        'Carry forward reviewed cautions and evidence limits',
        'Do not open a standalone development path',
      ],
    };
  }

  if (draftReadiness === 'research-required') {
    return {
      readerQuestion:
        `What evidence is required before this prospective ${label} can be developed?`,
      recommendedStructure: [
        `Prospective ${label} boundary`,
        'Claims requiring verification',
        'Evidence, counterpressure, and limits',
        'Unresolved questions before development',
      ],
    };
  }

  if (
    draftReadiness === 'insufficient-material' &&
    PRESERVATION_DISPOSITIONS.has(disposition)
  ) {
    return {
      readerQuestion:
        `What should be preserved from issue #${issueNumber} without authorizing independent development?`,
      recommendedStructure: [
        'Preservation boundary',
        'Material retained as provenance or future context',
        'Related material without combination or mutation',
        'Counterpressure and unresolved questions',
      ],
    };
  }

  if (draftReadiness === 'not-for-publication') {
    return {
      readerQuestion:
        `What should remain private from issue #${issueNumber}, and why?`,
      recommendedStructure: [
        'Private retention boundary',
        'Reason publication is not authorized',
        'Material retained for internal context',
      ],
    };
  }

  if (artifactType === 'prototype-note') {
    return {
      readerQuestion: '',
      recommendedStructure: [
        'The design problem',
        'The interaction choice',
        'How the control surface is grouped',
        'Why it matters',
        'Current state',
        'Remaining questions',
      ],
    };
  }

  return {
    readerQuestion: '',
    recommendedStructure: [
      'Observation',
      'Working model',
      'Open questions',
      'Explicit uncertainty boundaries',
    ],
  };
}

function containsExact(items, value) {
  return items.some((item) => item === value);
}

export function validateLoop2Consistency(packet, recommendation) {
  const errors = [];
  const expectedNarrative = deriveAuthoritativeNarrative({
    issueNumber: packet.issueReference?.number,
    artifactType: packet.approvedArtifactType,
    disposition: recommendation.disposition,
    draftReadiness: packet.draftReadiness,
  });

  let reviewedArtifact;
  let packetArtifact;
  try {
    reviewedArtifact = canonicalReviewedArtifact(recommendation.suggestedArtifact);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    packetArtifact = canonicalReviewedArtifact(packet.approvedArtifactType);
  } catch (error) {
    errors.push(`packet ${error.message}`);
  }
  if (reviewedArtifact && packetArtifact && packetArtifact !== reviewedArtifact) {
    errors.push(
      `artifact conflict: packet=${packet.approvedArtifactType}, reviewed=${recommendation.suggestedArtifact}`,
    );
  }
  if (
    (packet.artifactTreatment ?? '') !== (recommendation.artifactTreatment ?? '')
  ) {
    errors.push('artifact-treatment conflict');
  }
  if (
    (packet.possibleFutureArtifact ?? '') !==
    (recommendation.possibleFutureArtifact ?? '')
  ) {
    errors.push('possible-future-artifact conflict');
  }
  for (const requirement of recommendation.researchRequirements ?? []) {
    if (!packet.sourceRequirements.includes(requirement)) {
      errors.push(`research requirement missing from packet: ${requirement}`);
    }
  }
  if (packet.primaryDomain !== recommendation.primaryDomain) {
    errors.push(
      `primary-domain conflict: packet=${packet.primaryDomain}, reviewed=${recommendation.primaryDomain}`,
    );
  }
  if (packet.theme !== (recommendation.themeOrCluster ?? '')) {
    errors.push(
      `theme conflict: packet=${packet.theme}, reviewed=${recommendation.themeOrCluster ?? ''}`,
    );
  }

  const expectedReadinessByDisposition = {
    'research before development': 'research-required',
    'combine with existing material': 'combine-first',
    'combine with overlapping material': 'combine-first',
    'preserve as seed': 'insufficient-material',
    defer: 'insufficient-material',
    'needs human judgment': 'insufficient-material',
    'not for publication': 'not-for-publication',
  };
  const expectedReadiness =
    expectedReadinessByDisposition[recommendation.disposition];
  if (expectedReadiness && packet.draftReadiness !== expectedReadiness) {
    errors.push(
      `disposition conflict: ${recommendation.disposition} requires ${expectedReadiness}`,
    );
  }
  if (
    packet.draftReadiness !== 'ready' &&
    packet.readerQuestion !== expectedNarrative.readerQuestion
  ) {
    errors.push('readerQuestion conflicts with the authoritative artifact or disposition');
  }
  if (
    JSON.stringify(packet.recommendedStructure) !==
    JSON.stringify(expectedNarrative.recommendedStructure)
  ) {
    errors.push(
      'recommendedStructure conflicts with the authoritative artifact or disposition',
    );
  }

  if (
    packet.draftReadiness === 'research-required' &&
    packet.sourceSufficiency?.status === 'sufficient'
  ) {
    errors.push('research-required cannot serialize source sufficiency as sufficient');
  }
  if (
    packet.draftReadiness === 'insufficient-material' &&
    packet.sourceSufficiency?.status === 'sufficient'
  ) {
    errors.push('insufficient-material cannot serialize source sufficiency as sufficient');
  }
  if (
    packet.draftReadiness === 'ready' &&
    packet.sourceSufficiency?.status !== 'sufficient'
  ) {
    errors.push('ready requires source sufficiency to be sufficient');
  }

  const isCombine = COMBINE_DISPOSITIONS.has(recommendation.disposition);
  if (isCombine !== Boolean(packet.combinationPlan)) {
    errors.push('combine disposition and combinationPlan disagree');
  }
  if (
    isCombine &&
    recommendation.combineTargetReference &&
    packet.combinationPlan?.targetReference !==
      recommendation.combineTargetReference
  ) {
    errors.push('combine target conflicts with the reviewed target');
  }
  if (!isCombine && recommendation.combineTargetReference) {
    errors.push('non-combine disposition cannot carry a combine target');
  }

  for (const item of packet.developmentMaterial ?? []) {
    if (
      item.provenance === 'source' &&
      item.evidencePosture === 'approved-claim'
    ) {
      errors.push('source assertion was reintroduced as an approved claim');
    }
  }

  if (recommendation.uncertaintyOrReviewFlag) {
    const preservedCaution = (packet.developmentMaterial ?? []).some(
      (item) =>
        item.content === recommendation.uncertaintyOrReviewFlag &&
        item.role === 'caution' &&
        item.evidencePosture === 'editorial-caution',
    );
    if (!preservedCaution) {
      errors.push('reviewed counterpressure was not preserved in developmentMaterial');
    }
    if (
      !containsExact(
        packet.unresolvedQuestions ?? [],
        recommendation.uncertaintyOrReviewFlag,
      )
    ) {
      errors.push('reviewed counterpressure was not preserved in unresolvedQuestions');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Loop 2 consistency validation failed: ${errors.join('; ')}`);
  }
}
