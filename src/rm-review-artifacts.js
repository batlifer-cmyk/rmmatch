'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { toText } = require('./rm-report-builder');

const REVIEW_HEADERS = [
  '검수상태',
  '심각도',
  '규칙ID',
  '마스킹 학생키',
  '원천시트',
  '원천행',
  '근거',
  '권장조치',
  '운영자메모',
];

const SEVERITY_ORDER = Object.freeze({ urgent: 0, review: 1, info: 2, suggestion: 3 });
const REVIEW_STATUS_PENDING = '판단보류';
const PHONE_PATTERN = /(?:\+?82[-\s.]?)?0?10[-\s.]?\d{3,4}[-\s.]?\d{4}/g;

function redactArtifactText(value) {
  return String(value ?? '')
    .replace(/\r?\n|\r/g, ' ')
    .replace(PHONE_PATTERN, '[masked-phone]')
    .trim();
}

function sanitizeIssueForArtifact(issue = {}) {
  return {
    rule_id: redactArtifactText(issue.rule_id),
    severity: redactArtifactText(issue.severity || 'info'),
    entity_key_masked: redactArtifactText(issue.entity_key_masked || '*'),
    source_sheet: redactArtifactText(issueSourceSheet(issue)),
    source_rows: Array.isArray(issue.source_rows)
      ? issue.source_rows.map((row) => redactArtifactText(row)).filter(Boolean)
      : (issue.source_row == null ? [] : [redactArtifactText(issue.source_row)]),
    evidence: redactArtifactText(issue.evidence),
    recommended_action: redactArtifactText(issue.recommended_action),
    status: redactArtifactText(issue.status || 'open'),
    fingerprint: redactArtifactText(issue.fingerprint || issue.detection_id || ''),
  };
}

function sanitizeSourceStats(sourceStats = {}) {
  return Object.fromEntries(Object.entries(sourceStats).map(([source, stat]) => [source, {
    ...stat,
    error: stat?.error ? redactArtifactText(stat.error) : undefined,
  }]));
}

function sanitizeReportForArtifact(report = {}) {
  return {
    schema_version: report.schema_version || '1.0.0',
    generated_at: report.generated_at,
    mode: report.mode || 'READ_ONLY',
    source_stats: sanitizeSourceStats(report.source_stats || {}),
    summary: report.summary || {},
    warnings: (report.warnings || []).map(redactArtifactText),
    issues: (report.issues || []).map(sanitizeIssueForArtifact),
  };
}

function isPathInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveSafeOutputDir(outDir, options = {}) {
  if (!outDir || typeof outDir !== 'string') {
    throw new Error('Artifact output directory is required');
  }
  const baseDir = path.resolve(options.baseDir || process.cwd());
  const resolved = path.resolve(baseDir, outDir);
  if (!isPathInside(resolved, baseDir)) {
    throw new Error('Artifact output directory must stay inside the working directory');
  }
  if (resolved === path.parse(resolved).root) {
    throw new Error('Artifact output directory must not be a filesystem root');
  }
  return resolved;
}

function issueFingerprint(issue) {
  return issue.fingerprint || issue.detection_id || [
    issue.rule_id || '',
    issue.entity_key_masked || '',
    issue.source_sheet || '',
    issue.source_row || '',
    (issue.source_rows || []).join('|'),
  ].join('|');
}

function issueSourceRows(issue) {
  if (Array.isArray(issue.source_rows) && issue.source_rows.length) return issue.source_rows.join(';');
  return issue.source_row == null ? '' : String(issue.source_row);
}

function issueSourceSheet(issue) {
  return issue.source_sheet || issue.sourceSheet || '';
}

function deduplicateIssues(issues) {
  return [...new Map((issues || []).map((issue) => [issueFingerprint(issue), issue])).values()];
}

function buildReviewQueue(issues, options = {}) {
  const limit = options.limit ?? 50;
  return deduplicateIssues((issues || []).map(sanitizeIssueForArtifact))
    .sort((left, right) => {
      const leftRank = SEVERITY_ORDER[left.severity] ?? 99;
      const rightRank = SEVERITY_ORDER[right.severity] ?? 99;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return String(left.rule_id || '').localeCompare(String(right.rule_id || ''));
    })
    .slice(0, limit)
    .map((issue) => ({
      review_status: REVIEW_STATUS_PENDING,
      severity: issue.severity || 'info',
      rule_id: issue.rule_id || '',
      entity_key_masked: issue.entity_key_masked || '*',
      source_sheet: issueSourceSheet(issue),
      source_rows: issueSourceRows(issue),
      evidence: issue.evidence || '',
      recommended_action: issue.recommended_action || '',
      operator_memo: '',
    }));
}

function sanitizeCsvCell(value) {
  const text = redactArtifactText(value);
  if (/^[=+\-@]/.test(text)) return `'${text}`;
  return text;
}

function csvEscape(value) {
  const safe = sanitizeCsvCell(value);
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function reviewQueueToCsv(queue) {
  const rows = [
    REVIEW_HEADERS,
    ...queue.map((item) => [
      item.review_status,
      item.severity,
      item.rule_id,
      item.entity_key_masked,
      item.source_sheet,
      item.source_rows,
      item.evidence,
      item.recommended_action,
      item.operator_memo,
    ]),
  ];
  return `${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}\n`;
}

function buildRunManifest(result, options = {}) {
  const report = sanitizeReportForArtifact(result.report || {});
  const queue = options.reviewQueue || buildReviewQueue(report.issues || []);
  const sourceStats = report.source_stats || {};
  return {
    schema_version: '1.0.0',
    generated_at: report.generated_at || new Date().toISOString(),
    mode: report.mode || 'READ_ONLY',
    artifact_version: options.artifactVersion || 'review-queue-v1',
    source_stats: sourceStats,
    source_failures: Object.entries(sourceStats)
      .filter(([, stat]) => stat && stat.success === false)
      .map(([source, stat]) => ({ source, error: stat.error || '' })),
    summary: report.summary || {},
    review_queue: {
      total_candidates: Array.isArray(report.issues) ? deduplicateIssues(report.issues).length : 0,
      emitted: queue.length,
      limit: options.limit ?? 50,
      ordering: 'urgent, review, info, suggestion',
    },
    safety: {
      production_writes: 0,
      apps_script_deployments: 0,
      outbound_messages: 0,
      contains_raw_personal_data: false,
    },
  };
}

function writeReviewArtifacts(outDir, result, options = {}) {
  const safeOutDir = resolveSafeOutputDir(outDir, { baseDir: options.baseDir || process.cwd() });
  fs.mkdirSync(safeOutDir, { recursive: true });
  const safeReport = sanitizeReportForArtifact(result.report || {});
  const reviewQueue = buildReviewQueue(safeReport.issues || [], { limit: options.limit ?? 50 });
  const manifest = buildRunManifest({ report: safeReport }, { reviewQueue, limit: options.limit ?? 50 });
  const artifacts = {
    reportPath: path.join(safeOutDir, 'rm-report.json'),
    textPath: path.join(safeOutDir, 'rm-report.txt'),
    reviewQueuePath: path.join(safeOutDir, 'rm-review-queue.csv'),
    manifestPath: path.join(safeOutDir, 'rm-run-manifest.json'),
  };
  fs.writeFileSync(artifacts.reportPath, `${JSON.stringify(safeReport, null, 2)}\n`);
  fs.writeFileSync(artifacts.textPath, `${toText(safeReport)}\n`);
  fs.writeFileSync(artifacts.reviewQueuePath, reviewQueueToCsv(reviewQueue));
  fs.writeFileSync(artifacts.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return artifacts;
}

module.exports = {
  REVIEW_HEADERS,
  REVIEW_STATUS_PENDING,
  redactArtifactText,
  sanitizeCsvCell,
  sanitizeIssueForArtifact,
  sanitizeReportForArtifact,
  resolveSafeOutputDir,
  deduplicateIssues,
  buildReviewQueue,
  reviewQueueToCsv,
  buildRunManifest,
  writeReviewArtifacts,
};
