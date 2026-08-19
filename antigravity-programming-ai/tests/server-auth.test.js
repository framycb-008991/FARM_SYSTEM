/* ==========================================================================
   Server auth smoke test for PostgreSQL-backed workbook demo.
   ========================================================================== */
'use strict';

const fs = require('fs');
const { readWorkbook } = require('../scripts/xlsx-simple');
const { ATTACHED_INPUT } = require('../scripts/import-demo-accounts');
const { createSeededTestDb } = require('./test-db');
const { createApp } = require('../server');

const WORKBOOK = process.env.TEST_ACCOUNTS_XLSX || (fs.existsSync('C:/Users/user/Downloads/Test_Accounts2.xlsx') ? 'C:/Users/user/Downloads/Test_Accounts2.xlsx' : ATTACHED_INPUT);
const PORT = Number(process.env.TEST_PORT || 3417);
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.log(`  FAIL  ${label}`); }
}

function readFirstWorkbookAccount() {
  const wb = readWorkbook(WORKBOOK);
  const sheet = wb.sheets.find(s => s.name === 'Test Accounts') || wb.sheets[0];
  for (const row of sheet.rows) {
    const employeeNumber = String(row[0] || '').trim().toUpperCase();
    const password = String(row[2] || '').trim();
    if (/^TZ\d{8}$/.test(employeeNumber) && password) return { employeeNumber, password };
  }
  throw new Error(`No account rows found in ${WORKBOOK}`);
}

function cookieFrom(res) {
  const value = res.headers.get('set-cookie') || '';
  return value.split(';')[0];
}

async function postJson(url, body, cookie) {
  return fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, cookie ? { cookie } : {}),
    body: JSON.stringify(body)
  });
}

async function main() {
  const { db } = await createSeededTestDb(WORKBOOK);
  const { app } = createApp({ db, sessionSecret: 'test-session-secret-32-characters-minimum' });
  const server = await new Promise(resolve => {
    const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
  });

  try {
    const account = readFirstWorkbookAccount();
    check('/healthz returns 200', (await fetch(`${BASE}/healthz`)).status === 200);
    const health = await fetch(`${BASE}/healthz`).then(r => r.json());
    check('/healthz body is minimal', health.ok === true && Object.keys(health).length === 1);

    const noSession = await fetch(`${BASE}/api/auth/session`);
    check('session endpoint rejects anonymous users', noSession.status === 401);

    const login = await postJson(`${BASE}/api/auth/login`, { employeeNumber: account.employeeNumber, password: account.password });
    const loginBody = await login.json();
    const setCookie = login.headers.get('set-cookie') || '';
    const cookie = cookieFrom(login);
    check('workbook account logs in through server API', login.status === 200 && loginBody.ok === true && loginBody.employee.employeeNumber === account.employeeNumber);
    check('login response exposes role but not password/hash/session id', !/password|hash|salt|sessionId|sid/i.test(JSON.stringify(loginBody)));
    check('session cookie is HttpOnly and SameSite=Lax', /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie));

    const session = await fetch(`${BASE}/api/auth/session`, { headers: { cookie } });
    const sessionBody = await session.json();
    check('session endpoint returns server-derived role', session.status === 200 && sessionBody.session.role === loginBody.employee.role);
    check('session response does not leak secrets', !/password|hash|salt|sessionId|sid/i.test(JSON.stringify(sessionBody)));

    const bads = [];
    for (let i = 0; i < 6; i += 1) {
      bads.push(await postJson(`${BASE}/api/auth/login`, { employeeNumber: 'TZ00000000', password: 'wrong' }));
    }
    check('rate limit blocks the 6th failed login attempt', bads[5].status === 429);

    const logout = await postJson(`${BASE}/api/auth/logout`, {}, cookie);
    check('logout returns 200', logout.status === 200);
    const afterLogout = await fetch(`${BASE}/api/auth/session`, { headers: { cookie } });
    check('session is invalid after logout', afterLogout.status === 401);
  } finally {
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
