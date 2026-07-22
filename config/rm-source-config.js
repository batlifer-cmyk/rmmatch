// Read-only source configuration for Ryan Members operational data.
// Spreadsheet IDs and ranges are public to the repository but contain no credentials.

module.exports = Object.freeze({
  timezone: 'Asia/Seoul',
  sources: {
    lessons: {
      spreadsheetId: '16ZKz55oMD0wBUtv9-hMk_HrPfhxRAd9HQhtbY8981x0',
      range: "'Master time data'!A:K",
      trustLevel: 'A',
    },
    registrations: {
      spreadsheetId: '1P42_8yxR0Tlys8g48Cq1h4SryRHzTlljE0A-bvngwnE',
      range: "'_DB_등록로그'!A:J",
      trustLevel: 'B',
    },
    graduations: {
      spreadsheetId: '1P42_8yxR0Tlys8g48Cq1h4SryRHzTlljE0A-bvngwnE',
      range: "'_DB_졸업로그'!A:H",
      trustLevel: 'B',
    },
    payments: {
      spreadsheetId: '1aEaCAmyapSQkPt6rL23gFDkB0CkMVkizbx-k9OAMlfU',
      range: "'입금로그'!A:L",
      trustLevel: 'A',
    },
    contacts: {
      spreadsheetId: '1pzlK1k45fEjiDLv9XaF3YYj5ok5vhn-mqzCFRNZrgs0',
      range: "'학생연락처'!A:K",
      trustLevel: 'C',
    },
    studentProfiles: {
      spreadsheetId: '1Z5I2mDgQvrV0-g_iKbVP6emkDgp57hKFaOdRc57FozM',
      range: "'학생정보'!A:Q",
      trustLevel: 'B',
    },
  },
  limits: {
    maxRowsPerSource: 50000,
    recentLessonMonths: 18,
  },
});
