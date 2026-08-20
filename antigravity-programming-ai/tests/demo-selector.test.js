'use strict';

const fs = require('fs');
const { ATTACHED_INPUT } = require('../scripts/import-demo-accounts');
const { createSeededTestDb } = require('./test-db');
const { createApp } = require('../server');

const WORKBOOK = process.env.TEST_ACCOUNTS_XLSX || ATTACHED_INPUT;
let passed = 0; let failed = 0;
function check(label, value) { if (value) { passed += 1; console.log(`  PASS  ${label}`); } else { failed += 1; console.log(`  FAIL  ${label}`); } }
function cookie(res) { return (res.headers.get('set-cookie') || '').split(';')[0]; }

async function main() {
  const { db } = await createSeededTestDb(WORKBOOK);
  const secret = 'test-session-secret-32-characters-minimum';
  const disabled = createApp({ db, sessionSecret: secret });
  let server = await new Promise(resolve => { const s = disabled.app.listen(3431, '127.0.0.1', () => resolve(s)); });
  try { check('selector disabled fails closed', (await fetch('http://127.0.0.1:3431/api/demo/accounts')).status === 404); }
  finally { await new Promise(resolve => server.close(resolve)); }

  const enabled = createApp({ db, sessionSecret: secret, demoAccountSelectorEnabled: true });
  server = await new Promise(resolve => { const s = enabled.app.listen(3431, '127.0.0.1', () => resolve(s)); });
  try {
    const list = await fetch('http://127.0.0.1:3431/api/demo/accounts');
    const body = await list.json();
    check('selector list is ordered and no-store', list.status === 200 && list.headers.get('cache-control') === 'no-store' && body.accounts.length === 6);
    check('selector list is UI-safe', body.accounts.every(a => Object.keys(a).sort().join(',') === 'labelKey,selectionId' && !/TZ|password|hash|salt|session/i.test(JSON.stringify(a))));
    const expected = ['top_management', 'farm_technician', 'production_manager', 'administrator', 'admin_manager', 'driver'];
    check('selector labels preserve required order', body.accounts.map(a => a.labelKey.replace('auth.demo.option_', '')).join(',') === expected.join(','));
    const bad = await fetch('http://127.0.0.1:3431/api/auth/demo-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ selectionId: 'tampered', role: 'administrator' }) });
    check('unknown selector and arbitrary role fail without session', bad.status === 401 && bad.headers.get('cache-control') === 'no-store' && (await fetch('http://127.0.0.1:3431/api/auth/session')).status === 401);
    for (const account of body.accounts) {
      const login = await fetch('http://127.0.0.1:3431/api/auth/demo-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ selectionId: account.selectionId, role: 'administrator' }) });
      const loginBody = await login.json(); const sessionCookie = cookie(login);
      const session = await fetch('http://127.0.0.1:3431/api/auth/session', { headers: { cookie: sessionCookie } }).then(r => r.json());
      const setCookie = login.headers.get('set-cookie') || '';
      check(`demo login derives ${account.labelKey}`, login.status === 200 && session.session.role === expected[body.accounts.indexOf(account)] && !/password|hash|salt|sessionId|sid/i.test(JSON.stringify(loginBody)));
      check(`demo login cookie is HttpOnly/SameSite`, /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie) && /mecuzi_demo_session=s%3A/i.test(setCookie));
      const logout = await fetch('http://127.0.0.1:3431/api/auth/logout', { method: 'POST', headers: { cookie: sessionCookie } });
      check(`logout invalidates ${account.labelKey}`, logout.status === 200 && (await fetch('http://127.0.0.1:3431/api/auth/session', { headers: { cookie: sessionCookie } })).status === 401);
    }

    const target = (await db.findAccountsByRoles(['top_management']))[0];
    await db.query('UPDATE demo_accounts SET status = $1 WHERE employee_number = $2', ['inactive', target.employeeNumber]);
    check('inactive required role fails closed with no partial list', (await fetch('http://127.0.0.1:3431/api/demo/accounts')).status === 503);
    await db.query('UPDATE demo_accounts SET status = $1 WHERE employee_number = $2', ['active', target.employeeNumber]);
    await db.query('UPDATE demo_accounts SET role = $1, role_key = $2 WHERE employee_number = $3', ['finance_compliance_lead', 'roles.finance_compliance_lead', target.employeeNumber]);
    check('missing required role fails closed with no partial list', (await fetch('http://127.0.0.1:3431/api/demo/accounts')).status === 503);
    await db.query('UPDATE demo_accounts SET role = $1, role_key = $2 WHERE employee_number = $3', ['top_management', 'roles.top_management', target.employeeNumber]);
    const extra = (await db.findAccountsByRoles(['finance_compliance_lead']))[0];
    await db.query('UPDATE demo_accounts SET role = $1, role_key = $2 WHERE employee_number = $3', ['top_management', 'roles.top_management', extra.employeeNumber]);
    check('duplicate required role fails closed with no partial list', (await fetch('http://127.0.0.1:3431/api/demo/accounts')).status === 503);
  } finally { await new Promise(resolve => server.close(resolve)); await db.close(); }
  console.log(`RESULT: ${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
}
main().catch(err => { console.error(err.stack || err); process.exit(1); });
