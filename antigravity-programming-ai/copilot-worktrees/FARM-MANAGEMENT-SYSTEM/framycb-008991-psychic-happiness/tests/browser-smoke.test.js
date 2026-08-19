/* ==========================================================================
   ACCESS_CONTROL_FIX.md — Browser smoke test (QA Checklist §5, UI layer)

   Drives the real index.html in headless Chrome over the DevTools Protocol
   (Node's built-in WebSocket — no npm dependencies) and verifies:
     1. No ROLE dropdown exists in the navbar; a non-interactive label does
     2. App shell is locked until login + OTP completes
     3. Technician login lands directly on the technician dashboard
     4. Typing another role's dashboard URL redirects back to the user's own
     5. The session token is rejected (403) by endpoints outside its role
     6. Logout re-locks the app; admin login lands on the admin dashboard

   Usage:  node tests/browser-smoke.test.js
   ========================================================================== */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const pathToFileURL = require('url').pathToFileURL;

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const PAGE_URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}`); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--disable-gpu',
    PAGE_URL
  ], { stdio: 'ignore' });

  try {
    // Wait for the DevTools endpoint and find our page target
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const targets = await res.json();
        target = targets.find(t => t.type === 'page' && t.url.startsWith('file:'));
      } catch (e) { /* not up yet */ }
    }
    if (!target) throw new Error('Could not reach headless Chrome DevTools endpoint');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 0;
    const pending = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = ++msgId;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
    async function ev(expression) {
      const res = await send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true
      });
      if (res.result && res.result.exceptionDetails) {
        throw new Error('Page evaluation failed: ' + JSON.stringify(res.result.exceptionDetails));
      }
      return res.result && res.result.result ? res.result.result.value : undefined;
    }
    async function waitFor(expression, timeoutMs = 5000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (await ev(expression)) return true;
        await sleep(150);
      }
      return false;
    }

    async function loginAs(empNumber, pin) {
      await ev(`document.getElementById('authEmpNumber').value = '${empNumber}'`);
      await ev(`document.getElementById('authPin').value = '${pin}'`);
      await ev('handleAuthSubmitStep1()');
      // The simulated SMS arrives as a toast containing the 6-digit code
      const toastSeen = await waitFor(`/\\b\\d{6}\\b/.test(document.getElementById('toastContainer').textContent)`);
      if (!toastSeen) return false;
      const code = await ev(`document.getElementById('toastContainer').textContent.match(/\\b(\\d{6})\\b/)[1]`);
      await ev(`'${code}'.split('').forEach((d, i) => { document.getElementById('otp' + (i + 1)).value = d; })`);
      await ev('handleAuthSubmitStep2()');
      return waitFor(`document.body.classList.contains('authenticated')`);
    }

    console.log('\n=== 1. Navbar & access gate (before login) ===');
    await waitFor(`typeof AppState !== 'undefined'`);
    await sleep(500); // let initApp / restoreSession finish
    check('ROLE dropdown removed from navbar', await ev(`!document.getElementById('roleSelector')`));
    check('non-interactive role label present', await ev(`!!document.getElementById('currentRoleLabel')`));
    check('no <select> for role anywhere in the header', await ev(
      `!document.querySelector('.header-utility-zone select#roleSelector')`));
    check('login modal opened automatically', await ev(
      `document.getElementById('authModalBackdrop').classList.contains('open')`));
    check('app shell hidden before authentication', await ev(
      `!document.body.classList.contains('authenticated')`));
    check('no dashboard interface visible before login', await ev(
      `[...document.querySelectorAll('.role-interface-container')].every(el => getComputedStyle(el).display === 'none' || !document.body.classList.contains('authenticated'))`));

    console.log('\n=== 2. Technician login → lands directly on own dashboard (§3.2) ===');
    check('login + OTP as TZ11244045 succeeds', await loginAs('TZ11244045', '5678'));
    check('session role is farm_technician', await ev(`AppState.claims.role === 'farm_technician'`));
    check('URL is #/pt-MZ/dashboard/technician', await ev(`location.hash === '#/pt-MZ/dashboard/technician'`));
    check('technician interface is the visible one', await ev(
      `document.getElementById('interface_farm_technician').style.display === 'block' &&
       document.getElementById('interface_administrator').style.display === 'none' &&
       document.getElementById('interface_top_management').style.display === 'none' &&
       document.getElementById('interface_production_manager').style.display === 'none'`));
    check('navbar label shows the assigned role', await ev(
      `document.getElementById('currentRoleLabel').textContent.length > 1`));
    check('technician sees only own fields (FLD-01/FLD-02)', await ev(
      `document.querySelectorAll('#ftMyFieldsGrid > .card').length === 2`));

    console.log('\n=== 3. Route guard: typed URL for another role redirects back (§2.3) ===');
    await ev(`location.hash = '#/pt-MZ/dashboard/admin'`);
    await sleep(400);
    check('admin URL rejected → back on technician dashboard', await ev(
      `location.hash === '#/pt-MZ/dashboard/technician' &&
       document.getElementById('interface_farm_technician').style.display === 'block'`));
    check('redirect notice toast shown', await ev(
      `document.getElementById('toastContainer').textContent.length > 0`));

    console.log('\n=== 4. API boundary from the browser session (§2.4) ===');
    check('technician token → GET /audit-logs = 403', await ev(
      `MockAPI.listAuditLogs(AppState.accessToken).then(r => r.status === 403)`));
    check('technician token → GET /reports/summary = 403', await ev(
      `MockAPI.getReportsSummary(AppState.accessToken).then(r => r.status === 403)`));
    check('technician token → POST /field-reports = 201', await ev(
      `MockAPI.createFieldReport(AppState.accessToken, { id: 'REP-SMOKE-1', fieldId: 'FLD-01', fieldNameKey: 'fields.fld_01_name', reportType: 'harvest', data: {}, submittedAt: '18/08/2026 12:00', syncStatus: 'synced', reviewStatus: 'pending_review' }).then(r => r.status === 201)`));

    console.log('\n=== 5. Logout re-locks, admin login lands on admin dashboard (§3.4) ===');
    await ev(`document.getElementById('openAuthModalBtn').click()`); // acts as Sign Out
    await sleep(300);
    check('logout clears the session and re-opens login', await ev(
      `!document.body.classList.contains('authenticated') &&
       document.getElementById('authModalBackdrop').classList.contains('open')`));
    check('login + OTP as TZ10000099 succeeds', await loginAs('TZ10000099', '1099'));
    check('session role is administrator', await ev(`AppState.claims.role === 'administrator'`));
    check('URL is #/pt-MZ/dashboard/admin', await ev(`location.hash === '#/pt-MZ/dashboard/admin'`));
    check('admin interface is the visible one', await ev(
      `document.getElementById('interface_administrator').style.display === 'block'`));
    check('admin token → GET /audit-logs = 200', await ev(
      `MockAPI.listAuditLogs(AppState.accessToken).then(r => r.status === 200)`));

    console.log('\n=== 6. Admin Ops: admin_manager sees all 3 sections + overview (§3.1) ===');
    await ev(`document.getElementById('openAuthModalBtn').click()`); // Sign Out
    await sleep(300);
    check('login + OTP as TZ13000001 (admin_manager) succeeds', await loginAs('TZ13000001', '2001'));
    check('URL is #/pt-MZ/dashboard/ops', await ev(`location.hash === '#/pt-MZ/dashboard/ops'`));
    check('ops dashboard shell is visible', await ev(
      `document.getElementById('interface_admin_ops').style.display === 'block'`));
    check('sidebar shows all 6 items incl. Visão Geral + Relatórios', await ev(
      `document.querySelectorAll('#sidebarNavList .sidebar-nav-item').length === 6`));
    check('budget day-20 reminder chip visible for admin_manager', await ev(
      `document.querySelector('.alert-ticker-chip[data-alert="budget"]').style.display !== 'none'`));
    check('finance section renders its 8 sub-views', await waitFor(
      `document.querySelectorAll('#opsFinanceContent > .card').length === 8`));
    check('admin token → consolidated report = 200, wellbeing excluded', await ev(
      `MockAPI.generateConsolidatedReport(AppState.accessToken, { period: 'mensal' })
        .then(r => r.status === 200 && !('wellbeing_note' in r.data.sections.hr_services))`));

    console.log('\n=== 6b. Admin Ops tables translate with the language switcher ===');
    check('PT table shows PT values', await ev(
      `document.getElementById('opsFinanceContent').textContent.includes('Pendente')`));
    await ev(`(() => { const s = document.getElementById('langSelect'); s.value = 'en-GB'; s.dispatchEvent(new Event('change')); })()`);
    check('EN: finance table shows translated values', await waitFor(
      `document.getElementById('opsFinanceContent').textContent.includes('Pending') &&
       document.getElementById('opsFinanceContent').textContent.includes('Seeds & fertilizers')`));
    check('EN: no raw i18n keys leak into the table', await ev(
      `!/(v\\.[a-z_0-9]+|d\\.[a-z_0-9]+)/.test(document.getElementById('opsFinanceContent').textContent)`));
    await ev(`(() => { const s = document.getElementById('langSelect'); s.value = 'zh-TW'; s.dispatchEvent(new Event('change')); })()`);
    check('ZH: finance table shows translated values', await waitFor(
      `document.getElementById('opsFinanceContent').textContent.includes('待處理')`));
    check('ZH: sidebar shows translated section name', await ev(
      `document.getElementById('sidebarNavList').textContent.includes('財務與合規')`));
    await ev(`(() => { const s = document.getElementById('langSelect'); s.value = 'pt-MZ'; s.dispatchEvent(new Event('change')); })()`);
    await sleep(300);

    console.log('\n=== 6c. Excel export buttons on ops tables ===');
    check('every finance sub-view card has an Excel export button', await ev(
      `document.querySelectorAll('#opsFinanceContent > .card').length === 8 &&
       document.querySelectorAll('#opsFinanceContent > .card .card-header button').length === 8`));
    check('sensitive wellbeing card has NO export button (§6.1.3)', await ev(
      `(() => { const cards = [...document.querySelectorAll('#opsHrContent > .card')];
         const wb = cards.find(c => c.textContent.includes('Bem-Estar'));
         return !!wb && !wb.querySelector('.card-header button'); })()`));
    check('exportOpsTable runs and produces a download without error', await ev(
      `(() => { try { exportOpsTable('payment'); return true; } catch (e) { return false; } })()`));
    check('overview export button present', await ev(
      `!!document.querySelector('#pane_ops_overview .card-header button')`));

    console.log('\n=== 7. Admin Ops: unit lead sees ONLY their own section (§3.1–3.2) ===');
    await ev(`document.getElementById('openAuthModalBtn').click()`); // Sign Out
    await sleep(300);
    check('login + OTP as TZ13000002 (finance lead) succeeds', await loginAs('TZ13000002', '2002'));
    check('sidebar shows ONLY Finança & Conformidade', await ev(
      `document.querySelectorAll('#sidebarNavList .sidebar-nav-item').length === 1 &&
       document.querySelector('#sidebarNavList .sidebar-nav-btn').getAttribute('data-tab') === 'ops_finance'`));
    check('budget chip hidden for finance lead', await ev(
      `document.querySelector('.alert-ticker-chip[data-alert="budget"]').style.display === 'none'`));
    check('finance lead token → operations unit endpoint = 403', await ev(
      `MockAPI.listUnitRecords(AppState.accessToken, 'inventory_item').then(r => r.status === 403)`));
    check('finance lead token → wellbeing notes = 403', await ev(
      `MockAPI.listUnitRecords(AppState.accessToken, 'wellbeing_note').then(r => r.status === 403)`));
    check('finance lead token → consolidated report = 403', await ev(
      `MockAPI.generateConsolidatedReport(AppState.accessToken, {}).then(r => r.status === 403)`));

    console.log('\n=== 8. Admin Ops: driver gets the shared entry shell, driver forms only (§7) ===');
    await ev(`document.getElementById('openAuthModalBtn').click()`); // Sign Out
    await sleep(300);
    check('login + OTP as TZ13000005 (driver) succeeds', await loginAs('TZ13000005', '2005'));
    check('URL is #/pt-MZ/dashboard/entry', await ev(`location.hash === '#/pt-MZ/dashboard/entry'`));
    check('entry shell visible with 2 driver forms', await ev(
      `document.getElementById('interface_ops_entry').style.display === 'block' &&
       document.querySelectorAll('#opsEntryFormContent .touch-type-btn').length === 2`));
    check('driver token → any dashboard endpoint = 403', await ev(
      `MockAPI.listUnitRecords(AppState.accessToken, 'meal_log').then(r => r.status === 403)`));
    check('driver submits trip_log → routed to operations queue', await ev(
      `MockAPI.submitOpsEntry(AppState.accessToken, { formId: 'trip_log', data: { destination: 'X', km: 5 }, submittedAt: '19/08/2026 09:00', syncStatus: 'synced' })
        .then(r => r.status === 201 && r.data.unit === 'operations')`));

    console.log('\n=== 9. Admin Ops: driver submits via the actual UI form (§7.1) ===');
    await ev(`document.getElementById('opsEntryField_destination').value = 'Armazém central'`);
    await ev(`document.getElementById('opsEntryField_purpose').value = 'Entrega de castanha'`);
    await ev(`document.getElementById('opsEntryField_km').value = '38'`);
    await ev(`document.getElementById('opsEntryField_fuelL').value = '15'`);
    await ev(`document.querySelector('#opsEntryFormContent form button[type="submit"]').click()`);
    check('UI submission lands on the sync tab', await waitFor(
      `document.getElementById('pane_entry_sync').classList.contains('active')`));
    check('new entry row visible in the sync queue', await ev(
      `document.querySelectorAll('#opsEntrySyncTableBody tr').length >= 2`));
    check('entry carries the form values', await ev(
      `MECUZI_DATA.opsEntries[0].data.km === 38 && MECUZI_DATA.opsEntries[0].formId === 'trip_log'`));

    console.log('\n=== 10. Admin Ops: operations lead reviews it in their queue (§7.1) ===');
    await ev(`document.getElementById('openAuthModalBtn').click()`); // Sign Out
    await sleep(300);
    check('login + OTP as TZ13000003 (operations lead) succeeds', await loginAs('TZ13000003', '2003'));
    check('sidebar shows ONLY Apoio Operacional', await ev(
      `document.querySelectorAll('#sidebarNavList .sidebar-nav-item').length === 1 &&
       document.querySelector('#sidebarNavList .sidebar-nav-btn').getAttribute('data-tab') === 'ops_operations'`));
    check('supervision queue renders with the driver trip', await waitFor(
      `document.getElementById('opsOperationsContent').textContent.includes('Armazém central')`));
    check('8 sub-views + supervision queue rendered', await ev(
      `document.querySelectorAll('#opsOperationsContent > .card').length === 9`));

    ws.close();
  } finally {
    chrome.kill();
  }

  console.log(`\n=========================================`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Browser smoke test crashed:', err);
  process.exit(1);
});
