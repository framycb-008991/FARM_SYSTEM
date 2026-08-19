/* ==========================================================================
   ACCESS_CONTROL_FIX.md — Verification Suite (QA Checklist §5)

   Runs the real js/api.js + js/data.js under Node.js (no browser needed) and
   proves, for each of the 4 seeded role accounts:
     1. Login + OTP issues a JWT whose `role` claim matches the account (§2.1)
     2. That role maps to exactly one dashboard route (§3.5 routing table)
     3. Every endpoint OUTSIDE the role's permission set returns 403 (§2.4)
     4. Tampered / forged / expired / missing tokens return 401 (§2.4)

   Usage:  node tests/access-control.test.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

// Load the real data model and API layer into this process
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8') + '\nglobalThis.MECUZI_DATA = MECUZI_DATA;');
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'api.js'), 'utf8'));

const { MockAPI, ROLE_TO_ROUTE } = globalThis;

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
  }
}

// Seeded test accounts — ACCESS_CONTROL_FIX.md §3.1–3.4
const SEED_ACCOUNTS = [
  { employeeNumber: 'TZ10000001', pin: '1111', role: 'top_management',    dashboard: '/dashboard/management' },
  { employeeNumber: 'TZ11244045', pin: '5678', role: 'farm_technician',   dashboard: '/dashboard/technician' },
  { employeeNumber: 'TZ12000010', pin: '1010', role: 'production_manager', dashboard: '/dashboard/production' },
  { employeeNumber: 'TZ10000099', pin: '1099', role: 'administrator',      dashboard: '/dashboard/admin' }
];

const ALL_ROLES = ['top_management', 'farm_technician', 'production_manager', 'administrator'];

// Full endpoint surface (BACKEND_SPEC.md §8) with its allowed roles (§3)
const ENDPOINTS = [
  { name: 'GET  /employees',                  call: t => MockAPI.listEmployees(t),                                              allowed: ['administrator'] },
  { name: 'POST /employees',                  call: t => MockAPI.createEmployee(t, { employeeNumber: 'TZ99999998', name: 'Test Hire', phone: '+258 84 000 0000', role: 'farm_technician' }), allowed: ['administrator'] },
  { name: 'POST /employees/:id/reset-pin',    call: t => MockAPI.resetEmployeePin(t, 'TZ11244046'),                             allowed: ['administrator'] },
  { name: 'GET  /audit-logs',                 call: t => MockAPI.listAuditLogs(t),                                              allowed: ['administrator'] },
  { name: 'GET  /fields',                     call: t => MockAPI.listFields(t),                                                 allowed: ALL_ROLES },
  { name: 'POST /field-reports',              call: t => MockAPI.createFieldReport(t, { id: 'REP-TEST-0001', fieldId: 'FLD-01', fieldNameKey: 'fields.fld_01_name', reportType: 'harvest', data: {}, submittedAt: '18/08/2026 10:00', syncStatus: 'synced', reviewStatus: 'pending_review' }), allowed: ['farm_technician'] },
  { name: 'POST /sync/field-reports',         call: t => MockAPI.syncFieldReports(t),                                           allowed: ['farm_technician'] },
  { name: 'GET  /field-reports (review)',     call: t => MockAPI.getReviewQueue(t),                                             allowed: ['production_manager'] },
  { name: 'PATCH /field-reports/:id/review',  call: t => MockAPI.reviewFieldReport(t, 'REP-UUID-9082', 'approved'),             allowed: ['production_manager'] },
  { name: 'GET  /reports/summary',            call: t => MockAPI.getReportsSummary(t),                                          allowed: ['top_management'] },
  { name: 'GET  /reports/trends',             call: t => MockAPI.getReportsTrends(t),                                           allowed: ['top_management'] }
];

async function loginAs(account) {
  const loginRes = await MockAPI.login(account.employeeNumber, account.pin);
  if (!loginRes.ok) return { error: loginRes.error };
  const otpRes = await MockAPI.verifyOtp(loginRes.data.challengeId, loginRes.data.devOtp);
  if (!otpRes.ok) return { error: otpRes.error };
  return { token: otpRes.data.accessToken };
}

async function main() {
  console.log('\n=== 1. Seeded accounts: login + OTP lands each role on its own dashboard (§3.1–3.4, §3.5) ===');
  const tokens = {};
  for (const acc of SEED_ACCOUNTS) {
    const { token, error } = await loginAs(acc);
    check(`${acc.employeeNumber} (${acc.role}) logs in via PIN + OTP`, !!token && !error);
    if (!token) continue;

    const auth = await MockAPI.verifyAccessToken(token);
    check(`JWT role claim is "${acc.role}" (from the account, never user input)`, auth.ok && auth.claims.role === acc.role);
    check(`JWT subject is ${acc.employeeNumber}`, auth.ok && auth.claims.sub === acc.employeeNumber);

    const route = `/dashboard/${ROLE_TO_ROUTE[auth.claims.role]}`;
    check(`routes automatically to ${route} — zero manual steps`, route === acc.dashboard);
    tokens[acc.role] = token;
  }

  console.log('\n=== 2. RBAC matrix: every endpoint enforces the JWT role claim server-side (§2.4, BACKEND_SPEC.md §3) ===');
  for (const ep of ENDPOINTS) {
    for (const role of ALL_ROLES) {
      const res = await ep.call(tokens[role]);
      const shouldAllow = ep.allowed.includes(role);
      if (shouldAllow) {
        check(`${ep.name}  <- ${role}: allowed (${res.status})`, res.ok && (res.status === 200 || res.status === 201));
      } else {
        check(`${ep.name}  <- ${role}: 403 Forbidden`, !res.ok && res.status === 403 && res.error === 'errors.forbidden');
      }
    }
  }

  console.log('\n=== 3. Field scoping: technician sees ONLY their own assigned fields (§3.2) ===');
  const techFields = await MockAPI.listFields(tokens.farm_technician);
  check('technician token returns only FLD-01/FLD-02', techFields.ok && techFields.data.length === 2 &&
    techFields.data.every(f => f.assignedTechId === 'TZ11244045'));
  const mgmtFields = await MockAPI.listFields(tokens.top_management);
  check('top_management token returns all 6 fields', mgmtFields.ok && mgmtFields.data.length === 6);

  console.log('\n=== 4. Token abuse attempts all rejected with 401 (§2.4) ===');
  const noToken = await MockAPI.listAuditLogs(null);
  check('missing token -> 401', !noToken.ok && noToken.status === 401);

  const tampered = tokens.administrator.split('.');
  // Flip the role claim without re-signing: administrator payload -> farm_technician payload
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 'TZ11244045', name: 'Mallory', role: 'administrator', iat: 0, exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url');
  const forged = await MockAPI.listAuditLogs(`${tampered[0]}.${forgedPayload}.${tampered[2]}`);
  check('payload-tampered token -> 401 (signature mismatch)', !forged.ok && forged.status === 401);

  const unknownRole = await MockAPI._signTestToken({ sub: 'TZ99999999', name: 'Ghost', role: 'superuser', iat: 0, exp: Math.floor(Date.now() / 1000) + 900 });
  const ghostRes = await MockAPI.listAuditLogs(unknownRole);
  check('validly-signed token with unknown role -> 401', !ghostRes.ok && ghostRes.status === 401);

  const expired = await MockAPI._signTestToken({ sub: 'TZ10000099', name: 'Admin', role: 'administrator', iat: 0, exp: 1000 });
  const expiredRes = await MockAPI.listAuditLogs(expired);
  check('expired token -> 401', !expiredRes.ok && expiredRes.status === 401);

  console.log('\n=== 5. Auth flow negative cases (BACKEND_SPEC.md §2.3–2.4) ===');
  const badPin = await MockAPI.login('TZ11244045', '0000-WRONG');
  check('wrong PIN -> 401 errors.incorrect_pin', !badPin.ok && badPin.status === 401 && badPin.error === 'errors.incorrect_pin');
  const badEmp = await MockAPI.login('TZ00000000', '1234');
  check('unknown employee number -> 401 errors.employee_not_found', !badEmp.ok && badEmp.status === 401 && badEmp.error === 'errors.employee_not_found');

  const otpFlow = await MockAPI.login('TZ11244045', '5678');
  const wrongOtp = await MockAPI.verifyOtp(otpFlow.data.challengeId, otpFlow.data.devOtp === '000000' ? '111111' : '000000');
  check('wrong OTP -> 401 errors.otp_invalid', !wrongOtp.ok && wrongOtp.status === 401 && wrongOtp.error === 'errors.otp_invalid');
  const rightOtp = await MockAPI.verifyOtp(otpFlow.data.challengeId, otpFlow.data.devOtp);
  check('correct OTP -> 200 + JWT', rightOtp.ok && !!rightOtp.data.accessToken);
  const reuseOtp = await MockAPI.verifyOtp(otpFlow.data.challengeId, otpFlow.data.devOtp);
  check('OTP single-use: replay -> 401', !reuseOtp.ok && reuseOtp.status === 401);

  console.log('\n=== 6. Administrative Operations module (ADMIN_OPERATIONS_DASHBOARD_SPEC.md §9) ===');
  const OPS_ACCOUNTS = [
    { employeeNumber: 'TZ13000001', pin: '2001', role: 'admin_manager',           route: 'ops' },
    { employeeNumber: 'TZ13000002', pin: '2002', role: 'finance_compliance_lead', route: 'ops' },
    { employeeNumber: 'TZ13000003', pin: '2003', role: 'operations_support_lead', route: 'ops' },
    { employeeNumber: 'TZ13000004', pin: '2004', role: 'hr_facility_lead',        route: 'ops' },
    { employeeNumber: 'TZ13000005', pin: '2005', role: 'driver',                  route: 'entry' },
    { employeeNumber: 'TZ13000006', pin: '2006', role: 'warehouse_assistant',     route: 'entry' },
    { employeeNumber: 'TZ13000007', pin: '2007', role: 'cook',                    route: 'entry' },
    { employeeNumber: 'TZ13000008', pin: '2008', role: 'cleaning_assistant',      route: 'entry' }
  ];
  const opsTokens = {};
  for (const acc of OPS_ACCOUNTS) {
    const { token, error } = await loginAs(acc);
    check(`${acc.employeeNumber} (${acc.role}) logs in via PIN + OTP`, !!token && !error);
    if (!token) continue;
    const auth = await MockAPI.verifyAccessToken(token);
    check(`JWT role claim is "${acc.role}" → /dashboard/${acc.route}`,
      auth.ok && auth.claims.role === acc.role && ROLE_TO_ROUTE[auth.claims.role] === acc.route);
    opsTokens[acc.role] = token;
  }

  // Unit scoping: a unit lead calling another unit's endpoint = 403 (§3.2)
  const UNIT_CHECKS = [
    { entity: 'payment',          allowed: ['finance_compliance_lead', 'admin_manager'] },
    { entity: 'inventory_item',   allowed: ['operations_support_lead', 'admin_manager'] },
    { entity: 'meal_log',         allowed: ['hr_facility_lead', 'admin_manager'] },
    { entity: 'wellbeing_note',   allowed: ['hr_facility_lead', 'admin_manager'] } // sensitive (§6.1.3)
  ];
  const OPS_PANEL_AND_ENTRY = ['admin_manager', 'finance_compliance_lead', 'operations_support_lead',
    'hr_facility_lead', 'driver', 'warehouse_assistant', 'cook', 'cleaning_assistant'];
  for (const uc of UNIT_CHECKS) {
    for (const role of OPS_PANEL_AND_ENTRY) {
      const res = await MockAPI.listUnitRecords(opsTokens[role], uc.entity);
      if (uc.allowed.includes(role)) {
        check(`GET ${uc.entity} <- ${role}: allowed`, res.ok && res.status === 200);
      } else {
        check(`GET ${uc.entity} <- ${role}: 403`, !res.ok && res.status === 403);
      }
    }
  }
  // Original roles have no access to ops data at all
  const tmOps = await MockAPI.listUnitRecords(tokens.top_management, 'payment');
  check('GET payment <- top_management: 403', !tmOps.ok && tmOps.status === 403);

  // Operational entry: own form set only, routed to the correct unit (§7.1)
  const tripSubmit = await MockAPI.submitOpsEntry(opsTokens.driver,
    { formId: 'trip_log', data: { destination: 'X', km: 10 }, submittedAt: '19/08/2026 08:00', syncStatus: 'synced' });
  check('driver submits trip_log: 201, routed to operations', tripSubmit.ok && tripSubmit.data.unit === 'operations');
  const wrongForm = await MockAPI.submitOpsEntry(opsTokens.driver,
    { formId: 'meal_served', data: {}, submittedAt: '19/08/2026 08:00', syncStatus: 'synced' });
  check('driver submits cook form (meal_served): 403', !wrongForm.ok && wrongForm.status === 403);
  const leadSubmit = await MockAPI.submitOpsEntry(opsTokens.operations_support_lead,
    { formId: 'trip_log', data: {}, submittedAt: '19/08/2026 08:00', syncStatus: 'synced' });
  check('unit lead cannot submit operational entries: 403', !leadSubmit.ok && leadSubmit.status === 403);

  // Review queues are unit-scoped (§7.1, §9)
  const opsQueue = await MockAPI.listOpsSubmissions(opsTokens.operations_support_lead);
  check('operations lead queue contains only operations entries',
    opsQueue.ok && opsQueue.data.every(e => e.unit === 'operations'));
  const hrQueue = await MockAPI.listOpsSubmissions(opsTokens.hr_facility_lead);
  check('hr lead queue contains only hr_services entries',
    hrQueue.ok && hrQueue.data.every(e => e.unit === 'hr_services'));
  const finQueue = await MockAPI.listOpsSubmissions(opsTokens.finance_compliance_lead);
  check('finance lead has NO review queue: 403', !finQueue.ok && finQueue.status === 403);
  const driverQueue = await MockAPI.listOpsSubmissions(opsTokens.driver);
  check('driver has NO review queue: 403', !driverQueue.ok && driverQueue.status === 403);

  const hrEntry = hrQueue.data[0];
  const crossReview = await MockAPI.reviewOpsSubmission(opsTokens.operations_support_lead, hrEntry.id, 'approved');
  check('operations lead reviewing an hr_services entry: 403', !crossReview.ok && crossReview.status === 403);
  const ownReview = await MockAPI.reviewOpsSubmission(opsTokens.hr_facility_lead, hrEntry.id, 'approved');
  check('hr lead reviewing own-unit entry: 200', ownReview.ok && ownReview.status === 200);

  // Consolidated reporting: admin_manager only; wellbeing excluded by default (§8, §10)
  const rpt = await MockAPI.generateConsolidatedReport(opsTokens.admin_manager, { period: 'mensal' });
  check('admin_manager generates consolidated report: 200', rpt.ok && rpt.status === 200);
  check('report excludes wellbeing_note by default', rpt.ok && !('wellbeing_note' in rpt.data.sections.hr_services));
  const rptAnon = await MockAPI.generateConsolidatedReport(opsTokens.admin_manager,
    { period: 'mensal', includeAnonymizedWellbeing: true });
  check('opt-in wellbeing appears ONLY as anonymized count (no records)',
    rptAnon.ok && rptAnon.data.sections.hr_services.wellbeing_note.anonymized === true &&
    !rptAnon.data.sections.hr_services.wellbeing_note.records);
  const leadRpt = await MockAPI.generateConsolidatedReport(opsTokens.finance_compliance_lead, { period: 'mensal' });
  check('unit lead generating consolidated report: 403', !leadRpt.ok && leadRpt.status === 403);

  console.log(`\n=========================================`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
