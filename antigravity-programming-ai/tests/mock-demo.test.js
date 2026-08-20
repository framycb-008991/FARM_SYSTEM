'use strict';

const { createApp } = require('../server');

let passed = 0;
let failed = 0;
function check(label, value) {
  if (value) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.log(`  FAIL  ${label}`); }
}
function cookie(res) { return (res.headers.get('set-cookie') || '').split(';')[0]; }

async function main() {
  const { app, db } = createApp({
    sessionSecret: 'test-session-secret-32-characters-minimum',
    demoAccountSelectorEnabled: true,
    mockDemoAuthEnabled: true
  });
  const server = await new Promise(resolve => {
    const instance = app.listen(3432, '127.0.0.1', () => resolve(instance));
  });
  try {
    const list = await fetch('http://127.0.0.1:3432/api/demo/accounts');
    const body = await list.json();
    check('mock selector does not require PostgreSQL', list.status === 200 && body.accounts.length === 6);
    check('mock selector response is UI-safe', body.accounts.every(account => Object.keys(account).sort().join(',') === 'labelKey,selectionId'));

    const login = await fetch('http://127.0.0.1:3432/api/auth/demo-login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selectionId: body.accounts[4].selectionId, role: 'administrator' })
    });
    const loginBody = await login.json();
    const sessionCookie = cookie(login);
    const session = await fetch('http://127.0.0.1:3432/api/auth/session', { headers: { cookie: sessionCookie } }).then(r => r.json());
    check('mock selector creates normal server session', login.status === 200 && session.session.role === 'admin_manager');
    check('mock selector ignores arbitrary role field', loginBody.session.role === 'admin_manager');
    check('mock session cookie is HttpOnly/SameSite/no-store', /HttpOnly/i.test(login.headers.get('set-cookie') || '') && /SameSite=Lax/i.test(login.headers.get('set-cookie') || '') && login.headers.get('cache-control') === 'no-store');

    const logout = await fetch('http://127.0.0.1:3432/api/auth/logout', { method: 'POST', headers: { cookie: sessionCookie } });
    check('mock logout invalidates session', logout.status === 200 && (await fetch('http://127.0.0.1:3432/api/auth/session', { headers: { cookie: sessionCookie } })).status === 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}

main().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
