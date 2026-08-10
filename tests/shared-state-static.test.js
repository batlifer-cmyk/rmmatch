const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shared = fs.readFileSync(path.join(root, 'v2-shared-state.js'), 'utf8');
const usability = fs.readFileSync(path.join(root, 'v2-usability.js'), 'utf8');
const appScript = fs.readFileSync(path.join(root, 'apps-script', 'RM_Calendar_API.gs'), 'utf8');

assert.doesNotThrow(() => new Function(shared), 'v2-shared-state.js should parse as browser JavaScript');
assert.doesNotThrow(() => new Function(usability), 'v2-usability.js should parse as browser JavaScript');
assert.doesNotThrow(() => new Function(appScript), 'RM_Calendar_API.gs should parse as Apps Script JavaScript');

const compactStart = shared.indexOf('function compactInstructors()');
const compactEnd = shared.indexOf('function applyConfig', compactStart);
assert(compactStart >= 0 && compactEnd > compactStart, 'compactInstructors should be present');
const compactBody = shared.slice(compactStart, compactEnd);

['days', 'times', 'dayTimes', 'subjects', 'maxConsec', 'active'].forEach(field => {
  assert(compactBody.includes(field), `central config should include ${field}`);
});
['profile', 'calId', 'calendarId', 'calendarSourceLabel'].forEach(field => {
  assert(!compactBody.includes(field), `central config must not include ${field}`);
});

assert(shared.includes('LOGIN_STATUS_TIMEOUT_MS'), 'login should fail fast when shared-state status is slow');
assert(shared.includes('scheduleBackgroundLogin'), 'slow shared-state login should retry in background');
assert(shared.includes('applyRemoteState(remote)'), 'remote config should be applied through a single runtime refresh path');
assert(shared.includes('baseRevision'), 'state.save should send the base revision');
assert(shared.includes('revision_conflict'), 'client should handle revision conflicts');
assert(shared.includes('refreshOpenInstructorModal()'), 'remote config should refresh an already-open instructor modal');
assert(shared.includes('originalSaveInstructor'), 'instructor edits should flush remote saves immediately');
assert(!shared.includes("localStorage.getItem('rm_pw')"), 'shared login must not read browser-local passwords');
assert(!shared.includes("localStorage.setItem('rm_pw'"), 'shared password changes must not write browser-local passwords');
assert(!shared.includes('originalChangePw()'), 'shared password change must not fall back to legacy localStorage mutation');
assert(!shared.includes('originalDoLogin()'), 'shared login must not fall back to legacy localStorage password auth');
assert(shared.includes('clearLocalPassword()'), 'shared login should clear legacy browser-local password state');
assert(shared.includes('state.password'), 'shared password change should use the central password endpoint');
assert(usability.includes('isInstructorActive'), 'usability patch should define instructor active handling');
assert(usability.includes('active=!!active.checked'), 'instructor modal should save active state');
assert(usability.includes('originalComputeSlots'), 'inactive instructors should be filtered from slot results');
assert(usability.includes('elementFromPoint'), 'student time drag should use pointer position hit testing');
assert(usability.includes('splitNamePhone'), 'student name and phone should be parsed from combined input');

assert(appScript.includes('baseRevision'), 'Apps Script should validate base revision');
assert(appScript.includes("status: 'revision_conflict'"), 'Apps Script should return a conflict status');
assert(appScript.includes('rmStateReadConfig_'), 'conflict response should include latest server config');
assert(appScript.includes('active: row.active !== false'), 'Apps Script should preserve instructor active state');

assert(appScript.includes('ev.isAllDayEvent()'), 'all-day availability notes must not be BUSY');
assert(appScript.includes('CalendarApp.EventTransparency.TRANSPARENT'), 'transparent availability notes must not be BUSY');
const busyPushStart = appScript.indexOf('busy.push({');
const busyPushEnd = appScript.indexOf('});', busyPushStart);
assert(busyPushStart >= 0 && busyPushEnd > busyPushStart, 'busy.push payload should be present');
const busyPayload = appScript.slice(busyPushStart, busyPushEnd);
['summary', 'description', 'attendees', 'calendarId'].forEach(field => {
  assert(!busyPayload.includes(field), `BUSY payload must not include ${field}`);
});

console.log('shared-state static checks passed');
