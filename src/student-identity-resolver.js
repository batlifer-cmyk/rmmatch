// Ryan Members canonical student identity resolver.
// Pure functions only: no network, spreadsheet, or write operations.

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeName(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('82') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function normalizeDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function buildCandidate(record = {}) {
  return {
    source: normalizeText(record.source),
    sourceRecordId: normalizeText(record.sourceRecordId),
    studentId: normalizeText(record.studentId),
    phone: normalizePhone(record.phone),
    name: normalizeName(record.name),
    registrationDate: normalizeDate(record.registrationDate),
    instructor: normalizeName(record.instructor),
  };
}

function scoreIdentityMatch(leftInput, rightInput) {
  const left = buildCandidate(leftInput);
  const right = buildCandidate(rightInput);
  const reasons = [];
  let score = 0;

  if (left.studentId && right.studentId) {
    if (left.studentId === right.studentId) {
      score += 100;
      reasons.push('student_id_exact');
    } else {
      return { score: -100, confidence: 'conflict', reasons: ['student_id_conflict'] };
    }
  }

  if (left.phone && right.phone) {
    if (left.phone === right.phone) {
      score += 70;
      reasons.push('phone_exact');
    } else {
      score -= 40;
      reasons.push('phone_conflict');
    }
  }

  if (left.name && right.name && left.name === right.name) {
    score += 20;
    reasons.push('name_exact');
  }

  if (left.registrationDate && right.registrationDate && left.registrationDate === right.registrationDate) {
    score += 10;
    reasons.push('registration_date_exact');
  }

  if (left.instructor && right.instructor && left.instructor === right.instructor) {
    score += 5;
    reasons.push('instructor_exact');
  }

  let confidence = 'unmatched';
  if (score >= 100) confidence = 'certain';
  else if (score >= 70) confidence = 'high';
  else if (score >= 30) confidence = 'review';
  else if (score > 0) confidence = 'low';
  else if (score < 0) confidence = 'conflict';

  return { score, confidence, reasons };
}

function chooseCanonicalId(record = {}) {
  const candidate = buildCandidate(record);
  if (candidate.studentId) return `sid:${candidate.studentId}`;
  if (candidate.phone) return `phone:${candidate.phone}`;
  if (candidate.name && candidate.registrationDate) {
    return `name-date:${candidate.name}|${candidate.registrationDate}`;
  }
  if (candidate.name && candidate.instructor) {
    return `name-instructor:${candidate.name}|${candidate.instructor}`;
  }
  return candidate.name ? `name-only:${candidate.name}` : '';
}

function resolveIdentity(record, candidates = []) {
  const ranked = candidates
    .map((candidate) => ({ candidate, ...scoreIdentityMatch(record, candidate) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const ambiguous = Boolean(best && second && best.score === second.score && best.score > 0);

  if (!best || best.score <= 0) {
    return {
      canonicalId: chooseCanonicalId(record),
      confidence: 'unmatched',
      reviewRequired: true,
      match: null,
      ranked,
    };
  }

  return {
    canonicalId: chooseCanonicalId(best.candidate),
    confidence: ambiguous ? 'review' : best.confidence,
    reviewRequired: ambiguous || ['review', 'low', 'conflict'].includes(best.confidence),
    match: best.candidate,
    ranked,
  };
}

module.exports = {
  normalizeText,
  normalizeName,
  normalizePhone,
  normalizeDate,
  buildCandidate,
  scoreIdentityMatch,
  chooseCanonicalId,
  resolveIdentity,
};
