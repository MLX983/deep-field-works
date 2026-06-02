// Domain names are stored in Title Case as canonical taxonomy values
// (e.g. "Cognitive Infrastructure") in data, frontmatter, routing, and
// domainPath references. Those values must never be rewritten.
//
// This helper only produces a *presentation* label used when a domain is
// rendered as a link or list item, to match the editorial tone of the UI.
// It applies two editorial transforms and never touches the canonical value:
//   1. sentence case (e.g. "Cognitive Infrastructure" -> "Cognitive infrastructure")
//   2. drop the serial/Oxford comma (e.g. "Media, Memory, and Meaning"
//      -> "Media, memory and meaning")
export function formatDomainLabel(label: string): string {
  if (!label) return label;

  const sentenceCase = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  return sentenceCase.replace(/, and /g, ' and ');
}
