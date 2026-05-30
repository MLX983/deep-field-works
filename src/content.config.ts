import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const status = z.enum(['observation', 'working-theory', 'checkpoint', 'archived']);

const documentType = z.enum([
  'article',
  'field-note',
  'checkpoint',
  'research-note',
  'experiment',
  'project-journal',
]);

const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  draft: z.boolean().optional().default(false),
  documentType: documentType,
  theme: z.string().optional(),
  status: status.optional(),
  sourceNote: z.string().optional(),
  domainPath: z.array(z.string()).optional(),
  canonical: z.boolean().optional(),
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
