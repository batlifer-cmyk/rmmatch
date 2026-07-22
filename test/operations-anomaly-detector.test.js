const assert = require('node:assert/strict');
const { runReadOnlyDetection } = require('../src/operations-anomaly-detector');

const input = {
  students: [
    {
      name: '김영희', status: '활성', remainingLessons: 2, renewalStatus: '',
      lastLessonAt: '2026-06-01', nextLessonAt: '', sourceSheet: '학생DB', sourceRow: 12,
    },
    {
      name: '박철수', status: '연기', remainingLessons: 2, renewalStatus: '',
      lastLessonAt: '2026-01-01', nextLessonAt: '', sourceSheet: '학생DB', sourceRow: 13,
    },
  ],
  lessons: [
    { studentName: '김영희', instructorName: 'Matthew', startAt: '2026-07-20T10:00:00+09:00', code: 'NORMAL', sourceSheet: '수업DB', sourceRow: 20 },
    { studentName: '김영희', instructorName: 'Matthew', startAt: '2026-07-20T10:00:00+09:00', code: 'NORMAL', sourceSheet: '수업DB', sourceRow: 21 },
    { studentName: '이민수', instructorName: 'David', startAt: '2026-07-21T10:00:00+09:00', code: 'BAD', sourceSheet: '수업DB', sourceRow: 22 },
  ],
};

const result = runReadOnlyDetection(input, { now: '2026-07-23T00:00:00+09:00' });
const ruleIds = result.map((item) => item.rule_id);

assert(ruleIds.includes('RM-DET-001'));
assert(ruleIds.includes('RM-DET-002'));
assert(ruleIds.includes('RM-DET-003'));
assert.equal(ruleIds.filter((id) => id === 'RM-DET-005').length, 2);
assert(ruleIds.includes('RM-DET-006'));
assert(!result.some((item) => item.source_row === 13));
assert(result.every((item) => !item.entity_key_masked.includes('김영희')));

console.log(`passed: ${result.length} detections`);
