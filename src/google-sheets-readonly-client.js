'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_VALUES_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function loadJson(value, sourceName) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${sourceName} must contain valid Google service account JSON: ${error.message}`);
  }
}

function loadGoogleServiceAccountCredentials(env = process.env) {
  if (env.RM_GOOGLE_SERVICE_ACCOUNT_JSON) {
    return loadJson(env.RM_GOOGLE_SERVICE_ACCOUNT_JSON, 'RM_GOOGLE_SERVICE_ACCOUNT_JSON');
  }

  if (env.RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
    const decoded = Buffer.from(env.RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8');
    return loadJson(decoded, 'RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64');
  }

  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    const json = fs.readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
    return loadJson(json, 'GOOGLE_APPLICATION_CREDENTIALS');
  }

  throw new Error(
    'Google Sheets read-only credentials are not configured. Set RM_GOOGLE_SERVICE_ACCOUNT_JSON, ' +
    'RM_GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, or GOOGLE_APPLICATION_CREDENTIALS.',
  );
}

function assertServiceAccountCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') {
    throw new TypeError('Google credentials must be a service account JSON object');
  }
  if (credentials.type && credentials.type !== 'service_account') {
    throw new Error(`Unsupported Google credential type: ${credentials.type}`);
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google service account credentials require client_email and private_key');
  }
}

function createJwtAssertion(credentials, options = {}) {
  assertServiceAccountCredentials(credentials);
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.client_email,
    scope: READONLY_SCOPE,
    aud: options.tokenUrl || TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(credentials.private_key, 'base64url');
  return `${signingInput}.${signature}`;
}

async function fetchAccessToken(credentials, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is required to request a Google access token');
  }

  const tokenUrl = options.tokenUrl || TOKEN_URL;
  const assertion = createJwtAssertion(credentials, { tokenUrl, nowMs: options.nowMs });
  const response = await fetchImpl(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Google token request failed: ${payload.error_description || payload.error || response.status}`);
  }
  if (!payload.access_token) {
    throw new Error('Google token response did not include access_token');
  }
  return payload.access_token;
}

function createGoogleSheetsReadOnlyClient(options = {}) {
  const credentials = options.credentials || loadGoogleServiceAccountCredentials(options.env);
  assertServiceAccountCredentials(credentials);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const tokenProvider = options.tokenProvider || (() => fetchAccessToken(credentials, { fetchImpl }));

  return Object.freeze({
    async getValues(spreadsheetId, range) {
      if (!spreadsheetId || !range) throw new Error('spreadsheetId and range are required');
      const token = await tokenProvider();
      const url = `${SHEETS_VALUES_URL}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload.error?.message || payload.error_description || response.status;
        throw new Error(`Google Sheets values.get failed for ${spreadsheetId} ${range}: ${message}`);
      }
      return payload.values || [];
    },
  });
}

module.exports = {
  READONLY_SCOPE,
  TOKEN_URL,
  loadGoogleServiceAccountCredentials,
  assertServiceAccountCredentials,
  createJwtAssertion,
  fetchAccessToken,
  createGoogleSheetsReadOnlyClient,
};
