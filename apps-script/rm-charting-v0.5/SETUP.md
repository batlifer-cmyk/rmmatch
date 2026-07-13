# RM 상담차팅 MVP v0.5.1 설치

## GitHub Pages 화면
- `charting/index.html`
- 주소: `https://batlifer-cmyk.github.io/rmmatch/charting/`
- 기존 RM Scheduler 루트 `index.html`은 변경하지 않습니다.

## Apps Script 반영
1. 현재 잔디 자동화 Apps Script 프로젝트의 `Code.gs`를 이 폴더의 `Code.gs` 전체 내용으로 교체합니다.
2. 새 스크립트 파일 `Charting.gs`를 만들고 이 폴더의 `Charting.gs` 전체 내용을 붙여넣습니다.
3. `appsscript.json`은 이 폴더 파일과 동일한지 확인합니다.
4. 저장 후 웹앱을 새 버전으로 재배포합니다.
5. 기존 `/exec` URL은 그대로 유지합니다.

## 스크립트 속성
기존 속성을 유지하고 아래를 추가합니다.

- `CHARTING_PASSWORD`: 매튜가 페이지에서 입력할 비밀번호
- `OPENAI_API_KEY`: 맞춤법 교정용 API 키
- `OPENAI_PROOFREAD_MODEL`: `gpt-5.6-luna`
- `JANDI_INCOMING_WEBHOOK_URL`: 학생정보 토픽에 만든 잔디 Incoming Webhook URL

비밀번호, API 키, 웹훅 URL은 GitHub 코드·Google Sheet·채팅에 기록하지 않습니다.

## 보안·무결성
- 인증 비밀번호와 토큰은 오류로그에 기록하기 전에 자동 마스킹합니다.
- 맞춤법 교정 후 입력값이 바뀌면 전송을 차단하고 교정본 재생성을 요구합니다.
- 이미 잔디 전송이 완료된 `record_id`는 중복 전송하지 않습니다.
- 상담차팅 비밀번호는 브라우저 탭 세션에만 유지하고 영구 저장하지 않습니다.

## 동작
- 맞춤법 교정: 맞춤법·띄어쓰기·명백한 오타·기본 문장부호만 수정
- 보호 구간: 학생 실제 영어 응답, 테스트 단어, 레벨지침 원문
- 최종 버튼:
  1. `상담차팅` 탭에 구조화 데이터와 원문·교정본 저장
  2. 최종 교정본을 잔디 Incoming Webhook으로 전송
- 잔디 전송 실패 시 시트 저장은 유지되고 `잔디에만 다시 전송` 버튼이 표시됩니다.

## 현재 백엔드 URL
`https://script.google.com/macros/s/AKfycbx-5XshUD_hLa4nMh7vJR2iom_yYUiTalz4mxmAh5npEmtmOZ-Sq9gg906xqy6ovp75nQ/exec`
