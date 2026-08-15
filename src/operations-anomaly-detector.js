// Read-only anomaly detector core for Ryan Members operations data.
// This module has no network or spreadsheet write operations.

const DEFAULT_CONFIG = Object.freeze({
  longAbsenceDays: 21,
  remainingLessonThreshold: 3,
  activeStatuses: ['활성', '수강중'],
  excludedStatuses: ['연기', '휴학', '졸업', '환불', '환불진행'],
  allowedLessonCodes: ['NORMAL', 'N', 'n', 'S1'],
});

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeName(value) {
  return normalizeText(value).toLowerCase();
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(later, earlier) {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

function maskKey(value) {
  const text = normalizeText(value);
  if (text.length <= 1) return '*';
  if (text.length === 2) return `${text[0]}*`;
  return `${text[0]}${'*'.repeat(Math.max(1, text.length - 2))}${text[text.length - 1]}`;
}

function makeFingerprint(ruleId, entityKey, sourceRow) {
  return [ruleId, normalizeName(entityKey), sourceRow ?? ''].join('|');
}

function detection({ ruleId, severity, entityType, entityKey, sourceSheet, sourceRow, evidence, recommendedAction }) {
  return {
    detection_id: makeFingerprint(ruleId, entityKey, sourceRow),
    rule_id: ruleId,
    severity,
    entity_type: entityType,
    entity_key_masked: maskKey(entityKey),
    source_sheet: sourceSheet ?? '',
    source_row: sourceRow ?? null,
    fingerprint: makeFingerprint(ruleId, entityKey, sourceRow),
    evidence,
    recommended_action: recommendedAction,
    status: 'open',
  };
}

function detectStudentAnomalies(students, now = new Date(), customConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };
  const results = [];

  for (const student of students) {
    const name = normalizeText(student.name);
    const status = normalizeText(student.status);
    const active = config.activeStatuses.includes(status);
    const excluded = config.excludedStatuses.includes(status);
    const remaining = Number(student.remainingLessons);
    const nextLesson = toDate(student.nextLessonAt);
    const lastLesson = toDate(student.lastLessonAt);
    const renewalStatus = normalizeText(student.renewalStatus);

    if (active && !excluded && Number.isFinite(remaining) && remaining >= 0 && remaining <= config.remainingLessonThreshold && !renewalStatus) {
      results.push(detection({
        ruleId: 'RM-DET-001', severity: 'review', entityType: 'student', entityKey: name,
        sourceSheet: student.sourceSheet, sourceRow: student.sourceRow,
        evidence: `잔여 ${remaining}회, 재등록 상태 공란`,
        recommendedAction: '담당 강사 확인 목록에 추가',
      }));
    }

    if (active && !excluded && lastLesson && daysBetween(now, lastLesson) > config.longAbsenceDays) {
      results.push(detection({
        ruleId: 'RM-DET-002', severity: 'review', entityType: 'student', entityKey: name,
        sourceSheet: student.sourceSheet, sourceRow: student.sourceRow,
        evidence: `마지막 수업 후 ${daysBetween(now, lastLesson)}일 경과`,
        recommendedAction: '장기 미수강 사유와 상태값 확인',
      }));
    }

    if (active && !excluded && remaining > 0 && !nextLesson) {
      results.push(detection({
        ruleId: 'RM-DET-003', severity: 'review', entityType: 'student', entityKey: name,
        sourceSheet: student.sourceSheet, sourceRow: student.sourceRow,
        evidence: `잔여 ${remaining}회, 향후 일정 없음`,
        recommendedAction: '스케줄 미등록 여부 확인',
      }));
    }
  }

  return results;
}

function detectLessonAnomalies(lessons, customConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };
  const results = [];
  const duplicateMap = new Map();

  for (const lesson of lessons) {
    const student = normalizeText(lesson.studentName);
    const instructor = normalizeText(lesson.instructorName);
    const start = toDate(lesson.startAt);
    const code = normalizeText(lesson.code || 'NORMAL');
    const key = [normalizeName(student), normalizeName(instructor), start?.toISOString() ?? 'invalid'].join('|');

    if (!duplicateMap.has(key)) duplicateMap.set(key, []);
    duplicateMap.get(key).push(lesson);

    if (!config.allowedLessonCodes.includes(code)) {
      results.push(detection({
        ruleId: 'RM-DET-006', severity: 'urgent', entityType: 'lesson', entityKey: student,
        sourceSheet: lesson.sourceSheet, sourceRow: lesson.sourceRow,
        evidence: `허용되지 않은 코드: ${code || '(공란)'}`,
        recommendedAction: '원자료 코드 확인',
      }));
    }
  }

  for (const group of duplicateMap.values()) {
    if (group.length < 2) continue;
    for (const lesson of group) {
      results.push(detection({
        ruleId: 'RM-DET-005', severity: 'urgent', entityType: 'lesson', entityKey: lesson.studentName,
        sourceSheet: lesson.sourceSheet, sourceRow: lesson.sourceRow,
        evidence: `동일 학생·강사·시각 기록 ${group.length}건`,
        recommendedAction: '중복 입력 여부 확인',
      }));
    }
  }

  return results;
}

function deduplicateDetections(detections) {
  return [...new Map(detections.map((item) => [item.fingerprint, item])).values()];
}

function runReadOnlyDetection(input, options = {}) {
  const now = options.now ? toDate(options.now) : new Date();
  if (!now) throw new Error('Invalid detection date');
  return deduplicateDetections([
    ...detectStudentAnomalies(input.students ?? [], now, options.config),
    ...detectLessonAnomalies(input.lessons ?? [], options.config),
  ]);
}

module.exports = {
  DEFAULT_CONFIG,
  normalizeText,
  normalizeName,
  maskKey,
  detectStudentAnomalies,
  detectLessonAnomalies,
  deduplicateDetections,
  runReadOnlyDetection,
};
