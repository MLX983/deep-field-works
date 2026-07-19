import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = path.join(root, 'dist');
const contentRoot = path.join(root, 'src', 'content');
const collections = ['articles', 'field-notes', 'checkpoints'];

async function walk(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

const drafts = [];
for (const collection of collections) {
  const directory = path.join(contentRoot, collection);
  for (const file of await walk(directory)) {
    if (!file.endsWith('.md')) continue;
    const source = await readFile(file, 'utf8');
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    if (!/^draft:\s*true\s*$/m.test(frontmatter)) continue;
    const slug = path.relative(directory, file).replace(/\.md$/, '').split(path.sep).join('/');
    drafts.push({ collection, slug });
  }
}

const distFiles = await walk(dist);
const failures = [];

for (const file of distFiles) {
  const relative = path.relative(dist, file).split(path.sep).join('/');
  if (relative === 'review-drafts.html' || relative.startsWith('review-drafts/')) {
    failures.push(`review output generated: ${relative}`);
  }

  if (!/\.(html|xml|json|txt|js|css)$/.test(file)) continue;
  const output = await readFile(file, 'utf8');
  for (const draft of drafts) {
    const publicPath = `${draft.collection}/${draft.slug}`;
    if (relative === `${publicPath}.html` || relative === `${publicPath}/index.html`) {
      failures.push(`draft route generated: ${relative}`);
    }
    if (output.includes(`/${publicPath}`)) {
      failures.push(`draft link or reference found in ${relative}: /${publicPath}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Production exclusion check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production exclusion check passed for ${drafts.length} draft(s).`);
