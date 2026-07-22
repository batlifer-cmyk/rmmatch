# RM 읽기 전용 이상탐지 실행 지침

## 목적
운영 Google Sheets를 수정하지 않고 데이터를 읽어 이상 후보 보고서를 생성한다.

## 실행 순서
1. Google Sheets API 읽기 전용 자격증명을 준비한다.
2. `getValues(spreadsheetId, range)`만 노출하는 client wrapper를 만든다.
3. `runReadOnlyPipeline(client)`를 실행한다.
4. 반환값의 `report` JSON과 `textReport`를 비공개 테스트 위치에 저장한다.
5. 운영팀이 오탐·정탐을 표시한다.
6. 규칙을 보정한 뒤에만 정기 실행을 검토한다.

## CLI 실행

자격증명이 없는 환경에서는 운영 시트를 읽지 않는 dry-run으로 출력 경로와 보고서 스키마만 검증한다.

```bash
node scripts/run-rm-readonly.js --dry-run --out-dir artifacts/rm-readonly
```

실제 운영 원천은 Google Sheets `values.get`만 호출하는 읽기 전용 client로 실행한다.

```bash
node scripts/run-rm-readonly.js --out-dir artifacts/rm-readonly
```

지원하는 자격증명 환경변수는 다음 중 하나다.

- `RM_GOOGLE_SERVICE_ACCOUNT_JSON`: Google service account JSON 원문
- `RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`: Google service account JSON의 base64 값
- `GOOGLE_APPLICATION_CREDENTIALS`: 로컬 service account JSON 파일 경로

GitHub Actions Secret으로는 `RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` 사용을 권장한다. Google OAuth scope는 `https://www.googleapis.com/auth/spreadsheets.readonly`만 허용한다.

## GitHub Actions 자동 실행

`.github/workflows/rm-readonly-daily.yml`은 다음 조건으로 실행된다.

- `workflow_dispatch`: 수동 실행
- `schedule`: 매일 22:00 UTC, 즉 07:00 KST

workflow 권한은 `contents: read`만 사용한다. 먼저 전체 Node 테스트를 실행하고, `RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` 또는 `RM_GOOGLE_SERVICE_ACCOUNT_JSON` Secret이 있을 때만 실데이터 read-only runner를 실행한다. Secret이 없으면 job summary에 안전 skip 사유를 남기고 성공 종료한다.

생성 artifact는 `rm-readonly-report` 이름으로 업로드하며 보존기간은 30일이다.

## 출력

기본 출력 디렉터리는 `artifacts/rm-readonly`이며, 다음 파일을 생성한다.

- `rm-report.json`
- `rm-report.txt`
- `rm-review-queue.csv`
- `rm-run-manifest.json`

보고서의 `source_stats`에는 각 원천의 읽기 성공 여부, 변환 행 수, range, trust level, 실패 메시지를 기록한다. 일부 원천 읽기에 실패해도 `--dry-run`과 runner는 실패 원천을 보고서에 남기고 가능한 범위의 read-only 보고서를 생성한다.

`rm-review-queue.csv`는 urgent를 먼저 정렬하고 전체 최대 50건만 포함한다. CSV 필드는 `검수상태, 심각도, 규칙ID, 마스킹 학생키, 원천시트, 원천행, 근거, 권장조치, 운영자메모`이며 기본 검수상태는 `판단보류`다. `=`, `+`, `-`, `@`로 시작하는 값은 CSV injection 방지를 위해 앞에 `'`를 붙인다.

`rm-run-manifest.json`은 실행 시각, 원천별 성공/실패, 후보 건수, 출력 건수, 안전 조건을 기록한다.

## 금지
- 운영 시트에 결과 탭 자동 생성
- 원자료 수정
- 학생 또는 강사에게 자동 메시지 발송
- 이름만 일치하는 등록·입금 건 자동 확정
- API 자격증명 저장소 커밋
- `append`, `update`, `clear`, `batchUpdate` 계열 Google Sheets 쓰기 메서드 구현

## 첫 실행 검수표
- 원천별 읽은 행 수가 실제 범위와 유사한가
- 테스트 시나리오 입금이 탐지되는가
- `999` 회차와 임시 학생명이 탐지되는가
- 졸업 후 복귀 학생이 오탐으로 분류될 가능성을 확인했는가
- 가족·법인·카드 입금이 미매칭으로 과다 탐지되는가
- 동명이인과 번호변경을 구분할 보조자료가 있는가

## 승인 게이트
첫 실데이터 실행 결과 50건을 사람이 검토하여 다음을 기록한다.
- 정탐
- 오탐
- 판단불가
- 필요한 추가 원천

오탐률과 개인정보 노출 위험을 확인하기 전에는 정기 실행이나 외부 알림을 활성화하지 않는다.
