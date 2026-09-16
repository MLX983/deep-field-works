import type { PresentationPlan } from './presentationPlan';
import { planKey } from './presentationPlan';

const myAiRules = {
  version: 1,
  collection: 'articles',
  slug: 'my-ai-rules',
  pageTitle: 'From Chatbot to Personal AI',
  dek: { source: 'description' },
  sectionOrder: [],
  pullQuotes: [],
  callouts: [],
  relatedConcepts: [],
  relatedPieces: [],
  draftWarning: 'Unpublished draft · Local review only',
  internalEditorialFlags: [
    {
      severity: 'warning',
      message:
        'Issue #17 describes a proposed personal-AI direction. Review whether the distinction from current chat products is clear without implying implementation or testing.',
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
  [planKey(myAiRules.collection, myAiRules.slug), myAiRules],
  [
    planKey(
      capacityExpansionUnderAHigherStandardOfProof.collection,
      capacityExpansionUnderAHigherStandardOfProof.slug,
    ),
    capacityExpansionUnderAHigherStandardOfProof,
  ],
]);
