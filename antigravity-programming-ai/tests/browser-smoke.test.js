/* ==========================================================================
   Browser smoke test for PostgreSQL-backed server-side auth demo.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { readWorkbook } = require('../scripts/xlsx-simple');
const { ATTACHED_INPUT } = require('../scripts/import-demo-accounts');
const { createSeededTestDb } = require('./test-db');
const { createApp } = require('../server');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEVTOOLS_PORT = Number(process.env.DEVTOOLS_PORT || (9333 + Math.floor(Math.random() * 500)));
const APP_PORT = Number(process.env.TEST_PORT || 3421);
const PAGE_URL = `http://127.0.0.1:${APP_PORT}/`;
const WORKBOOK = process.env.TEST_ACCOUNTS_XLSX || (fs.existsSync('C:/Users/user/Downloads/Test_Accounts2.xlsx') ? 'C:/Users/user/Downloads/Test_Accounts2.xlsx' : ATTACHED_INPUT);

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.log(`  FAIL  ${label}`); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function workbookAccountFor(functionName) {
  const wb = readWorkbook(WORKBOOK);
  const sheet = wb.sheets.find(s => s.name === 'Test Accounts') || wb.sheets[0];
  for (const row of sheet.rows) {
    const employeeNumber = String(row[0] || '').trim().toUpperCase();
    const fn = String(row[1] || '').trim();
    const password = String(row[2] || '').trim();
    if (/^TZ\d{8}$/.test(employeeNumber) && fn === functionName) return { employeeNumber, password };
  }
  throw new Error(`No workbook account found for ${functionName}`);
}

async function main() {
  const tech = workbookAccountFor('Farm Technician');
  const admin = workbookAccountFor('Administrator');
  const ops = workbookAccountFor('Administrative Manager');
  const { db } = await createSeededTestDb(WORKBOOK);
  const { app } = createApp({ db, sessionSecret: 'test-session-secret-32-characters-minimum' });
  const server = await new Promise(resolve => {
    const s = app.listen(APP_PORT, '127.0.0.1', () => resolve(s));
  });
  const chromeProfile = path.join(process.env.LOCALAPPDATA || '.', 'Temp', `farm-smoke-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${DEVTOOLS_PORT}`,
    '--remote-allow-origins=*', '--no-first-run', '--disable-gpu', '--user-data-dir=' + chromeProfile,
    PAGE_URL
  ], { stdio: 'ignore' });

  try {
    check('/healthz ready before browser flow', (await fetch(`http://127.0.0.1:${APP_PORT}/healthz`)).ok);
    let target = null;
    for (let i = 0; i < 100 && !target; i += 1) {
      await sleep(250);
      if (chrome.exitCode !== null) throw new Error(`Headless Chrome exited before DevTools became reachable (code ${chrome.exitCode})`);
      try {
        const targets = await fetch(`http://127.0.0.1:${DEVTOOLS_PORT}/json/list`).then(r => r.json());
        target = targets.find(t => t.type === 'page' && t.url.startsWith(PAGE_URL));
      } catch (e) {}
    }
    if (!target) throw new Error('Could not reach headless Chrome DevTools endpoint');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let msgId = 0;
    const pending = new Map();
    ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    };
    function send(method, params = {}) {
      return new Promise(resolve => { const id = ++msgId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    }
    async function ev(expression) {
      const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (res.result && res.result.exceptionDetails) throw new Error('Page evaluation failed: ' + JSON.stringify(res.result.exceptionDetails));
      return res.result && res.result.result ? res.result.result.value : undefined;
    }
    async function waitFor(expression, timeoutMs = 5000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) { if (await ev(expression)) return true; await sleep(150); }
      return false;
    }
    async function loginAs(account) {
      await ev(`document.getElementById('authEmpNumber').value = ${JSON.stringify(account.employeeNumber)}`);
      await ev(`document.getElementById('authPin').value = ${JSON.stringify(account.password)}`);
      await ev('handleAuthSubmitStep1()');
      return waitFor(`document.body.classList.contains('authenticated')`);
    }

    await waitFor(`typeof AppState !== 'undefined'`);
    await sleep(500);
    check('login modal opened automatically', await ev(`document.getElementById('authModalBackdrop').classList.contains('open')`));
    check('no plaintext password defaults in auth inputs', await ev(`!document.getElementById('authEmpNumber').value && !document.getElementById('authPin').value`));
    check('app shell hidden before authentication', await ev(`!document.body.classList.contains('authenticated')`));

    check('workbook technician login succeeds via server', await loginAs(tech));
    check('session role is farm_technician', await ev(`AppState.claims.role === 'farm_technician'`));
    check('URL is #/pt-MZ/dashboard/technician', await ev(`location.hash === '#/pt-MZ/dashboard/technician'`));
    check('technician sees only own fields', await ev(`document.querySelectorAll('#ftMyFieldsGrid > .card').length === 2`));
    check('no token persisted in sessionStorage/localStorage', await ev(`sessionStorage.length === 0 && localStorage.getItem('mecuzi_access_token') === null`));
    check('technician claims → GET /audit-logs = 403', await ev(`MockAPI.listAuditLogs(AppState.accessToken).then(r => r.status === 403)`));

    await ev(`document.getElementById('openAuthModalBtn').click()`);
    await sleep(300);
    check('logout clears UI session', await ev(`!document.body.classList.contains('authenticated') && document.getElementById('authModalBackdrop').classList.contains('open')`));
    check('admin login succeeds via workbook/server', await loginAs(admin));
    check('URL is #/pt-MZ/dashboard/admin', await ev(`location.hash === '#/pt-MZ/dashboard/admin'`));
    await ev(`document.getElementById('openAuthModalBtn').click()`);
    await sleep(300);
    check('admin_manager login succeeds via workbook/server', await loginAs(ops));
    check('URL is #/pt-MZ/dashboard/ops', await ev(`location.hash === '#/pt-MZ/dashboard/ops'`));
  } finally {
    chrome.kill();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }

  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
