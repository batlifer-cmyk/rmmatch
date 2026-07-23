// Read-only source configuration for Ryan Members operational data.
// Spreadsheet IDs and ranges are public to the repository but contain no credentials.

module.exports = Object.freeze({
  timezone: 'Asia/Seoul',
  sources: {
    lessons: {
      spreadsheetId: '16ZKz55oMD0wBUtv9-hMk_HrPfhxRAd9HQhtbY8981x0',
      range: "'Master time data'!A:K",
      trustLevel: 'A',
      requiredHeaders: ['Teacher', 'Date', 'Student', 'Hours', 'Rate', 'Total amount'],
    },
    registrations: {
      spreadsheetId: '1P42_8yxR0Tlys8g48Cq1h4SryRHzTlljE0A-bvngwnE',
      range: "'_DB_등록로그'!A:J",
      trustLevel: 'B',
      requiredHeaders: ['등록일시', '학생명', '금액', '회차수', '원본메시지', '상태'],
    },
    graduations: {
      spreadsheetId: '1P42_8yxR0Tlys8g48Cq1h4SryRHzTlljE0A-bvngwnE',
      range: "'_DB_졸업로그'!A:H",
      trustLevel: 'B',
      requiredHeaders: ['처리일시', '학생명', '마지막수업일', '사유', '원본메시지', '상태'],
    },
    payments: {
      spreadsheetId: '1aEaCAmyapSQkPt6rL23gFDkB0CkMVkizbx-k9OAMlfU',
      range: "'입금로그'!A:L",
      trustLevel: 'A',
      requiredHeaders: ['수신시각', '입금일시', '입금자', '입금액', '추가등록횟수', '원본문자', '메모'],
    },
    contacts: {
      spreadsheetId: '1pzlK1k45fEjiDLv9XaF3YYj5ok5vhn-mqzCFRNZrgs0',
      range: "'학생연락처'!A:K",
      trustLevel: 'C',
      requiredHeaders: ['학생명', '전화번호'],
    },
    studentProfiles: {
      spreadsheetId: '1Z5I2mDgQvrV0-g_iKbVP6emkDgp57hKFaOdRc57FozM',
      range: "'학생정보'!A:Q",
      trustLevel: 'B',
      requiredHeaders: ['student_id', 'name', 'phone'],
    },
  },
  limits: {
    maxRowsPerSource: 50000,
    recentLessonMonths: 18,
  },
});
