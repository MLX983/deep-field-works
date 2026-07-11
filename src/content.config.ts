import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const status = z.enum([
  'seed',
  'draft',
  'review',
  'published',
  'archived',
  'superseded',
]);

const documentType = z.enum([
  'seed',
  'note',
  'field-report',
  'essay',
  'experiment',
  'prototype-note',
  'concept',
  'checkpoint',
  'project-log',
]);

const baseSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date().optional(),
    draftDate: z.coerce.date().optional(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean(),
    documentType: documentType,
    theme: z.string().optional(),
    status: status.optional(),
    sourceNote: z.string().optional(),
    domainPath: z.array(z.string()).optional(),
    canonical: z.boolean().optional(),
    relatedConcepts: z.array(z.string()).optional(),
    relatedPieces: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if ((!data.draft || data.status === 'published') && !data.pubDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'pubDate is required when draft is false',
        path: ['pubDate'],
      });
    }
  });

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: baseSchema,
});

const fieldNotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/field-notes' }),
  schema: baseSchema,
});

const checkpoints = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/checkpoints' }),
  schema: baseSchema.extend({
    checkpointFor: z.string().optional(),
  }),
});

export const collections = {
  articles,
  'field-notes': fieldNotes,
  checkpoints,
};
