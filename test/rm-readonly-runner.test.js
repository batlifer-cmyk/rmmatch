'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const { readOperationalSnapshot } = require('../src/google-sheets-readonly-reader');
const { runReadOnlyPipeline } = require('../src/rm-readonly-pipeline');
const { createDryRunClient } = require('../src/rm-dry-run-fixtures');

test('readOperationalSnapshot can record a failed source without writing', async () => {
  const config = {
    limits: { maxRowsPerSource: 10 },
    sources: {
      lessons: { spreadsheetId: 'ok', range: "'Master time data'!A:K", trustLevel: 'A' },
      registrations: { spreadsheetId: 'fail', range: "'_DB_등록로그'!A:J", trustLevel: 'B' },
      graduations: { spreadsheetId: 'ok', range: "'_DB_졸업로그'!A:H", trustLevel: 'B' },
      payments: { spreadsheetId: 'ok', range: "'입금로그'!A:L", trustLevel: 'A' },
      contacts: { spreadsheetId: 'ok', range: "'학생연락처'!A:K", trustLevel: 'C' },
      studentProfiles: { spreadsheetId: 'ok', range: "'학생정보'!A:Q", trustLevel: 'B' },
    },
  };
  const client = Object.freeze({
    async getValues(spreadsheetId) {
      if (spreadsheetId === 'fail') throw new Error('fixture source unavailable');
      return [['H']];
    },
  });

  const snapshot = await readOperationalSnapshot(client, config, { continueOnError: true });
  assert.equal(snapshot.registrations.success, false);
  assert.match(snapshot.registrations.error, /fixture source unavailable/);
  assert.deepEqual(snapshot.registrations.rows, []);
});

test('pipeline report includes per-source success and failure stats', async () => {
  const config = {
    limits: { maxRowsPerSource: 10 },
    sources: {
      lessons: { spreadsheetId: 'ok', range: "'Master time data'!A:K", trustLevel: 'A' },
      registrations: { spreadsheetId: 'fail', range: "'_DB_등록로그'!A:J", trustLevel: 'B' },
      graduations: { spreadsheetId: 'ok', range: "'_DB_졸업로그'!A:H", trustLevel: 'B' },
      payments: { spreadsheetId: 'ok', range: "'입금로그'!A:L", trustLevel: 'A' },
      contacts: { spreadsheetId: 'ok', range: "'학생연락처'!A:K", trustLevel: 'C' },
      studentProfiles: { spreadsheetId: 'ok', range: "'학생정보'!A:Q", trustLevel: 'B' },
    },
  };
  const client = Object.freeze({
    async getValues(spreadsheetId) {
      if (spreadsheetId === 'fail') throw new Error('fixture source unavailable');
      return [['H']];
    },
  });

  const result = await runReadOnlyPipeline(client, { config, continueOnSourceError: true });
  assert.equal(result.report.source_stats.lessons.success, true);
  assert.equal(result.report.source_stats.registrations.success, false);
  assert.match(result.report.source_stats.registrations.error, /fixture source unavailable/);
  assert.ok(result.report.warnings.some((warning) => warning.includes('registrations 원천 읽기 실패')));
});

test('dry-run CLI writes JSON and TXT artifacts without credentials', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-readonly-'));
  execFileSync(process.execPath, ['scripts/run-rm-readonly.js', '--dry-run', '--out-dir', outDir], {
    cwd: path.join(__dirname, '..'),
    env: { PATH: process.env.PATH },
    stdio: 'pipe',
  });

  const report = JSON.parse(fs.readFileSync(path.join(outDir, 'rm-report.json'), 'utf8'));
  const text = fs.readFileSync(path.join(outDir, 'rm-report.txt'), 'utf8');
  const csv = fs.readFileSync(path.join(outDir, 'rm-review-queue.csv'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'rm-run-manifest.json'), 'utf8'));
  assert.equal(report.mode, 'READ_ONLY');
  assert.ok(report.source_stats.lessons);
  assert.ok(report.summary.total > 0);
  assert.match(text, /라이언멤버스 운영 이상탐지 보고서/);
  assert.match(csv, /^검수상태,심각도,규칙ID,마스킹 학생키,원천시트,원천행,근거,권장조치,운영자메모/);
  assert.match(csv, /RM-X-011/);
  assert.match(csv, /입금로그/);
  assert.equal(manifest.safety.production_writes, 0);
  assert.equal(manifest.review_queue.emitted, report.summary.total);
});

test('dry-run mock runs Reader to Reconciler to Matcher to Artifact inputs end-to-end', async () => {
  const result = await runReadOnlyPipeline(createDryRunClient(), {
    continueOnSourceError: true,
    generatedAt: new Date('2026-07-23T00:00:00.000Z'),
  });
  const rules = result.report.issues.map((issue) => issue.rule_id);
  assert.ok(rules.includes('RM-X-002'));
  assert.ok(rules.includes('RM-X-007'));
  assert.ok(rules.includes('RM-X-010'));
  assert.ok(rules.includes('RM-X-011'));
  assert.ok(result.report.issues.every((issue) => issue.entity_key_masked && !issue.entity_key_masked.includes('익명학생')));
  assert.ok(result.report.issues.some((issue) => issue.source_sheet === '입금로그'));
});
