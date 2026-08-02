export const CANONICAL_ARTIFACT_TYPES = Object.freeze([
  'seed',
  'note',
  'field-report',
  'essay',
  'experiment',
  'prototype-note',
  'concept',
  'checkpoint',
  'project-log',
]);

const CANONICAL_ARTIFACT_SET = new Set(CANONICAL_ARTIFACT_TYPES);

// Compatibility is deliberately exact. These values appeared in approved v1
// recommendations before suggestedArtifact was defined as a canonical field.
export const LEGACY_REVIEWED_ARTIFACT_ALIASES = Object.freeze({
  'prototype note': 'prototype-note',
  'field report': 'field-report',
  'seed pending sourcing': 'seed',
  'seed, with potential to become a field report': 'seed',
  'supporting seed': 'seed',
  'supporting note or section within the loop-engineering cluster': 'note',
});

export function canonicalReviewedArtifact(value) {
  if (typeof value !== 'string') {
    throw new Error('suggestedArtifact must be a string');
  }
  const normalized = value.trim().toLowerCase();
  if (CANONICAL_ARTIFACT_SET.has(normalized)) return normalized;
  const compatibilityValue = LEGACY_REVIEWED_ARTIFACT_ALIASES[normalized];
  if (compatibilityValue) return compatibilityValue;
  throw new Error(
    `Unsupported or ambiguous suggestedArtifact: ${JSON.stringify(value)}`,
  );
}
