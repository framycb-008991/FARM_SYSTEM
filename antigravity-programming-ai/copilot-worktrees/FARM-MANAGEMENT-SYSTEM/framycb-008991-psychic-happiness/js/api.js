/* ==========================================================================
   MECUZI FARM MANAGEMENT SYSTEM — Mock API Layer (RBAC-enforced)
   Implementing ACCESS_CONTROL_FIX.md §2.1/§2.4/§3 and BACKEND_SPEC.md §2.3/§3/§8

   Role is an attribute of the employee account (set once by an Administrator),
   embedded as a claim in the JWT issued after login + OTP. EVERY endpoint
   independently verifies the token's `role` claim and returns:
     - 401  missing / tampered / expired token
     - 403  authenticated but role not permitted for that endpoint
   Error bodies carry translatable keys (BACKEND_SPEC.md §9), never hardcoded
   English strings — the frontend resolves them via i18n.js.

   This file is DOM-free on purpose: it also runs under Node.js for the
   access-control verification suite (tests/access-control.test.js).
   ========================================================================== */

(function (global) {
  'use strict';

  /* ----------------------------------------------------------------------
     Role → dashboard route mapping (ACCESS_CONTROL_FIX.md §3.5)
     Written ONCE here; both the frontend guard and the tests read this map.
     ---------------------------------------------------------------------- */
  const ROLE_TO_ROUTE = {
    top_management: 'management',
    farm_technician: 'technician',
    production_manager: 'production',
    administrator: 'admin',
    // ADMIN_OPERATIONS_DASHBOARD_SPEC.md §2 — 8 new roles, 2 destinations:
    // unit leads + admin manager share ONE dashboard shell; operational roles
    // share ONE data-entry interface (§1: "not three separate dashboards").
    admin_manager: 'ops',
    finance_compliance_lead: 'ops',
    operations_support_lead: 'ops',
    hr_facility_lead: 'ops',
    driver: 'entry',
    warehouse_assistant: 'entry',
    cook: 'entry',
    cleaning_assistant: 'entry'
  };

  const ROLES = Object.keys(ROLE_TO_ROUTE);

  /* ----------------------------------------------------------------------
     Administrative Operations — unit scoping (spec §2, §3.2, §9)
     Unit leads see ONLY their own unit; admin_manager has cross-unit access.
     Enforced here server-side — UI hiding is never the boundary.
     ---------------------------------------------------------------------- */
  const UNIT_LEAD_ROLE = {
    finance: 'finance_compliance_lead',
    operations: 'operations_support_lead',
    hr_services: 'hr_facility_lead'
  };

  // Operational data-entry roles route submissions to their unit lead (§7.1)
  const ENTRY_ROLE_UNIT = {
    driver: 'operations',
    warehouse_assistant: 'operations',
    cook: 'hr_services',
    cleaning_assistant: 'hr_services'
  };

  // Every entity belongs to exactly one unit (spec §4.2, §5.2, §6.2).
  // wellbeing_note is SENSITIVE (§6.1.3): hr_facility_lead + admin_manager only,
  // never exported/consolidated without aggregation+anonymization.
  const ENTITY_REGISTRY = {
    budget_line: { unit: 'finance' },
    payment: { unit: 'finance' },
    cost_entry: { unit: 'finance' },
    procurement_request: { unit: 'finance', reviewable: true },
    stock_reconciliation: { unit: 'finance' },
    cash_reconciliation: { unit: 'finance' },
    financial_report: { unit: 'finance' },
    document_record: { unit: 'finance' },
    inventory_item: { unit: 'operations' },
    field_requisition: { unit: 'operations', reviewable: true },
    postharvest_batch: { unit: 'operations' },
    transport_log: { unit: 'operations' },
    warehouse_ledger_entry: { unit: 'operations' },
    borehole_reading: { unit: 'operations' },
    waste_log: { unit: 'operations' },
    harvest_task: { unit: 'operations' },
    meal_log: { unit: 'hr_services' },
    kitchen_stock: { unit: 'hr_services' },
    wellbeing_note: { unit: 'hr_services', sensitive: true },
    hygiene_checklist: { unit: 'hr_services' },
    first_aid_log: { unit: 'hr_services' },
    maintenance_ticket: { unit: 'hr_services' }
  };

  const UNIT_COLLECTION = {
    budget_line: 'opsBudgetLines',
    payment: 'opsPayments',
    cost_entry: 'opsCostEntries',
    procurement_request: 'opsProcurementRequests',
    stock_reconciliation: 'opsStockReconciliations',
    cash_reconciliation: 'opsCashReconciliations',
    financial_report: 'opsFinancialReports',
    document_record: 'opsDocuments',
    inventory_item: 'opsInventory',
    field_requisition: 'opsFieldRequisitions',
    postharvest_batch: 'opsPostharvestBatches',
    transport_log: 'opsTransportLogs',
    warehouse_ledger_entry: 'opsWarehouseLedger',
    borehole_reading: 'opsBoreholeReadings',
    waste_log: 'opsWasteLogs',
    harvest_task: 'opsHarvestTasks',
    meal_log: 'opsMealLogs',
    kitchen_stock: 'opsKitchenStock',
    wellbeing_note: 'opsWellbeingNotes',
    hygiene_checklist: 'opsHygieneChecklists',
    first_aid_log: 'opsFirstAidLogs',
    maintenance_ticket: 'opsMaintenanceTickets'
  };

  // Roles allowed to READ/WRITE a unit's data: its lead + admin_manager (§9).
  function unitAllowedRoles(unit) {
    return [UNIT_LEAD_ROLE[unit], 'admin_manager'];
  }

  // Data access: in the browser, data.js declares `const MECUZI_DATA` as a
  // script-level lexical binding (NOT a window property); under Node the test
  // suite assigns it to globalThis explicitly. Resolve both.
  function db() {
    return (typeof MECUZI_DATA !== 'undefined') ? MECUZI_DATA : global.MECUZI_DATA;
  }

  /* ----------------------------------------------------------------------
     JWT (HS256) helpers — real HMAC-SHA256 via Web Crypto (browser + Node)
     ---------------------------------------------------------------------- */
  const JWT_SECRET = '';
  const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // BACKEND_SPEC.md §2.3: short-lived access token

  function b64urlEncodeString(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlEncodeBuffer(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecodeString(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function hmacSign(data) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return b64urlEncodeBuffer(signature);
  }

  async function issueAccessToken(employee) {
    const now = Math.floor(Date.now() / 1000);
    const header = b64urlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    // The `role` claim comes ONLY from the employee record — never from user input
    // (ACCESS_CONTROL_FIX.md §2.1).
    const payload = b64urlEncodeString(JSON.stringify({
      sub: employee.employeeNumber,
      name: employee.name,
      role: employee.role,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS
    }));
    const signature = await hmacSign(`${header}.${payload}`);
    return `${header}.${payload}.${signature}`;
  }

  // Returns { ok: true, claims } or { ok: false, status: 401, error }
  async function verifyAccessToken(token) {
    if (!token || typeof token !== 'string') {
      return { ok: false, status: 401, error: 'errors.session_expired' };
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { ok: false, status: 401, error: 'errors.session_expired' };
    }
    const expectedSig = await hmacSign(`${parts[0]}.${parts[1]}`);
    if (expectedSig !== parts[2]) {
      return { ok: false, status: 401, error: 'errors.session_expired' };
    }
    let claims;
    try {
      claims = JSON.parse(b64urlDecodeString(parts[1]));
    } catch (e) {
      return { ok: false, status: 401, error: 'errors.session_expired' };
    }
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, status: 401, error: 'errors.session_expired' };
    }
    if (!ROLES.includes(claims.role)) {
      return { ok: false, status: 401, error: 'errors.session_expired' };
    }
    return { ok: true, claims };
  }

  /* ----------------------------------------------------------------------
     Role guard — the real boundary (ACCESS_CONTROL_FIX.md §2.4)
     Every endpoint below passes through this. No exceptions.
     ---------------------------------------------------------------------- */
  async function requireRole(token, allowedRoles) {
    const auth = await verifyAccessToken(token);
    if (!auth.ok) return auth; // 401
    if (!allowedRoles.includes(auth.claims.role)) {
      return { ok: false, status: 403, error: 'errors.forbidden' };
    }
    return auth;
  }

  /* ----------------------------------------------------------------------
     OTP challenge store (mock of Twilio Verify — BACKEND_SPEC.md §1/§2.4)
     Codes are 6 digits, 5-minute expiry, single-use. `devOtp` in the login
     response simulates the SMS delivery so the demo/tests can read the code.
     ---------------------------------------------------------------------- */
  const otpChallenges = new Map();
  let challengeCounter = 0;

  function createOtpChallenge(employeeNumber) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const challengeId = `CHL-${Date.now()}-${++challengeCounter}`;
    // Invalidate any previous challenge for this employee (BACKEND_SPEC.md §2.4)
    for (const [id, ch] of otpChallenges) {
      if (ch.employeeNumber === employeeNumber) otpChallenges.delete(id);
    }
    otpChallenges.set(challengeId, {
      employeeNumber,
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
      consumed: false
    });
    return { challengeId, code };
  }

  function maskPhone(phone) {
    return phone.replace(/(\+258\s?\d{2})\s?\d{3}\s?(\d{4})/, '$1 *** $2');
  }

  /* ----------------------------------------------------------------------
     Audit trail (BACKEND_SPEC.md §7) — every security-relevant write action
     ---------------------------------------------------------------------- */
  let auditCounter = 8822;
  function writeAuditLog(actorLabel, role, actionKey, targetEntity, targetId, metadataKey) {
    const now = new Date();
    const ts = now.toLocaleDateString('pt-PT') + ' ' + now.toLocaleTimeString('pt-PT');
    db().auditLogs.unshift({
      id: `LOG-${auditCounter++}`,
      actor: actorLabel,
      role: role,
      actionKey: actionKey,
      targetEntity: targetEntity,
      targetId: targetId,
      metadataKey: metadataKey,
      timestamp: ts
    });
  }

  /* ----------------------------------------------------------------------
     Mock API surface (mirrors BACKEND_SPEC.md §8)
     Every function returns { ok, status, data? , error? } like an HTTP response.
     ---------------------------------------------------------------------- */
  const MockAPI = {

    ROLE_TO_ROUTE,
    ROLES,
    verifyAccessToken,

    /* --- Auth (BACKEND_SPEC.md §2.3) — public, no token required --- */

    // POST /auth/login — employee number + PIN -> challenge_id (+ simulated SMS)
    async login(employeeNumber, pin) {
      const emp = db().employees.find(e => e.employeeNumber === employeeNumber);
      if (!emp) {
        return { ok: false, status: 401, error: 'errors.employee_not_found' };
      }
      if (emp.pin !== pin) {
        return { ok: false, status: 401, error: 'errors.incorrect_pin' };
      }
      const { challengeId, code } = createOtpChallenge(emp.employeeNumber);
      return {
        ok: true,
        status: 200,
        data: {
          challengeId,
          maskedPhone: maskPhone(emp.phone),
          devOtp: code // simulated SMS payload (mock provider)
        }
      };
    },

    // POST /auth/verify-otp — challenge_id + OTP -> JWT (role claim inside)
    async verifyOtp(challengeId, code) {
      const ch = otpChallenges.get(challengeId);
      if (!ch || ch.consumed || ch.expiresAt < Date.now() || ch.code !== String(code || '').trim()) {
        return { ok: false, status: 401, error: 'errors.otp_invalid' };
      }
      ch.consumed = true; // single-use (BACKEND_SPEC.md §2.4)
      const emp = db().employees.find(e => e.employeeNumber === ch.employeeNumber);
      if (!emp) {
        return { ok: false, status: 401, error: 'errors.employee_not_found' };
      }
      const accessToken = await issueAccessToken(emp);
      writeAuditLog(`${emp.name} (${emp.employeeNumber})`, emp.role,
        'audit_actions.LOGIN_SUCCESS', 'Auth', emp.employeeNumber, 'audit_meta.auth_sms_otp');
      return {
        ok: true,
        status: 200,
        data: {
          accessToken,
          mustSetPin: emp.status === 'pending',
          employee: {
            employeeNumber: emp.employeeNumber,
            name: emp.name,
            role: emp.role,
            roleKey: emp.roleKey,
            status: emp.status
          }
        }
      };
    },

    /* --- Administration endpoints [administrator] (BACKEND_SPEC.md §8) --- */

    // GET /employees
    async listEmployees(token) {
      const auth = await requireRole(token, ['administrator']);
      if (!auth.ok) return auth;
      return { ok: true, status: 200, data: db().employees };
    },

    // POST /employees — the ONLY place a role is ever assigned (§3.0)
    async createEmployee(token, payload) {
      const auth = await requireRole(token, ['administrator']);
      if (!auth.ok) return auth;
      const role = ROLES.includes(payload.role) ? payload.role : 'farm_technician';
      const newEmp = {
        id: `EMP-${String(db().employees.length + 1).padStart(3, '0')}`,
        employeeNumber: payload.employeeNumber,
        name: payload.name,
        phone: payload.phone,
        role: role,
        roleKey: `roles.${role}`,
        pin: payload.tempPin || '0000',
        status: 'pending',
        point: payload.point || 'Point_A',
        rotation: '14/2 Cycle A',
        assignedFields: payload.assignedFields || [],
        createdAt: new Date().toLocaleDateString('pt-PT')
      };
      db().employees.push(newEmp);
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.EMPLOYEE_PROVISIONED', 'Employee', newEmp.employeeNumber,
        'audit_meta.provision_pending_samuel');
      return { ok: true, status: 201, data: newEmp };
    },

    // POST /employees/:id/reset-pin
    async resetEmployeePin(token, employeeNumber) {
      const auth = await requireRole(token, ['administrator']);
      if (!auth.ok) return auth;
      const emp = db().employees.find(e => e.employeeNumber === employeeNumber);
      if (!emp) {
        return { ok: false, status: 404, error: 'errors.employee_not_found' };
      }
      emp.pin = '0000';
      emp.status = 'pending';
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.PIN_RESET', 'Employee', employeeNumber, 'audit_meta.pin_reset_samuel');
      return { ok: true, status: 200, data: emp };
    },

    // GET /audit-logs
    async listAuditLogs(token) {
      const auth = await requireRole(token, ['administrator']);
      if (!auth.ok) return auth;
      return { ok: true, status: 200, data: db().auditLogs };
    },

    /* --- Field endpoints --- */

    // GET /fields — technician: own only; manager/admin/management: all (§8)
    async listFields(token) {
      const auth = await requireRole(token, ROLES);
      if (!auth.ok) return auth;
      let fields = db().fields;
      if (auth.claims.role === 'farm_technician') {
        fields = fields.filter(f => f.assignedTechId === auth.claims.sub);
      }
      return { ok: true, status: 200, data: fields };
    },

    // POST /field-reports [farm_technician]
    async createFieldReport(token, report) {
      const auth = await requireRole(token, ['farm_technician']);
      if (!auth.ok) return auth;
      report.technicianId = auth.claims.sub; // server attributes the author, never the client
      db().fieldReports.unshift(report);
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.REPORT_SUBMITTED', 'FieldReport', report.id, 'audit_meta.batch_sync_3_reports');
      return { ok: true, status: 201, data: report };
    },

    // POST /sync/field-reports [farm_technician] — batch offline sync (§5)
    async syncFieldReports(token) {
      const auth = await requireRole(token, ['farm_technician']);
      if (!auth.ok) return auth;
      let synced = 0;
      db().fieldReports.forEach(r => {
        if (r.syncStatus === 'pending') { r.syncStatus = 'synced'; synced++; }
      });
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.BATCH_SYNC', 'SyncQueue', `BATCH-${Date.now()}`, 'audit_meta.batch_sync_3_reports');
      return { ok: true, status: 200, data: { synced } };
    },

    // GET /field-reports — review queue [production_manager]
    async getReviewQueue(token) {
      const auth = await requireRole(token, ['production_manager']);
      if (!auth.ok) return auth;
      return { ok: true, status: 200, data: db().fieldReports };
    },

    // PATCH /field-reports/:id/review [production_manager]
    async reviewFieldReport(token, reportId, decision) {
      const auth = await requireRole(token, ['production_manager']);
      if (!auth.ok) return auth;
      const report = db().fieldReports.find(r => r.id === reportId);
      if (!report) {
        return { ok: false, status: 404, error: 'errors.report_not_found' };
      }
      report.reviewStatus = decision === 'approved' ? 'approved' : 'flagged';
      report.reviewedBy = auth.claims.name;
      report.reviewedAt = new Date().toLocaleTimeString('pt-PT');
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        decision === 'approved' ? 'audit_actions.REPORT_APPROVED' : 'audit_actions.REPORT_FLAGGED',
        'FieldReport', reportId, 'audit_meta.harvest_approval_fld1');
      return { ok: true, status: 200, data: report };
    },

    /* --- Top Management read-only endpoints [top_management] (§6) --- */

    // GET /reports/summary
    async getReportsSummary(token) {
      const auth = await requireRole(token, ['top_management']);
      if (!auth.ok) return auth;
      return { ok: true, status: 200, data: db().yieldData };
    },

    // GET /reports/trends
    async getReportsTrends(token) {
      const auth = await requireRole(token, ['top_management']);
      if (!auth.ok) return auth;
      return { ok: true, status: 200, data: db().yieldData };
    },

    /* --- Administrative Operations endpoints (spec §4–§8) ---
       Every one enforces unit scoping server-side: a unit lead calling
       another unit's endpoint gets 403 (§3.2, §9). --- */

    // GET unit collection, e.g. /ops/finance/payments — lead(own unit) + admin_manager
    async listUnitRecords(token, entity) {
      const meta = ENTITY_REGISTRY[entity];
      if (!meta) return { ok: false, status: 404, error: 'errors.report_not_found' };
      const auth = await requireRole(token, unitAllowedRoles(meta.unit));
      if (!auth.ok) return auth;
      return { ok: true, status: 200, data: db()[UNIT_COLLECTION[entity]] };
    },

    // POST new record into a unit collection (lead own unit + admin_manager, §9)
    async createUnitRecord(token, entity, record) {
      const meta = ENTITY_REGISTRY[entity];
      if (!meta) return { ok: false, status: 404, error: 'errors.report_not_found' };
      const auth = await requireRole(token, unitAllowedRoles(meta.unit));
      if (!auth.ok) return auth;
      record.id = record.id || `${entity.toUpperCase()}-${Date.now()}`;
      record.createdBy = auth.claims.sub;
      db()[UNIT_COLLECTION[entity]].unshift(record);
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.REPORT_SUBMITTED', entity, record.id, 'audit_meta.ops_record_created');
      return { ok: true, status: 201, data: record };
    },

    // PATCH review action (approve/reject/flag) — e.g. procurement requests,
    // field requisitions. Unit lead (own) + admin_manager only (§9).
    async reviewUnitRecord(token, entity, recordId, decision) {
      const meta = ENTITY_REGISTRY[entity];
      if (!meta || !meta.reviewable) return { ok: false, status: 404, error: 'errors.report_not_found' };
      const auth = await requireRole(token, unitAllowedRoles(meta.unit));
      if (!auth.ok) return auth;
      const record = db()[UNIT_COLLECTION[entity]].find(r => r.id === recordId);
      if (!record) return { ok: false, status: 404, error: 'errors.report_not_found' };
      record.status = decision; // 'v.aprovado' | 'v.rejeitado' (i18n keys, translated in UI)
      record.reviewedBy = auth.claims.name;
      record.reviewedAt = new Date().toLocaleString('pt-PT');
      const isApproval = decision === 'approved' || decision === 'v.aprovado';
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        isApproval ? 'audit_actions.REPORT_APPROVED' : 'audit_actions.REPORT_FLAGGED',
        entity, recordId, 'audit_meta.ops_record_reviewed');
      return { ok: true, status: 200, data: record };
    },

    /* --- Operational Data Entry (spec §7) — driver / warehouse / cook / cleaning --- */

    // POST /ops/entries — single submission, routed to the correct unit lead's queue
    async submitOpsEntry(token, entry) {
      const auth = await requireRole(token, Object.keys(ENTRY_ROLE_UNIT));
      if (!auth.ok) return auth;
      const unit = ENTRY_ROLE_UNIT[auth.claims.role];
      // The form set is fixed per role — a role cannot submit another role's form
      const allowedForms = {
        driver: ['trip_log', 'breakdown_report'],
        warehouse_assistant: ['stock_movement', 'daily_count', 'damage_report'],
        cook: ['meal_served', 'food_stock', 'restock_request'],
        cleaning_assistant: ['cleaning_checklist', 'facility_anomaly', 'basic_maintenance']
      };
      if (!allowedForms[auth.claims.role].includes(entry.formId)) {
        return { ok: false, status: 403, error: 'errors.forbidden' };
      }
      entry.id = entry.id || `OPS-ENTRY-${Date.now()}`;
      entry.unit = unit; // server routes the queue — never the client
      entry.submittedBy = auth.claims.sub;
      entry.submittedByName = auth.claims.name;
      entry.reviewStatus = entry.reviewStatus || 'pending_review';
      db().opsEntries.unshift(entry);
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.REPORT_SUBMITTED', 'OpsEntry', entry.id, 'audit_meta.ops_entry_submitted');
      return { ok: true, status: 201, data: entry };
    },

    // POST /ops/entries/sync — offline batch sync, same engine as field reports
    async syncOpsEntries(token) {
      const auth = await requireRole(token, Object.keys(ENTRY_ROLE_UNIT));
      if (!auth.ok) return auth;
      let synced = 0;
      db().opsEntries.forEach(e => {
        if (e.submittedBy === auth.claims.sub && e.syncStatus === 'pending') {
          e.syncStatus = 'synced'; synced++;
        }
      });
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.BATCH_SYNC', 'OpsSyncQueue', `OPS-BATCH-${Date.now()}`, 'audit_meta.ops_entry_synced');
      return { ok: true, status: 200, data: { synced } };
    },

    // GET review queue — unit lead sees ONLY their unit's submissions (§7.1, §9)
    async listOpsSubmissions(token) {
      const auth = await requireRole(token,
        ['operations_support_lead', 'hr_facility_lead', 'admin_manager']);
      if (!auth.ok) return auth;
      let entries = db().opsEntries;
      if (auth.claims.role !== 'admin_manager') {
        const myUnit = Object.keys(UNIT_LEAD_ROLE).find(u => UNIT_LEAD_ROLE[u] === auth.claims.role);
        entries = entries.filter(e => e.unit === myUnit);
      }
      return { ok: true, status: 200, data: entries };
    },

    // PATCH review a submission — owning unit lead or admin_manager (§9)
    async reviewOpsSubmission(token, entryId, decision) {
      const auth = await requireRole(token,
        ['operations_support_lead', 'hr_facility_lead', 'admin_manager']);
      if (!auth.ok) return auth;
      const entry = db().opsEntries.find(e => e.id === entryId);
      if (!entry) return { ok: false, status: 404, error: 'errors.report_not_found' };
      if (auth.claims.role !== 'admin_manager') {
        const myUnit = Object.keys(UNIT_LEAD_ROLE).find(u => UNIT_LEAD_ROLE[u] === auth.claims.role);
        if (entry.unit !== myUnit) {
          return { ok: false, status: 403, error: 'errors.forbidden' };
        }
      }
      entry.reviewStatus = decision === 'approved' ? 'approved' : 'flagged';
      entry.reviewedBy = auth.claims.name;
      entry.reviewedAt = new Date().toLocaleString('pt-PT');
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        decision === 'approved' ? 'audit_actions.REPORT_APPROVED' : 'audit_actions.REPORT_FLAGGED',
        'OpsEntry', entryId, 'audit_meta.ops_entry_reviewed');
      return { ok: true, status: 200, data: entry };
    },

    /* --- Consolidated reporting (spec §8) — admin_manager ONLY --- */
    async generateConsolidatedReport(token, opts = {}) {
      const auth = await requireRole(token, ['admin_manager']);
      if (!auth.ok) return auth;
      const sections = opts.sections && opts.sections.length
        ? opts.sections
        : ['finance', 'operations', 'hr_services'];
      const from = opts.from ? new Date(opts.from) : null;
      const to = opts.to ? new Date(opts.to) : null;
      const inRange = (dateStr) => {
        if (!from && !to) return true;
        const d = new Date(dateStr);
        if (isNaN(d)) return true; // PT display dates aren't parseable — include
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      };

      const summary = { period: opts.period || 'mensal', from: opts.from || null, to: opts.to || null, sections: {} };
      for (const unit of sections) {
        summary.sections[unit] = {};
        for (const [entity, meta] of Object.entries(ENTITY_REGISTRY)) {
          if (meta.unit !== unit) continue;
          // SENSITIVE (§6.1.3, §10): wellbeing notes are NEVER exported raw —
          // only an anonymized aggregate count, and only when requested.
          if (meta.sensitive) {
            if (opts.includeAnonymizedWellbeing === true) {
              summary.sections[unit][entity] = { anonymized: true, count: db()[UNIT_COLLECTION[entity]].length };
            }
            continue; // excluded by default
          }
          const rows = db()[UNIT_COLLECTION[entity]].filter(r => !r.date || inRange(r.date));
          summary.sections[unit][entity] = { count: rows.length, records: rows };
        }
      }
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.REPORT_APPROVED', 'ConsolidatedReport', `RPT-${Date.now()}`, 'audit_meta.ops_report_generated');
      return { ok: true, status: 200, data: summary };
    },

    /* --- Test hook: sign an arbitrary payload (used ONLY by the test suite
           to prove tampered/foreign-role claims are rejected) --- */
    async _signTestToken(payload) {
      const header = b64urlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const body = b64urlEncodeString(JSON.stringify(payload));
      const signature = await hmacSign(`${header}.${body}`);
      return `${header}.${body}.${signature}`;
    }
  };

  global.MockAPI = MockAPI;
  global.ROLE_TO_ROUTE = ROLE_TO_ROUTE;
  global.ADMIN_OPS_ENTITY_REGISTRY = ENTITY_REGISTRY;
  global.ADMIN_OPS_UNIT_LEAD_ROLE = UNIT_LEAD_ROLE;
  global.ADMIN_OPS_ENTRY_ROLE_UNIT = ENTRY_ROLE_UNIT;

})(typeof window !== 'undefined' ? window : globalThis);
