export const presentationCollections = [
  'articles',
  'field-notes',
  'checkpoints',
] as const;

export type PresentationCollection =
  (typeof presentationCollections)[number];

export interface BodySelection {
  /** Exact Markdown heading; use null for the opening before the first h2. */
  section: string | null;

  /** Zero-based paragraph within the selected section. */
  paragraph: number;

  /** Optional inclusive, zero-based sentence slice. */
  sentences?: [start: number, end: number];
}

export type Placement =
  | {
      position: 'before-section' | 'after-section';
      section: string;
    }
  | {
      position: 'after-paragraph';
      section: string;

      /** Zero-based paragraph within the selected section. */
      paragraph: number;
    };

export type CalloutVariant = 'operational';

export type CalloutSourceBehavior = 'reference' | 'extract';

export interface PresentationPlan {
  version: 1;
  collection: PresentationCollection;
  slug: string;

  /**
   * Optional display title for presentation.
   *
   * When omitted, the renderer uses the canonical artifact title.
   */
  pageTitle?: string;

  /**
   * Optional dek.
   *
   * Omit to render no dek. Frontmatter description is never shown implicitly.
   */
  dek?: { source: 'description' } | { text: string };

  /**
   * Exact Markdown section headings in the intended presentation order.
   */
  sectionOrder: string[];

  pullQuotes: Array<{
    /**
     * Selection and placement are explicit editorial choices and
     * human-review points.
     */
    source: BodySelection;
    placement: Placement;
  }>;

  callouts: Array<{
    /**
     * Named visual treatment.
     *
     * Callouts do not share a universal default presentation.
     */
    variant: CalloutVariant;

    /**
     * `extract` moves the selected paragraph into the callout instead of
     * duplicating it.
     */
    sourceBehavior: CalloutSourceBehavior;

    label?: string;
    source: BodySelection;
    placement: Placement;
  }>;

  relatedConcepts: string[];
  relatedPieces: string[];

  /**
   * Review-only banner text.
   *
   * This must never appear in production.
   */
  draftWarning: string;

  /**
   * Review-only guidance for editors.
   *
   * These flags must never appear in production.
   */
  internalEditorialFlags: Array<{
    severity: 'note' | 'warning' | 'blocking';
    message: string;
  }>;
}

export const planKey = (
  collection: PresentationCollection,
  slug: string,
): string => `${collection}/${slug}`;
