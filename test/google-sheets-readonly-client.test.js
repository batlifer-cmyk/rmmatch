'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  READONLY_SCOPE,
  loadGoogleServiceAccountCredentials,
  createGoogleSheetsReadOnlyClient,
} = require('../src/google-sheets-readonly-client');
const { assertReadOnlyClient } = require('../src/google-sheets-readonly-reader');

test('credential loader fails clearly when no supported env var is present', () => {
  assert.throws(
    () => loadGoogleServiceAccountCredentials({}),
    /RM_GOOGLE_SERVICE_ACCOUNT_JSON.*RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64.*GOOGLE_APPLICATION_CREDENTIALS/,
  );
});

test('credential loader accepts base64 service account JSON', () => {
  const credentials = { type: 'service_account', client_email: 'svc@example.test', private_key: 'key' };
  const encoded = Buffer.from(JSON.stringify(credentials), 'utf8').toString('base64');
  assert.deepEqual(loadGoogleServiceAccountCredentials({ RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64: encoded }), credentials);
});

test('Google Sheets client exposes only values.get read path', async () => {
  const calls = [];
  const client = createGoogleSheetsReadOnlyClient({
    credentials: { type: 'service_account', client_email: 'svc@example.test', private_key: 'unused' },
    tokenProvider: async () => 'token-1',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ values: [['A'], ['B']] }) };
    },
  });

  assertReadOnlyClient(client);
  assert.equal(client.updateValues, undefined);
  assert.deepEqual(await client.getValues('sheet-1', "'Tab'!A:B"), [['A'], ['B']]);
  assert.match(calls[0].url, /spreadsheets\/sheet-1\/values\//);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers.authorization, 'Bearer token-1');
});

test('client module hard-codes the Google Sheets read-only scope only', () => {
  assert.equal(READONLY_SCOPE, 'https://www.googleapis.com/auth/spreadsheets.readonly');
  assert.doesNotMatch(READONLY_SCOPE, /drive|spreadsheets(?!\.readonly)/);
});
