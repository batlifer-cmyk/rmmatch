const RM_CALENDAR_TIMEZONE = 'Asia/Seoul';
const RM_CALENDAR_IDS = Object.freeze({
  matthew: 'matthew.g.mun@gmail.com',
  david: 'parkdavid0211@gmail.com',
  paul: '78705a8de54b56ea1c21af40a1b8c80b468dcdc82b1e92d2943db0d121ac4bec@group.calendar.google.com',
  jenna: '6bfaa96f9c8bf215a51189ab58c6426586b77751a85c898365d2f6ffb86eb73f@group.calendar.google.com',
  dean: '2f1dff2664bb6fd9c5de5bf31aa0dbc87e680ae675fc474302f975a78b39bf64@group.calendar.google.com'
});

const RM_STATE_SCHEMA = 'rm-shared-state-v1';
const RM_STATE_PASSWORD_KEY = 'RM_SHARED_PASSWORD_HASH';
const RM_STATE_CONFIG_KEY = 'RM_SHARED_INSTRUCTOR_CONFIG';
const RM_STATE_REV_KEY = 'RM_SHARED_REVISION';

/**
 * RM Scheduler Apps Script Web App
 * - Google Calendar BUSY-only live read
 * - Shared operator password
 * - Shared instructor scheduling settings
 *
 * Deploy from ryanmembers.rmhq@gmail.com as "Execute as me".
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
    let result;

    if (p.action === 'calendar.busy') {
      result = rmCalendarBuildBusy_(p);
    } else if (String(p.action || '').indexOf('state.') === 0) {
      result = rmStateHandle_(p);
    } else {
      result = {
        ok: true,
        service: 'rm-calendar-busy',
        version: '2026.08.09.3',
        sharedState: RM_STATE_SCHEMA
      };
    }

    if (p.callback) return rmCalendarJsonp_(p.callback, result);
    return rmCalendarJson_(result);
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

function rmStateHandle_(p) {
  const action = String(p.action || '');
  const props = PropertiesService.getScriptProperties();

  if (action === 'state.status') {
    return {
      ok: true,
      schema: RM_STATE_SCHEMA,
      passwordInitialized: !!props.getProperty(RM_STATE_PASSWORD_KEY),
      hasConfig: !!props.getProperty(RM_STATE_CONFIG_KEY),
      revision: Number(props.getProperty(RM_STATE_REV_KEY) || 0)
    };
  }

  if (action === 'state.bootstrap') {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (props.getProperty(RM_STATE_PASSWORD_KEY)) {
        return { ok: false, status: 'already_initialized', message: 'Shared state already initialized' };
      }
      const newHash = rmStateValidateHash_(p.newHash);
      const config = rmStateSanitizeConfig_(p.config);
      props.setProperty(RM_STATE_PASSWORD_KEY, newHash);
      props.setProperty(RM_STATE_CONFIG_KEY, JSON.stringify(config));
      props.setProperty(RM_STATE_REV_KEY, '1');
      return { ok: true, schema: RM_STATE_SCHEMA, revision: 1 };
    } finally {
      lock.releaseLock();
    }
  }

  const storedHash = String(props.getProperty(RM_STATE_PASSWORD_KEY) || '');
  if (!storedHash) {
    return { ok: false, status: 'not_initialized', message: 'Shared state not initialized' };
  }

  const proof = rmStateValidateHash_(p.proof);
  const authorized = rmStateSafeEqual_(storedHash, proof);

  if (action === 'state.auth') {
    return { ok: true, schema: RM_STATE_SCHEMA, authorized: authorized };
  }

  if (!authorized) {
    return { ok: false, status: 'unauthorized', message: 'Invalid shared password' };
  }

  if (action === 'state.get') {
    const raw = props.getProperty(RM_STATE_CONFIG_KEY) || '[]';
    let instructors = [];
    try { instructors = JSON.parse(raw); } catch (_) { instructors = []; }
    return {
      ok: true,
      schema: RM_STATE_SCHEMA,
      revision: Number(props.getProperty(RM_STATE_REV_KEY) || 0),
      instructors: Array.isArray(instructors) ? instructors : []
    };
  }

  if (action === 'state.save') {
    const config = rmStateSanitizeConfig_(p.config);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const revision = Number(props.getProperty(RM_STATE_REV_KEY) || 0) + 1;
      props.setProperty(RM_STATE_CONFIG_KEY, JSON.stringify(config));
      props.setProperty(RM_STATE_REV_KEY, String(revision));
      return { ok: true, schema: RM_STATE_SCHEMA, revision: revision };
    } finally {
      lock.releaseLock();
    }
  }

  if (action === 'state.password') {
    const newHash = rmStateValidateHash_(p.newHash);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const current = String(props.getProperty(RM_STATE_PASSWORD_KEY) || '');
      if (!rmStateSafeEqual_(current, proof)) {
        return { ok: false, status: 'unauthorized', message: 'Password changed by another operator' };
      }
      props.setProperty(RM_STATE_PASSWORD_KEY, newHash);
      return { ok: true, schema: RM_STATE_SCHEMA };
    } finally {
      lock.releaseLock();
    }
  }

  return { ok: false, status: 'unknown_action', message: 'Unknown shared-state action' };
}

function rmStateValidateHash_(value) {
  const s = String(value || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(s)) throw new Error('Invalid password proof');
  return s;
}

function rmStateSafeEqual_(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function rmStateSanitizeConfig_(raw) {
  let input = raw;
  if (typeof input === 'string') {
    if (input.length > 12000) throw new Error('Instructor config too large');
    input = JSON.parse(input || '[]');
  }
  if (!Array.isArray(input)) throw new Error('Invalid instructor config');
  if (input.length > 30) throw new Error('Too many instructors');

  const allowedDays = ['월','화','수','목','금','토','일'];
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

  return input.map(function(row) {
    row = row || {};
    const id = String(row.id || '').trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new Error('Invalid instructor id');

    const days = (Array.isArray(row.days) ? row.days : [])
      .map(String).filter(function(x) { return allowedDays.indexOf(x) >= 0; }).slice(0, 7);
    const times = (Array.isArray(row.times) ? row.times : [])
      .map(String).filter(function(x) { return timeRe.test(x); }).slice(0, 32);
    const subjects = (Array.isArray(row.subjects) ? row.subjects : [])
      .map(function(x) { return String(x).slice(0, 80); }).slice(0, 32);
    const maxConsec = Math.max(1, Math.min(12, Number(row.maxConsec) || 4));
    const dayTimes = {};
    const srcDayTimes = row.dayTimes && typeof row.dayTimes === 'object' ? row.dayTimes : {};
    allowedDays.forEach(function(day) {
      if (!Array.isArray(srcDayTimes[day])) return;
      dayTimes[day] = srcDayTimes[day]
        .map(String).filter(function(x) { return timeRe.test(x); }).slice(0, 32);
    });

    return {
      id: id,
      days: days,
      times: times,
      dayTimes: dayTimes,
      subjects: subjects,
      maxConsec: maxConsec
    };
  });
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
