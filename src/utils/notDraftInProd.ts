/**
 * Content collection filter for environment-aware draft handling.
 *
 * - Development (`astro dev`): include all entries so draft pieces can be
 *   previewed at their collection routes (e.g. /articles/{slug}).
 * - Production (`astro build`): exclude entries with draft: true so drafts
 *   never appear in the static site, listings, chronology, or domain pages.
 */
export const notDraftInProd = ({ data }: { data: { draft: boolean } }): boolean =>
  import.meta.env.PROD ? !data.draft : true;
