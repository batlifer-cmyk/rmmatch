'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { reconcileOperationalData } = require('../src/rm-cross-source-reconciler');

test('강사명이 학생명 열에 들어간 졸업행을 탐지한다', () => {
  const issues = reconcileOperationalData({
    graduations: [{ studentName: '매튜', rawMessage: '김수영 졸업', status: '확정', sourceRow: 11 }],
  });
  assert.ok(issues.some((issue) => issue.rule_id === 'RM-X-007'));
});

test('자동감지 알림행을 확정 졸업과 분리한다', () => {
  const issues = reconcileOperationalData({
    graduations: [{ studentName: '배동환', rawMessage: '자동감지(일일스캔)', status: '알림전송', sourceRow: 22 }],
  });
  assert.ok(issues.some((issue) => issue.rule_id === 'RM-X-008'));
  assert.ok(!issues.some((issue) => issue.rule_id === 'RM-X-005'));
});

test('동일 학생·일자·금액·회차 등록 중복을 탐지한다', () => {
  const issues = reconcileOperationalData({
    registrations: [
      { studentName: '김동연', registeredAt: '2026-07-16 20:20', amount: 550000, packageCount: 8, sourceRow: 12 },
      { studentName: '김동연', registeredAt: '2026-07-16 20:20', amount: 550000, packageCount: 8, sourceRow: 13 },
    ],
  });
  assert.ok(issues.some((issue) => issue.rule_id === 'RM-X-009'));
});

test('취소와 비패키지 거래는 등록-입금 미매칭과 중복 패키지 판정에서 제외한다', () => {
  const issues = reconcileOperationalData({
    registrations: [
      {
        studentName: '익명학생A', registeredAt: '2026-07-16', amount: 550000, packageCount: 8,
        transactionKind: 'CANCELLED', excludedFromPackageTotals: true, sourceRow: 31,
      },
      {
        studentName: '익명학생A', registeredAt: '2026-07-16', amount: 550000, packageCount: 8,
        transactionKind: 'NON_PACKAGE_ADJUSTMENT', excludedFromPackageTotals: true, sourceRow: 32,
      },
    ],
    payments: [],
  });

  assert.ok(!issues.some((issue) => issue.rule_id === 'RM-X-003'));
  assert.ok(!issues.some((issue) => issue.rule_id === 'RM-X-009'));
});

test('동일 학생의 동일 졸업사유 분할·중복 후보를 탐지한다', () => {
  const issues = reconcileOperationalData({
    graduations: [
      { studentName: '익명학생B', lastLessonDate: '2026-07-01', reason: '이동 부담', status: '확정', sourceRow: 41 },
      { studentName: '익명학생B', lastLessonDate: '2026-07-01', reason: ' 이동  부담 ', status: '확정', sourceRow: 42 },
    ],
  });

  assert.ok(issues.some((issue) => issue.rule_id === 'RM-X-010'));
});
