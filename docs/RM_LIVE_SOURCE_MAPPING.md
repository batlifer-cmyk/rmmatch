# RM 실제 운영 원천 매핑

> 조사일: 2026-07-23
> 원칙: 이 문서는 읽기 전용 연결을 위한 매핑이며 운영 시트 쓰기 권한을 부여하지 않는다.

## 1. 실제 수업 원천

- Spreadsheet: `16ZKz55oMD0wBUtv9-hMk_HrPfhxRAd9HQhtbY8981x0`
- Tab: `Master time data`
- 신뢰등급: A (운영 원본)

| 열 | 원천 헤더 | 공통 필드 | 비고 |
|---|---|---|---|
| A | Teacher | instructorName | 강사명 |
| B | Date | lessonDate | 표시 형식이 영문 날짜일 수 있음 |
| C | Month | month | 파생값 |
| D | Day | day | 파생값 |
| E | Quarter | quarter | 파생값 |
| F | Student | studentName | 이름 단독 확정 금지 |
| G | Hours | hours/code | 숫자는 수업시간, `n` 등 문자는 코드 |
| H | Rate | rate | 숫자 변환 |
| I | Total amount | totalAmount | 공란 가능 |
| J | Class type | classType | 스몰톡·시험대비 등 |
| K | Note | note | 자유문장 |

### 예외

- `Hours`에는 `1`, `2`, `n` 등이 함께 존재한다.
- 숫자형 시간과 상태 코드를 분리해 저장해야 한다.
- 날짜와 시간 정보가 분리되어 있지 않아 동일 학생·강사의 하루 복수수업은 추가 키가 필요하다.

## 2. 등록 원천

- Spreadsheet: `1P42_8yxR0Tlys8g48Cq1h4SryRHzTlljE0A-bvngwnE`
- Tab: `_DB_등록로그`
- 신뢰등급: B (구조화 파생 DB)

| 원천 헤더 | 공통 필드 |
|---|---|
| 등록일시 | registeredAt |
| 학생명 | studentName |
| 전화번호 | phone |
| 금액 | amount |
| 회차수 | packageCount |
| 담당강사 | instructorName |
| 입력자 | enteredBy |
| 원본메시지 | rawMessage |
| 상태 | status |
| 수업유형 | lessonType |

### 예외

- 학생명 자리에 계좌·카드 식별문자처럼 보이는 임시값이 들어갈 수 있다.
- `회차수=999`는 정상 패키지가 아니라 판정 실패 또는 임시값으로 취급한다.
- 전화번호와 담당강사가 공란인 행이 많아 이름 단독 자동 연결을 금지한다.
- `확인필요` 상태는 자동 확정 대상에서 제외한다.

## 3. 졸업 원천

- Spreadsheet: `1P42_8yxR0Tlys8g48Cq1h4SryRHzTlljE0A-bvngwnE`
- Tab: `_DB_졸업로그`
- 신뢰등급: B

| 원천 헤더 | 공통 필드 |
|---|---|
| 처리일시 | processedAt |
| 학생명 | studentName |
| 마지막수업일 | lastLessonDate |
| 잔여 | remainingLessons |
| 사유 | reason |
| 처리자 | processedBy |
| 원본메시지 | rawMessage |
| 상태 | status |

### 예외

- 잔여 회차가 공란인 기록이 존재한다.
- 사유에는 관찰 사실, 학생 발언, 운영자의 해석이 혼재할 수 있다.
- `상태=확정`만 운영 상태 판정 후보로 사용한다.
- 졸업사유 분석에서는 사실·해석·추론을 별도 필드로 분리해야 한다.

## 4. 입금 원천

- Spreadsheet: `1aEaCAmyapSQkPt6rL23gFDkB0CkMVkizbx-k9OAMlfU`
- Tab: `입금로그`
- 신뢰등급: A/B (자동화 처리 로그)

| 원천 헤더 | 공통 필드 |
|---|---|
| 수신시각 | receivedAt |
| 입금일시 | paidAt |
| 입금자 | payerName |
| 입금액 | amount |
| 추가등록횟수 | addedCount |
| 강사구분 | instructorType |
| 판정 | judgment |
| 시트행 | targetRow |
| 처리상태 | processStatus |
| 잔디전송 | jandiStatus |
| 원본문자 | rawMessage |
| 메모 | memo |

### 예외

- 입금자명이 학생명과 다를 수 있다.
- 괄호 안 학생명이 포함된 복합 이름이 존재한다.
- `확인필요_550K` 같은 강사구분은 확정된 강사유형이 아니다.
- 과거 테스트 시나리오가 메모에 남아 있으므로 실운영 집계 전 제외 규칙이 필요하다.

## 5. 1차 연결 규칙

1. 명시적 학생 ID 일치
2. 정규화된 전화번호 일치
3. 이름 + 가까운 등록일 + 담당강사 보조 일치
4. 입금자명과 학생명이 다른 경우 원본문자·연락처·등록로그를 함께 검토
5. 이름 단독 일치는 확정하지 않고 `review_required=true`

## 6. 첫 실제 탐지에서 제외할 항목

- 날짜 안에 정확한 수업 시작시각이 없는 상태에서의 동일시간 중복 판정
- 졸업사유의 심리적 원인 자동 확정
- 입금자명만으로 학생 자동 연결
- 테스트 시나리오가 섞인 입금로그의 무조건 집계
- `회차수=999`를 실제 등록회차로 계산

## 7. 다음 구현

- 시트 API 읽기 결과를 이 어댑터에 전달하는 Apps Script 또는 서버 측 reader
- 결과를 운영본이 아닌 테스트 출력 탭 또는 JSON 보고서에 저장
- 학생 식별 resolver와 결합
- 오탐 검토 후 규칙 고정
