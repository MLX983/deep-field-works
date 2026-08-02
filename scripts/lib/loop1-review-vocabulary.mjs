export const LOOP1_RECOMMENDATION_DISPOSITIONS = new Map([
  ['preserve as-is', 'preserve as seed'],
  ['defer', 'defer'],
  ['combine with other material', 'combine with overlapping material'],
  ['develop as note', 'develop independently'],
  ['research as field report', 'research before development'],
  ['draft artifact', 'develop independently'],
  ['needs human judgment', 'needs human judgment'],
  ['not for publication', 'not for publication'],
]);

export const LOOP1_DOCUMENT_TYPES = new Set([
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

export const LOOP1_DOMAINS = new Set([
  'Cognitive Infrastructure',
  'Human-Machine Workflows',
  'Institutions in Transition',
  'Interfaces for Judgment',
  'Media, Memory, and Meaning',
]);

export const LOOP1_CONFIDENCE_VALUES = new Set(['low', 'medium', 'high']);
export const LOOP1_EVALUATION_RESULTS = new Set(['PASS', 'REVISE', 'ESCALATE']);

// These are the only non-canonical recommendation spellings accepted from
// stored results. Keep this list exact; arbitrary case folding is intentionally
// unsupported so new vocabulary cannot enter the machine-readable boundary.
export const LEGACY_LOOP1_RECOMMENDATIONS = new Map([
  ['Combine with other material', 'combine with other material'],
]);

export function canonicalLoop1Recommendation(value) {
  if (LOOP1_RECOMMENDATION_DISPOSITIONS.has(value)) return value;
  return LEGACY_LOOP1_RECOMMENDATIONS.get(value) ?? null;
}

export function canonicalGeneratedLoop1Recommendation(value) {
  return canonicalTitleVariant(
    value,
    new Set(LOOP1_RECOMMENDATION_DISPOSITIONS.keys()),
  );
}

export function canonicalTitleVariant(value, canonicalValues) {
  if (canonicalValues.has(value)) return value;
  for (const canonical of canonicalValues) {
    const titleVariant = `${canonical.charAt(0).toUpperCase()}${canonical.slice(1).toLowerCase()}`;
    if (value === titleVariant) return canonical;
  }
  return null;
}
