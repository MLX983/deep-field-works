/**
 * Deep Field Works presentation registry.
 *
 * Editorial meaning is defined in:
 *
 *   docs/source-of-truth/presentation-system.md
 *
 * This file provides stable machine-readable IDs, Figma mappings, structural
 * classifications, and constraints for presentation planning, rendering, and
 * validation.
 *
 * Figma node IDs and file keys must be captured from the actual Figma source.
 * Unknown values must remain null rather than being inferred.
 */

export type PresentationEntryId =
  | "masthead"
  | "global-navigation"
  | "intro"
  | "page-title"
  | "metadata-wrapper"
  | "section-heading"
  | "subheading-block"
  | "subheading"
  | "body-content"
  | "pull-quote"
  | "operational-callout"
  | "inline-link"
  | "main-link"
  | "footer-utility-link"
  | "ordered-list"
  | "unordered-list"
  | "related-concepts"
  | "related-pieces"
  | "draft-banner"
  | "internal-editorial-warning";

export type PresentationEntryKind =
  | "component"
  | "composition"
  | "text-element"
  | "text-treatment"
  | "semantic-structure"
  | "data-structure"
  | "review-only";

export type PresentationCategory =
  | "site-structure"
  | "article-introduction"
  | "article-structure"
  | "editorial-content"
  | "editorial-emphasis"
  | "navigation"
  | "archive-navigation"
  | "review";

export type ProductionAvailability =
  | "production"
  | "review-only"
  | "production-and-review";

export type SourceTextBehavior =
  | "canonical"
  | "extract-existing"
  | "reviewed-derived"
  | "metadata-derived"
  | "reference-derived"
  | "utility-generated"
  | "not-applicable";

export type PlacementRule =
  | "page-header"
  | "before-intro"
  | "article-intro"
  | "before-article-body"
  | "within-article-body"
  | "within-section"
  | "within-subsection"
  | "between-paragraphs"
  | "inline"
  | "after-article-body"
  | "page-footer"
  | "review-page-only";

export interface FigmaReference {
  /**
   * Exact canonical component or composition name in Figma.
   *
   * Null indicates that the entry is not represented as a separate Figma
   * component or has not yet been mapped.
   */
  componentName: string | null;

  /**
   * Figma file key captured from a source URL or MCP response.
   */
  fileKey: string | null;

  /**
   * Existing Figma node ID.
   *
   * Never assign or invent this value.
   */
  nodeId: string | null;

  /**
   * Date on which the Figma source was last inspected.
   * ISO format: YYYY-MM-DD.
   */
  capturedAt: string | null;
}

export interface PresentationEntryDefinition {
  id: PresentationEntryId;
  name: string;
  kind: PresentationEntryKind;
  category: PresentationCategory;
  htmlRole: string | null;
  productionAvailability: ProductionAvailability;

  /**
   * Concise operational description.
   *
   * The full normative definition remains in presentation-system.md.
   */
  purpose: string;

  sourceTextBehavior: SourceTextBehavior;
  allowedPlacements: readonly PlacementRule[];

  optional: boolean;
  minimumPerArtifact: number | null;
  maximumPerArtifact: number | null;

  /**
   * Stable IDs of entries contained by a composition.
   *
   * Empty for non-composition entries.
   */
  contains: readonly PresentationEntryId[];

  /**
   * Confirmed renderer or implementation reference.
   *
   * Add only after inspecting the actual repository implementation.
   */
  renderer: string | null;

  figma: FigmaReference;

  /**
   * Stable constraints suitable for planning or automated validation.
   *
   * Subjective editorial guidance remains in presentation-system.md and
   * presentation-review.md.
   */
  constraints: readonly string[];
}

const FIGMA_FILE_KEY = "9BPDDO9m33ffYpkMNWSFYW";
const FIGMA_CAPTURED_AT = "2026-07-18";

function figmaReference(
  componentName: string | null,
  nodeId: string | null = null,
): FigmaReference {
  const mapped = componentName !== null && nodeId !== null;

  return {
    componentName,
    fileKey: mapped ? FIGMA_FILE_KEY : null,
    nodeId,
    capturedAt: mapped ? FIGMA_CAPTURED_AT : null,
  };
}

export const presentationRegistry = {
  masthead: {
    id: "masthead",
    name: "Masthead",
    kind: "component",
    category: "site-structure",
    htmlRole: "header",
    productionAvailability: "production-and-review",
    purpose: "Identify Deep Field Works as the publishing context.",
    sourceTextBehavior: "not-applicable",
    allowedPlacements: ["page-header"],
    optional: false,
    minimumPerArtifact: 1,
    maximumPerArtifact: 1,
    contains: [],
    renderer: null,
    figma: figmaReference("DFW / Article / Masthead", "8043:6812"),
    constraints: [
      "The masthead must appear no more than once.",
      "It must remain visually subordinate to the artifact title.",
      "It must not contain article-specific claims.",
    ],
  },

  "global-navigation": {
    id: "global-navigation",
    name: "Global Navigation",
    kind: "component",
    category: "site-structure",
    htmlRole: "nav",
    productionAvailability: "production-and-review",
    purpose: "Provide navigation from the artifact to a broader DFW destination.",
    sourceTextBehavior: "utility-generated",
    allowedPlacements: ["page-header", "before-intro"],
    optional: false,
    minimumPerArtifact: 1,
    maximumPerArtifact: 1,
    contains: [],
    renderer: null,
    figma: figmaReference(
      "DFW / Article / Global Navigation",
      "8043:6816",
    ),
    constraints: [
      "It must remain distinct from article-specific links.",
      "Its label must describe a navigational destination.",
    ],
  },

  intro: {
    id: "intro",
    name: "Intro",
    kind: "composition",
    category: "article-introduction",
    htmlRole: "header",
    productionAvailability: "production-and-review",
    purpose:
      "Present the artifact title and essential metadata as one introductory block.",
    sourceTextBehavior: "not-applicable",
    allowedPlacements: ["article-intro", "before-article-body"],
    optional: false,
    minimumPerArtifact: 1,
    maximumPerArtifact: 1,
    contains: ["page-title", "metadata-wrapper"],
    renderer: null,
    figma: figmaReference(
      "DFW / Article / Compositions / Intro",
      "8043:6796",
    ),
    constraints: [
      "It must contain exactly one page title.",
      "It must contain exactly one metadata wrapper.",
      "It must appear before the article body.",
    ],
  },

  "page-title": {
    id: "page-title",
    name: "Page Title",
    kind: "text-element",
    category: "article-introduction",
    htmlRole: "h1",
    productionAvailability: "production-and-review",
    purpose: "Identify the primary idea of the artifact.",
    sourceTextBehavior: "canonical",
    allowedPlacements: ["article-intro"],
    optional: false,
    minimumPerArtifact: 1,
    maximumPerArtifact: 1,
    contains: [],
    renderer: null,
    figma: figmaReference(null),
    constraints: [
      "Exactly one page title must appear.",
      "It must represent the artifact's central idea.",
      "It must not be derived solely from a filename, slug, or internal label.",
    ],
  },

  "metadata-wrapper": {
    id: "metadata-wrapper",
    name: "Metadata Wrapper",
    kind: "text-element",
    category: "article-introduction",
    htmlRole: null,
    productionAvailability: "production-and-review",
    purpose: "Orient the reader with essential artifact information.",
    sourceTextBehavior: "metadata-derived",
    allowedPlacements: ["article-intro"],
    optional: false,
    minimumPerArtifact: 1,
    maximumPerArtifact: 1,
    contains: [],
    renderer: null,
    figma: figmaReference(null),
    constraints: [
      "Displayed values must come from canonical artifact metadata.",
      "Draft state must only appear when applicable.",
      "Metadata must not replace the page title.",
    ],
  },

  "section-heading": {
    id: "section-heading",
    name: "Section Heading",
    kind: "component",
    category: "article-structure",
    htmlRole: "h2",
    productionAvailability: "production-and-review",
    purpose: "Divide the artifact into coherent major sections.",
    sourceTextBehavior: "canonical",
    allowedPlacements: ["within-article-body", "within-section"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: null,
    contains: [],
    renderer: null,
    figma: figmaReference("DFW / Article / Section Heading", "8045:30"),
    constraints: [
      "It must introduce a genuine structural division.",
      "It must not be used solely to emphasize an isolated sentence.",
      "Heading hierarchy must remain coherent.",
    ],
  },

  "subheading-block": {
    id: "subheading-block",
    name: "Subheading Block",
    kind: "composition",
    category: "article-structure",
    htmlRole: "section",
    productionAvailability: "production-and-review",
    purpose:
      "Introduce and contain a meaningful subsection within a larger section.",
    sourceTextBehavior: "not-applicable",
    allowedPlacements: ["within-section"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: null,
    contains: ["subheading", "body-content"],
    renderer: null,
    figma: figmaReference(
      "DFW / Article / Compositions / Subheading Block",
      "8043:6817",
    ),
    constraints: [
      "It must contain a subheading and associated body content.",
      "Its content must form a meaningful subsection.",
      "It must remain subordinate to the surrounding section.",
    ],
  },

  subheading: {
    id: "subheading",
    name: "Subheading",
    kind: "component",
    category: "article-structure",
    htmlRole: "h3",
    productionAvailability: "production-and-review",
    purpose: "Introduce a subsection within a larger article section.",
    sourceTextBehavior: "canonical",
    allowedPlacements: ["within-subsection"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: null,
    contains: [],
    renderer: null,
    figma: figmaReference("DFW / Article / Subheading", "8046:40"),
    constraints: [
      "It must represent a meaningful subdivision.",
      "It must remain subordinate to the section heading.",
      "It must not be used solely to style or emphasize a sentence.",
    ],
  },

  "body-content": {
    id: "body-content",
    name: "Body Content",
    kind: "component",
    category: "editorial-content",
    htmlRole: null,
    productionAvailability: "production-and-review",
    purpose: "Present the primary prose of the artifact.",
    sourceTextBehavior: "canonical",
    allowedPlacements: [
      "within-article-body",
      "within-section",
      "within-subsection",
    ],
    optional: false,
    minimumPerArtifact: 1,
    maximumPerArtifact: null,
    contains: [],
    renderer: null,
    figma: figmaReference("DFW / Article / Body Content", "8043:6800"),
    constraints: [
      "It is the default presentation form for article prose.",
      "Its content must remain canonical article text.",
      "Prose must not be moved into a specialized component without a semantic reason.",
    ],
  },

  "pull-quote": {
    id: "pull-quote",
    name: "Pull Quote",
    kind: "component",
    category: "editorial-emphasis",
    htmlRole: "blockquote",
    productionAvailability: "production-and-review",
    purpose: "Emphasize an important sentence already present in the artifact.",
    sourceTextBehavior: "extract-existing",
    allowedPlacements: ["between-paragraphs", "within-section"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: 2,
    contains: [],
    renderer: null,
    figma: figmaReference("DFW / Article / Pull Quote", "8043:6804"),
    constraints: [
      "Its text must already exist in the canonical artifact.",
      "Extracted wording must remain unchanged.",
      "Its content must be prose rather than a heading, list, label, or summary.",
      "Removing it must not alter the artifact's meaning.",
      "Its placement should follow sufficient context.",
    ],
  },

  "operational-callout": {
    id: "operational-callout",
    name: "Operational Callout",
    kind: "component",
    category: "editorial-emphasis",
    htmlRole: "aside",
    productionAvailability: "production-and-review",
    purpose:
      "Highlight a design principle, operational insight, practical implication, or durable takeaway.",
    sourceTextBehavior: "reviewed-derived",
    allowedPlacements: ["between-paragraphs", "within-section"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: null,
    contains: [],
    renderer: null,
    figma: figmaReference(
      "DFW / Article / Operational Callout",
      "8046:412",
    ),
    constraints: [
      "Its content must be concise and editorially reviewed.",
      "It must not introduce an unsupported claim.",
      "It must not appear inside a list.",
      "Two operational callouts should not appear consecutively.",
      "Ordinary prose must not be converted into a callout solely for visual variety.",
    ],
  },

  "inline-link": {
    id: "inline-link",
    name: "Inline Link",
    kind: "text-treatment",
    category: "navigation",
    htmlRole: "a",
    productionAvailability: "production-and-review",
    purpose:
      "Connect readers to supporting material without interrupting body prose.",
    sourceTextBehavior: "reference-derived",
    allowedPlacements: ["inline"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: null,
    contains: [],
    renderer: null,
    figma: figmaReference(null),
    constraints: [
      "It is a text treatment, not a standalone Figma component.",
      "Linked text must describe the destination or its relevance.",
      "The surrounding sentence must read naturally.",
      "It must not fragment the argument through excessive use.",
    ],
  },

  "main-link": {
    id: "main-link",
    name: "Main Link",
    kind: "component",
    category: "navigation",
    htmlRole: "a",
    productionAvailability: "production-and-review",
    purpose:
      "Present a prominent standalone destination directly relevant to the artifact.",
    sourceTextBehavior: "reference-derived",
    allowedPlacements: [
      "within-article-body",
      "within-section",
      "after-article-body",
    ],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: null,
    contains: [],
    renderer: null,
    figma: figmaReference("DFW / Article / Main Link", "8046:34"),
    constraints: [
      "Its label must identify the destination or purpose.",
      "It must represent a meaningful primary destination or action.",
      "It must not be used merely to make an ordinary inline citation prominent.",
      "It should be used selectively.",
    ],
  },

  "footer-utility-link": {
    id: "footer-utility-link",
    name: "Footer Utility Link",
    kind: "component",
    category: "navigation",
    htmlRole: "a",
    productionAvailability: "production-and-review",
    purpose:
      "Provide a low-priority utility action at the end of the article.",
    sourceTextBehavior: "utility-generated",
    allowedPlacements: ["after-article-body", "page-footer"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: 1,
    contains: [],
    renderer: null,
    figma: figmaReference(
      "DFW / Article / Footer Utility Link",
      "8085:269",
    ),
    constraints: [
      "It must perform a utility navigation function.",
      "It must not serve as a recommendation, citation, or related-content link.",
      "It must remain subordinate to article content.",
    ],
  },

  "ordered-list": {
    id: "ordered-list",
    name: "Ordered List",
    kind: "semantic-structure",
    category: "editorial-content",
    htmlRole: "ol",
    productionAvailability: "production-and-review",
    purpose: "Communicate sequence, progression, procedure, or priority.",
    sourceTextBehavior: "canonical",
    allowedPlacements: [
      "within-article-body",
      "within-section",
      "within-subsection",
    ],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: null,
    contains: [],
    renderer: null,
    figma: figmaReference(null),
    constraints: [
      "Order or sequence must carry meaning.",
      "It must not be used solely to break up prose visually.",
    ],
  },

  "unordered-list": {
    id: "unordered-list",
    name: "Unordered List",
    kind: "semantic-structure",
    category: "editorial-content",
    htmlRole: "ul",
    productionAvailability: "production-and-review",
    purpose: "Present related items without implying order or priority.",
    sourceTextBehavior: "canonical",
    allowedPlacements: [
      "within-article-body",
      "within-section",
      "within-subsection",
    ],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: null,
    contains: [],
    renderer: null,
    figma: figmaReference(null),
    constraints: [
      "Items must be meaningfully related.",
      "It must not imply a sequence that does not exist.",
      "It must not be used solely for emphasis.",
    ],
  },

  "related-concepts": {
    id: "related-concepts",
    name: "Related Concepts",
    kind: "data-structure",
    category: "archive-navigation",
    htmlRole: "section",
    productionAvailability: "production-and-review",
    purpose:
      "Connect the artifact to recurring concepts within the DFW archive.",
    sourceTextBehavior: "reference-derived",
    allowedPlacements: ["after-article-body"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: 1,
    contains: [],
    renderer: null,
    figma: figmaReference(null),
    constraints: [
      "Each relationship must be meaningful.",
      "It must not merely repeat tags or metadata.",
      "The selection must remain limited and useful.",
    ],
  },

  "related-pieces": {
    id: "related-pieces",
    name: "Related Pieces",
    kind: "data-structure",
    category: "archive-navigation",
    htmlRole: "section",
    productionAvailability: "production-and-review",
    purpose:
      "Surface nearby work that expands or complements the current artifact.",
    sourceTextBehavior: "reference-derived",
    allowedPlacements: ["after-article-body"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: 1,
    contains: [],
    renderer: null,
    figma: figmaReference(null),
    constraints: [
      "Each relationship must improve archive exploration.",
      "Generic topical similarity is insufficient.",
      "Unpublished pieces must not be exposed unintentionally.",
      "The selection must remain limited.",
    ],
  },

  "draft-banner": {
    id: "draft-banner",
    name: "Draft Banner",
    kind: "review-only",
    category: "review",
    htmlRole: "aside",
    productionAvailability: "review-only",
    purpose:
      "Clearly distinguish unpublished review material from published work.",
    sourceTextBehavior: "metadata-derived",
    allowedPlacements: ["page-header", "review-page-only"],
    optional: false,
    minimumPerArtifact: 1,
    maximumPerArtifact: 1,
    contains: [],
    renderer: null,
    figma: figmaReference(null),
    constraints: [
      "It must appear on unpublished review pages.",
      "It must never appear in a production build.",
    ],
  },

  "internal-editorial-warning": {
    id: "internal-editorial-warning",
    name: "Internal Editorial Warning",
    kind: "review-only",
    category: "review",
    htmlRole: "aside",
    productionAvailability: "review-only",
    purpose: "Communicate actionable guidance to editorial reviewers.",
    sourceTextBehavior: "reviewed-derived",
    allowedPlacements: ["review-page-only"],
    optional: true,
    minimumPerArtifact: 0,
    maximumPerArtifact: null,
    contains: [],
    renderer: null,
    figma: figmaReference(null),
    constraints: [
      "It must contain actionable review information.",
      "It must be distinguishable from article content.",
      "It must never appear in a production build.",
      "It should be removed when no longer relevant.",
    ],
  },
} as const satisfies Record<
  PresentationEntryId,
  PresentationEntryDefinition
>;

export const presentationEntryList: PresentationEntryDefinition[] =
  Object.values(presentationRegistry);

export function getPresentationEntry(
  id: PresentationEntryId,
): PresentationEntryDefinition {
  return presentationRegistry[id];
}

export function getEntriesForEnvironment(
  environment: "production" | "review",
): PresentationEntryDefinition[] {
  return presentationEntryList.filter((entry) => {
    if (environment === "review") {
      return true;
    }

    return entry.productionAvailability !== "review-only";
  });
}

export function getReviewOnlyEntries(): PresentationEntryDefinition[] {
  return presentationEntryList.filter(
    (entry) => entry.productionAvailability === "review-only",
  );
}

export function getFigmaMappedEntries(): PresentationEntryDefinition[] {
  return presentationEntryList.filter(
    (entry) => entry.figma.componentName !== null,
  );
}

export function getCompositionEntries(): PresentationEntryDefinition[] {
  return presentationEntryList.filter(
    (entry) => entry.kind === "composition",
  );
}
