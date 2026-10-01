import { getCollection, type CollectionEntry } from 'astro:content';
import { publicEntriesOnly } from './publicEntriesOnly';

export const entryCollections = ['articles', 'field-notes', 'checkpoints'] as const;
export type EntryCollection = typeof entryCollections[number];
export type PublicEntry = CollectionEntry<EntryCollection>;
export const entryPath = (entry: Pick<PublicEntry, 'collection' | 'id'>) =>
  `/${entry.collection}/${entry.id}/`;
export const hasSources = (entry: PublicEntry) => (entry.data.sources?.length ?? 0) > 0;

export async function sourcePaths(collection: EntryCollection) {
  const entries = await getCollection(collection, publicEntriesOnly);
  return entries.filter(hasSources).map((entry) => ({
    params: { slug: entry.id }, props: { entry },
  }));
}

/** Explicit reviewed references only. Never resolve ambiguous bare IDs. */
export async function resolveRelatedEntries(entry: PublicEntry, references = entry.data.relatedPieces ?? []) {
  if (!references.length) return [];
  const entries = (await Promise.all(entryCollections.map((collection) =>
    getCollection(collection, publicEntriesOnly),
  ))).flat().filter((target) =>
    !target.data.status || ['published', 'archived', 'superseded'].includes(target.data.status),
  );
  const seen = new Set([entryPath(entry)]);
  return references.flatMap((reference) => {
    // Accept the existing pipeline's repository-relative IDs as well as slugs.
    const id = reference.trim().replace(/^src\/content\//, '').replace(/\.md$/, '');
    const matches = entries.filter((target) =>
      id === `${target.collection}/${target.id}` || id === target.id,
    );
    if (matches.length !== 1 || seen.has(entryPath(matches[0]))) return [];
    seen.add(entryPath(matches[0]));
    return [matches[0]];
  });
}
