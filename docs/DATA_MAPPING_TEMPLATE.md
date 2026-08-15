# 운영 이상탐지 데이터 매핑표

실제 Google Sheets 연결 전 아래 항목을 운영 시트의 정확한 탭명·열명과 대조해야 한다.

| 표준 필드 | 실제 탭 | 실제 열 | 필수 | 비고 |
|---|---|---|---|---|
| student.name |  |  | 예 | 학생DB 기준명 |
| student.status |  |  | 예 | 활성·연기·졸업 등 |
| student.remainingLessons |  |  | 예 | 잔여 회차 |
| student.renewalStatus |  |  | 아니오 | 재등록 진행 상태 |
| student.lastLessonAt |  |  | 예 | 최근 수업일 |
| student.nextLessonAt |  |  | 아니오 | 가장 가까운 미래 일정 |
| lesson.studentName |  |  | 예 | 학생DB 기준명과 연결 |
| lesson.instructorName |  |  | 예 | 강사 기준명 |
| lesson.startAt |  |  | 예 | 수업 시작 일시 |
| lesson.code |  |  | 예 | NORMAL, N/n, S1 등 |
| lesson.settlementHours |  |  | 아니오 | 정산시간 검사용 |
| payment.studentName |  |  | 아니오 | 입금·패키지 검사 2단계 |
| payment.amount |  |  | 아니오 |  |
| package.studentName |  |  | 아니오 |  |
| package.lessonCount |  |  | 아니오 |  |

## 연결 전 확인사항
- 학생명을 단일키로 쓸 수 있는지, 동명이인 보조키가 있는지
- 날짜가 Date 객체인지 문자열인지
- N/n, S1 외 실제 허용 코드 전체 목록
- 활성·연기·환불·졸업 상태값의 정확한 철자
- 장기 미수강 기준일을 21일로 둘지
- 미래 일정 원천이 스케줄러인지 수업DB인지
- 운영 결과를 어느 테스트 탭에 쓸지
