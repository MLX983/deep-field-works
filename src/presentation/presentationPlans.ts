import type { PresentationPlan } from './presentationPlan';
import { planKey } from './presentationPlan';

const skillsHalfLife = {
  version: 1,
  collection: 'field-notes',
  slug: 'skills-half-life',
  pageTitle: 'AI skills have different half-lives',
  sectionOrder: [
    'Why it may matter',
    'Current interpretation',
    'Open question',
  ],
  pullQuotes: [
    {
      source: {
        section: 'Why it may matter',
        paragraph: 0,
        sentences: [1, 3],
      },
      placement: {
        position: 'after-paragraph',
        section: 'Why it may matter',
        paragraph: 0,
      },
    },
  ],
  callouts: [],
  relatedConcepts: ['AI skill adaptation'],
  relatedPieces: [],
  draftWarning: 'Unpublished draft · Local review only',
  internalEditorialFlags: [
    {
      severity: 'warning',
      message:
        'The prototyping example was inserted to test the human-input handoff. It satisfies the requested example structurally but does not fit the note’s argument well. Remove or replace it before final editorial approval.',
    },
  ],
} satisfies PresentationPlan;

const myAiRules = {
  version: 1,
  collection: 'articles',
  slug: 'my-ai-rules',
  pageTitle: 'My AI Rules',
  dek: { source: 'description' },
  sectionOrder: [
    'The design problem',
    'The interaction choice',
    'How the control surface is grouped',
    'Why it matters',
    'Current state',
    'Remaining questions',
  ],
  pullQuotes: [],
  callouts: [
    {
      variant: 'operational',
      sourceBehavior: 'extract',
      source: {
        section: 'Why it matters',
        paragraph: 1,
      },
      placement: {
        position: 'after-paragraph',
        section: 'Why it matters',
        paragraph: 1,
      },
    },
  ],
  relatedConcepts: [
    'Delegated authority',
    'Governance surfaces',
    'Trust calibration',
  ],
  relatedPieces: [],
  draftWarning: 'Unpublished draft · Local review only',
  internalEditorialFlags: [
    {
      severity: 'warning',
      message:
        'This page represents a proposed control surface from issue #17. Do not imply that My AI Rules has been implemented, user-tested, or observed in production.',
    },
  ],
} satisfies PresentationPlan;

export const presentationPlans = new Map<string, PresentationPlan>([
  [planKey(skillsHalfLife.collection, skillsHalfLife.slug), skillsHalfLife],
  [planKey(myAiRules.collection, myAiRules.slug), myAiRules],
]);
