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

const capacityExpansionUnderAHigherStandardOfProof = {
  version: 1,
  collection: 'field-notes',
  slug: 'capacity-expansion-under-a-higher-standard-of-proof',
  dek: { source: 'description' },
  sectionOrder: [
    'Spending accelerates while scrutiny rises',
    'The capex evidence does not show a retreat',
    'Physical capacity still sets the pace',
    'Markets appear to judge the operating evidence',
    'Monetization is visible before ROI is measurable',
    'Efficiency increases supply, but demand is absorbing it so far',
    'Cash leaves before returns accumulate',
    'The strongest case against a new regime',
    'A more accountable buildout',
  ],
  pullQuotes: [],
  callouts: [
    {
      variant: 'operational',
      sourceBehavior: 'extract',
      label: 'Key distinction',
      source: {
        section: null,
        paragraph: 1,
      },
      placement: {
        position: 'before-section',
        section: 'Spending accelerates while scrutiny rises',
      },
    },
    {
      variant: 'operational',
      sourceBehavior: 'extract',
      label: 'Bounded conclusion',
      source: {
        section: 'Efficiency increases supply, but demand is absorbing it so far',
        paragraph: 1,
      },
      placement: {
        position: 'after-paragraph',
        section: 'Efficiency increases supply, but demand is absorbing it so far',
        paragraph: 0,
      },
    },
  ],
  relatedConcepts: [],
  relatedPieces: [],
  draftWarning: 'Unpublished draft · Local review only',
  internalEditorialFlags: [
    {
      severity: 'note',
      message:
        'Review the argument and presentation together. The 23 linked citations remain part of the draft; Reuters and AP links are market-reaction reporting, not primary evidence for company figures.',
    },
  ],
} satisfies PresentationPlan;

export const presentationPlans = new Map<string, PresentationPlan>([
  [planKey(skillsHalfLife.collection, skillsHalfLife.slug), skillsHalfLife],
  [planKey(myAiRules.collection, myAiRules.slug), myAiRules],
  [
    planKey(
      capacityExpansionUnderAHigherStandardOfProof.collection,
      capacityExpansionUnderAHigherStandardOfProof.slug,
    ),
    capacityExpansionUnderAHigherStandardOfProof,
  ],
]);
