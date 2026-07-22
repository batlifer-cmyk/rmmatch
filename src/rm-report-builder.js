'use strict';

function summarize(issues) {
  const result = { urgent: 0, review: 0, info: 0, total: issues.length, byRule: {} };
  for (const issue of issues) {
    const severity = issue.severity || 'info';
    result[severity] = (result[severity] || 0) + 1;
    result.byRule[issue.rule_id] = (result.byRule[issue.rule_id] || 0) + 1;
  }
  return result;
}

function buildReport(input) {
  const issues = [...(input.issues || [])].sort((a, b) => {
    const priority = { urgent: 0, review: 1, info: 2 };
    return (priority[a.severity] ?? 9) - (priority[b.severity] ?? 9);
  });
  return {
    schema_version: '1.0.0',
    generated_at: (input.generatedAt || new Date()).toISOString(),
    mode: 'READ_ONLY',
    source_stats: input.sourceStats || {},
    summary: summarize(issues),
    warnings: input.warnings || [],
    issues,
  };
}

function toText(report) {
  const lines = [
    '라이언멤버스 운영 이상탐지 보고서',
    `생성시각: ${report.generated_at}`,
    `실행모드: ${report.mode}`,
    `긴급: ${report.summary.urgent || 0}건`,
    `검토: ${report.summary.review || 0}건`,
    `전체: ${report.summary.total}건`,
    '',
  ];
  for (const issue of report.issues) {
    lines.push(`[${issue.severity}] ${issue.rule_id} ${issue.entity_key_masked}`);
    lines.push(`근거: ${issue.evidence}`);
    lines.push(`권장조치: ${issue.recommended_action}`);
    if (issue.source_rows && issue.source_rows.length) lines.push(`원본행: ${issue.source_rows.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = { summarize, buildReport, toText };
