#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { createGoogleSheetsReadOnlyClient } = require('../src/google-sheets-readonly-client');
const { runReadOnlyPipeline } = require('../src/rm-readonly-pipeline');
const { writeReviewArtifacts } = require('../src/rm-review-artifacts');
const { createDryRunClient } = require('../src/rm-dry-run-fixtures');

function parseArgs(argv) {
  const args = { outDir: path.join(process.cwd(), 'artifacts', 'rm-readonly'), dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') args.dryRun = true;
    else if (value === '--out-dir') args.outDir = argv[++index];
    else if (value === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/run-rm-readonly.js [--out-dir DIR] [--dry-run]',
    '',
    'Environment for live Google Sheets reads:',
    '- RM_GOOGLE_SERVICE_ACCOUNT_JSON',
    '- RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64',
    '- GOOGLE_APPLICATION_CREDENTIALS',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const client = args.dryRun ? createDryRunClient() : createGoogleSheetsReadOnlyClient();
  const result = await runReadOnlyPipeline(client, { continueOnSourceError: true });
  const written = writeReviewArtifacts(args.outDir, result);
  console.log(`RM read-only report written: ${written.reportPath}`);
  console.log(`RM read-only text report written: ${written.textPath}`);
  console.log(`RM review queue written: ${written.reviewQueuePath}`);
  console.log(`RM run manifest written: ${written.manifestPath}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
