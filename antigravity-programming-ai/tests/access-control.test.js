/* ==========================================================================
   ACCESS_CONTROL_FIX.md — Domain API/RBAC verification suite

   Authentication credentials are no longer available to browser JavaScript.
   This test verifies the client-side demo domain API still enforces role
   scoping when handed public claims from the server session. Server-side
   workbook password auth is covered by tests/server-auth.test.js.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8') + '\nglobalThis.MECUZI_DATA = MECUZI_DATA;');
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'api.js'), 'utf8'));

const { MockAPI, ROLE_TO_ROUTE } = globalThis;

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}`); }
}

const CORE_ACCOUNTS = [
  { employeeNumber: 'TZ10000001', name: 'Top Management', role: 'top_management', dashboard: '/dashboard/management' },
  { employeeNumber: 'TZ11244045', name: 'Farm Technician', role: 'farm_technician', dashboard: '/dashboard/technician' },
  { employeeNumber: 'TZ12000010', name: 'Production Manager', role: 'production_manager', dashboard: '/dashboard/production' },
  { employeeNumber: 'TZ10000099', name: 'Administrator', role: 'administrator', dashboard: '/dashboard/admin' }
];
const ALL_ROLES = CORE_ACCOUNTS.map(a => a.role);
function claimsFor(account) {
  return {
    employeeNumber: account.employeeNumber,
    sub: account.employeeNumber,
    name: account.name,
    role: account.role,
    roleKey: `roles.${account.role}`,
    status: 'active'
  };
}

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

async function main() {
  console.log('\n=== 1. Server-derived public claims route each role to exactly one dashboard ===');
  const tokens = {};
  for (const acc of CORE_ACCOUNTS) {
    const token = claimsFor(acc);
    const auth = await MockAPI.verifyAccessToken(token);
    check(`${acc.employeeNumber} (${acc.role}) accepted as public server claims`, auth.ok && auth.claims.role === acc.role);
    check(`claim subject is ${acc.employeeNumber}`, auth.ok && auth.claims.sub === acc.employeeNumber);
    const route = `/dashboard/${ROLE_TO_ROUTE[auth.claims.role]}`;
    check(`routes automatically to ${route}`, route === acc.dashboard);
    tokens[acc.role] = token;
  }

  console.log('\n=== 2. RBAC matrix: every domain API checks the server-derived role claim ===');
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

  console.log('\n=== 3. Field scoping: technician sees ONLY their own assigned fields ===');
  const techFields = await MockAPI.listFields(tokens.farm_technician);
  check('technician token returns only FLD-01/FLD-02', techFields.ok && techFields.data.length === 2 &&
    techFields.data.every(f => f.assignedTechId === 'TZ11244045'));
  const mgmtFields = await MockAPI.listFields(tokens.top_management);
  check('top_management token returns all 6 fields', mgmtFields.ok && mgmtFields.data.length === 6);

  console.log('\n=== 4. Missing/invalid public claims are rejected with 401 ===');
  const noToken = await MockAPI.listAuditLogs(null);
  check('missing session claims -> 401', !noToken.ok && noToken.status === 401);
  const badRole = await MockAPI.listAuditLogs({ employeeNumber: 'TZ99999999', role: 'superuser', name: 'Ghost' });
  check('unknown role -> 401', !badRole.ok && badRole.status === 401);

  console.log('\n=== 5. Administrative Operations module scoping ===');
  const OPS_ACCOUNTS = [
    { employeeNumber: 'TZ13000001', role: 'admin_manager', route: 'ops' },
    { employeeNumber: 'TZ13000002', role: 'finance_compliance_lead', route: 'ops' },
    { employeeNumber: 'TZ13000003', role: 'operations_support_lead', route: 'ops' },
    { employeeNumber: 'TZ13000004', role: 'hr_facility_lead', route: 'ops' },
    { employeeNumber: 'TZ13000005', role: 'driver', route: 'entry' },
    { employeeNumber: 'TZ13000006', role: 'warehouse_assistant', route: 'entry' },
    { employeeNumber: 'TZ13000007', role: 'cook', route: 'entry' },
    { employeeNumber: 'TZ13000008', role: 'cleaning_assistant', route: 'entry' }
  ];
  const opsTokens = {};
  for (const acc of OPS_ACCOUNTS) {
    const token = claimsFor(Object.assign({ name: acc.role }, acc));
    const auth = await MockAPI.verifyAccessToken(token);
    check(`${acc.employeeNumber} (${acc.role}) claims accepted`, auth.ok && auth.claims.role === acc.role && ROLE_TO_ROUTE[auth.claims.role] === acc.route);
    opsTokens[acc.role] = token;
  }

  const UNIT_CHECKS = [
    { entity: 'payment', allowed: ['finance_compliance_lead', 'admin_manager'] },
    { entity: 'inventory_item', allowed: ['operations_support_lead', 'admin_manager'] },
    { entity: 'meal_log', allowed: ['hr_facility_lead', 'admin_manager'] },
    { entity: 'wellbeing_note', allowed: ['hr_facility_lead', 'admin_manager'] }
  ];
  const OPS_PANEL_AND_ENTRY = OPS_ACCOUNTS.map(a => a.role);
  for (const uc of UNIT_CHECKS) {
    for (const role of OPS_PANEL_AND_ENTRY) {
      const res = await MockAPI.listUnitRecords(opsTokens[role], uc.entity);
      if (uc.allowed.includes(role)) check(`GET ${uc.entity} <- ${role}: allowed`, res.ok && res.status === 200);
      else check(`GET ${uc.entity} <- ${role}: 403`, !res.ok && res.status === 403);
    }
  }

  const tripSubmit = await MockAPI.submitOpsEntry(opsTokens.driver,
    { formId: 'trip_log', data: { destination: 'X', km: 10 }, submittedAt: '19/08/2026 08:00', syncStatus: 'synced' });
  check('driver submits trip_log: 201, routed to operations', tripSubmit.ok && tripSubmit.data.unit === 'operations');
  const wrongForm = await MockAPI.submitOpsEntry(opsTokens.driver,
    { formId: 'meal_served', data: {}, submittedAt: '19/08/2026 08:00', syncStatus: 'synced' });
  check('driver submits cook form (meal_served): 403', !wrongForm.ok && wrongForm.status === 403);
  const rpt = await MockAPI.generateConsolidatedReport(opsTokens.admin_manager, { period: 'mensal' });
  check('admin_manager generates consolidated report: 200', rpt.ok && rpt.status === 200);
  check('report excludes wellbeing_note by default', rpt.ok && !('wellbeing_note' in rpt.data.sections.hr_services));

  console.log(`\n=========================================`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
