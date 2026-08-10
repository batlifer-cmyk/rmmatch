const assert = require('assert');
const fs = require('fs');

const files = Object.fromEntries([
  'v2-workload.js',
  'v2-calendar.js',
  'v2-live-refresh.js',
  'v2-calendar-health.js',
  'v2-sort.js',
  'v2-step-fix.js',
  'v2-date-guard.js',
  'v2-core.js'
].map(file => [file, fs.readFileSync(file, 'utf8')]));

for (const [file, source] of Object.entries(files)) {
  assert.doesNotThrow(() => new Function(source), `${file} should parse`);
}

assert(files['v2-workload.js'].includes('hardBlock:false'), '4-hour break policy should be soft, not hard');
assert(files['v2-workload.js'].includes('fit.maxRunExceeded=false'), '5-hour candidates should not be deleted by legacy maxRunExceeded filter');
assert(files['v2-workload.js'].includes('workloadWarning'), '5-hour candidates should keep a visible warning');

assert(files['v2-sort.js'].includes('low_workload'), 'result sort should retain workload-aware sort mode');
assert(files['v2-sort.js'].includes('warning'), 'sort should rank warning candidates lower');
assert(files['v2-sort.js'].includes('requestRank'), 'result sort should keep requested day/time fit ahead of raw time ordering');
assert(files['v2-sort.js'].includes('requestFirst||cmpNum(x.max,y.max)'), 'early sort should apply only inside the requested-time bucket');

assert(/jenna\.days=\[[^\]]+,[^\]]+\]/.test(files['v2-calendar.js']), 'Jenna availability preference should stay limited to two days');
assert(files['v2-calendar.js'].includes("jenna.times=['10:00','11:00','12:00','13:00']"), 'Jenna after-14:00 non-preference should stay reflected');
assert(/dean\.days=\[[^\]]+,[^\]]+\]/.test(files['v2-calendar.js']), 'Dean weekend online-only availability should stay limited to two days');
assert(files['v2-calendar.js'].includes("dean.times=['17:00','18:00','19:00','20:00','21:00']"), 'Dean online evening hours should stay reflected');

assert(files['v2-live-refresh.js'].includes('apps-script-live-failed'), 'Apps Script live failures should be tracked');
assert(files['v2-live-refresh.js'].includes('markUnavailable(ins.id,true)'), 'calendar failures should mark instructor unavailable');
assert(files['v2-calendar.js'].includes('unavailableCalendarInstructors.has(insId)'), 'unavailable calendars should become hard conflicts');

assert(files['v2-date-guard.js'].includes('conflictOnDate'), 'date-specific BUSY guard should remain installed');
assert(files['v2-core.js'].includes('rmv2ValidateSelectedSlot'), 'selected slot validation should remain installed');
assert(files['v2-step-fix.js'].includes('goStep3'), 'step fix should continue wrapping goStep3');
assert(files['v2-step-fix.js'].includes('selectedSlot'), 'step fix should preserve selectedSlot handoff');

console.log('scheduler regression static checks passed');
