#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createGoogleSheetsReadOnlyClient } = require('../src/google-sheets-readonly-client');
const { runReadOnlyPipeline } = require('../src/rm-readonly-pipeline');

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

function dryRunClient() {
  const fixtures = {
    'Master time data': [['Teacher', 'Date', 'Month', 'Day', 'Quarter', 'Student', 'Hours', 'Rate', 'Total amount', 'Class type', 'Note']],
    '_DB_등록로그': [['등록일시', '학생명', '전화번호', '금액', '회차수', '담당강사', '입력자', '원본메시지', '상태', '수업유형']],
    '_DB_졸업로그': [['처리일시', '학생명', '마지막수업일', '잔여', '사유', '처리자', '원본메시지', '상태']],
    '입금로그': [['수신시각', '입금일시', '입금자', '입금액', '추가등록횟수', '강사구분', '판정', '시트행', '처리상태', '잔디전송', '원본문자', '메모']],
    '학생연락처': [['학생명', '전화번호', '신뢰도']],
    '학생정보': [['student_id', 'name', 'phone']],
  };
  return Object.freeze({
    async getValues(_spreadsheetId, range) {
      const match = String(range).match(/^'(.+)'!/);
      return fixtures[match?.[1]] || [[]];
    },
  });
}

function writeArtifacts(outDir, result) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, 'rm-report.json');
  const textPath = path.join(outDir, 'rm-report.txt');
  fs.writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
  fs.writeFileSync(textPath, `${result.textReport}\n`);
  return { reportPath, textPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const client = args.dryRun ? dryRunClient() : createGoogleSheetsReadOnlyClient();
  const result = await runReadOnlyPipeline(client, { continueOnSourceError: true });
  const written = writeArtifacts(args.outDir, result);
  console.log(`RM read-only report written: ${written.reportPath}`);
  console.log(`RM read-only text report written: ${written.textPath}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
