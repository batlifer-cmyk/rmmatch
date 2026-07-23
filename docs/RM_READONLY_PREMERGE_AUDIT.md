# RM Read-only v1 Pre-merge Audit

Audit target: Draft PR #20, branch `agent/integrate-rm-readonly-v1`

Audit date: 2026-07-23 KST

## Scope

This audit covers the PR #20 read-only execution path:

- GitHub Actions workflows under `.github/workflows/`
- `scripts/run-rm-readonly.js`
- read-only Google Sheets client and reader modules
- source adapters, reconciler, matcher, report builder, and review artifact writer
- Node tests and dry-run fixtures introduced or changed by PR #20

Existing Apps Script and UI files outside this path still contain production write or outbound-message code from earlier work, but PR #20 does not call, deploy, or modify those paths.

## Audit Results

| Item | Result | Evidence |
| --- | --- | --- |
| Changed PR files reviewed | PASS | The original 20 changed files in PR #20 were reviewed before the audit fixes. The audit then added focused safety fixes and tests on the same branch. |
| Google API scope | PASS | `src/google-sheets-readonly-client.js` hard-codes only `https://www.googleapis.com/auth/spreadsheets.readonly`. |
| Google Sheets write paths | PASS | Static search found no Sheets `append`, `update`, `clear`, `batchUpdate`, or values write method in the PR #20 execution path. The only POST is the OAuth token exchange. |
| Workflow permissions | PASS | Daily and PR test workflows use `permissions: contents: read`. |
| Secret exposure | PASS | Workflow summaries print only Secret names. Credential loader errors name the missing or malformed source but do not print JSON, private keys, assertions, or tokens. |
| Artifact PII masking | PASS | Artifacts now serialize only an allow-listed issue shape. Raw fields such as `studentName`, `phone`, and `rawMessage` are dropped, and phone-like text is replaced with `[masked-phone]`. |
| CSV injection | PASS | CSV cells are trimmed, line breaks are flattened, phone-like text is masked, and values beginning with `=`, `+`, `-`, or `@` are prefixed with `'`. |
| Path traversal and arbitrary output path | PASS | Artifact output directories are resolved against the working directory and rejected if they escape it or target a filesystem root. |
| Asia/Seoul date handling | PASS | Date-key normalization now formats parsed dates in `Asia/Seoul`, preserving KST calendar days around UTC boundaries. |
| Empty sheet | PASS | Empty or absent values return a successful zero-row source when the tab read itself succeeds. |
| Missing tab or source read failure | PASS | With `continueOnSourceError`, failed sources are recorded in `source_stats` and warnings without writes. |
| Header change | PASS | Required headers are validated per source. Missing required headers fail that source instead of silently producing empty or shifted data. |
| Duplicate header | PASS | Duplicate non-empty headers fail that source before adaptation. |
| Empty rows | PASS | Empty rows are skipped while source row numbers remain aligned to the sheet row. |
| 50,000+ rows | PASS | Sources fail when non-empty rows exceed `limits.maxRowsPerSource` of 50,000. |
| Rerun stability | PASS | Dry-run with the same generated timestamp produces stable summaries and issue lists. |
| No-Secret environment | PASS | Dry-run succeeds without credentials. Live runner fails closed without credentials, and scheduled workflow skips live execution when Secrets are absent. |
| Windows syntax and tests | PASS | Local Windows full syntax check and all Node test files passed. |
| Linux syntax and tests | PASS | `.github/workflows/rm-readonly-tests.yml` now runs Ubuntu `node --check` over `src`, `config`, `test`, and `scripts`, then executes every `test/*.test.js`. This must remain green on PR #20 before merge. |

## Test Evidence

Windows local verification:

```powershell
Get-ChildItem -Path src,config,test,scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-ChildItem -Path test -Filter *.test.js | Sort-Object Name | ForEach-Object { node $_.FullName }
```

Targeted failing-before-fix tests were added for:

- duplicate and missing required headers
- empty sheet and row-limit failure
- KST date boundary handling
- artifact PII allow-listing and phone masking
- CSV line-break and formula injection handling
- output path traversal rejection
- stable dry-run reruns
- Ubuntu PR workflow full-test coverage

## Secrets For Live Read-only Run

Use one of:

- `RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` preferred
- `RM_GOOGLE_SERVICE_ACCOUNT_JSON` alternative

Local-only fallback:

- `GOOGLE_APPLICATION_CREDENTIALS`

The service account should have read access only to the required spreadsheets. Do not grant Drive-wide scopes, do not create write scopes, and do not store service account JSON in artifacts, logs, or repository files.

## Remaining Risks

- Real Google Sheets execution was not performed in this audit because no credentials were available.
- Spreadsheet IDs are public configuration values in the repository. They are not credentials, but access should still be controlled at the Google service-account permission layer.
- Actual operating data can contain header spelling changes, hidden tabs, merged cells, formulas, or unusual row formats not represented by the mock fixtures.
- Existing non-PR Apps Script code has production write and outbound-message paths. It must not be deployed or invoked as part of this read-only rollout.
- Review queue output is capped at 50 rows, so high-volume incidents require checking `rm-report.json` summary counts before relying on the CSV alone.

## First Live Run Stop Criteria

Stop the first real-data run and do not proceed to scheduled use if any condition is true:

- GitHub Actions workflow permissions are broader than `contents: read`.
- The live run requests any Google scope other than `spreadsheets.readonly`.
- Any log contains a private key, service-account JSON, access token, JWT assertion, raw phone number, raw student name, or raw original message.
- Any source fails due to missing required headers or duplicate headers.
- Any source exceeds 50,000 non-empty rows.
- `source_stats` row counts differ materially from expected tab sizes.
- `rm-run-manifest.json` safety counters are not all zero.
- `rm-review-queue.csv` contains raw phone numbers, unmasked raw names, or formula-leading cells without a leading `'`.
- More than 20% of the first 50 review rows are clearly caused by schema/header drift rather than real operating exceptions.

## First 50 Review Checklist

For the first 50 emitted review rows:

- Confirm the source sheet and source row point to the intended operational record.
- Mark each row as true positive, false positive, or undecidable.
- Check whether urgent rows should really be urgent.
- Confirm `RM-X-011` identity findings do not auto-link name-only, family-payer, corporate-payer, alias, or homonym cases.
- Confirm duplicate registration and graduation findings are not caused by benign split records that need rule tuning.
- Confirm no raw phone number, full student name, account details, or original message text is visible in CSV, JSON, TXT, workflow logs, or summaries.
- Record any missing source column, renamed header, or unexpected tab layout before enabling scheduled runs.

## Recommended Merge And Deployment Procedure

1. Keep PR #20 on `feature/rm-automation-foundation`; do not merge to `main` directly.
2. Wait for Ubuntu PR workflow `RM Read-only Pipeline Tests` to pass on the latest PR #20 commit.
3. Review this audit document and the generated dry-run artifacts.
4. Merge PR #20 only after PR #7 foundation status is settled and reviewers accept #20 as superseding PRs #15-#19.
5. Configure exactly one read-only credential Secret, preferably `RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`.
6. Run `workflow_dispatch` once and inspect artifacts before relying on the schedule.
7. Complete the first 50-row manual review checklist.
8. Keep Apps Script deployment, production sheet writes, and outbound alerts disabled until a separate approval explicitly covers those effects.
