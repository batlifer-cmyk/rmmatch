# RM 상담차팅 MVP v0.5 설치

## 배포 구성

- 기존 RM Scheduler: 저장소 루트의 `index.html` — 변경하지 않음
- 신규 RM 상담차팅: `charting/` 경로
- 예상 GitHub Pages 주소: `https://batlifer-cmyk.github.io/rmmatch/charting/`

## Apps Script 설치

1. 현재 잔디 자동화 Apps Script 프로젝트를 엽니다.
2. 기존 `Code.gs` 전체를 이 폴더의 `Code.gs`로 교체합니다.
3. 새 스크립트 파일 `Charting.gs`를 생성하고 이 폴더의 `Charting.gs` 전체를 붙여넣습니다.
4. `appsscript.json`은 이 폴더의 파일과 동일한지 확인합니다.
5. 저장 후 `배포 → 배포 관리 → 연필 아이콘 → 새 버전 → 배포`합니다.
6. 기존 `/exec` URL은 유지합니다.

## 스크립트 속성

기존 속성을 유지하고 아래 항목을 추가합니다.

- `CHARTING_PASSWORD`: 매튜가 상담차팅 화면에서 사용할 비밀번호
- `OPENAI_API_KEY`: 맞춤법 교정용 OpenAI API 키
- `OPENAI_PROOFREAD_MODEL`: `gpt-5.6-luna`
- `JANDI_INCOMING_WEBHOOK_URL`: 학생정보 토픽에 연결한 잔디 Incoming Webhook URL

비밀번호, API 키, 웹훅 URL은 GitHub 코드나 Google Sheet 셀에 기록하지 않습니다.

## 동작

- `맞춤법 교정본 생성`: 한글 맞춤법·띄어쓰기·명백한 오타·문장부호만 교정합니다.
- 교정 보호 항목: 학생 실제 영어 응답, 테스트 단어, 매튜가 선택·수정한 레벨지침.
- `구글시트 저장 + 잔디 전송`:
  1. `상담차팅` 탭에 구조화 필드, 작성 원문, 최종 교정본을 저장합니다.
  2. 최종 교정본을 잔디 학생정보 토픽에 전송합니다.
  3. 잔디 전송 실패 시 시트 저장은 유지하며 `잔디에만 다시 전송` 버튼을 제공합니다.

## 현재 백엔드 URL

`https://script.google.com/macros/s/AKfycbx-5XshUD_hLa4nMh7vJR2iom_yYUiTalz4mxmAh5npEmtmOZ-Sq9gg906xqy6ovp75nQ/exec`
