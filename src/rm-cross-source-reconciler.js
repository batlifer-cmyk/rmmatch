'use strict';

const { normalizeName, normalizePhone, resolveStudentIdentity } = require('./student-identity-resolver');

function toNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

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

function reconcileOperationalData(data) {
  const issues = [];
  const paymentsByName = new Map();
  const registrationsByName = new Map();
  const graduationByName = new Map();
  const lessonsByName = new Map();

  for (const payment of data.payments ?? []) {
    const name = normalizeName(payment.studentName || payment.payerName);
    if (!name) continue;
    if (!paymentsByName.has(name)) paymentsByName.set(name, []);
    paymentsByName.get(name).push(payment);
    if (/TEST/i.test(payment.memo || '') || /TEST/i.test(payment.rawMessage || '')) {
      issues.push(recordIssue('RM-X-001', 'urgent', name, '테스트 표기가 있는 입금기록', [payment.sourceRow], '운영 집계 포함 여부 확인'));
    }
  }

  for (const registration of data.registrations ?? []) {
    const name = normalizeName(registration.studentName);
    if (!name) continue;
    if (!registrationsByName.has(name)) registrationsByName.set(name, []);
    registrationsByName.get(name).push(registration);
    if (registration.reviewRequired || registration.sessionCount === 999) {
      issues.push(recordIssue('RM-X-002', 'urgent', name, `등록 검토 필요: 회차 ${registration.sessionCount ?? '(공란)'}`, [registration.sourceRow], '등록 원문과 실제 학생 확인'));
    }
  }

  for (const graduation of data.graduations ?? []) {
    const name = normalizeName(graduation.studentName);
    if (!name) continue;
    if (!graduationByName.has(name)) graduationByName.set(name, []);
    graduationByName.get(name).push(graduation);
  }

  for (const lesson of data.lessons ?? []) {
    const name = normalizeName(lesson.studentName);
    if (!name) continue;
    if (!lessonsByName.has(name)) lessonsByName.set(name, []);
    lessonsByName.get(name).push(lesson);
  }

  for (const [name, registrations] of registrationsByName) {
    const payments = paymentsByName.get(name) ?? [];
    if (payments.length === 0) {
      issues.push(recordIssue('RM-X-003', 'review', name, `등록 ${registrations.length}건, 대응 입금명 없음`, registrations.map((r) => r.sourceRow), '입금자명 차이 또는 카드결제 여부 확인'));
    }
  }

  for (const [name, payments] of paymentsByName) {
    const registrations = registrationsByName.get(name) ?? [];
    if (registrations.length === 0) {
      issues.push(recordIssue('RM-X-004', 'review', name, `입금 ${payments.length}건, 대응 등록명 없음`, payments.map((p) => p.sourceRow), '등록로그 누락 또는 입금자-학생 관계 확인'));
    }
  }

  for (const [name, graduations] of graduationByName) {
    const latestGraduation = graduations.map((g) => normalizeDateKey(g.processedAt || g.lastLessonAt)).sort().at(-1);
    const laterLessons = (lessonsByName.get(name) ?? []).filter((lesson) => normalizeDateKey(lesson.date) > latestGraduation);
    if (latestGraduation && laterLessons.length > 0) {
      issues.push(recordIssue('RM-X-005', 'urgent', name, `졸업 처리일 이후 수업 ${laterLessons.length}건`, [...graduations.map((g) => g.sourceRow), ...laterLessons.map((l) => l.sourceRow)], '복귀·오입력·졸업상태 갱신 여부 확인'));
    }
  }

  const contactGroups = new Map();
  for (const contact of data.contacts ?? []) {
    const name = normalizeName(contact.studentName || contact.name);
    const phone = normalizePhone(contact.phone);
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

module.exports = { toNumber, normalizeDateKey, reconcileOperationalData };
