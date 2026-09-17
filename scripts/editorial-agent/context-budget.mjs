import crypto from 'node:crypto';

export const DEFAULT_EDITORIAL_CONTEXT_CHARS = 24_000;
export const MIN_EDITORIAL_CONTEXT_CHARS = 1_000;
export const MAX_EDITORIAL_CONTEXT_CHARS = 250_000;
const MAX_PASSAGE_CHARS = 4_500;

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const stop = new Set(['that','this','with','from','have','what','they','their','into','about','when','does','should','would','could','there','where','which','while']);
const words = value => new Set((value.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter(word => !stop.has(word)));

export function parseContextBudget(value) {
  if (value === undefined) return DEFAULT_EDITORIAL_CONTEXT_CHARS;
  if (!/^\d+$/.test(String(value))) throw new Error('Editorial context budget must be an integer number of characters');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < MIN_EDITORIAL_CONTEXT_CHARS || parsed > MAX_EDITORIAL_CONTEXT_CHARS) {
    throw new Error(`Editorial context budget must be between ${MIN_EDITORIAL_CONTEXT_CHARS} and ${MAX_EDITORIAL_CONTEXT_CHARS} characters`);
  }
  return parsed;
}

function sourcePriority(item) {
  if (item.kind === 'DFW context, not approved exemplar' || item.kind === 'intake') return 4;
  if (item.kind === 'ai-adoption-read-only-export') return 3;
  if (item.kind === 'exemplar') return 2;
  return 1;
}

function splitLongBlock(block, limit) {
  if (block.length <= limit) return [block];
  const sentences = block.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);
  const parts = [];
  let current = '';
  for (const sentence of sentences.length > 1 ? sentences : block.split(/\s+/)) {
    const separator = current ? ' ' : '';
    if (current.length + separator.length + sentence.length <= limit) {
      current += separator + sentence;
      continue;
    }
    if (current) parts.push(current);
    if (sentence.length <= limit) current = sentence;
    else {
      for (let offset = 0; offset < sentence.length; offset += limit) parts.push(sentence.slice(offset, offset + limit));
      current = '';
    }
  }
  if (current) parts.push(current);
  return parts;
}

function passages(item) {
  const lines = item.body.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let heading = item.provenance?.sectionHeading ?? item.title;
  let blocks = [];
  const flush = () => {
    const text = blocks.join('\n\n').trim();
    if (text) sections.push({ heading, text });
    blocks = [];
  };
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      flush();
      heading = match[2].trim();
    } else if (line.trim()) {
      const last = blocks.at(-1);
      if (last && !last.endsWith('\n') && !/^[-*+]\s|^\d+[.)]\s/.test(line)) blocks[blocks.length - 1] += `\n${line}`;
      else blocks.push(line);
    } else if (blocks.length && blocks.at(-1) !== '') {
      blocks.push('');
    }
  }
  flush();
  if (!sections.length && item.body.trim()) sections.push({ heading, text: item.body.trim() });

  const out = [];
  for (const section of sections) {
    const paragraphs = section.text.split(/\n{2,}/).filter(Boolean).flatMap(block => splitLongBlock(block, MAX_PASSAGE_CHARS));
    let current = '';
    for (const paragraph of paragraphs) {
      const separator = current ? '\n\n' : '';
      if (current.length + separator.length + paragraph.length <= MAX_PASSAGE_CHARS) {
        current += separator + paragraph;
      } else {
        if (current) out.push({ heading: section.heading, text: current });
        current = paragraph;
      }
    }
    if (current) out.push({ heading: section.heading, text: current });
  }
  return out.map((passage, index) => ({ ...passage, passageIndex: index + 1 }));
}

function scorePassage(item, passage, queryTerms) {
  const passageTerms = words(`${item.title} ${passage.heading} ${passage.text}`);
  const overlap = [...passageTerms].filter(term => queryTerms.has(term)).length;
  const headingTerms = words(passage.heading);
  const headingOverlap = [...headingTerms].filter(term => queryTerms.has(term)).length;
  return overlap + (headingOverlap * 3) + sourcePriority(item) / 100;
}

function passageRecord(item, passage, score) {
  const sourceSha256 = item.provenance?.sourceSha256 ?? item.provenance?.sha256 ?? hash(item.body);
  return {
    passageId: `${item.canonicalId}:passage:${passage.passageIndex}`,
    sourceId: item.id,
    canonicalId: item.canonicalId,
    aliases: item.aliases ?? [item.id],
    title: item.title,
    heading: passage.heading,
    passageIndex: passage.passageIndex,
    kind: item.kind,
    roles: item.roles ?? [],
    text: passage.text,
    chars: passage.text.length,
    sourceChars: item.body.length,
    sourceSha256,
    passageSha256: hash(passage.text),
    selectionReason: item.selectionReason,
    provenance: item.provenance ?? {},
    provenanceRecords: item.provenanceRecords ?? [],
    relevanceScore: score,
  };
}

export function buildBoundedEditorialContext({ seed, selectedSources, editorialQuestions = [], budgetChars = DEFAULT_EDITORIAL_CONTEXT_CHARS, operatorOverrideUsed = false, candidateCount = 0 }) {
  budgetChars = parseContextBudget(budgetChars);
  if (!Array.isArray(selectedSources) || !Array.isArray(editorialQuestions)) throw new Error('Selected sources and editorial questions must be arrays');
  const queryTerms = words([seed, ...editorialQuestions, ...selectedSources.map(item => item.selectionReason ?? '')].join('\n'));
  const allPassages = selectedSources.flatMap((item, sourceOrder) => passages(item).map(passage => ({
    record: passageRecord(item, passage, scorePassage(item, passage, queryTerms)),
    sourceOrder,
  })));
  allPassages.sort((a, b) => b.record.relevanceScore - a.record.relevanceScore || a.sourceOrder - b.sourceOrder || a.record.passageIndex - b.record.passageIndex);

  const includedPassages = [];
  const excludedPassages = [];
  let suppliedContextChars = 0;
  for (const entry of allPassages) {
    if (suppliedContextChars + entry.record.chars <= budgetChars) {
      includedPassages.push(entry.record);
      suppliedContextChars += entry.record.chars;
    } else {
      excludedPassages.push({ ...entry.record, omissionReason: 'context-budget' });
    }
  }
  const includedIds = new Set(includedPassages.map(passage => passage.canonicalId));
  const excludedIds = new Set(excludedPassages.map(passage => passage.canonicalId));
  const sourceSummary = item => ({
    sourceId: item.id,
    canonicalId: item.canonicalId,
    aliases: item.aliases ?? [item.id],
    title: item.title,
    kind: item.kind,
    roles: item.roles ?? [],
    sourceChars: item.body.length,
    sourceSha256: item.provenance?.sourceSha256 ?? item.provenance?.sha256 ?? hash(item.body),
    provenance: item.provenance ?? {},
    provenanceRecords: item.provenanceRecords ?? [],
  });
  const availableSelectedSourceChars = selectedSources.reduce((total, item) => total + item.body.length, 0);
  const omittedBecauseBudgetChars = excludedPassages.reduce((total, passage) => total + passage.chars, 0);
  return {
    schemaVersion: 'editorial-context-budget.v1',
    configuredBudgetChars: budgetChars,
    operatorOverrideUsed: Boolean(operatorOverrideUsed),
    candidateCount,
    selectedSourceCount: selectedSources.length,
    availableSelectedSourceChars,
    suppliedContextChars,
    omittedContextChars: availableSelectedSourceChars - suppliedContextChars,
    omittedBecauseBudgetChars,
    includedSources: selectedSources.filter(item => includedIds.has(item.canonicalId)).map(sourceSummary),
    excludedSources: selectedSources.filter(item => !includedIds.has(item.canonicalId) && excludedIds.has(item.canonicalId)).map(sourceSummary),
    includedPassages,
    excludedPassages,
  };
}

export function editorialContextPromptView(context) {
  return context.includedPassages.map(({ passageId, sourceId, canonicalId, aliases, title, heading, passageIndex, kind, roles, text, chars, sourceSha256, passageSha256, selectionReason }) => ({
    passageId, sourceId, canonicalId, aliases, title, heading, passageIndex, kind, roles, text, chars, sourceSha256, passageSha256, selectionReason,
  }));
}
