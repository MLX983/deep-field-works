export interface Domain {
  title: string;
  slug: string;
  description: string;
  currentQuestions: string[];
}

/*
 * Five primary domains, per the source-of-truth `domain-structure.md`.
 * Descriptions and current questions are taken from the "Suggested launch
 * domain page copy" section of that document, lightly adapted.
 *
 * Domains are thematic territories. Field Notes, Articles, and Checkpoints
 * are content types/sections, not domains.
 */
export const domains: Domain[] = [
  {
    title: 'Cognitive Infrastructure',
    slug: 'cognitive-infrastructure',
    description:
      'How thinking changes when notes, archives, models, and retrieval systems become part of the cognitive loop.',
    currentQuestions: [
      'When does storage become memory?',
      'What changes when an archive can generate new artifacts?',
      'How should a personal knowledge system preserve uncertainty and chronology?',
    ],
  },
  {
    title: 'Human-Machine Workflows',
    slug: 'human-machine-workflows',
    description:
      'How people and AI systems divide labor, coordinate action, supervise automation, and create new forms of work together.',
    currentQuestions: [
      'What should humans still do directly?',
      'What can systems do under policy?',
      'Where does supervision create new work?',
    ],
  },
  {
    title: 'Institutions in Transition',
    slug: 'institutions-in-transition',
    description:
      'How organizations, hierarchies, governance systems, and institutional memory change when AI alters the flow of information and authority.',
    currentQuestions: [
      'What happens when information no longer has to move through human relay chains?',
      'Which management functions become less valuable?',
      'Which forms of judgment become more important?',
    ],
  },
  {
    title: 'Interfaces for Judgment',
    slug: 'interfaces-for-judgment',
    description:
      'How interfaces help people interpret signals, manage uncertainty, supervise systems, and make better decisions when conditions are ambiguous.',
    currentQuestions: [
      'What should a user see when a system recommends action?',
      'How should uncertainty be represented?',
      'What controls let a human adjust posture rather than micromanage every task?',
    ],
  },
  {
    title: 'Media, Memory, and Meaning',
    slug: 'media-memory-meaning',
    description:
      'How ideas become durable through writing, publishing, visual explanation, video, narrative structure, and accumulated archives.',
    currentQuestions: [
      'How do notes become essays, checkpoints, prototypes, or videos?',
      'How does chronology preserve the evolution of thought?',
      'When does an archive become part of the creative system?',
    ],
  },
];

export const getDomainBySlug = (slug: string): Domain | undefined =>
  domains.find((domain) => domain.slug === slug);

export const getDomainByTitle = (title: string): Domain | undefined =>
  domains.find(
    (domain) => domain.title.toLowerCase() === title.trim().toLowerCase(),
  );

/**
 * Resolve the canonical domain a content entry belongs to. Prefers the curated
 * `domainPath`, then falls back to `theme`. Returns undefined if neither maps
 * to a known domain.
 */
export const resolveEntryDomain = (data: {
  domainPath?: string[];
  theme?: string;
}): Domain | undefined => {
  const candidates = [...(data.domainPath ?? []), data.theme].filter(
    (value): value is string => Boolean(value),
  );
  for (const candidate of candidates) {
    const match = getDomainByTitle(candidate);
    if (match) return match;
  }
  return undefined;
};
