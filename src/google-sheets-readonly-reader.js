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

function rowsToObjects(values) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const headers = values[0].map((value) => String(value ?? '').trim());
  return values.slice(1).filter((row) => row.some((value) => value !== '' && value != null)).map((row, index) => {
    const object = { __sourceRow: index + 2 };
    headers.forEach((header, columnIndex) => {
      if (!header) return;
      object[header] = row[columnIndex] ?? '';
    });
    return object;
  });
}

async function readSource(client, sourceName, config = sourceConfig) {
  assertReadOnlyClient(client);
  const source = config.sources[sourceName];
  if (!source) throw new Error(`Unknown source: ${sourceName}`);
  const values = await client.getValues(source.spreadsheetId, source.range);
  const rows = rowsToObjects(values);
  if (rows.length > config.limits.maxRowsPerSource) {
    throw new Error(`${sourceName} exceeds row limit: ${rows.length}`);
  }
  return {
    sourceName,
    spreadsheetId: source.spreadsheetId,
    range: source.range,
    trustLevel: source.trustLevel,
    rows,
  };
}

async function readOperationalSnapshot(client, config = sourceConfig) {
  const names = ['lessons', 'registrations', 'graduations', 'payments', 'contacts', 'studentProfiles'];
  const entries = await Promise.all(names.map(async (name) => [name, await readSource(client, name, config)]));
  return Object.fromEntries(entries);
}

module.exports = {
  assertReadOnlyClient,
  rowsToObjects,
  readSource,
  readOperationalSnapshot,
};
