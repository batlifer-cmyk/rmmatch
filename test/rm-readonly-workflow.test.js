'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'rm-readonly-daily.yml');

test('daily workflow keeps minimal permissions and scheduled 07:00 KST run', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /permissions:\r?\n\s+contents: read/);
  assert.match(workflow, /cron: '0 22 \* \* \*'/);
  assert.doesNotMatch(workflow, /contents: write|pull-requests: write|issues: write/);
});

test('daily workflow skips live runner safely when credentials are missing', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64/);
  assert.match(workflow, /RM_GOOGLE_SERVICE_ACCOUNT_JSON/);
  assert.match(workflow, /available=false/);
  assert.match(workflow, /live runner skipped safely/);
});

test('daily workflow runs tests before live runner and uploads all artifacts for 30 days', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.ok(workflow.indexOf('Run Node tests') < workflow.indexOf('Run live read-only report'));
  assert.match(workflow, /node scripts\/run-rm-readonly\.js --out-dir artifacts\/rm-readonly/);
  assert.match(workflow, /rm-report\.json/);
  assert.match(workflow, /rm-report\.txt/);
  assert.match(workflow, /rm-review-queue\.csv/);
  assert.match(workflow, /rm-run-manifest\.json/);
  assert.match(workflow, /retention-days: 30/);
});
