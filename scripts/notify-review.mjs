#!/usr/bin/env node

import process from 'node:process';
import { notifyReview } from './lib/review-notification.mjs';

function usage() {
  return `Usage: npm run notify:review -- --manifest <completed-manifest.json> --ledger <local-ledger.json> [--send]\n\nWithout --send, the command performs a dry run and makes no provider call.`;
}

function parseArgs(argv) {
  const result = { manifestPath: '', ledgerPath: '', send: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--manifest') result.manifestPath = argv[++index] ?? '';
    else if (argument === '--ledger') result.ledgerPath = argv[++index] ?? '';
    else if (argument === '--send') result.send = true;
    else if (argument === '--help' || argument === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return result;
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (input.help) { console.log(usage()); return; }
  if (!input.manifestPath || !input.ledgerPath) throw new Error(`--manifest and --ledger are required.\n${usage()}`);
  const result = await notifyReview(input);
  console.log(JSON.stringify(result, null, 2));
  if (result.result === 'provider-failed') process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
