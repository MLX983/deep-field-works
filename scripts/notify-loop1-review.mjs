#!/usr/bin/env node

import process from 'node:process';
import { notifyLoop1Review } from './lib/loop1-review-notification.mjs';

function usage() {
  return `Usage: npm run notify:loop1-review -- --review-packet <loop1/review-packet.json> --ledger <local-ledger.json> [--send]

Without --send, the command previews the email payload and makes no provider call or ledger write.`;
}

function parseArgs(argv) {
  const result = { reviewPacketPath: '', ledgerPath: '', send: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--review-packet') result.reviewPacketPath = argv[++index] ?? '';
    else if (argument === '--ledger') result.ledgerPath = argv[++index] ?? '';
    else if (argument === '--send') result.send = true;
    else if (argument === '--help' || argument === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return result;
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (input.help) {
    console.log(usage());
    return;
  }
  if (!input.reviewPacketPath || !input.ledgerPath) {
    throw new Error(`--review-packet and --ledger are required.\n${usage()}`);
  }
  const result = await notifyLoop1Review(input);
  console.log(JSON.stringify(result, null, 2));
  if (result.result === 'provider-failed') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
