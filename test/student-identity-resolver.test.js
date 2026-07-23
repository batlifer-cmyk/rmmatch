const assert = require('node:assert/strict');
const {
  normalizePhone,
  normalizeDate,
  extractNameAliases,
  scorePaymentStudentMatch,
  matchPaymentToStudents,
  scoreIdentityMatch,
  chooseCanonicalId,
  resolveIdentity,
} = require('../src/student-identity-resolver');

assert.equal(normalizePhone('010-1234-5678'), '01012345678');
assert.equal(normalizePhone('+82 10-1234-5678'), '01012345678');
assert.equal(normalizeDate('2026-07-23T00:30:00+09:00'), '2026-07-23');

assert.deepEqual(
  scoreIdentityMatch({ studentId: 'S001' }, { studentId: 'S001' }).confidence,
  'certain',
);

assert.equal(
  scoreIdentityMatch(
    { name: '홍길동', phone: '010-1111-2222' },
    { name: '홍길동', phone: '010-1111-2222' },
  ).confidence,
  'high',
);

assert.equal(
  scoreIdentityMatch(
    { name: '홍길동', phone: '010-1111-2222' },
    { name: '홍길동', phone: '010-9999-8888' },
  ).confidence,
  'conflict',
);

assert.equal(
  chooseCanonicalId({ name: '김학생', registrationDate: '2026-07-01' }),
  'name-date:김학생|2026-07-01',
);

const resolved = resolveIdentity(
  { name: '김학생', phone: '010-5555-7777' },
  [
    { source: 'contacts', sourceRecordId: '1', name: '김학생', phone: '010-5555-7777' },
    { source: 'contacts', sourceRecordId: '2', name: '김학생', phone: '010-0000-0000' },
  ],
);

assert.equal(resolved.confidence, 'high');
assert.equal(resolved.reviewRequired, false);
assert.equal(resolved.match.sourceRecordId, '1');

const ambiguous = resolveIdentity(
  { name: '동명이인' },
  [
    { sourceRecordId: 'A', name: '동명이인', instructor: 'Matthew' },
    { sourceRecordId: 'B', name: '동명이인', instructor: 'Campbell' },
  ],
);

assert.equal(ambiguous.reviewRequired, true);
assert.equal(ambiguous.confidence, 'review');

assert.deepEqual(extractNameAliases('보호자(익명학생A)'), ['보호자(익명학생a)', '익명학생a']);

assert.equal(
  scorePaymentStudentMatch(
    { payerName: '보호자(익명학생A)', rawMessage: '가족 입금' },
    { name: '익명학생A' },
  ).confidence,
  'review',
);

assert.ok(
  scorePaymentStudentMatch(
    { payerName: 'Student Jane' },
    { name: 'Jane Student' },
  ).reasons.includes('name_order_variant'),
);

assert.equal(
  scorePaymentStudentMatch(
    { payerName: '익명학생B', phone: '010-1111-2222' },
    { name: '익명학생B', phone: '010-9999-8888' },
  ).confidence,
  'conflict',
);

const homonymPaymentMatch = matchPaymentToStudents(
  { payerName: '익명학생C' },
  [
    { sourceRecordId: '1', name: '익명학생C', phone: '010-1000-0001' },
    { sourceRecordId: '2', name: '익명학생C', phone: '010-1000-0002' },
  ],
);

assert.equal(homonymPaymentMatch.confidence, 'conflict');
assert.ok(homonymPaymentMatch.reasons.includes('homonym_conflict'));

console.log('student identity resolver tests passed');
