import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MODEL = 'gpt-5.6-sol';
export const VERSION = 'v0.2';
export const DEFAULT_MODEL_POLICY = Object.freeze({
  selection: Object.freeze({ model: DEFAULT_MODEL, reasoning: 'low' }),
  editorial: Object.freeze({ model: DEFAULT_MODEL, reasoning: 'medium' }),
});
const REASONING_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const CATALOG_EXCERPT_CHARS = 700;
const text = { type: 'string' };
const list = { type: 'array', items: text };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const selectionSchema = object({ selected: { type: 'array', maxItems: 6, items: object({ id: text, reason: text }) }, editorialQuestions: list });
export const resultSchema = object({
  sourcePremise: text,
  editorialAssessment: object({ judgment: text, rationale: text, primaryDevelopment: text }),
  recommendation: { enum: ['develop', 'preserve', 'defer'], type: 'string' },
  whyWorthPublishing: text,
  proposedArtifact: object({ documentType: { type: 'string', enum: ['seed', 'note', 'field-report', 'essay', 'experiment', 'prototype-note', 'concept', 'checkpoint', 'project-log'] }, workingTitle: text, coreObservation: text, scope: text }),
  draft: text,
  researchBasis: { type: 'array', items: object({ url: text, finding: text, limitation: text }) },
  developmentNotes: object({ candidateFramings: list, revisionNotes: list, researchNotes: text }),
  unresolvedEdge: list, connections: list, scratchpadAdditions: list, proposedKbUpdates: list,
  discoveredBranches: { type: 'array', items: object({ idea: text, howItEmerged: text, relationshipToSeed: text, suggestedNextAction: text }) },
  designPrototypeConnections: { type: 'array', items: object({ designQuestion: text, relationshipToSeed: text, suggestedNextAction: text }) },
});
const ajv = new Ajv({ strict: false });
export function validate(schema, value) {
  const check = ajv.compile(schema);
  if (!check(value)) throw new Error(`Invalid agent output: ${ajv.errorsText(check.errors)}`);
  return value;
}
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const inside = (a, b) => a === b || a.startsWith(b + path.sep);
function resolved(p) {
  p = path.resolve(p);
  return fs.existsSync(p) ? fs.realpathSync(p) : path.join(resolved(path.dirname(p)), path.basename(p));
}
export function checkWorkspace(root, repo, extraForbidden = []) {
  root = resolved(root); repo = resolved(repo);
  const forbidden = [repo, '/tmp/dfw-backlog-state', '/tmp/dfw-backlog-work', ...extraForbidden].map(resolved);
  if ([path.parse(root).root, os.homedir(), '/private/tmp', '/tmp'].includes(root) || forbidden.some(p => inside(root, p) || inside(p, root))) {
    throw new Error('Editorial workspace must be separate from repository, publishing state, and context sources');
  }
  // Refuse accidental use of an existing publishing workspace under another name.
  for (let p = root; p !== path.dirname(p); p = path.dirname(p)) {
    if (fs.existsSync(path.join(p, 'registry.v2.json'))) throw new Error('Publishing registry ancestor rejected');
  }
  return root;
}
export function writePrivate(root, relative, content) {
  const target = path.resolve(root, relative);
  if (!inside(target, root) || target === root || !inside(resolved(target), root)) throw new Error('Unsafe output path');
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  fs.writeFileSync(target, content, { flag: 'wx', mode: 0o600 });
  return target;
}
function command(bin, args, options = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120000, ...options });
  if (r.error || r.status !== 0) throw new Error(`${bin} failed: ${r.error?.message ?? r.stderr}`);
  return r.stdout.trim();
}
export function seedBody(body) {
  const match = body.match(/(?:^|\n)### Body\s*\n([\s\S]*?)(?=\n---\s*\n+## Initial agent classification|$)/);
  return (match ? match[1] : body).trim();
}
const CONCEPT_GROUPS = [
  ['agent','agents','assistant','assistants','autonomous','autonomy','delegate','delegated','delegation'],
  ['authority','permission','permissions','control','consent','boundary','boundaries','governance','oversight','supervision','accountability'],
  ['outage','outages','unavailable','silence','silent','failure','failures','recovery','resilience','continuity','redundancy','dependency','degraded'],
  ['institution','institutions','institutional','organization','organizations','organizational','workflow','workflows','coordination','role','roles','responsibility'],
  ['memory','context','archive','archives','continuity','record','records','provenance','history'],
  ['evidence','research','claim','claims','uncertainty','proof','verification','verify'],
  ['adoption','usage','integration','deployment','transition','implementation'],
  ['interface','interfaces','label','labels','disclosure','transparency','visibility','inspectability','settings','configuration'],
  ['work','task','tasks','delegation','workload','productivity','capacity','time','effort'],
];
function words(s) { return new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(w => !['that','this','with','from','have','what','they','their','into','about','when','does','should','would','could'].includes(w))); }
function rolesFor(item) {
  if (Array.isArray(item.roles)) return item.roles;
  if (item.kind === 'exemplar') return ['exemplar', `${item.provenance.polarity}-exemplar`];
  if (item.kind === 'intake') return ['source-issue'];
  if (item.kind === 'ai-adoption-read-only-export') return ['KB context'];
  if (item.kind === 'provisional scratchpad') return ['scratchpad'];
  if (item.kind === 'canonical domain context') return ['domain context'];
  return ['ordinary context'];
}
export function canonicalizeCandidates(items) {
  const merged = new Map();
  for (const item of items) {
    const canonicalId = item.canonicalId ?? `content:${hash(item.body)}`;
    const roles = rolesFor(item);
    const current = merged.get(canonicalId);
    const record = { id: item.id, kind: item.kind, provenance: item.provenance };
    if (!current) {
      merged.set(canonicalId, { ...item, canonicalId, aliases: [item.id], roles: [...new Set(roles)], provenanceRecords: [record] });
      continue;
    }
    if (current.body !== item.body) throw new Error(`Canonical context identity collision: ${canonicalId}`);
    current.aliases = [...new Set([...current.aliases, item.id])];
    current.roles = [...new Set([...current.roles, ...roles])];
    current.provenanceRecords.push(record);
  }
  return [...merged.values()];
}
function lexicalScore(seedTerms, item) {
  const bodyTerms = words(`${item.title} ${item.body}`);
  const overlap = [...bodyTerms].filter(word => seedTerms.has(word)).length;
  return overlap ? overlap / Math.sqrt(Math.max(bodyTerms.size, 1)) : 0;
}
function conceptualScore(seedTerms, item) {
  const itemTerms = words(`${item.title} ${item.body}`);
  return CONCEPT_GROUPS.reduce((score, group) => {
    const active = group.some(term => seedTerms.has(term));
    if (!active) return score;
    const titleTerms = words(item.title);
    const titleHit = group.some(term => titleTerms.has(term));
    const bodyHit = group.some(term => itemTerms.has(term));
    return score + (titleHit ? 2 : bodyHit ? 1 : 0);
  }, 0);
}
function diverseConceptualPool(items, limit, perSourceLimit = 4) {
  const counts = new Map();
  const selected = [];
  for (const item of items) {
    const source = item.provenance?.sourceSha256 ?? item.canonicalId;
    const count = counts.get(source) ?? 0;
    if (count >= perSourceLimit) continue;
    selected.push(item);
    counts.set(source, count + 1);
    if (selected.length === limit) break;
  }
  return selected;
}
export function shortlist(seed, items, count = 24) {
  const seedTerms = words(seed);
  const scored = canonicalizeCandidates(items).map(item => ({
    ...item,
    lexicalScore: lexicalScore(seedTerms, item),
    conceptualScore: conceptualScore(seedTerms, item),
  }));
  const lexical = [...scored].sort((a,b) => b.lexicalScore - a.lexicalScore || a.id.localeCompare(b.id)).slice(0, 16);
  const conceptual = diverseConceptualPool([...scored].filter(item => item.conceptualScore > 0)
    .sort((a,b) => b.conceptualScore - a.conceptualScore || b.lexicalScore - a.lexicalScore || a.id.localeCompare(b.id)), 12);
  const poolRoles = new Map();
  for (const item of lexical) poolRoles.set(item.canonicalId, ['lexical']);
  for (const item of conceptual) poolRoles.set(item.canonicalId, [...new Set([...(poolRoles.get(item.canonicalId) ?? []), 'conceptual'])]);
  return scored.filter(item => poolRoles.has(item.canonicalId)).map(item => ({
    ...item,
    retrievalPools: poolRoles.get(item.canonicalId),
    score: item.lexicalScore,
  })).sort((a,b) => b.retrievalPools.length - a.retrievalPools.length || b.conceptualScore - a.conceptualScore || b.lexicalScore - a.lexicalScore || a.id.localeCompare(b.id)).slice(0, count);
}
export function chosenContext(selection, catalog) {
  validate(selectionSchema, selection);
  if (new Set(selection.selected.map(x => x.id)).size !== selection.selected.length) throw new Error('Duplicate context selection');
  return selection.selected.map(choice => {
    const item = catalog.find(i => i.id === choice.id);
    if (!item) throw new Error('Unknown context ID');
    return { ...item, selectionReason: choice.reason };
  });
}
function repoContext(repo) {
  const files = command('git', ['-C', repo, 'ls-files', 'src/content/articles', 'src/content/field-notes', 'src/content/concepts']).split('\n').filter(f => f.endsWith('.md'));
  const items = files.map(f => {
    const p = path.join(repo, f);
    if (!inside(fs.realpathSync(p), repo)) throw new Error('Symlink escapes repository context');
    const body = fs.readFileSync(p, 'utf8');
    return { id: f, canonicalId: `source:${hash(body)}`, title: body.match(/^title:\s*(.+)$/m)?.[1] ?? f, body, provenance: { path: f, sha256: hash(body) }, kind: 'DFW context, not approved exemplar' };
  });
  const domainPath = path.join(repo,'docs/source-of-truth/domain-structure.md');
  const domains = fs.readFileSync(domainPath,'utf8');
  for (const section of domains.split(/(?=^# \d+\. )/m).filter(s => /^# \d+\. /.test(s))) {
    const title = section.split('\n')[0];
    // End each domain at the next top-level heading; do not inject the whole guide.
    const body = section.split(/\n# (?!\d+\. )/)[0];
    items.push({id:`domain:${title.replace(/^# \d+\. /,'')}`,canonicalId:`source:${hash(body)}`,title,body,kind:'canonical domain context',provenance:{path:'docs/source-of-truth/domain-structure.md',sha256:hash(body)}});
  }
  return items;
}
export function optionalContext(config) {
  const out = [];
  const seen = new Set();
  for (const [key, kind] of [['exemplars', 'exemplar'], ['aiAdoptionContext', 'ai-adoption-read-only-export']]) {
    if (config[key] !== undefined && !Array.isArray(config[key])) throw new Error('Context lists must be arrays');
    for (const entry of config[key] ?? []) {
      if (['approvedBy','approvedAt','path','source','id'].some(k => typeof entry?.[k] !== 'string' || !entry[k].trim())) throw new Error('Context needs explicit approval and provenance');
      if (Number.isNaN(Date.parse(entry.approvedAt))) throw new Error('Context approval date must be valid');
      if (!path.isAbsolute(entry.path) || !entry.path.endsWith('.md') || !fs.statSync(entry.path).isFile()) throw new Error('Context must reference an absolute Markdown file');
      if (kind === 'exemplar' && !['positive','negative'].includes(entry.polarity)) throw new Error('Exemplar polarity required');
      const baseId = `${kind}:${entry.id}`;
      if (seen.has(baseId)) throw new Error('Duplicate context ID');
      seen.add(baseId);
      const body = fs.readFileSync(entry.path, 'utf8');
      const sourceSha256 = hash(body);
      if (kind === 'exemplar') {
        out.push({ id: baseId, canonicalId: `source:${sourceSha256}`, title: entry.title ?? entry.id, body, kind, provenance: { ...entry, sha256: sourceSha256 } });
        continue;
      }
      const starts = [...body.matchAll(/^##\s+(.+)$/gm)];
      const sections = starts.length ? starts.map((match,index) => ({
        heading: match[1].trim(),
        body: body.slice(match.index, starts[index+1]?.index ?? body.length).trim(),
      })) : [{ heading: entry.title ?? entry.id, body: body.trim() }];
      sections.forEach((section,index) => {
        const slug = section.heading.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64) || `section-${index+1}`;
        out.push({
          id: `${baseId}:${String(index+1).padStart(2,'0')}-${slug}`,
          canonicalId: `section:${sourceSha256}:${index+1}:${hash(section.body)}`,
          title: `${entry.title ?? entry.id} — ${section.heading}`,
          body: section.body,
          kind,
          provenance: { ...entry, sourceSha256, sectionHeading: section.heading, sectionIndex: index+1, sectionSha256: hash(section.body) },
        });
      });
    }
  }
  return out;
}
export function exemplarGuidance(items) {
  return items.filter(item => item.kind === 'exemplar').map(item => ({
    id: item.id,
    title: item.title,
    polarity: item.provenance.polarity,
    editorialFunction: item.provenance.editorialFunction ?? '',
    failureMode: item.provenance.failureMode ?? '',
    lesson: item.provenance.lesson ?? '',
    restrictions: item.provenance.restrictions ?? '',
  }));
}
function catalogView(items, includeProvenanceRecords = false) {
  return items.map(({ body, provenanceRecords, ...item }) => ({
    ...item,
    ...(includeProvenanceRecords ? { provenanceRecords } : {}),
    excerpt: body.slice(0, CATALOG_EXCERPT_CHARS),
  }));
}
function editorialContextView(items) {
  return items.map(item => ({
    id: item.id,
    canonicalId: item.canonicalId,
    aliases: item.aliases,
    title: item.title,
    kind: item.kind,
    roles: item.roles,
    body: item.body,
    selectionReason: item.selectionReason,
  }));
}
function modelChoice(choice, fallback) {
  const model = choice?.model ?? fallback.model;
  const reasoning = choice?.reasoning ?? fallback.reasoning;
  if (typeof model !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(model)) throw new Error('Invalid explicit model name');
  if (!REASONING_LEVELS.has(reasoning)) throw new Error('Unsupported reasoning level; no fallback');
  return { model, reasoning };
}
export function modelPolicy(config = {}, overrides = {}) {
  for (const [label,source] of [['model config',config],['CLI overrides',overrides]]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error(`${label} must be an object`);
    const unknownPhases = Object.keys(source).filter(key => !['selection','editorial'].includes(key));
    if (unknownPhases.length) throw new Error(`Unknown ${label} phase: ${unknownPhases.join(', ')}`);
    for (const [phase,choice] of Object.entries(source)) {
      if (!choice || typeof choice !== 'object' || Array.isArray(choice)) throw new Error(`${label} ${phase} must be an object`);
      const unknownFields = Object.keys(choice).filter(key => !['model','reasoning'].includes(key));
      if (unknownFields.length) throw new Error(`Unknown ${label} ${phase} field: ${unknownFields.join(', ')}`);
    }
  }
  return {
    selection: modelChoice({ ...config.selection, ...overrides.selection }, DEFAULT_MODEL_POLICY.selection),
    editorial: modelChoice({ ...config.editorial, ...overrides.editorial }, DEFAULT_MODEL_POLICY.editorial),
  };
}
export function reasoningPolicy(selection = 'low', editorial = 'medium') {
  const policy = modelPolicy({}, { selection: { reasoning: selection }, editorial: { reasoning: editorial } });
  return { selection: policy.selection.reasoning, editorial: policy.editorial.reasoning };
}
export function scratchpadCandidates(root, mode = 'enabled') {
  if (!['enabled','disabled'].includes(mode)) throw new Error('Unknown scratchpad context mode');
  const scratch = path.join(root,'scratchpad');
  if (mode === 'disabled' || !fs.existsSync(scratch)) return [];
  return fs.readdirSync(scratch).filter(f=>f.endsWith('.json')).sort().slice(-20).map(f => {
    const p = path.join(scratch,f);
    if (!inside(fs.realpathSync(p),root)) throw new Error('Scratchpad symlink rejected');
    return { id:`scratchpad:${f}`, title:f, body:fs.readFileSync(p,'utf8'), kind:'provisional scratchpad', provenance:{path:p} };
  });
}
export function invocation(cwd, schema, output, research, model = DEFAULT_MODEL, reasoning = 'medium') {
  ({ model, reasoning } = modelChoice({ model, reasoning }, DEFAULT_MODEL_POLICY.editorial));
  const disabled = ['shell_tool','unified_exec','apps','plugins','hooks','multi_agent','multi_agent_v2','memories','browser_use','browser_use_external','computer_use','code_mode','image_generation','skill_search'];
  return ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check',
    '--model', model, '--sandbox', 'read-only', '--cd', cwd,
    '-c', 'approval_policy="never"', '-c', 'project_doc_max_bytes=0', '-c', `model_reasoning_effort="${reasoning}"`,
    '-c', `sqlite_home=${JSON.stringify(path.join(cwd,'runtime'))}`, '-c', `log_dir=${JSON.stringify(path.join(cwd,'logs'))}`,
    '-c', `web_search="${research ? 'live' : 'disabled'}"`, '-c', 'features.skip_host_skill_discovery=true',
    ...disabled.flatMap(f => ['--disable', f]), '--output-schema', schema, '--output-last-message', output, '--json', '-'];
}
export function invoke(root, run, phase, prompt, schema, research, bin, runtime = DEFAULT_MODEL_POLICY[phase]) {
  const dir = path.join(root, 'runs', run);
  const schemaPath = writePrivate(root, `runs/${run}/${phase}-schema.json`, JSON.stringify(schema));
  writePrivate(root, `runs/${run}/${phase}-prompt.txt`, prompt);
  const output = path.join(dir, `${phase}-response.json`);
  const { model, reasoning } = modelChoice(runtime, DEFAULT_MODEL_POLICY[phase]);
  const args = invocation(dir, schemaPath, output, research, model, reasoning);
  const start = new Date().toISOString();
  const r = spawnSync(bin, args, { cwd: dir, encoding: 'utf8', input: prompt, maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60 * 1000 });
  writePrivate(root, `runs/${run}/${phase}-events.jsonl`, r.stdout ?? '');
  writePrivate(root, `runs/${run}/${phase}-stderr.log`, r.stderr ?? '');
  const eventErrors = (r.stdout ?? '').split('\n').flatMap(line => {
    try {
      const event = JSON.parse(line);
      return event.type === 'error' || event.item?.type === 'error' ? [JSON.stringify(event)] : [];
    } catch {
      return [];
    }
  });
  const fallbackOccurred = /falling back|fallback model|using (?:the )?default model|(?:model|reasoning).*not supported|model.*not found/i.test(`${r.stderr ?? ''}\n${eventErrors.join('\n')}`);
  const succeeded = !r.error && r.status === 0 && !fallbackOccurred;
  const execution = {
    requestedModel: model, requestedReasoning: reasoning,
    actualModel: succeeded ? model : null, actualReasoning: succeeded ? reasoning : null,
    actualConfigurationEvidence: succeeded ? 'Explicit CLI arguments; successful exit; no fallback signal' : null,
    fallbackOccurred, command: [bin,...args], start, end: new Date().toISOString(), exitCode: r.status, error: r.error?.message ?? null,
  };
  writePrivate(root, `runs/${run}/${phase}-execution.json`, JSON.stringify(execution, null, 2));
  if (r.error || r.status !== 0 || fallbackOccurred) {
    const error = new Error(fallbackOccurred ? 'Requested model/reasoning was not honored; fallback rejected' : `${phase} failed for requested ${model}/${reasoning}; no fallback. Inspect ${phase}-stderr.log`);
    Object.assign(error, { phase, execution });
    throw error;
  }
  try {
    return { value: validate(schema, JSON.parse(fs.readFileSync(output, 'utf8'))), execution };
  } catch (error) {
    Object.assign(error, { phase, execution });
    throw error;
  }
}
export function persistResult(root, run, result, provenance) {
  validate(resultSchema, result);
  writePrivate(root, `runs/${run}/result.json`, JSON.stringify(result, null, 2));
  writePrivate(root, `runs/${run}/draft.md`, result.draft);
  writePrivate(root, `runs/${run}/research.json`, JSON.stringify(result.researchBasis, null, 2));
  writePrivate(root, `runs/${run}/development.json`, JSON.stringify(result.developmentNotes, null, 2));
  writePrivate(root, `runs/${run}/branches.json`, JSON.stringify({ canonical: false, ...provenance, branches: result.discoveredBranches }, null, 2));
  writePrivate(root, `runs/${run}/design-connections.json`, JSON.stringify({ canonical: false, ...provenance, connections: result.designPrototypeConnections }, null, 2));
  writePrivate(root, `runs/${run}/kb-proposals.json`, JSON.stringify({ canonical: false, ...provenance, suggestions: result.proposedKbUpdates }, null, 2));
  writePrivate(root, `scratchpad/${run}.json`, JSON.stringify({ canonical: false, ...provenance, entries: result.scratchpadAdditions, discoveredBranches: result.discoveredBranches, designPrototypeConnections: result.designPrototypeConnections }, null, 2));
  return { status: 'awaiting-human-editorial-review', approvalGranted: false,
    warnings: result.draft.includes('—') ? ['Draft contains em dash; preserve generated result for review'] : [] };
}
export async function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i=0; i<argv.length; i+=2) {
    if (!['--workspace','--repo-path','--issue-number','--context-config','--model-config','--research','--selection-model','--selection-reasoning','--editorial-model','--editorial-reasoning','--scratchpad-context'].includes(argv[i]) || !argv[i+1]) throw new Error('Expected --workspace PATH --repo-path PATH --issue-number N [--context-config JSON] [--model-config JSON] [--selection-model MODEL] [--selection-reasoning LEVEL] [--editorial-model MODEL] [--editorial-reasoning LEVEL] [--research live|disabled] [--scratchpad-context enabled|disabled]');
    args[argv[i]] = argv[i+1];
  }
  const issue = Number(args['--issue-number']);
  if (!Number.isSafeInteger(issue) || issue < 1 || !args['--workspace'] || !args['--repo-path']) throw new Error('Explicit workspace, repository and issue number required');
  const repo = fs.realpathSync(args['--repo-path']);
  const config = args['--context-config'] ? JSON.parse(fs.readFileSync(args['--context-config'],'utf8')) : { exemplars: [], aiAdoptionContext: [] };
  const modelConfig = args['--model-config'] ? JSON.parse(fs.readFileSync(args['--model-config'],'utf8')) : {};
  const research = args['--research'] ?? 'live';
  if (!['live','disabled'].includes(research)) throw new Error('Unknown research mode');
  const runtimePolicy = modelPolicy(modelConfig, {
    selection: Object.fromEntries(Object.entries({ model: args['--selection-model'], reasoning: args['--selection-reasoning'] }).filter(([,value]) => value !== undefined)),
    editorial: Object.fromEntries(Object.entries({ model: args['--editorial-model'], reasoning: args['--editorial-reasoning'] }).filter(([,value]) => value !== undefined)),
  });
  const scratchpadContext = args['--scratchpad-context'] ?? 'enabled';
  if (!['enabled','disabled'].includes(scratchpadContext)) throw new Error('Unknown scratchpad context mode');
  const approvedContext = optionalContext(config);
  const root = checkWorkspace(args['--workspace'], repo, [...(config.exemplars ?? []), ...(config.aiAdoptionContext ?? [])].map(x => x.path));
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const run = `editorial-${VERSION}-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomUUID().slice(0,8)}`;
  const write = (f, v) => writePrivate(root, `runs/${run}/${f}`, typeof v === 'string' ? v : JSON.stringify(v,null,2));
  const phaseRuntime = Object.fromEntries(Object.entries(runtimePolicy).map(([phase,requested]) => [phase, {
    requestedModel: requested.model,
    requestedReasoning: requested.reasoning,
    actualModel: null,
    actualReasoning: null,
    fallbackOccurred: false,
    status: 'pending',
  }]));
  const manifest = { runId: run, version: VERSION, modelPolicy: phaseRuntime, fallbackOccurred: false, modelConfigPath: args['--model-config'] ? path.resolve(args['--model-config']) : null, scratchpadContext, issueNumber: issue, status: 'running', research, approvalGranted: false, startedAt: new Date().toISOString() };
  write('started.json', manifest);
  try {
    const bin = process.env.CODEX_BIN || 'codex';
    manifest.cliVersion = command(bin, ['--version']);
    manifest.loginStatus = command(bin, ['login', 'status']);
    manifest.repositoryCommit = command('git', ['-C', repo, 'rev-parse', 'HEAD']);
    const source = JSON.parse(command('gh', ['issue', 'view', String(issue), '--repo', 'MLX983/dfw-intake', '--json', 'number,title,body,url,createdAt,updatedAt']));
    write('source.json', source);
    manifest.sourceBodySha256 = hash(source.body);
    const seed = seedBody(source.body); write('seed.md', seed);
    const issues = JSON.parse(command('gh', ['issue', 'list', '--repo', 'MLX983/dfw-intake', '--state', 'all', '--limit', '100', '--json', 'number,title,body,url,createdAt,updatedAt']));
    const candidates = issues.filter(i => i.number !== issue).map(i => ({ id: `intake:${i.number}`, canonicalId: `issue:${i.url}`, title: i.title, body: seedBody(i.body), kind: 'intake', provenance: { url:i.url, createdAt:i.createdAt, updatedAt:i.updatedAt, sha256:hash(i.body) } }));
    candidates.push(...repoContext(repo), ...approvedContext);
    // Prior scratchpad is context only, never instructions or approved exemplar material.
    candidates.push(...scratchpadCandidates(root,scratchpadContext));
    const catalog = shortlist(seed, candidates);
    const visibleCatalog = catalogView(catalog);
    write('catalog.json', catalogView(catalog,true));
    const role = fs.readFileSync(path.join(HERE,'role.md'),'utf8');
    write('role.md', role);
    const selectionRun = invoke(root,run,'selection', `${role}\n\nSelect zero to six context IDs whose full text would materially improve this seed. Explain each selection. Do not choose the final artifact yet. No research in this selection phase. Retrieval pools are candidate-generation signals only; no source type is mandatory.\nSEED:\n${seed}\nCATALOG:\n${JSON.stringify(visibleCatalog)}`, selectionSchema,false,bin,runtimePolicy.selection);
    const selection = selectionRun.value;
    Object.assign(manifest.modelPolicy.selection, { actualModel: selectionRun.execution.actualModel, actualReasoning: selectionRun.execution.actualReasoning, fallbackOccurred: selectionRun.execution.fallbackOccurred, status: 'completed' });
    const context = chosenContext(selection,catalog); write('context.json',context);
    const editorialRun = invoke(root,run,'editorial', `${role}\n\nResearch tools: ${research}. ${research === 'disabled' ? 'Research unavailable; disclose limitations.' : 'Independently research when evidence could change the piece.'}\nReturn the editorial contract. draft is reader-facing Markdown including title, or empty if no piece is worthwhile yet. Preserve internal notes separately.\nSEED (${source.url}, ${source.createdAt}):\n${seed}\nAPPROVED EXEMPLAR FUNCTIONS AND ANTI-PATTERNS (guidance only; full prose appears below only when selectively chosen):\n${JSON.stringify(exemplarGuidance(approvedContext))}\nSELECTED FULL CONTEXT:\n${JSON.stringify(editorialContextView(context))}\nYOUR EDITORIAL QUESTIONS:\n${JSON.stringify(selection.editorialQuestions)}`,resultSchema,research==='live',bin,runtimePolicy.editorial);
    const result = editorialRun.value;
    Object.assign(manifest.modelPolicy.editorial, { actualModel: editorialRun.execution.actualModel, actualReasoning: editorialRun.execution.actualReasoning, fallbackOccurred: editorialRun.execution.fallbackOccurred, status: 'completed' });
    Object.assign(manifest, persistResult(root,run,result,{runId:run,sourceUrl:source.url,sourceBodySha256:manifest.sourceBodySha256}), { selectedContext:context.map(c=>c.id), completedAt:new Date().toISOString() });
    write('manifest.json',manifest);
    write('run-report.json', { runId:run, status:manifest.status, modelPolicy:manifest.modelPolicy, fallbackOccurred:manifest.fallbackOccurred, recommendation:result.recommendation, proposedArtifact:result.proposedArtifact, approvalGranted:false });
    console.log(JSON.stringify({ ...manifest, workspace:path.join(root,'runs',run) },null,2));
  } catch(error) {
    if (error.phase && error.execution && manifest.modelPolicy[error.phase]) {
      Object.assign(manifest.modelPolicy[error.phase], {
        actualModel: error.execution.actualModel,
        actualReasoning: error.execution.actualReasoning,
        fallbackOccurred: error.execution.fallbackOccurred,
        status: 'failed',
      });
    }
    manifest.fallbackOccurred = Object.values(manifest.modelPolicy).some(phase => phase.fallbackOccurred);
    const failure = {...manifest,status:'failed',message:error.message,completedAt:new Date().toISOString()};
    write('failure.json',failure);
    if (!fs.existsSync(path.join(root,'runs',run,'run-report.json'))) {
      write('run-report.json',{runId:run,status:'failed',modelPolicy:manifest.modelPolicy,fallbackOccurred:manifest.fallbackOccurred,message:error.message,approvalGranted:false});
    }
    throw error;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode=1; });
