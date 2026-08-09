const RM_CALENDAR_TIMEZONE = 'Asia/Seoul';
const RM_CALENDAR_IDS = Object.freeze({
  matthew: 'matthew.g.mun@gmail.com',
  david: 'parkdavid0211@gmail.com',
  paul: '78705a8de54b56ea1c21af40a1b8c80b468dcdc82b1e92d2943db0d121ac4bec@group.calendar.google.com',
  jenna: '6bfaa96f9c8bf215a51189ab58c6426586b77751a85c898365d2f6ffb86eb73f@group.calendar.google.com',
  dean: '2f1dff2664bb6fd9c5de5bf31aa0dbc87e680ae675fc474302f975a78b39bf64@group.calendar.google.com'
});

/**
 * Standalone Apps Script Web App for RM Scheduler.
 * Deploy from ryanmembers.rmhq@gmail.com as "Execute as me".
 * Returns BUSY time ranges only. Event titles, student names, descriptions,
 * guests, locations and event IDs never leave Apps Script.
 */
function doPost(e) {
  try {
    const body = rmCalendarParseBody_(e);
    if (body.action !== 'calendar.busy') {
      return rmCalendarJson_({ ok: false, status: 'unknown_action' });
    }
    return rmCalendarJson_(rmCalendarBuildBusy_(body));
  } catch (err) {
    return rmCalendarJson_({
      ok: false,
      status: 'exception',
      message: err && err.message ? err.message : String(err)
    });
  }
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.action === 'calendar.busy') {
      const result = rmCalendarBuildBusy_(p);
      if (p.callback) return rmCalendarJsonp_(p.callback, result);
      return rmCalendarJson_(result);
    }
    return rmCalendarJson_({
      ok: true,
      service: 'rm-calendar-busy',
      version: '2026.08.09.2'
    });
  } catch (err) {
    const result = {
      ok: false,
      status: 'exception',
      message: err && err.message ? err.message : String(err)
    };
    const callback = e && e.parameter && e.parameter.callback;
    return callback ? rmCalendarJsonp_(callback, result) : rmCalendarJson_(result);
  }
}

function rmCalendarParseBody_(e) {
  const text = e && e.postData && e.postData.contents
    ? String(e.postData.contents)
    : '{}';
  const parsed = JSON.parse(text || '{}');
  return parsed && parsed.payload ? parsed.payload : parsed;
}

function rmCalendarBuildBusy_(body) {
  const now = new Date();
  const from = rmCalendarParseDate_(body.from) || new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const requestedTo = rmCalendarParseDate_(body.to);
  const to = requestedTo || new Date(from.getTime() + 31 * 24 * 60 * 60 * 1000);
  if (to <= from) throw new Error('Invalid date range');
  if (to.getTime() - from.getTime() > 62 * 24 * 60 * 60 * 1000) {
    throw new Error('Date range too large');
  }

  const instructors = {};
  Object.keys(RM_CALENDAR_IDS).forEach(function(id) {
    const cal = CalendarApp.getCalendarById(RM_CALENDAR_IDS[id]);
    if (!cal) throw new Error('Calendar unavailable: ' + id);
    const events = cal.getEvents(from, to);
    const busy = [];
    events.forEach(function(ev) {
      if (!ev || ev.isAllDayEvent()) return;
      if (ev.getTransparency() === CalendarApp.EventTransparency.TRANSPARENT) return;
      const start = ev.getStartTime();
      const end = ev.getEndTime();
      if (!start || !end || end <= start) return;
      busy.push({
        start: Utilities.formatDate(start, RM_CALENDAR_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        end: Utilities.formatDate(end, RM_CALENDAR_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
      });
    });
    instructors[id] = rmCalendarMerge_(busy);
  });

  return {
    ok: true,
    schema: 'rm-calendar-live-v1',
    generatedAt: Utilities.formatDate(now, RM_CALENDAR_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    timezone: RM_CALENDAR_TIMEZONE,
    privacy: 'busy-times-only-no-event-content',
    range: {
      from: Utilities.formatDate(from, RM_CALENDAR_TIMEZONE, 'yyyy-MM-dd'),
      to: Utilities.formatDate(to, RM_CALENDAR_TIMEZONE, 'yyyy-MM-dd')
    },
    instructors: instructors
  };
}

function rmCalendarParseDate_(value) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
}

function rmCalendarMerge_(rows) {
  const items = (rows || []).map(function(x) {
    return { start: new Date(x.start), end: new Date(x.end) };
  }).filter(function(x) {
    return Number.isFinite(x.start.getTime()) && Number.isFinite(x.end.getTime()) && x.end > x.start;
  }).sort(function(a, b) { return a.start - b.start; });

  const merged = [];
  items.forEach(function(x) {
    const last = merged[merged.length - 1];
    if (last && x.start <= last.end) {
      if (x.end > last.end) last.end = x.end;
    } else {
      merged.push({ start: x.start, end: x.end });
    }
  });
  return merged.map(function(x) {
    return {
      start: Utilities.formatDate(x.start, RM_CALENDAR_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
      end: Utilities.formatDate(x.end, RM_CALENDAR_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
    };
  });
}

function rmCalendarJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rmCalendarJsonp_(callback, obj) {
  const name = String(callback || '');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/.test(name)) {
    return rmCalendarJson_({ ok: false, status: 'invalid_callback' });
  }
  return ContentService
    .createTextOutput(name + '(' + JSON.stringify(obj) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
