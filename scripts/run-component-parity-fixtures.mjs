import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Isolated builds exercise optional publishing states without editing real entries.
const root = fileURLToPath(new URL('..', import.meta.url));
const fixtureRoot = await mkdtemp(join(tmpdir(), 'dfw-component-parity-'));
try {
  for (const path of ['src', 'public', 'astro.config.mjs', 'package.json']) {
    await cp(join(root, path), join(fixtureRoot, path), { recursive: true });
  }
  // The dependency symlink must not share Astro's content cache with the real build.
  const config = await readFile(join(fixtureRoot, 'astro.config.mjs'), 'utf8');
  await writeFile(join(fixtureRoot, 'astro.config.mjs'), config.replace('defineConfig({', "defineConfig({ cacheDir: './.astro-cache/',"));
  await symlink(join(root, 'node_modules'), join(fixtureRoot, 'node_modules'), 'dir');
  const putEntry = async (collection, id, data = {}, body = 'Fixture prose.') => {
    const file = join(fixtureRoot, 'src/content', collection, `${id}.md`);
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, `---\n${JSON.stringify({ title: id, description: `Description for ${id}.`, pubDate: '2026-01-01', draft: false, status: 'published', documentType: 'note', ...data })}\n---\n\n${body}\n`);
  };
  const sources = [{ label: 'Reference one', url: 'https://example.org/one' }, { label: 'Reference two', url: 'https://example.org/two' }];
  await putEntry('articles', 'parity-target');
  await putEntry('articles', 'parity-draft', { draft: true, status: 'draft', sources });
  await putEntry('articles', 'parity-unpublished', { status: 'review' });
  await putEntry('articles', 'parity-ambiguous');
  await putEntry('field-notes', 'parity-ambiguous');
  await putEntry('articles', 'parity-empty', { sources: [], relatedPieces: ['missing', 'articles/parity-draft'] });
  await putEntry('articles', 'parity-all', {
    sources, sourcesDescription: 'A reviewed explanation of the source material.',
    relatedPieces: ['field-notes/agents-increase-shop-time', 'parity-target', 'articles/parity-draft', 'articles/parity-unpublished', 'missing', 'parity-ambiguous', 'articles/parity-all', 'src/content/articles/parity-target.md'],
  }, `A paragraph introducing an ordinary list:\n\n- A longer list item that wraps at mobile width to verify that its continuation aligns with the item text.\n- A second item.\n\nFollowing prose.\n\n> A pull quote uses the active header color with no decorative rules.\n\n## A normal section\n\nAn ordered sequence:\n\n1. First step\n2. Second step\n\nFollowing paragraph.\n\n<aside class="operational-callout"><p class="operational-callout__title">Optional title</p><p>A reviewed operational insight.</p></aside>\n\nSome intervening prose.\n\n<aside class="operational-callout"><p>An untitled operational insight.</p></aside>`);
  for (const collection of ['field-notes', 'checkpoints']) await putEntry(collection, 'parity-sources', { sources });
  const build = spawnSync(process.execPath, [join(root, 'node_modules/astro/bin/astro.mjs'), 'build'], { cwd: fixtureRoot, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const html = (path) => readFile(join(fixtureRoot, 'dist', path, 'index.html'), 'utf8');
  const article = await html('articles/parity-all');
  const sourcesPage = await html('articles/parity-all/sources');
  assert.match(article, /href="\/articles\/parity-all\/sources\/"/);
  const related = article.match(/<section class="related-links"[\s\S]*?<\/section>/)?.[0];
  assert.ok(related);
  assert.deepEqual([...related.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), ['/field-notes/agents-increase-shop-time/', '/articles/parity-target/']);
  assert.match(sourcesPage, /<h1[^>]*>Sources and references<\/h1>/);
  assert.match(sourcesPage, /href="\/articles\/parity-all\/"/);
  assert.match(sourcesPage, /href="https:\/\/example.org\/one"/);
  assert.match(sourcesPage, /<link rel="canonical" href="https:\/\/deepfieldworks.com\/articles\/parity-all\/sources\/"/);
  assert.match(sourcesPage, /Sources and references: parity-all/);
  assert.match(sourcesPage, /A reviewed explanation of the source material\./);
  assert.match(sourcesPage, /https:\/\/deepfieldworks.com\/images\/dfw-social-card.png/);
  assert.doesNotMatch(sourcesPage, /class="masthead"/);
  assert.doesNotMatch(await html('articles/parity-empty'), /class="(?:sources-link|related-links)"/);
  const sitemap = await readFile(join(fixtureRoot, 'dist/sitemap.xml'), 'utf8');
  for (const collection of ['articles', 'field-notes', 'checkpoints']) {
    const id = collection === 'articles' ? 'parity-all' : 'parity-sources';
    await html(`${collection}/${id}/sources`);
    assert.ok(sitemap.includes(`https://deepfieldworks.com/${collection}/${id}/sources/`));
  }
  const files = await readdir(join(fixtureRoot, 'dist'), { recursive: true });
  assert.ok(!files.some((file) => /parity-draft|parity-empty\/sources|parity-target\/sources/.test(file)));
  assert.ok(!sitemap.includes('parity-draft'));
  for (const file of files.filter((file) => file.endsWith('.html'))) {
    const page = await readFile(join(fixtureRoot, 'dist', file), 'utf8');
    assert.doesNotMatch(page, /data-citation|review-counterargument|review-timing-model|review-measure-ledger|review-related-topic/);
    if (file !== 'index.html') assert.doesNotMatch(page, /class="masthead"/);
    for (const [, href] of page.matchAll(/href="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
      if (href === '/') continue;
      const path = href.slice(1).replace(/\/$/, '');
      assert.ok(files.includes(path) || files.includes(`${path}/index.html`), `Broken internal link in ${file}: ${href}`);
    }
  }
  assert.equal(await readFile(join(fixtureRoot, 'dist/robots.txt'), 'utf8'), await readFile(join(root, 'public/robots.txt'), 'utf8'));
  console.log('Component parity fixtures passed: conditional routes, sources/backlink/metadata/sitemap, related order and exclusions, public shell, internal links, no experimental production output.');
  if (process.env.KEEP_PARITY_FIXTURE === '1') console.log(`Visual fixture: ${fixtureRoot}`);
} finally {
  if (process.env.KEEP_PARITY_FIXTURE !== '1') await rm(fixtureRoot, { recursive: true, force: true });
}
