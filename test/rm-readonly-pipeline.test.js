'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { rowsToObjects, assertReadOnlyClient } = require('../src/google-sheets-readonly-reader');
const { reconcileOperationalData } = require('../src/rm-cross-source-reconciler');
const { buildReport } = require('../src/rm-report-builder');
const { objectRowsToArrays } = require('../src/rm-readonly-pipeline');

test('rowsToObjects preserves source row numbers', () => {
  const result = rowsToObjects([['학생명', '금액'], ['김가', '550000'], [], ['이가', '450000']]);
  assert.equal(result.length, 2);
  assert.equal(result[0].__sourceRow, 2);
  assert.equal(result[1].__sourceRow, 4);
});

test('read-only boundary rejects write-capable clients', () => {
  assert.throws(() => assertReadOnlyClient({ getValues() {}, updateValues() {} }), /Write-capable/);
  assert.doesNotThrow(() => assertReadOnlyClient({ getValues() {} }));
});

test('objectRowsToArrays follows explicit header order', () => {
  assert.deepEqual(objectRowsToArrays([{ B: 2, A: 1 }], ['A', 'B']), [[1, 2]]);
});

test('reconciler detects test payments and unmatched records', () => {
  const issues = reconcileOperationalData({
    payments: [{ payerName: '김가', memo: 'TEST 시나리오', sourceRow: 2 }],
    registrations: [{ studentName: '이가', packageCount: 8, sourceRow: 3 }],
    graduations: [], lessons: [], contacts: [],
  });
  const rules = issues.map((issue) => issue.rule_id);
  assert.ok(rules.includes('RM-X-001'));
  assert.ok(rules.includes('RM-X-003'));
  assert.ok(rules.includes('RM-X-004'));
});

test('reconciler reports payment identity confidence and avoids name-only certainty', () => {
  const issues = reconcileOperationalData({
    payments: [{ payerName: '보호자(익명학생A)', rawMessage: '가족 입금', sourceRow: 7 }],
    registrations: [{ studentName: '익명학생A', packageCount: 8, sourceRow: 8 }],
    contacts: [],
  });
  const identityIssue = issues.find((issue) => issue.rule_id === 'RM-X-011');
  assert.ok(identityIssue);
  assert.match(identityIssue.evidence, /review/);
  assert.match(identityIssue.evidence, /family_payer/);
});

test('reconciler reports homonym payment conflicts', () => {
  const issues = reconcileOperationalData({
    payments: [{ payerName: '익명학생C', sourceRow: 11 }],
    contacts: [
      { studentName: '익명학생C', phone: '010-1000-0001', sourceRow: 21 },
      { studentName: '익명학생C', phone: '010-1000-0002', sourceRow: 22 },
    ],
  });
  const identityIssue = issues.find((issue) => issue.rule_id === 'RM-X-011');
  assert.ok(identityIssue);
  assert.equal(identityIssue.severity, 'urgent');
  assert.match(identityIssue.evidence, /homonym_conflict/);
});

test('reconciler detects lessons after graduation', () => {
  const issues = reconcileOperationalData({
    payments: [], registrations: [], contacts: [],
    graduations: [{ studentName: '김가', processedAt: '2026-07-17', sourceRow: 2 }],
    lessons: [{ studentName: '김가', lessonDate: '2026-07-20', sourceRow: 9 }],
  });
  assert.ok(issues.some((issue) => issue.rule_id === 'RM-X-005'));
});

test('report builder creates counts by severity and rule', () => {
  const report = buildReport({ generatedAt: new Date('2026-07-23T00:00:00Z'), issues: [
    { rule_id: 'A', severity: 'review' },
    { rule_id: 'A', severity: 'urgent' },
  ] });
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.urgent, 1);
  assert.equal(report.summary.byRule.A, 2);
  assert.equal(report.mode, 'READ_ONLY');
});
