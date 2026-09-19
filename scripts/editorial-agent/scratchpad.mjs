import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGIN_TYPES, SCRATCHPAD_STATUSES, createScratchpadItem, listScratchpadItems, listSynthesisCandidates } from './editorial-memory.mjs';

const splitList = value => value ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
const readJson = file => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));

function parse(argv, allowed) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!allowed.has(key) || args[key] !== undefined || !argv[index + 1]) throw new Error(`Unknown, repeated, or incomplete option: ${key}`);
    args[key] = argv[++index];
  }
  return args;
}

function add(argv) {
  const args = parse(argv, new Set(['--workspace','--title','--body-file','--why','--origin','--provenance-file','--source-references-file','--themes','--concepts','--entities','--related-seeds','--related-runs','--related-artifacts','--related-scratchpad','--status']));
  if (!args['--workspace'] || !args['--title'] || !args['--body-file']) throw new Error('Scratchpad add requires --workspace, --title, and --body-file');
  const originType = args['--origin'] ?? 'human-added-note';
  if (!ORIGIN_TYPES.includes(originType)) throw new Error('Unknown scratchpad origin');
  if (args['--status'] && !SCRATCHPAD_STATUSES.includes(args['--status'])) throw new Error('Unknown scratchpad status');
  const result = createScratchpadItem(args['--workspace'], {
    title: args['--title'], body: fs.readFileSync(path.resolve(args['--body-file']), 'utf8'), whyMayMatter: args['--why'] ?? '', originType,
    originProvenance: args['--provenance-file'] ? readJson(args['--provenance-file']) : { addedBy: 'human-operator' },
    sourceReferences: args['--source-references-file'] ? readJson(args['--source-references-file']) : [],
    themes: splitList(args['--themes']), concepts: splitList(args['--concepts']), entities: splitList(args['--entities']),
    relatedSeeds: splitList(args['--related-seeds']), relatedRuns: splitList(args['--related-runs']), relatedArtifacts: splitList(args['--related-artifacts']), relatedScratchpadItems: splitList(args['--related-scratchpad']),
    status: args['--status'] ?? 'unformed',
  });
  console.log(JSON.stringify({ itemId: result.item.itemId, revision: result.item.revision, created: result.created, path: result.path, contentSha256: result.item.fingerprints.contentSha256 }, null, 2));
}

function review(argv) {
  const args = parse(argv, new Set(['--workspace','--status','--theme','--origin','--related-seed','--recent-days','--include-candidates']));
  if (!args['--workspace']) throw new Error('Scratchpad review requires --workspace');
  const items = listScratchpadItems(args['--workspace'], { status: args['--status'], theme: args['--theme'], origin: args['--origin'], relatedSeed: args['--related-seed'], recentDays: args['--recent-days'] }).map(item => ({
    itemId: item.itemId, revision: item.revision, status: item.status, title: item.observation.title, whyMayMatter: item.observation.whyMayMatter, origin: item.origin.type, themes: item.retrieval.themes, concepts: item.retrieval.concepts, relatedSeeds: item.relationships.seeds, updatedAt: item.lastUpdatedAt,
  }));
  const includeCandidates = args['--include-candidates'] === 'true';
  if (args['--include-candidates'] !== undefined && !['true','false'].includes(args['--include-candidates'])) throw new Error('--include-candidates must be true or false');
  const candidates = includeCandidates ? listSynthesisCandidates(args['--workspace']).map(candidate => ({ candidateId: candidate.candidateId, revision: candidate.revision, status: candidate.status, workingPremise: candidate.workingPremise, scratchpadItemIds: candidate.participants.scratchpadItemIds, updatedAt: candidate.lastUpdatedAt })) : [];
  console.log(JSON.stringify({ itemCount: items.length, items, candidateCount: candidates.length, candidates }, null, 2));
}

export function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (command === 'add') return add(rest);
  if (command === 'review') return review(rest);
  throw new Error('Expected scratchpad command: add or review');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
