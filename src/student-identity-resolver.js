// Ryan Members canonical student identity resolver.
// Pure functions only: no network, spreadsheet, or write operations.

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeName(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeNameOrderKey(value) {
  const tokens = normalizeName(value).split(/\s+/).filter(Boolean);
  return tokens.length > 1 ? [...tokens].sort().join(' ') : normalizeName(value);
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
    name: normalizeName(record.name || record.studentName),
    aliases: extractNameAliases(record.aliases || record.payerName || record.studentName || record.name),
    registrationDate: normalizeDate(record.registrationDate),
    instructor: normalizeName(record.instructor),
  };
}

function extractNameAliases(value) {
  const values = Array.isArray(value) ? value : [value];
  const aliases = new Set();
  for (const item of values) {
    const text = normalizeText(item);
    if (!text) continue;
    aliases.add(normalizeName(text));
    for (const match of text.matchAll(/\(([^)]+)\)|（([^）]+)）|\[([^\]]+)\]/g)) {
      aliases.add(normalizeName(match[1] || match[2] || match[3]));
    }
  }
  return [...aliases].filter(Boolean);
}

function classifyPayerName(value) {
  const text = normalizeText(value);
  return {
    family: /가족|보호자|부친|모친|아버지|어머니|엄마|아빠|parent|family/i.test(text),
    corporate: /주식회사|\(주\)|회사|법인|corp|inc|ltd/i.test(text),
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

function buildStudentIdentityCandidates(data = {}) {
  const candidates = [];
  for (const registration of data.registrations ?? []) {
    candidates.push({
      source: 'registration',
      sourceRecordId: String(registration.sourceRow ?? ''),
      studentId: registration.studentId,
      name: registration.studentName,
      phone: registration.phone,
      registrationDate: registration.registeredAt,
      instructor: registration.instructorName,
    });
  }
  for (const contact of data.contacts ?? []) {
    candidates.push({
      source: 'contact',
      sourceRecordId: String(contact.sourceRow ?? ''),
      studentId: contact.studentId,
      name: contact.studentName || contact.name,
      phone: contact.phone || contact.phoneNumber,
    });
  }
  for (const profile of data.studentProfiles ?? []) {
    candidates.push({
      source: 'studentProfile',
      sourceRecordId: String(profile.__sourceRow || profile.sourceRow || profile.source_id || ''),
      studentId: profile.student_id || profile.studentId,
      name: profile.name || profile.studentName || profile['학생명'],
      phone: profile.phone || profile.phoneNumber || profile['전화번호'],
    });
  }
  return candidates.filter((candidate) => normalizeText(candidate.name) || normalizeText(candidate.studentId) || normalizePhone(candidate.phone));
}

function scorePaymentStudentMatch(payment = {}, candidateInput = {}) {
  const candidate = buildCandidate(candidateInput);
  const payerAliases = extractNameAliases([payment.payerName, payment.studentName, payment.alias]);
  const payerPhone = normalizePhone(payment.phone || payment.phoneNumber);
  const payerStudentId = normalizeText(payment.studentId || payment.student_id);
  const relationship = classifyPayerName([payment.payerName, payment.rawMessage, payment.memo].filter(Boolean).join(' '));
  const reasons = [];
  let score = 0;

  if (payerStudentId && candidate.studentId) {
    if (payerStudentId === candidate.studentId) {
      score += 100;
      reasons.push('student_id_exact');
    } else {
      return { score: -100, confidence: 'conflict', reasons: ['student_id_conflict'] };
    }
  }

  if (payerPhone && candidate.phone) {
    if (payerPhone === candidate.phone) {
      score += 80;
      reasons.push('phone_exact');
    } else {
      score -= 60;
      reasons.push('phone_conflict');
    }
  }

  const aliasMatches = payerAliases.filter((alias) => alias && (alias === candidate.name || candidate.aliases.includes(alias)));
  if (aliasMatches.length) {
    score += 30;
    reasons.push('payer_alias_exact');
  } else if (payerAliases.some((alias) => normalizeNameOrderKey(alias) === normalizeNameOrderKey(candidate.name))) {
    score += 20;
    reasons.push('name_order_variant');
  }

  if (relationship.family) reasons.push('family_payer');
  if (relationship.corporate) reasons.push('corporate_payer');

  let confidence = 'unmatched';
  if (score >= 100) confidence = 'certain';
  else if (score >= 80) confidence = 'high';
  else if (score >= 30) confidence = 'review';
  else if (score > 0) confidence = 'low';
  else if (score < 0) confidence = 'conflict';
  if (confidence === 'certain' && !reasons.includes('student_id_exact')) confidence = 'high';
  if (['family_payer', 'corporate_payer', 'payer_alias_exact', 'name_order_variant'].some((reason) => reasons.includes(reason)) && confidence === 'high') {
    confidence = 'review';
  }

  return { score, confidence, reasons, candidate: candidateInput };
}

function matchPaymentToStudents(payment = {}, candidates = []) {
  const ranked = candidates
    .map((candidate) => scorePaymentStudentMatch(payment, candidate))
    .filter((match) => match.score !== 0 || match.reasons.length)
    .sort((left, right) => right.score - left.score);
  const conflicts = ranked.filter((match) => match.confidence === 'conflict');
  if (conflicts.length) {
    return { confidence: 'conflict', reviewRequired: true, reasons: conflicts[0].reasons, matches: conflicts };
  }
  const best = ranked[0] || null;
  if (!best || best.score <= 0) {
    return { confidence: 'unmatched', reviewRequired: true, reasons: ['no_identity_match'], matches: [] };
  }
  const tied = ranked.filter((match) => match.score === best.score && match.score > 0);
  if (tied.length > 1) {
    return { confidence: 'conflict', reviewRequired: true, reasons: ['homonym_conflict', ...best.reasons], matches: tied };
  }
  return {
    confidence: best.confidence,
    reviewRequired: ['review', 'low', 'conflict', 'unmatched'].includes(best.confidence),
    reasons: best.reasons,
    match: best.candidate,
    matches: [best],
  };
}

module.exports = {
  normalizeText,
  normalizeName,
  normalizeNameOrderKey,
  normalizePhone,
  normalizeDate,
  extractNameAliases,
  classifyPayerName,
  buildCandidate,
  scoreIdentityMatch,
  chooseCanonicalId,
  resolveIdentity,
  buildStudentIdentityCandidates,
  scorePaymentStudentMatch,
  matchPaymentToStudents,
};
