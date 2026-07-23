'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  REVIEW_HEADERS,
  sanitizeCsvCell,
  sanitizeReportForArtifact,
  resolveSafeOutputDir,
  buildReviewQueue,
  reviewQueueToCsv,
  buildRunManifest,
  writeReviewArtifacts,
} = require('../src/rm-review-artifacts');

test('review queue deduplicates issues, sorts urgent first, and limits to 50', () => {
  const issues = Array.from({ length: 55 }, (_, index) => ({
    fingerprint: `review-${index}`,
    rule_id: `R-${index}`,
    severity: 'review',
    entity_key_masked: '학***',
    evidence: '검토 근거',
  }));
  issues.push({
    fingerprint: 'urgent-1',
    rule_id: 'R-U',
    severity: 'urgent',
    entity_key_masked: '긴***',
    evidence: '긴급 근거',
  });
  issues.push({ ...issues[0] });

  const queue = buildReviewQueue(issues);
  assert.equal(queue.length, 50);
  assert.equal(queue[0].severity, 'urgent');
  assert.equal(queue.filter((item) => item.rule_id === 'R-0').length, 1);
  assert.ok(queue.every((item) => item.review_status === '판단보류'));
});

test('review queue CSV contains the required Korean headers and escapes injection cells', () => {
  const queue = buildReviewQueue([{
    fingerprint: '1',
    rule_id: 'RM-X',
    severity: 'urgent',
    entity_key_masked: 'A***',
    source_sheet: '=Sheet',
    source_row: 2,
    evidence: '+formula',
    recommended_action: '@mention',
  }]);
  const csv = reviewQueueToCsv(queue);
  assert.equal(csv.split('\n')[0], REVIEW_HEADERS.join(','));
  assert.match(csv, /'=Sheet/);
  assert.match(csv, /'\+formula/);
  assert.match(csv, /'@mention/);
});

test('CSV sanitizer leaves safe masked values unchanged', () => {
  assert.equal(sanitizeCsvCell('김***'), '김***');
  assert.equal(sanitizeCsvCell('-danger'), "'-danger");
  assert.equal(sanitizeCsvCell('\r=danger'), "'=danger");
});

test('artifact sanitizer removes raw personal fields and masks phone-like text', () => {
  const safe = sanitizeReportForArtifact({
    generated_at: '2026-07-23T00:00:00.000Z',
    mode: 'READ_ONLY',
    source_stats: {},
    summary: { total: 1 },
    issues: [{
      rule_id: 'RM-X',
      severity: 'review',
      entity_key_masked: '김***',
      studentName: '김민수',
      phone: '010-1234-5678',
      rawMessage: '김민수 원본문자',
      evidence: '입금자 전화 010-1234-5678 확인',
      recommended_action: '원본문자 열은 artifact에 싣지 않음',
    }],
  });
  const serialized = JSON.stringify(safe);
  assert.doesNotMatch(serialized, /김민수|010-1234-5678|rawMessage|studentName/);
  assert.match(serialized, /\[masked-phone\]/);
});

test('manifest records zero production effects and source failures', () => {
  const manifest = buildRunManifest({
    report: {
      generated_at: '2026-07-23T00:00:00.000Z',
      mode: 'READ_ONLY',
      source_stats: { payments: { success: false, error: 'missing permission' } },
      summary: { total: 0 },
      issues: [],
    },
  });

  assert.deepEqual(manifest.source_failures, [{ source: 'payments', error: 'missing permission' }]);
  assert.equal(manifest.safety.production_writes, 0);
  assert.equal(manifest.safety.contains_raw_personal_data, false);
});

test('artifact writer creates report, text, review queue, and manifest for zero issues', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-artifacts-base-'));
  const artifacts = writeReviewArtifacts('out', {
    report: {
      generated_at: '2026-07-23T00:00:00.000Z',
      mode: 'READ_ONLY',
      source_stats: {},
      summary: { total: 0 },
      issues: [],
    },
    textReport: 'empty report',
  }, { baseDir });

  for (const filePath of Object.values(artifacts)) {
    assert.equal(fs.existsSync(filePath), true);
  }
  assert.equal(fs.readFileSync(artifacts.reviewQueuePath, 'utf8'), `${REVIEW_HEADERS.join(',')}\n`);
  const manifest = JSON.parse(fs.readFileSync(artifacts.manifestPath, 'utf8'));
  assert.equal(manifest.review_queue.emitted, 0);
});

test('artifact output path rejects traversal outside the working directory', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-artifacts-base-'));
  assert.throws(() => resolveSafeOutputDir('..', { baseDir }), /must stay inside the working directory/);
  assert.equal(resolveSafeOutputDir('safe/out', { baseDir }), path.join(baseDir, 'safe', 'out'));
});
