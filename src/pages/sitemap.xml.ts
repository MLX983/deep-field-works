import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { domains } from '../data/domains';
import { publicEntriesOnly } from '../utils/publicEntriesOnly';

export const GET: APIRoute = async ({ site }) => {
  // Explicit public route scope keeps review, error, and implementation routes out.
  const paths = ['/', '/chronology/', '/domains/', '/articles/', '/field-notes/', '/checkpoints/'];
  paths.push(...domains.map((domain) => `/domains/${domain.slug}/`));

  for (const collection of ['articles', 'field-notes', 'checkpoints'] as const) {
    const entries = await getCollection(collection, publicEntriesOnly);
    paths.push(...entries.map((entry) => `/${collection}/${entry.id}/`));
  }

  const escapeXML = (value: string) => value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character]!);
  const urls = [...new Set(paths)].sort().map((path) =>
    `  <url><loc>${escapeXML(new URL(path, site).href)}</loc></url>`,
  );

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
