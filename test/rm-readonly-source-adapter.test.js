const assert = require('assert');
const {
  numberValue,
  isTemporaryStudentLabel,
  adaptMasterTimeDataRow,
  adaptRegistrationLogRow,
  adaptGraduationLogRow,
  adaptPaymentLogRow,
} = require('../src/rm-readonly-source-adapter');

assert.strictEqual(numberValue('602,580'), 602580);
assert.strictEqual(numberValue(''), null);
assert.strictEqual(isTemporaryStudentLabel('786431611BC'), true);
assert.strictEqual(isTemporaryStudentLabel('정성헌'), false);

const lesson = adaptMasterTimeDataRow(
  ['Andy', 'Jan 1, 2025', 'January 2025', 'Wednesday', 'Q1 2025', '박형호', '2', '25000', '50000', '스몰톡', '보충'],
  3,
);
assert.strictEqual(lesson.hours, 2);
assert.strictEqual(lesson.code, 'NORMAL');
assert.strictEqual(lesson.reviewRequired, false);

const noShowLesson = adaptMasterTimeDataRow(
  ['Andy', 'Jan 1, 2025', 'January 2025', 'Wednesday', 'Q1 2025', '신동진', 'n', '25000', '', '스몰톡', ''],
  2,
);
assert.strictEqual(noShowLesson.hours, null);
assert.strictEqual(noShowLesson.code, 'n');

const suspiciousRegistration = adaptRegistrationLogRow(
  ['2026-07-21 10:35:34', '786431611BC', '', '602,580', '999', '', '메이크자동화', '원문', '확인필요', ''],
  2,
);
assert.strictEqual(suspiciousRegistration.reviewRequired, true);
assert.ok(suspiciousRegistration.reviewReasons.includes('비정상 회차수'));
assert.ok(suspiciousRegistration.reviewReasons.includes('임시 또는 비정상 학생 식별값'));

const graduation = adaptGraduationLogRow(
  ['2026. 7. 17 오후 3:43:31', '진유섭', '2026-07-13', '', '업무 후 이동 부담', 'RYAN CHOI', '원문', '확정'],
  3,
);
assert.strictEqual(graduation.reviewRequired, false);
assert.strictEqual(graduation.remainingLessons, null);

const payment = adaptPaymentLogRow(
  ['2026-06-05 14:48:41', '06/05 14:48', '이준영', '550000', '8', '확인필요_550K', '재등록', '2', '완료', '대기', '원문', ''],
  2,
);
assert.strictEqual(payment.amount, 550000);
assert.strictEqual(payment.reviewRequired, true);

console.log('rm-readonly-source-adapter tests passed');
