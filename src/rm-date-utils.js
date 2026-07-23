'use strict';

const DEFAULT_TIMEZONE = 'Asia/Seoul';

function formatDateInTimeZone(date, timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeDateForTimezone(value, timeZone = DEFAULT_TIMEZONE) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatDateInTimeZone(date, timeZone);
}

module.exports = {
  DEFAULT_TIMEZONE,
  formatDateInTimeZone,
  normalizeDateForTimezone,
};
