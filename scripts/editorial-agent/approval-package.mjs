import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APPROVAL_PACKAGE_VERSION = 'editorial-approval-package.v1';
export const DOCUMENT_TYPES = Object.freeze(['seed','note','field-report','essay','experiment','prototype-note','concept','checkpoint','project-log']);
export const approvalPackageSchema = JSON.parse(fs.readFileSync(path.join(HERE, 'editorial-approval-package.v1.schema.json'), 'utf8'));
const ajv = new Ajv2020({ strict: false, formats: { 'date-time': value => !Number.isNaN(Date.parse(value)) } });
const validatePackage = ajv.compile(approvalPackageSchema);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function normalizeSet(items, label, requiredKey, optionalKey) {
  if (items === undefined) return [];
  if (!Array.isArray(items)) throw new Error(`${label} must be a JSON array`);
  const normalized = items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${label} entries must be objects`);
    const unknown = Object.keys(item).filter(key => ![requiredKey, optionalKey].includes(key));
    if (unknown.length || typeof item[requiredKey] !== 'string' || !item[requiredKey].trim() || (item[optionalKey] !== undefined && typeof item[optionalKey] !== 'string')) throw new Error(`Invalid ${label} entry`);
    return { [requiredKey]: item[requiredKey].trim(), ...(item[optionalKey] === undefined ? {} : { [optionalKey]: item[optionalKey].trim() }) };
  });
  const unique = new Map(normalized.map(item => [stableJson(item), item]));
  return [...unique.values()].sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
}

export function contentFingerprint(approvedArtifact) {
  const publicationContent = {
    documentType: approvedArtifact.documentType,
    title: approvedArtifact.title,
    body: approvedArtifact.body,
    externalReferences: approvedArtifact.externalReferences,
    relatedDfwConnections: approvedArtifact.relatedDfwConnections,
  };
  return sha256(stableJson(publicationContent));
}

export function verifyApprovalPackage(value) {
  if (!validatePackage(value)) throw new Error(`Invalid EditorialApprovalPackage: ${ajv.errorsText(validatePackage.errors)}`);
  if (contentFingerprint(value.approvedArtifact) !== value.fingerprints.contentSha256) throw new Error('Editorial approval content fingerprint mismatch');
  const { packageSha256, ...fingerprintsWithoutPackage } = value.fingerprints;
  const packageMaterial = { ...value, fingerprints: fingerprintsWithoutPackage };
  if (sha256(stableJson(packageMaterial)) !== packageSha256) throw new Error('Editorial approval package fingerprint mismatch');
  return value;
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function runFile(runDirectory, name) {
  const target = path.join(runDirectory, name);
  if (!fs.existsSync(target) || !inside(fs.realpathSync(target), fs.realpathSync(runDirectory))) throw new Error(`Required source-run file is missing or escapes the run: ${name}`);
  return target;
}

function existingPackages(root, artifactId) {
  const directory = path.join(root, 'approvals', artifactId);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(name => name.endsWith('.json')).map(name => {
    const target = path.join(directory, name);
    if (!inside(fs.realpathSync(target), fs.realpathSync(root))) throw new Error('Approval package symlink escapes workspace');
    return verifyApprovalPackage(loadJson(target));
  });
}

export function createApprovalPackage({ workspace, sourceRunId, editorialArtifactId, documentType, approvedBy, approvalMarker, approvedAt = new Date().toISOString(), approveCurrentDraft = false, title, body, externalReferences, relatedDfwConnections }) {
  if (!workspace || !fs.existsSync(workspace)) throw new Error('Existing editorial workspace required');
  const root = fs.realpathSync(workspace);
  if (!/^editorial-v[0-9A-Za-z.-]+$/.test(sourceRunId ?? '')) throw new Error('Valid source Editorial Agent run ID required');
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(editorialArtifactId ?? '')) throw new Error('Editorial artifact ID must be a lowercase stable slug');
  if (!DOCUMENT_TYPES.includes(documentType)) throw new Error('Approved artifact type is invalid');
  if (typeof approvedBy !== 'string' || !approvedBy.trim() || typeof approvalMarker !== 'string' || !approvalMarker.trim()) throw new Error('Explicit approval identity and marker required');
  if (Number.isNaN(Date.parse(approvedAt))) throw new Error('Approval timestamp must be valid');

  const runDirectory = path.join(root, 'runs', sourceRunId);
  if (!fs.existsSync(runDirectory) || !inside(fs.realpathSync(runDirectory), root)) throw new Error('Source Editorial Agent run not found in workspace');
  const manifest = loadJson(runFile(runDirectory, 'manifest.json'));
  const source = loadJson(runFile(runDirectory, 'source.json'));
  if (manifest.runId !== sourceRunId || manifest.status !== 'awaiting-human-editorial-review' || manifest.approvalGranted !== false) throw new Error('Source run is not at the unapproved human-review boundary');
  if (!Number.isSafeInteger(source.number) || source.number < 1 || typeof source.url !== 'string' || typeof source.body !== 'string' || sha256(source.body) !== manifest.sourceBodySha256) throw new Error('Source run provenance is incomplete or does not match its source fingerprint');

  if (approveCurrentDraft) {
    if (title !== undefined || body !== undefined) throw new Error('Current-draft approval cannot be combined with edited title/body');
    const result = loadJson(runFile(runDirectory, 'result.json'));
    title = result.proposedArtifact?.workingTitle;
    body = fs.readFileSync(runFile(runDirectory, 'draft.md'), 'utf8');
  } else if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
    throw new Error('Edited approval requires both final title and final body');
  }

  const approvedArtifact = {
    documentType,
    title,
    body,
    externalReferences: normalizeSet(externalReferences, 'External references', 'url', 'title'),
    relatedDfwConnections: normalizeSet(relatedDfwConnections, 'DFW connections', 'reference', 'note'),
  };
  const prior = existingPackages(root, editorialArtifactId);
  const revision = prior.reduce((maximum, item) => Math.max(maximum, item.revision), 0) + 1;
  const contentSha256 = contentFingerprint(approvedArtifact);
  const packageId = `eap-${editorialArtifactId}-r${String(revision).padStart(4, '0')}-${contentSha256.slice(0, 12)}`;
  const packageWithoutPackageHash = {
    schemaVersion: APPROVAL_PACKAGE_VERSION,
    packageId,
    editorialArtifactId,
    revision,
    sourceProvenance: {
      sourceIntakeId: `MLX983/dfw-intake#${source.number}`,
      intakeRepository: 'MLX983/dfw-intake',
      intakeIssueNumber: source.number,
      sourceUrl: source.url,
      sourceBodySha256: manifest.sourceBodySha256,
      editorialAgentRunId: sourceRunId,
    },
    approvedArtifact,
    approval: { approvedBy: approvedBy.trim(), approvalMarker: approvalMarker.trim(), approvedAt: new Date(approvedAt).toISOString() },
    fingerprints: { contentSha256 },
    editorialApprovalGranted: true,
  };
  const value = {
    ...packageWithoutPackageHash,
    fingerprints: { ...packageWithoutPackageHash.fingerprints, packageSha256: sha256(stableJson(packageWithoutPackageHash)) },
  };
  verifyApprovalPackage(value);

  const approvalsRoot = path.join(root, 'approvals');
  if (fs.existsSync(approvalsRoot) && !inside(fs.realpathSync(approvalsRoot), root)) throw new Error('Approval output root escapes workspace');
  fs.mkdirSync(approvalsRoot, { recursive: true, mode: 0o700 });
  const directory = path.join(approvalsRoot, editorialArtifactId);
  if (fs.existsSync(directory) && !inside(fs.realpathSync(directory), root)) throw new Error('Approval output directory escapes workspace');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (!inside(fs.realpathSync(directory), root)) throw new Error('Approval output directory escapes workspace');
  const target = path.join(directory, `${packageId}.json`);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  fs.chmodSync(target, 0o400);
  return { package: value, path: target };
}

function parseArgs(argv) {
  const args = {};
  const boolean = new Set(['--approve-current-draft']);
  const allowed = new Set(['--workspace','--source-run','--artifact-id','--artifact-type','--approved-by','--approval-marker','--approved-at','--title','--body-file','--references-file','--relationships-file', ...boolean]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!allowed.has(key) || args[key] !== undefined) throw new Error(`Unknown or repeated approval option: ${key}`);
    if (boolean.has(key)) args[key] = true;
    else {
      if (!argv[index + 1]) throw new Error(`Missing value for ${key}`);
      args[key] = argv[++index];
    }
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const body = args['--body-file'] ? fs.readFileSync(path.resolve(args['--body-file']), 'utf8') : undefined;
  const externalReferences = args['--references-file'] ? loadJson(path.resolve(args['--references-file'])) : undefined;
  const relatedDfwConnections = args['--relationships-file'] ? loadJson(path.resolve(args['--relationships-file'])) : undefined;
  const result = createApprovalPackage({
    workspace: args['--workspace'], sourceRunId: args['--source-run'], editorialArtifactId: args['--artifact-id'], documentType: args['--artifact-type'],
    approvedBy: args['--approved-by'], approvalMarker: args['--approval-marker'], approvedAt: args['--approved-at'], approveCurrentDraft: Boolean(args['--approve-current-draft']),
    title: args['--title'], body, externalReferences, relatedDfwConnections,
  });
  console.log(JSON.stringify({ packageId: result.package.packageId, revision: result.package.revision, contentSha256: result.package.fingerprints.contentSha256, packageSha256: result.package.fingerprints.packageSha256, path: result.path }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
