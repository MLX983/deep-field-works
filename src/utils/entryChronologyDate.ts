export type EntryDateFields = {
  pubDate?: Date;
  draftDate?: Date;
};

/** Sort/display date: publication date when set, otherwise internal draft date. */
export function entryChronologyDate(data: EntryDateFields): Date {
  return data.pubDate ?? data.draftDate ?? new Date(0);
}
