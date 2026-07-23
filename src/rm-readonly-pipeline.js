'use strict';

const { readOperationalSnapshot } = require('./google-sheets-readonly-reader');
const {
  adaptMasterTimeDataRow,
  adaptRegistrationLogRow,
  adaptGraduationLogRow,
  adaptPaymentLogRow,
  adaptRows,
} = require('./rm-readonly-source-adapter');
const { reconcileOperationalData } = require('./rm-cross-source-reconciler');
const { buildReport, toText } = require('./rm-report-builder');

function objectRowsToArrays(rows, headers) {
  return rows.map((row) => {
    const values = headers.map((header) => row[header] ?? '');
    Object.defineProperty(values, '__sourceRow', { value: row.__sourceRow, enumerable: false });
    return values;
  });
}

function normalizeContactRows(rows) {
  return rows.map((row) => ({
    sourceRow: row.__sourceRow,
    studentName: row['학생명'] || '',
    phone: row['전화번호'] || '',
    confidence: row['신뢰도'] || '',
  }));
}

function adaptSnapshot(snapshot) {
  const lessonHeaders = ['Teacher', 'Date', 'Month', 'Day', 'Quarter', 'Student', 'Hours', 'Rate', 'Total amount', 'Class type', 'Note'];
  const registrationHeaders = ['등록일시', '학생명', '전화번호', '금액', '회차수', '담당강사', '입력자', '원본메시지', '상태', '수업유형'];
  const graduationHeaders = ['처리일시', '학생명', '마지막수업일', '잔여', '사유', '처리자', '원본메시지', '상태'];
  const paymentHeaders = ['수신시각', '입금일시', '입금자', '입금액', '추가등록횟수', '강사구분', '판정', '시트행', '처리상태', '잔디전송', '원본문자', '메모'];

  return {
    lessons: adaptRows(objectRowsToArrays(snapshot.lessons.rows, lessonHeaders), adaptMasterTimeDataRow),
    registrations: adaptRows(objectRowsToArrays(snapshot.registrations.rows, registrationHeaders), adaptRegistrationLogRow),
    graduations: adaptRows(objectRowsToArrays(snapshot.graduations.rows, graduationHeaders), adaptGraduationLogRow),
    payments: adaptRows(objectRowsToArrays(snapshot.payments.rows, paymentHeaders), adaptPaymentLogRow),
    contacts: normalizeContactRows(snapshot.contacts.rows),
    studentProfiles: snapshot.studentProfiles.rows,
  };
}

function sourceStats(adapted) {
  return Object.fromEntries(Object.entries(adapted).map(([name, rows]) => [name, {
    success: true,
    row_count: Array.isArray(rows) ? rows.length : 0,
  }]));
}

function snapshotStats(snapshot, adapted) {
  return Object.fromEntries(Object.entries(snapshot).map(([name, source]) => [name, {
    success: source.success !== false,
    row_count: Array.isArray(adapted[name]) ? adapted[name].length : 0,
    range: source.range,
    trust_level: source.trustLevel,
    error: source.error || undefined,
  }]));
}

async function runReadOnlyPipeline(client, options = {}) {
  const snapshot = await readOperationalSnapshot(client, options.config, { continueOnError: options.continueOnSourceError === true });
  const adapted = adaptSnapshot(snapshot);
  const failedSources = Object.values(snapshot).filter((source) => source.success === false);
  const issues = reconcileOperationalData(adapted);
  const report = buildReport({
    generatedAt: options.generatedAt || new Date(),
    sourceStats: snapshotStats(snapshot, adapted),
    issues,
    warnings: [
      '학생명 단독 대조 결과는 확정 판정이 아니라 검토 후보입니다.',
      '카드결제·가족 입금·입금자와 수강생 이름이 다른 경우 오탐이 발생할 수 있습니다.',
      ...failedSources.map((source) => `${source.sourceName} 원천 읽기 실패: ${source.error}`),
    ],
  });
  return { snapshot, adapted, report, textReport: toText(report) };
}

module.exports = { objectRowsToArrays, normalizeContactRows, adaptSnapshot, sourceStats, snapshotStats, runReadOnlyPipeline };
