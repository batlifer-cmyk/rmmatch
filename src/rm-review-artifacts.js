'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
  return deduplicateIssues(issues)
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
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
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
  const report = result.report || {};
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
  fs.mkdirSync(outDir, { recursive: true });
  const reviewQueue = buildReviewQueue(result.report?.issues || [], { limit: options.limit ?? 50 });
  const manifest = buildRunManifest(result, { reviewQueue, limit: options.limit ?? 50 });
  const artifacts = {
    reportPath: path.join(outDir, 'rm-report.json'),
    textPath: path.join(outDir, 'rm-report.txt'),
    reviewQueuePath: path.join(outDir, 'rm-review-queue.csv'),
    manifestPath: path.join(outDir, 'rm-run-manifest.json'),
  };
  fs.writeFileSync(artifacts.reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
  fs.writeFileSync(artifacts.textPath, `${result.textReport || ''}\n`);
  fs.writeFileSync(artifacts.reviewQueuePath, reviewQueueToCsv(reviewQueue));
  fs.writeFileSync(artifacts.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return artifacts;
}

module.exports = {
  REVIEW_HEADERS,
  REVIEW_STATUS_PENDING,
  sanitizeCsvCell,
  deduplicateIssues,
  buildReviewQueue,
  reviewQueueToCsv,
  buildRunManifest,
  writeReviewArtifacts,
};
