/**
 * The public content boundary.
 *
 * Drafts never enter normal routes, indexes, chronology, domains, or other
 * collections. Local draft review loads entries explicitly through /review-drafts.
 */
export const publicEntriesOnly = ({ data }: { data: { draft: boolean } }): boolean =>
  !data.draft;
