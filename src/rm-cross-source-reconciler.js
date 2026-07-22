'use strict';

const {
  normalizeName,
  normalizePhone,
  buildStudentIdentityCandidates,
  matchPaymentToStudents,
} = require('./student-identity-resolver');

function normalizeDateKey(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).trim() : date.toISOString().slice(0, 10);
}

function recordIssue(ruleId, severity, entity, evidence, sourceRows, action) {
  return {
    rule_id: ruleId,
    severity,
    entity_key_masked: entity ? `${String(entity).slice(0, 1)}***` : '*',
    evidence,
    source_rows: sourceRows,
    recommended_action: action,
    status: 'open',
  };
}

function registrationSignature(record) {
  return [
    normalizeName(record.studentName),
    normalizeDateKey(record.registeredAt),
    record.amount ?? '',
    record.packageCount ?? '',
  ].join('|');
}

function graduationReasonSignature(record) {
  return [
    normalizeName(record.studentName),
    normalizeDateKey(record.lastLessonDate || record.processedAt),
    String(record.reason || '').trim().replace(/\s+/g, ' '),
  ].join('|');
}

function reconcileOperationalData(data) {
  const issues = [];
  const paymentsByName = new Map();
  const registrationsByName = new Map();
  const graduationByName = new Map();
  const lessonsByName = new Map();
  const registrationSignatures = new Map();
  const graduationReasonSignatures = new Map();
  const knownInstructorLabels = new Set((data.instructorNames ?? ['매튜', '데이빗', '캠벨', 'matthew', 'david', 'campbell']).map(normalizeName));
  const identityCandidates = buildStudentIdentityCandidates(data);

  for (const payment of data.payments ?? []) {
    const identityMatch = matchPaymentToStudents(payment, identityCandidates);
    const matchedName = normalizeName(identityMatch.match?.name || payment.studentName);
    const fallbackName = normalizeName(payment.studentName || payment.payerName);
    const name = matchedName || fallbackName;
    if (/TEST/i.test(payment.memo || '') || /TEST/i.test(payment.rawMessage || '')) {
      issues.push(recordIssue('RM-X-001', 'urgent', name, '테스트 표기가 있는 입금기록', [payment.sourceRow], '운영 집계 포함 여부 확인'));
    }
    if (!name) continue;
    if (identityMatch.reviewRequired) {
      const severity = identityMatch.confidence === 'conflict' ? 'urgent' : 'review';
      issues.push(recordIssue(
        'RM-X-011',
        severity,
        name,
        `입금자-학생 매칭 ${identityMatch.confidence}: ${identityMatch.reasons.join(', ')}`,
        [payment.sourceRow],
        'student_id·전화번호·alias 근거를 확인하고 이름 단독 자동 확정 금지',
      ));
    }
    if (identityMatch.confidence !== 'unmatched' && identityMatch.confidence !== 'conflict') {
      if (!paymentsByName.has(name)) paymentsByName.set(name, []);
      paymentsByName.get(name).push({ ...payment, identityMatch });
    } else if (!paymentsByName.has(fallbackName)) {
      paymentsByName.set(fallbackName, [payment]);
    } else {
      paymentsByName.get(fallbackName).push(payment);
    }
  }

  for (const registration of data.registrations ?? []) {
    const name = normalizeName(registration.studentName);
    if (!name) continue;
    const excludedFromPackageTotals = registration.excludedFromPackageTotals === true;
    if (registration.reviewRequired || registration.packageCount === 999) {
      const action = registration.transactionKind === 'UNKNOWN_999'
        ? '회차 999가 실제 패키지가 아닌 판정 실패인지 원문 확인'
        : '등록 원문과 실제 학생 확인';
      issues.push(recordIssue('RM-X-002', 'urgent', name, `등록 검토 필요: 회차 ${registration.packageCount ?? '(공란)'}`, [registration.sourceRow], action));
    }
    if (excludedFromPackageTotals) {
      continue;
    }
    if (!registrationsByName.has(name)) registrationsByName.set(name, []);
    registrationsByName.get(name).push(registration);
    const signature = registrationSignature(registration);
    if (!registrationSignatures.has(signature)) registrationSignatures.set(signature, []);
    registrationSignatures.get(signature).push(registration);
  }

  for (const rows of registrationSignatures.values()) {
    if (rows.length > 1) {
      const sample = rows[0];
      issues.push(recordIssue('RM-X-009', 'urgent', sample.studentName, `동일 학생·등록일·금액·회차 등록 ${rows.length}건`, rows.map((r) => r.sourceRow), '중복 등록 여부 확인 후 한 건만 유효 처리'));
    }
  }

  for (const graduation of data.graduations ?? []) {
    const name = normalizeName(graduation.studentName);
    if (!name) continue;
    if (/자동감지/.test(graduation.rawMessage || '') || graduation.status === '알림전송') {
      issues.push(recordIssue('RM-X-008', 'review', name, '자동감지 알림행이 졸업로그에 혼재', [graduation.sourceRow], '확정 졸업과 후보 알림을 별도 상태·탭으로 분리'));
      continue;
    }
    if (knownInstructorLabels.has(name)) {
      issues.push(recordIssue('RM-X-007', 'urgent', name, '학생명 열에 강사명이 입력됨', [graduation.sourceRow], '원본문장에서 실제 학생명을 추출해 정정'));
      continue;
    }
    if (!graduationByName.has(name)) graduationByName.set(name, []);
    graduationByName.get(name).push(graduation);
    const reasonSignature = graduationReasonSignature(graduation);
    if (!graduationReasonSignatures.has(reasonSignature)) graduationReasonSignatures.set(reasonSignature, []);
    graduationReasonSignatures.get(reasonSignature).push(graduation);
  }

  for (const rows of graduationReasonSignatures.values()) {
    if (rows.length > 1) {
      const sample = rows[0];
      issues.push(recordIssue('RM-X-010', 'review', sample.studentName, `동일 졸업사유·일자 후보 ${rows.length}건`, rows.map((r) => r.sourceRow), '분할 입력인지 중복 처리인지 확인하고 자동 확정하지 않음'));
    }
  }

  for (const lesson of data.lessons ?? []) {
    const name = normalizeName(lesson.studentName);
    if (!name) continue;
    if (!lessonsByName.has(name)) lessonsByName.set(name, []);
    lessonsByName.get(name).push(lesson);
  }

  for (const [name, registrations] of registrationsByName) {
    if (!(paymentsByName.get(name) ?? []).length) {
      issues.push(recordIssue('RM-X-003', 'review', name, `등록 ${registrations.length}건, 대응 입금명 없음`, registrations.map((r) => r.sourceRow), '입금자명 차이 또는 카드결제 여부 확인'));
    }
  }

  for (const [name, payments] of paymentsByName) {
    if (!(registrationsByName.get(name) ?? []).length) {
      issues.push(recordIssue('RM-X-004', 'review', name, `입금 ${payments.length}건, 대응 등록명 없음`, payments.map((p) => p.sourceRow), '등록로그 누락 또는 입금자-학생 관계 확인'));
    }
  }

  for (const [name, graduations] of graduationByName) {
    const latestGraduation = graduations.map((g) => normalizeDateKey(g.processedAt || g.lastLessonDate)).sort().at(-1);
    const laterLessons = (lessonsByName.get(name) ?? []).filter((lesson) => normalizeDateKey(lesson.lessonDate) > latestGraduation);
    if (latestGraduation && laterLessons.length) {
      issues.push(recordIssue('RM-X-005', 'urgent', name, `졸업 처리일 이후 수업 ${laterLessons.length}건`, [...graduations.map((g) => g.sourceRow), ...laterLessons.map((l) => l.sourceRow)], '복귀·오입력·졸업상태 갱신 여부 확인'));
    }
  }

  const contactGroups = new Map();
  for (const contact of data.contacts ?? []) {
    const name = normalizeName(contact.studentName || contact.name);
    const phone = normalizePhone(contact.phone || contact.phoneNumber);
    if (!name || !phone) continue;
    if (!contactGroups.has(name)) contactGroups.set(name, new Set());
    contactGroups.get(name).add(phone);
  }
  for (const [name, phones] of contactGroups) {
    if (phones.size > 1) {
      issues.push(recordIssue('RM-X-006', 'review', name, `동일 이름에 전화번호 ${phones.size}개`, [], '동일인 번호변경인지 동명이인인지 확인'));
    }
  }

  return issues;
}

module.exports = { normalizeDateKey, registrationSignature, graduationReasonSignature, reconcileOperationalData };
