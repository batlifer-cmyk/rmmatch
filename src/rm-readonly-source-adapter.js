// Read-only adapters for Ryan Members operational source rows.
// These functions transform already-read sheet rows into normalized objects.
// They do not call Google APIs and do not write to any source.

function text(value) {
  return String(value ?? '').trim();
}

function numberValue(value) {
  const normalized = text(value).replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedStatus(value) {
  return text(value).replace(/\s+/g, ' ');
}

function isTemporaryStudentLabel(value) {
  const label = text(value);
  if (!label) return true;
  return /^[A-Z0-9]{8,}$/i.test(label) || /^\d{6,}$/.test(label);
}

function rowHasData(row) {
  return Array.isArray(row) && row.some((value) => value !== '' && value != null);
}

function adaptMasterTimeDataRow(row, sourceRow) {
  const [teacher, date, month, day, quarter, student, hours, rate, totalAmount, classType, note] = row;
  const rawHours = text(hours);
  const numericHours = numberValue(rawHours);
  const code = numericHours === null ? rawHours : 'NORMAL';

  return {
    sourceType: 'lesson',
    sourceSheet: 'Master time data',
    sourceRow,
    instructorName: text(teacher),
    studentName: text(student),
    lessonDate: text(date),
    month: text(month),
    day: text(day),
    quarter: text(quarter),
    hours: numericHours,
    code,
    rate: numberValue(rate),
    totalAmount: numberValue(totalAmount),
    classType: text(classType),
    note: text(note),
    reviewRequired: !text(student) || !text(teacher) || (!numericHours && !rawHours),
  };
}

function adaptRegistrationLogRow(row, sourceRow) {
  const [registeredAt, studentName, phone, amount, packageCount, instructor, enteredBy, rawMessage, status, lessonType] = row;
  const parsedCount = numberValue(packageCount);
  const temporaryName = isTemporaryStudentLabel(studentName);
  const suspiciousCount = parsedCount !== null && (parsedCount <= 0 || parsedCount > 100);

  return {
    sourceType: 'registration',
    sourceSheet: '_DB_등록로그',
    sourceRow,
    registeredAt: text(registeredAt),
    studentName: text(studentName),
    phone: text(phone),
    amount: numberValue(amount),
    packageCount: parsedCount,
    instructorName: text(instructor),
    enteredBy: text(enteredBy),
    rawMessage: text(rawMessage),
    status: normalizedStatus(status),
    lessonType: text(lessonType),
    reviewRequired: temporaryName || suspiciousCount || normalizedStatus(status) === '확인필요',
    reviewReasons: [
      temporaryName ? '임시 또는 비정상 학생 식별값' : null,
      suspiciousCount ? '비정상 회차수' : null,
      normalizedStatus(status) === '확인필요' ? '원천 상태 확인필요' : null,
    ].filter(Boolean),
  };
}

function adaptGraduationLogRow(row, sourceRow) {
  const [processedAt, studentName, lastLessonDate, remaining, reason, processedBy, rawMessage, status] = row;
  return {
    sourceType: 'graduation',
    sourceSheet: '_DB_졸업로그',
    sourceRow,
    processedAt: text(processedAt),
    studentName: text(studentName),
    lastLessonDate: text(lastLessonDate),
    remainingLessons: numberValue(remaining),
    reason: text(reason),
    processedBy: text(processedBy),
    rawMessage: text(rawMessage),
    status: normalizedStatus(status),
    reviewRequired: !text(studentName) || normalizedStatus(status) !== '확정',
  };
}

function adaptPaymentLogRow(row, sourceRow) {
  const [receivedAt, paidAt, payerName, amount, addedCount, instructorType, judgment, targetRow, processStatus, jandiStatus, rawMessage, memo] = row;
  const parsedCount = numberValue(addedCount);
  return {
    sourceType: 'payment',
    sourceSheet: '입금로그',
    sourceRow,
    receivedAt: text(receivedAt),
    paidAt: text(paidAt),
    payerName: text(payerName),
    amount: numberValue(amount),
    addedCount: parsedCount,
    instructorType: text(instructorType),
    judgment: text(judgment),
    targetRow: text(targetRow),
    processStatus: text(processStatus),
    jandiStatus: text(jandiStatus),
    rawMessage: text(rawMessage),
    memo: text(memo),
    reviewRequired: !text(payerName) || numberValue(amount) === null || parsedCount === null || /확인필요/.test(text(instructorType)),
  };
}

function adaptRows(rows, adapter, startRow = 2) {
  return (rows ?? []).flatMap((row, index) => {
    if (!rowHasData(row)) return [];
    return [adapter(row, startRow + index)];
  });
}

module.exports = {
  numberValue,
  isTemporaryStudentLabel,
  rowHasData,
  adaptMasterTimeDataRow,
  adaptRegistrationLogRow,
  adaptGraduationLogRow,
  adaptPaymentLogRow,
  adaptRows,
};
