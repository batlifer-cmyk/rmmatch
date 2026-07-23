'use strict';

const sourceConfig = require('../config/rm-source-config');

function assertReadOnlyClient(client) {
  if (!client || typeof client.getValues !== 'function') {
    throw new TypeError('A read-only client exposing getValues(spreadsheetId, range) is required');
  }
  const forbidden = ['appendValues', 'updateValues', 'clearValues', 'batchUpdate'];
  for (const method of forbidden) {
    if (typeof client[method] === 'function') {
      throw new Error(`Write-capable method is not allowed: ${method}`);
    }
  }
}

function assertValidHeaders(headers, options = {}) {
  const sourceName = options.sourceName || 'source';
  const seen = new Set();
  const duplicates = new Set();
  for (const header of headers) {
    if (!header) continue;
    if (seen.has(header)) duplicates.add(header);
    seen.add(header);
  }
  if (duplicates.size) {
    throw new Error(`Duplicate header in ${sourceName}: ${[...duplicates].join(', ')}`);
  }

  const requiredHeaders = options.requiredHeaders || [];
  const missing = requiredHeaders.filter((header) => !seen.has(header));
  if (missing.length) {
    throw new Error(`Missing required header in ${sourceName}: ${missing.join(', ')}`);
  }
}

function rowsToObjects(values, options = {}) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const headers = values[0].map((value) => String(value ?? '').trim());
  assertValidHeaders(headers, options);
  return values.slice(1).flatMap((row, index) => {
    const hasData = Array.isArray(row) && row.some((value) => value !== '' && value != null);
    if (!hasData) return [];
    const object = { __sourceRow: index + 2 };
    headers.forEach((header, columnIndex) => {
      if (!header) return;
      object[header] = row[columnIndex] ?? '';
    });
    return [object];
  });
}

async function readSource(client, sourceName, config = sourceConfig) {
  assertReadOnlyClient(client);
  const source = config.sources[sourceName];
  if (!source) throw new Error(`Unknown source: ${sourceName}`);
  const values = await client.getValues(source.spreadsheetId, source.range);
  const rows = rowsToObjects(values, { sourceName, requiredHeaders: source.requiredHeaders || [] });
  if (rows.length > config.limits.maxRowsPerSource) {
    throw new Error(`${sourceName} exceeds row limit: ${rows.length}`);
  }
  return {
    sourceName,
    spreadsheetId: source.spreadsheetId,
    range: source.range,
    trustLevel: source.trustLevel,
    success: true,
    rowCount: rows.length,
    rows,
  };
}

async function readOperationalSnapshot(client, config = sourceConfig, options = {}) {
  const names = ['lessons', 'registrations', 'graduations', 'payments', 'contacts', 'studentProfiles'];
  const entries = await Promise.all(names.map(async (name) => {
    try {
      return [name, await readSource(client, name, config)];
    } catch (error) {
      if (!options.continueOnError) throw error;
      const source = config.sources[name] || {};
      return [name, {
        sourceName: name,
        spreadsheetId: source.spreadsheetId || '',
        range: source.range || '',
        trustLevel: source.trustLevel || '',
        success: false,
        rowCount: 0,
        error: error.message,
        rows: [],
      }];
    }
  }));
  return Object.fromEntries(entries);
}

module.exports = {
  assertReadOnlyClient,
  assertValidHeaders,
  rowsToObjects,
  readSource,
  readOperationalSnapshot,
};
