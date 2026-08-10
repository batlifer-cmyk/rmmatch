const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwGu-XsnJnphpLRzP_k--f4H2FM8-SegNP-Y9pCIaqWOhj31E1IcvdMD8q3b-9qORUh/exec';
const APP_URL = 'https://batlifer-cmyk.github.io/rmmatch/scheduler-v2.html?e2e=20260810-16';
const RUN_PRODUCTION = process.env.RM_RUN_PRODUCTION_E2E === '1';

function password() {
  const legacy = fs.readFileSync(path.join(ROOT, 'legacy.html'), 'utf8');
  const match = legacy.match(/const PW_DEFAULT='([^']+)'/);
  assert(match, 'PW_DEFAULT should be present');
  return match[1];
}

function proof() {
  return crypto.createHash('sha256').update(password()).digest('hex');
}

async function api(action, params = {}) {
  const q = new URLSearchParams({ action, proof: proof(), _: Date.now().toString() });
  for (const [key, value] of Object.entries(params)) {
    q.set(key, typeof value === 'string' ? value : String(value));
  }
  const res = await fetch(`${ENDPOINT}?${q.toString()}`, { cache: 'no-store' });
  return res.json();
}

function canonical(rows) {
  return rows.map(row => ({
    id: row.id,
    days: row.days,
    times: row.times,
    dayTimes: row.dayTimes,
    subjects: row.subjects,
    maxConsec: row.maxConsec
  }));
}

function sameConfig(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function requestJson(port, route, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(text)); } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitFor(fn, timeoutMs = 15000, label = 'condition') {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      last = err;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${label}${last ? `: ${last.message}` : ''}`);
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

class CdpPage {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async eval(expression, awaitPromise = true) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Runtime exception');
    }
    return result.result.value;
  }

  close() {
    try { this.ws.close(); } catch (_) {}
  }
}

async function launchBrowser(port, profileDir, initialUrl = APP_URL) {
  const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ];
  const proc = spawn(chromePath, args, { stdio: 'ignore', windowsHide: true });
  await waitFor(() => requestJson(port, '/json/version').catch(() => null), 10000, `Chrome ${port}`);
  const target = await requestJson(port, `/json/new?${encodeURIComponent(initialUrl)}`, 'PUT');
  const page = new CdpPage(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');
  return { proc, page };
}

async function launchScheduler(port, profileDir) {
  const browser = await launchBrowser(port, profileDir, APP_URL);
  await waitFor(() => browser.page.eval("!!document.getElementById('app')?.contentWindow?.__RMV2_SHARED_STATE__", false), 20000, 'scheduler patches');
  return browser;
}

async function login(page) {
  const pw = JSON.stringify(password());
  await page.eval(`
    (async () => {
      const w = document.getElementById('app').contentWindow;
      w.document.getElementById('pwInput').value = ${pw};
      await w.doLogin();
      return true;
    })()
  `);
  await waitFor(() => page.eval(`
    (() => {
      const w = document.getElementById('app').contentWindow;
      return !!(w.__RMV2_SHARED_STATE__?.state?.ready && w.document.getElementById('loginScreen').style.display === 'none');
    })()
  `), 20000, 'central login');
}

async function loginAllowFallback(page) {
  const pw = JSON.stringify(password());
  await page.eval(`
    (async () => {
      const w = document.getElementById('app').contentWindow;
      w.document.getElementById('pwInput').value = ${pw};
      await w.doLogin();
      return true;
    })()
  `);
  await waitFor(() => page.eval(`
    (() => {
      const w = document.getElementById('app').contentWindow;
      return w.document.getElementById('loginScreen').style.display === 'none';
    })()
  `), 6000, 'fallback login');
}

async function compact(page) {
  return page.eval(`
    (() => {
      const w = document.getElementById('app').contentWindow;
      return w.__RMV2_SHARED_STATE__.compactInstructors();
    })()
  `);
}

async function setStaleLocal(page, config) {
  await page.eval(`
    (() => {
      const w = document.getElementById('app').contentWindow;
      const stale = ${JSON.stringify(JSON.stringify(config))};
      w.localStorage.setItem('rm_instructors', stale);
      return true;
    })()
  `);
}

async function setLegacyLocalPassword(page, value = 'browser-local-only-password') {
  await page.eval(`
    (() => {
      const w = document.getElementById('app').contentWindow;
      w.localStorage.setItem('rm_pw', ${JSON.stringify(value)});
      return true;
    })()
  `);
}

async function legacyLocalPassword(page) {
  return page.eval(`
    (() => document.getElementById('app').contentWindow.localStorage.getItem('rm_pw'))()
  `);
}

async function setDeanMaxConsec(page, value) {
  return page.eval(`
    (async () => {
      const w = document.getElementById('app').contentWindow;
      return w.eval(\`
        (async () => {
          const ins = instructors.find(i => i.id === 'dean');
          ins.maxConsec = ${Number(value)};
          saveData();
          await __RMV2_SHARED_STATE__.saveRemoteNow();
          return __RMV2_SHARED_STATE__.state.revision;
        })()
      \`);
    })()
  `);
}

async function verifySelectionProceeds(page) {
  const ok = await page.eval(`
    (() => {
      const w = document.getElementById('app').contentWindow;
      return w.eval(\`
        (() => {
          document.getElementById('s-name').value = 'E2E Sync';
          document.getElementById('s-phone').value = '010-0000-0000';
          const subject = document.querySelector('#s-subjects input');
          if (subject) {
            subject.checked = true;
            subject.closest('.check-item')?.classList.add('checked');
          }
          const instructor = instructors.find(i => i.id === 'campbell') || instructors[0];
          selectedSlot = {
            entries: [{
              instructor,
              day: instructor.days[0],
              time: instructor.times[0] || '10:00'
            }],
            multiInstructor: false,
            score: 1,
            label: 'E2E sync'
          };
          goStep3();
          return document.getElementById('step3').style.display !== 'none';
        })()
      \`);
    })()
  `);
  assert(ok, 'selection should proceed to step 3');
}

async function reloadAndLogin(page) {
  await page.send('Page.navigate', { url: `${APP_URL}&reload=${Date.now()}` });
  await waitFor(() => page.eval("!!document.getElementById('app')?.contentWindow?.__RMV2_SHARED_STATE__", false), 20000, 'scheduler reload');
  await login(page);
}

async function runProduction() {
  const before = await api('state.get');
  assert(before.ok, 'initial state.get should succeed');
  const original = before.instructors;
  const dean = original.find(row => row.id === 'dean');
  assert(dean, 'dean config should exist');
  const changedMax = Number(dean.maxConsec) === 5 ? 4 : 5;
  const stale = JSON.parse(JSON.stringify(original));
  stale.find(row => row.id === 'dean').maxConsec = changedMax === 5 ? 4 : 5;

  const profileRoot = path.join(ROOT, 'work', 'browser-e2e');
  removeDir(profileRoot);
  fs.mkdirSync(profileRoot, { recursive: true });

  const a = await launchScheduler(9323, path.join(profileRoot, 'a'));
  const b = await launchScheduler(9324, path.join(profileRoot, 'b'));
  try {
    await login(a.page);
    assert.strictEqual(await legacyLocalPassword(a.page), null, 'Browser A central login should clear legacy local password');
    await verifySelectionProceeds(a.page);
    await setDeanMaxConsec(a.page, changedMax);
    const aConfig = await compact(a.page);

    await setStaleLocal(b.page, stale);
    await setLegacyLocalPassword(b.page);
    await login(b.page);
    assert.strictEqual(await legacyLocalPassword(b.page), null, 'Browser B central login should clear legacy local password');
    const bConfig = await compact(b.page);
    assert(sameConfig(aConfig, bConfig), 'Browser B should receive Browser A remote config');

    await setDeanMaxConsec(b.page, Number(dean.maxConsec) || 4);
    await reloadAndLogin(a.page);
    assert.strictEqual(await legacyLocalPassword(a.page), null, 'Browser A reload should not restore legacy local password');
    const aRestored = await compact(a.page);
    assert(sameConfig(aRestored, original), 'Browser A fresh load should receive Browser B restored config');

    console.log(JSON.stringify({ pass: true, browserAToB: true, browserBToA: true }));
  } finally {
    try {
      const latest = await api('state.get');
      if (latest.ok && !sameConfig(latest.instructors, original)) {
        await api('state.save', { baseRevision: latest.revision, config: JSON.stringify(original) });
      }
    } finally {
      a.page.close();
      b.page.close();
      a.proc.kill();
      b.proc.kill();
      await new Promise(resolve => setTimeout(resolve, 500));
      removeDir(profileRoot);
    }
  }
}

async function runTimeoutFallback() {
  const profileRoot = path.join(ROOT, 'work', 'browser-timeout-e2e');
  removeDir(profileRoot);
  fs.mkdirSync(profileRoot, { recursive: true });
  const browser = await launchScheduler(9325, profileRoot);
  try {
    await browser.page.eval(`
      localStorage.setItem(
        'rm_calendar_apps_script_url',
        'https://script.google.com/macros/s/AKfycbInvalidSlowSharedStateForE2E/exec'
      );
      localStorage.setItem('rm_pw', 'browser-local-only-password');
      true;
    `);
    await browser.page.send('Page.navigate', { url: `${APP_URL}&timeout=${Date.now()}` });
    await waitFor(() => browser.page.eval("!!document.getElementById('app')?.contentWindow?.__RMV2_SHARED_STATE__", false), 20000, 'scheduler timeout patches');
    const started = Date.now();
    await loginAllowFallback(browser.page);
    const loginMs = Date.now() - started;
    assert(loginMs < 5000, `fallback login should not block for 5s; got ${loginMs}ms`);
    assert.strictEqual(await legacyLocalPassword(browser.page), null, 'fallback login should clear legacy local password');
    await waitFor(() => browser.page.eval(`
      (() => {
        const w = document.getElementById('app').contentWindow;
        const shared = w.__RMV2_SHARED_STATE__;
        const text = w.document.getElementById('rm-shared-state-status')?.textContent || '';
        return !!(text && shared?.state?.supported === false && shared?.state?.pendingProof);
      })()
    `), 8000, 'fallback status');
    const statusText = await browser.page.eval(`
      (() => document.getElementById('app').contentWindow.document.getElementById('rm-shared-state-status')?.textContent || '')()
    `);
    assert(statusText.length > 0, 'fallback status should be visible');
    console.log(JSON.stringify({ pass: true, timeoutFallback: true, loginMs, statusText }));
  } finally {
    browser.page.close();
    browser.proc.kill();
    await new Promise(resolve => setTimeout(resolve, 500));
    removeDir(profileRoot);
  }
}

if (!RUN_PRODUCTION) {
  console.log('production browser sync test skipped; set RM_RUN_PRODUCTION_E2E=1 to run');
} else {
  (async () => {
    await runProduction();
    await runTimeoutFallback();
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
