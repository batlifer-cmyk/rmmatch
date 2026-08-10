const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shared = fs.readFileSync(path.join(root, 'v2-shared-state.js'), 'utf8');
const appScript = fs.readFileSync(path.join(root, 'apps-script', 'RM_Calendar_API.gs'), 'utf8');

assert.doesNotThrow(() => new Function(shared), 'v2-shared-state.js should parse as browser JavaScript');
assert.doesNotThrow(() => new Function(appScript), 'RM_Calendar_API.gs should parse as Apps Script JavaScript');

const compactStart = shared.indexOf('function compactInstructors()');
const compactEnd = shared.indexOf('function applyConfig', compactStart);
assert(compactStart >= 0 && compactEnd > compactStart, 'compactInstructors should be present');
const compactBody = shared.slice(compactStart, compactEnd);

['days', 'times', 'dayTimes', 'subjects', 'maxConsec'].forEach(field => {
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

assert(appScript.includes('baseRevision'), 'Apps Script should validate base revision');
assert(appScript.includes("status: 'revision_conflict'"), 'Apps Script should return a conflict status');
assert(appScript.includes('rmStateReadConfig_'), 'conflict response should include latest server config');

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
