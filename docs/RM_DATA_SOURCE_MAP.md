# Ryan Members 데이터 원천 지도

이 문서는 운영 이상탐지와 멀티에이전트가 어떤 시트를 사실 원천으로 사용해야 하는지 정의한다.
운영 원본은 읽기 전용으로 취급하며, 파생·테스트 시트의 결과를 사실값으로 역수입하지 않는다.

## 신뢰등급

- A: 운영 사실 원천
- B: 구조화된 파생 DB
- C: 자동 추출·AI 정제 자료
- D: 테스트·분석 결과물

## 원천 목록

### A. 실제 수업·출석

- 파일: Master Time Data
- ID: `16ZKz55oMD0wBUtv9-hMk_HrPfhxRAd9HQhtbY8981x0`
- 역할: 실제 수업기록, 강사, 학생, 일시, 수업/정산 코드
- 등급: A
- 주의: 실제 탭별 헤더 매핑 추가 조사 필요

### B. 상담·학생 진단 양식

- 파일: RM 상담 파일 및 학생 진단 사항
- ID: `1qsty4gtAnHTZXqK71bX89SuPEqgAIP2YTwXxRV07N64`
- 탭: `RM 상담 파일`, `RM 학생 진단 사항`, `신규 등록 학생 정보 입력`
- 역할: 상담 질문, 레벨 진단, 등록 전달 양식
- 등급: B
- 주의: 파일 시간대가 Europe/Paris이므로 일시 해석 시 Asia/Seoul로 명시 변환

### C. QR 출결 테스트

- 파일: QR Attendance System - Test
- ID: `1ODobbLBtKm-1WyPxS19k334Kv4ocP_PAf-UZaD5Nlvw`
- 탭: `Students`, `Classes`, `Teachers`, `Enrollments`, `Sessions`, `QR_Attendance_Log`, `AuditLog`
- 역할: 정규화된 향후 출결 모델
- 등급: D
- 금지: 현재 운영 사실 원천으로 사용하지 않음

### D. 연락처 정제 저장소

- 파일: ryan_members_contacts
- ID: `1pzlK1k45fEjiDLv9XaF3YYj5ok5vhn-mqzCFRNZrgs0`
- 탭: `학생연락처`, `검토필요`, `전체번호원문`, `중복번호`
- 역할: 이름-전화번호 후보, 등장횟수, 원문근거
- 등급: C
- 주의: 동일 이름에 복수 번호가 존재할 수 있으므로 단독 확정키로 사용 금지

### E. 잔디→개인카톡 자동화

- 파일: RM_잔디→개인카톡 자동화_테스트_v0.3
- ID: `1Z5I2mDgQvrV0-g_iKbVP6emkDgp57hKFaOdRc57FozM`
- 탭: `학생정보`, `상담차팅`, `카카오발송대기`, `강사매핑`, `오류로그`, `차팅전송로그`
- 역할: 구조화 학생 프로필, 상담·레벨·수업전략, AI 신뢰도
- 등급: B/C
- 주의: `student_id`, `phone`, `source_id`를 식별 보조키로 사용

### F. 수강료·등록

- 파일: RM 수강료 등록 현황
- ID: `1aEaCAmyapSQkPt6rL23gFDkB0CkMVkizbx-k9OAMlfU`
- 기준 탭: `RM 수강료 등록 현황`, `입금로그`, `입금 총집계`
- 역할: 등록횟수, 등록일, 강사구분, 입금·결제 근거
- 등급: A
- 주의: 학생키·연락처 공란, 자유문장 비고, 비정형 금액 존재

### G. 재등록 조기경보

- 파일: RM 재등록 조기경보 테스트
- ID: `1P42_8yxR0Tlys8g48Cq1h4SryRHzTlljE0A-bvngwnE`
- 기준 탭: `_DB_졸업로그`, `_DB_등록로그`
- 참고 탭: `브리핑헬퍼`, `학생연락처`, `전체연락처_마케팅리드`
- 역할: 졸업·등록 이력과 재등록 분석
- 등급: B/D
- 금지: 계산 블록과 `#REF!`가 혼재된 `시트1`을 운영 원본으로 사용하지 않음

## canonical_student_id 생성 우선순위

1. 명시적 `student_id`
2. 정규화된 휴대전화번호
3. 학생명 + 등록일
4. 학생명 + 담당강사
5. 이름 단독은 임시 키만 생성하고 반드시 검토 대상으로 남김

## 원천 간 연결 규칙

- student_id exact: 자동 연결 가능
- phone exact: 높은 신뢰도, 번호 중복 목록과 충돌 여부 확인
- name exact + registration date exact: 검토 후 연결
- name exact + instructor exact: 검토 후 연결
- name only: 자동 연결 금지
- student_id conflict 또는 phone conflict: 즉시 충돌로 분류

## 1차 이상탐지 입력

- 학생 상태·최근/향후 수업: Master Time Data
- 등록 패키지: RM 수강료 등록 현황
- 입금: 입금로그·입금 총집계
- 학생 식별 보조: 잔디 학생정보 + ryan_members_contacts
- 졸업·중단 제외: `_DB_졸업로그`

## 다음 연결 작업

1. Master Time Data 실제 탭과 헤더 확정
2. `_DB_등록로그`, `_DB_졸업로그` 헤더 확정
3. 입금로그 헤더 확정
4. 각 원천을 공통 객체로 변환하는 read-only adapter 작성
5. 익명 샘플로 교차원천 매칭 테스트
6. 이름 단독 연결률과 충돌률 보고
