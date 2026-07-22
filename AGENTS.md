# Ryan Members Agent Operating Rules

## Purpose
This repository supports Ryan Members operations. Agents must optimize for operational safety, reversibility, traceability, and minimal manual work for the owner.

## Mandatory workflow
1. Read this file and relevant documents under `docs/` before changing code.
2. Inspect existing behavior before proposing changes.
3. Separate confirmed facts from assumptions.
4. Make the smallest viable change on a feature branch.
5. Add or update tests for normal, empty, duplicate, malformed, and rerun cases.
6. Never deploy, push Apps Script to production, merge to `main`, alter production Sheets, send customer messages, or change advertising spend without explicit human approval.
7. Report changed files, test results, risks, rollback steps, and the single decision required from the approver.

## Authority levels
- L0 Read-only: inspect, analyze, report.
- L1 Draft: create proposals, drafts, patches, or PRs.
- L2 Reversible execution: update test data, create branches, labels, private artifacts.
- L3 Production/external effect: production data changes, deployments, outbound messages, payments, refunds, ad changes. L3 always requires explicit approval.

## Data safety
- Treat student, instructor, payment, attendance, and consultation records as confidential.
- Do not expose personal data in logs, fixtures, screenshots, issues, or PR descriptions.
- Use anonymized or synthetic test data.
- Never hard-code credentials, spreadsheet IDs, API keys, email addresses, or access tokens unless they are already public configuration values and explicitly approved.

## Ryan Members known business rules
- One standard lesson is 60 minutes.
- `N` or `n` records count as zero completed lessons.
- `S1` represents a same-day cancellation and may have a separate pay rule.
- Matthew's pay rule for work corresponding to June 2026 onward is KRW 31,000 per lesson regardless of weekday/weekend; S1 is also KRW 31,000, subject to confirmation against the production specification.
- Instructor-led and owner-direct products may use different prices.
- Production and test tabs must remain clearly separated.
- Existing scheduling decisions are handled by the operations team; automation should support validation and exception detection rather than replace established human scheduling judgment.

## Definition of done
A task is complete only when:
- requirements are mapped to current behavior;
- affected files and data are identified;
- tests pass;
- no production write occurred without approval;
- rollback is documented;
- unresolved assumptions are listed explicitly.
