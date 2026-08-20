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
     Server-owned auth session helpers

     No credential, JWT secret, password hash, salt, or session identifier is
     embedded in this browser bundle. Authentication is delegated to the same
     origin Express server, which returns only public role claims and sets an
     HttpOnly signed cookie.
     ---------------------------------------------------------------------- */
  function publicClaimsFromSession(session) {
    if (!session || !ROLES.includes(session.role) || !session.employeeNumber) return null;
    return {
      sub: session.employeeNumber,
      employeeNumber: session.employeeNumber,
      name: session.name || session.functionName || session.employeeNumber,
      role: session.role,
      roleKey: session.roleKey || `roles.${session.role}`,
      status: session.status || 'active'
    };
  }

  async function authFetch(path, options = {}) {
    const res = await fetch(path, Object.assign({ credentials: 'same-origin' }, options));
    let body = null;
    try { body = await res.json(); } catch (e) { body = {}; }
    if (!res.ok || !body.ok) {
      return { ok: false, status: res.status, error: (body && body.error) || 'errors.session_expired' };
    }
    return { ok: true, status: res.status, data: body };
  }

  async function loginWithServer(employeeNumber, password) {
    return authFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeNumber, password })
    });
  }

  async function getServerSession() {
    return authFetch('/api/auth/session');
  }

  async function logoutWithServer() {
    return authFetch('/api/auth/logout', { method: 'POST' });
  }

  async function getDemoAccounts() {
    return authFetch('/api/demo/accounts');
  }

  async function demoLogin(selectionId) {
    return authFetch('/api/auth/demo-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectionId })
    });
  }

  // Returns { ok: true, claims } or { ok: false, status: 401, error }.
  // Existing MockAPI functions still accept a first `token` argument, but it is
  // now a non-secret public claims object derived from the server session.
  async function verifyAccessToken(session) {
    const localClaims = publicClaimsFromSession(session);
    if (localClaims) return { ok: true, claims: localClaims };

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await getServerSession();
      if (res.ok) {
        const claims = publicClaimsFromSession(res.data.session || res.data.employee);
        if (claims) return { ok: true, claims };
      }
      return { ok: false, status: res.status || 401, error: res.error || 'errors.session_expired' };
    }

    return { ok: false, status: 401, error: 'errors.session_expired' };
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
     OTP is disabled in this Render demo because the workbook has no phone
     numbers. The stale MockAPI.verifyOtp path returns 410 fail-closed.
     ---------------------------------------------------------------------- */

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

  /* ======================================================================
     CLIMATE & FIRE RISK MODULE (WEATHER_INTEGRATION_SPEC.md)
     Extension of the same backend — same role scoping, offline sync pattern,
     audit logging and translation-key conventions. Not a parallel system.
     ====================================================================== */

  // Roles allowed to file a manual "Report Fire / Smoke" (§2.4): Farm
  // Technician + the 4 Operational Data Entry roles.
  const FIRE_REPORT_ROLES = ['farm_technician', 'driver', 'warehouse_assistant', 'cook', 'cleaning_assistant'];

  // Per-field climate alert visibility (§7). Top Management is deliberately
  // excluded here — it gets the aggregated org-wide summary endpoint only.
  const CLIMATE_ALERT_READ_ROLES = ['farm_technician', 'production_manager', 'administrator',
    'admin_manager', 'finance_compliance_lead', 'operations_support_lead', 'hr_facility_lead',
    'driver', 'warehouse_assistant', 'cook', 'cleaning_assistant'];

  const CLIMATE_ACK_ROLES = ['farm_technician', 'production_manager', 'administrator', 'admin_manager'];
  const CLIMATE_THRESHOLD_ROLES = ['administrator', 'admin_manager']; // §5/§7: Settings editors

  /* --- Geo helpers --- */
  function parseFieldCoords(field) {
    // Field.coords is stored as "(-24.184, 34.721)"
    const m = /\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/.exec(field.coords || '');
    return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function nearestField(lat, lng) {
    let best = null, bestKm = Infinity;
    db().fields.forEach(f => {
      const c = parseFieldCoords(f);
      if (!c) return;
      const d = haversineKm(lat, lng, c.lat, c.lng);
      if (d < bestKm) { best = f; bestKm = d; }
    });
    return { field: best, distanceKm: bestKm };
  }

  /* --- Threshold access (§5: every threshold is a ClimateAlertThreshold row,
         admin-editable — never a magic number in this file) --- */
  function getThreshold(alertType, unit, fieldId) {
    const rows = db().climateAlertThresholds.filter(r =>
      r.alertType === alertType && r.unit === unit &&
      (r.appliesTo === 'all' || r.appliesTo === fieldId));
    // A field-specific row overrides the org-wide 'all' row.
    return rows.find(r => r.appliesTo === fieldId) || rows[0] || null;
  }

  /* --- SMS notification (§8) — reuses the existing Twilio integration.
         CRITICAL severity only. Recipients: the Production Manager(s)
         overseeing the field + the Admin Manager. Every SMS is logged to
         AuditLog. The body carries message_key + params, never pre-formatted
         text (§10). --- */
  let smsCounter = 1;
  function sendCriticalAlertSms(alert) {
    if (alert.severity !== 'critical') return; // §8: never watch/warning
    const recipients = db().employees.filter(e =>
      e.status === 'active' && (
        e.role === 'admin_manager' ||
        (e.role === 'production_manager' &&
          (e.assignedFields.length === 0 || e.assignedFields.includes(alert.fieldId)))
      ));
    recipients.forEach(emp => {
      db().smsOutbox.unshift({
        id: `SMS-${String(smsCounter++).padStart(4, '0')}`,
        to: emp.phone,
        toName: emp.name,
        toRole: emp.role,
        alertId: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        messageKey: alert.messageKey,
        messageParams: alert.messageParams,
        sentAt: new Date().toISOString()
      });
      writeAuditLog('system (Twilio SMS)', 'system',
        'audit_actions.SMS_SENT', 'ClimateAlert', alert.id, 'audit_meta.sms_critical_alert');
    });
  }

  /* --- Alert raise / corroborate / resolve (§5, §12) ---
         One unified pipeline for weather AND fire. Dedup rules:
         - same alertType + field already active → update in place, escalate
           severity if worse (escalation to critical fires the SMS once);
         - a second hotspot for the SAME real fire (same field, or within
           fireDedupRadiusKm) → linked onto the existing alert via
           corroboratingHotspotIds, never a second unlinked alert (§12). --- */
  let climateAlertCounter = 100;
  function raiseClimateAlert(opts) {
    const { fieldId, alertType, severity, messageKey, messageParams, forecastWindow, hotspot } = opts;
    const now = new Date().toISOString();

    if (alertType === 'fire_detected' && hotspot) {
      const dedupKm = db().climateConfig.fireDedupRadiusKm;
      const existing = db().climateAlerts.find(a => {
        if (a.alertType !== 'fire_detected' || a.resolvedAt) return false;
        if (a.fieldId === fieldId) return true;
        // Different field attribution but physically the same fire?
        const linkedIds = [a.relatedHotspotId, ...(a.corroboratingHotspotIds || [])].filter(Boolean);
        return linkedIds.some(id => {
          const h = db().fireHotspots.find(x => x.id === id);
          return h && haversineKm(h.latitude, h.longitude, hotspot.latitude, hotspot.longitude) <= dedupKm;
        });
      });
      if (existing) {
        if (existing.relatedHotspotId !== hotspot.id &&
            !(existing.corroboratingHotspotIds || []).includes(hotspot.id)) {
          existing.corroboratingHotspotIds = (existing.corroboratingHotspotIds || []).concat(hotspot.id);
          existing.messageParams = Object.assign({}, existing.messageParams, {
            sourceKey: 'climate.source_corroborated'
          });
        }
        return { alert: existing, created: false, corroborated: true };
      }
    } else {
      const existing = db().climateAlerts.find(a =>
        a.alertType === alertType && a.fieldId === fieldId && !a.resolvedAt);
      if (existing) {
        const rank = { watch: 0, warning: 1, critical: 2 };
        const wasCritical = existing.severity === 'critical';
        existing.triggeredAt = now;
        existing.messageKey = messageKey;
        existing.messageParams = messageParams;
        existing.forecastWindow = forecastWindow || null;
        if (rank[severity] > rank[existing.severity]) {
          existing.severity = severity;
          if (existing.severity === 'critical' && !wasCritical) sendCriticalAlertSms(existing);
        }
        return { alert: existing, created: false, corroborated: false };
      }
    }

    const alert = {
      id: `CAL-${String(climateAlertCounter++).padStart(4, '0')}`,
      fieldId: fieldId,
      alertType: alertType,
      severity: severity,
      triggeredAt: now,
      resolvedAt: null,
      forecastWindow: forecastWindow || null,
      messageKey: messageKey,
      messageParams: messageParams,
      relatedHotspotId: hotspot ? hotspot.id : null,
      corroboratingHotspotIds: [],
      acknowledgedBy: null,
      acknowledgedAt: null
    };
    db().climateAlerts.unshift(alert);
    writeAuditLog('system (climate monitor)', 'system',
      'audit_actions.CLIMATE_ALERT_RAISED', 'ClimateAlert', alert.id, 'audit_meta.climate_alert_raised');
    if (alert.severity === 'critical') sendCriticalAlertSms(alert); // §8
    return { alert, created: true, corroborated: false };
  }

  // Auto-resolve weather-type alerts when the triggering condition clears on
  // a later evaluation. fire_detected is NEVER auto-resolved — a confirmed
  // fire requires acknowledgment (§9).
  function resolveClimateAlert(fieldId, alertType) {
    db().climateAlerts.forEach(a => {
      if (a.fieldId === fieldId && a.alertType === alertType && !a.resolvedAt) {
        a.resolvedAt = new Date().toISOString();
      }
    });
  }

  /* --- Fire Danger Index (§2.3) — computed locally, no new API.
         Simplified Nesterov-style index (G. Nesterov, 1949), adapted for a
         single-day reading plus dry-spell accumulation:

           Tdew ≈ T − (100 − RH) / 5        (Magnus dry-air approximation)
           D    = max(0, T − Tdew) · T / 40 (daily dryness)
           K    = min(daysSinceRain, 20)    (dry-spell accumulation)
           W    = 1 + windKmh / 60          (wind spread factor)
           score = D · (1 + 0.15·K) · W

         Levels: low < 20 · moderate < 40 · high < 70 · extreme ≥ 70.
         Cited here so the formula can be audited/tuned later (§2.3). --- */
  function computeFireDangerScore({ temperatureC, humidityPct, windSpeedKmh, daysSinceRain }) {
    const tDew = temperatureC - (100 - humidityPct) / 5;
    const D = Math.max(0, temperatureC - tDew) * temperatureC / 40;
    const K = Math.min(daysSinceRain || 0, 20);
    const W = 1 + (windSpeedKmh || 0) / 60;
    const score = Math.round(D * (1 + 0.15 * K) * W);
    const level = score >= 70 ? 'extreme' : (score >= 40 ? 'high' : (score >= 20 ? 'moderate' : 'low'));
    return { score, level };
  }

  function computeFireDangerForField(field) {
    const observed = db().weatherReadings
      .filter(r => r.fieldId === field.id && !r.isForecast)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    if (observed.length === 0) return null; // §11: no data yet — skip gracefully

    // Dry-spell length: carried forward from the previous danger reading
    // (incremented while observed precipitation stays below 1mm).
    const latest = observed[0];
    const prev = db().fireDangerReadings
      .filter(r => r.fieldId === field.id)
      .sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt))[0];
    let daysSinceRain;
    if (latest.precipitationMm >= 1) {
      daysSinceRain = 0;
    } else if (prev) {
      daysSinceRain = prev.daysSinceRain + 1;
    } else {
      daysSinceRain = observed.filter(r => r.precipitationMm < 1).length;
    }

    const { score, level } = computeFireDangerScore({
      temperatureC: latest.temperatureC,
      humidityPct: latest.humidityPct,
      windSpeedKmh: latest.windSpeedKmh,
      daysSinceRain: daysSinceRain
    });
    const reading = {
      id: `FD-${field.id}-${Date.now()}`,
      fieldId: field.id,
      calculatedAt: new Date().toISOString(),
      dangerScore: score,
      dangerLevel: level,
      daysSinceRain: daysSinceRain,
      inputsSnapshot: {
        temperatureC: latest.temperatureC,
        humidityPct: latest.humidityPct,
        windSpeedKmh: latest.windSpeedKmh
      }
    };
    db().fireDangerReadings.unshift(reading);
    return reading;
  }

  /* --- Alert evaluation (§5) — every threshold read from
         ClimateAlertThreshold rows. A field with no data returns early and
         never throws (§11). --- */
  function evaluateFieldClimate(field) {
    const readings = db().weatherReadings.filter(r => r.fieldId === field.id);
    if (readings.length === 0) return { fieldId: field.id, noData: true }; // §11

    const observed = readings.filter(r => !r.isForecast).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    const forecast = readings.filter(r => r.isForecast).sort((a, b) => a.recordedAt.localeCompare(a.recordedAt));
    const latest = observed[0] || null;
    const fieldKey = field.nameKey;
    const fired = [];

    // -- Cyclone / high wind: gusts forecast within 48h (§5) → critical --
    const cycloneThr = getThreshold('cyclone_warning', 'km/h', field.id);
    const gustThr = getThreshold('high_wind', 'km/h', field.id);
    const maxGust = forecast.reduce((m, r) => Math.max(m, r.windGustKmh || 0), 0);
    if (cycloneThr && maxGust > cycloneThr.value) {
      raiseClimateAlert({ fieldId: field.id, alertType: 'cyclone_warning', severity: 'critical',
        messageKey: 'climate.msg_cyclone', forecastWindow: '48h',
        messageParams: { gust: maxGust, fieldKey } });
      fired.push('cyclone_warning');
      resolveClimateAlert(field.id, 'high_wind'); // cyclone supersedes
    } else if (gustThr && maxGust > gustThr.value) {
      raiseClimateAlert({ fieldId: field.id, alertType: 'high_wind', severity: 'critical',
        messageKey: 'climate.msg_high_wind', forecastWindow: '48h',
        messageParams: { gust: maxGust, fieldKey } });
      fired.push('high_wind');
      resolveClimateAlert(field.id, 'cyclone_warning');
    } else {
      resolveClimateAlert(field.id, 'high_wind');
      resolveClimateAlert(field.id, 'cyclone_warning');
    }

    // -- Heavy rain / flood risk (§5): >40mm/24h → warning, escalating to
    //    critical when it overlaps an active harvest/drying CropCycle; ≥3
    //    consecutive days >20mm → flood warning --
    const rainThr = getThreshold('heavy_rain', 'mm/24h', field.id);
    const floodDayThr = getThreshold('flood_risk', 'mm/day', field.id);
    const floodDaysThr = getThreshold('flood_risk', 'consecutive_days', field.id);
    const maxRain24 = forecast.reduce((m, r) => Math.max(m, r.precipitationMm || 0), 0);
    if (rainThr && maxRain24 > rainThr.value) {
      const cycle = db().cropCycles.find(c => c.fieldId === field.id &&
        /harvest|imminent/.test(c.statusKey));
      const escalated = !!cycle; // harvest/drying overlap → critical (§5)
      raiseClimateAlert({ fieldId: field.id, alertType: 'heavy_rain',
        severity: escalated ? 'critical' : 'warning',
        messageKey: escalated ? 'climate.msg_heavy_rain_harvest' : 'climate.msg_heavy_rain',
        forecastWindow: '24h',
        messageParams: escalated
          ? { mm: maxRain24, fieldKey, cycleKey: cycle.statusKey }
          : { mm: maxRain24, fieldKey } });
      fired.push('heavy_rain');
    } else {
      resolveClimateAlert(field.id, 'heavy_rain');
    }

    if (floodDayThr && floodDaysThr) {
      const daily = observed.concat(forecast).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      let streak = 0, maxStreak = 0;
      daily.forEach(r => {
        streak = (r.precipitationMm || 0) > floodDayThr.value ? streak + 1 : 0;
        maxStreak = Math.max(maxStreak, streak);
      });
      if (maxStreak >= floodDaysThr.value) {
        raiseClimateAlert({ fieldId: field.id, alertType: 'flood_risk', severity: 'warning',
          messageKey: 'climate.msg_flood_risk', forecastWindow: '7d',
          messageParams: { days: maxStreak, fieldKey } });
        fired.push('flood_risk');
      } else {
        resolveClimateAlert(field.id, 'flood_risk');
      }
    }

    // -- Drought risk (§5): soil moisture below threshold for 10+ consecutive
    //    days with no rain forecast → warning --
    const soilThr = getThreshold('drought_risk', 'm3/m3', field.id);
    const dryDaysThr = getThreshold('drought_risk', 'days_without_rain', field.id);
    const dangerLatest = db().fireDangerReadings
      .filter(r => r.fieldId === field.id)
      .sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt))[0];
    const daysSinceRain = dangerLatest ? dangerLatest.daysSinceRain : 0;
    const rainForecast = forecast.some(r => (r.precipitationMm || 0) > 2);
    if (latest && soilThr && dryDaysThr &&
        latest.soilMoisture < soilThr.value && daysSinceRain >= dryDaysThr.value && !rainForecast) {
      raiseClimateAlert({ fieldId: field.id, alertType: 'drought_risk', severity: 'warning',
        messageKey: 'climate.msg_drought', forecastWindow: '7d',
        messageParams: { days: daysSinceRain, fieldKey } });
      fired.push('drought_risk');
    } else {
      resolveClimateAlert(field.id, 'drought_risk');
    }

    // -- Extreme heat (§5): forecast max temp above threshold → watch --
    const heatThr = getThreshold('extreme_heat', '°C', field.id);
    const maxTemp = forecast.reduce((m, r) => Math.max(m, r.temperatureC ?? -Infinity), -Infinity);
    if (heatThr && maxTemp > heatThr.value) {
      raiseClimateAlert({ fieldId: field.id, alertType: 'extreme_heat', severity: 'watch',
        messageKey: 'climate.msg_extreme_heat', forecastWindow: '48h',
        messageParams: { temp: maxTemp, fieldKey } });
      fired.push('extreme_heat');
    } else {
      resolveClimateAlert(field.id, 'extreme_heat');
    }

    // -- Disease-risk humidity (§5): humidity above threshold combined with
    //    recent rainfall → watch (fungal risk relevant to cashew) --
    const humThr = getThreshold('disease_risk_humidity', '%', field.id);
    const recentRain = observed.some(r => (r.precipitationMm || 0) > 1);
    if (latest && humThr && latest.humidityPct > humThr.value && recentRain) {
      raiseClimateAlert({ fieldId: field.id, alertType: 'disease_risk_humidity', severity: 'watch',
        messageKey: 'climate.msg_disease_risk', forecastWindow: '48h',
        messageParams: { humidity: latest.humidityPct, fieldKey } });
      fired.push('disease_risk_humidity');
    } else {
      resolveClimateAlert(field.id, 'disease_risk_humidity');
    }

    // -- Fire danger, predicted (§5): high → warning; extreme → critical.
    //    The level names come from threshold rows, not constants. --
    const warnLevel = getThreshold('fire_danger', 'danger_level', field.id); // 'high' row
    const critRow = db().climateAlertThresholds.find(r =>
      r.id === 'THR-FIRE-CRIT' || (r.alertType === 'fire_danger' && r.value === 'extreme'));
    if (dangerLatest && warnLevel) {
      if (dangerLatest.dangerLevel === (critRow ? critRow.value : 'extreme')) {
        raiseClimateAlert({ fieldId: field.id, alertType: 'fire_danger', severity: 'critical',
          messageKey: 'climate.msg_fire_danger', forecastWindow: null,
          messageParams: { levelKey: 'climate.level_extreme', days: daysSinceRain, fieldKey } });
        fired.push('fire_danger');
      } else if (dangerLatest.dangerLevel === warnLevel.value) { // 'high'
        raiseClimateAlert({ fieldId: field.id, alertType: 'fire_danger', severity: 'warning',
          messageKey: 'climate.msg_fire_danger', forecastWindow: null,
          messageParams: { levelKey: 'climate.level_high', days: daysSinceRain, fieldKey } });
        fired.push('fire_danger');
      } else {
        resolveClimateAlert(field.id, 'fire_danger');
      }
    }

    // -- Fire detected, satellite (§5): any FIRMS hotspot inside the field's
    //    buffer → critical, always (never a watch) --
    const bufferKm = db().climateConfig.firmsBufferRadiusKm;
    db().fireHotspots
      .filter(h => h.source === 'nasa_firms' && h.syncStatus !== 'pending' &&
        h.fieldId === field.id && h.distanceToFieldKm <= bufferKm)
      .forEach(h => {
        raiseClimateAlert({ fieldId: field.id, alertType: 'fire_detected', severity: 'critical',
          messageKey: 'climate.msg_fire_detected', forecastWindow: null,
          messageParams: { km: h.distanceToFieldKm, fieldKey, sourceKey: 'climate.source_satellite' },
          hotspot: h });
        fired.push('fire_detected');
      });

    return { fieldId: field.id, fired };
  }

  /* --- Ingestion jobs (§4) — batch/rate-limited per field; a failed external
         call is logged with backoff and NEVER blocks the other fields (§11). --- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function buildOpenMeteoUrl(field) {
    const c = parseFieldCoords(field);
    const params = new URLSearchParams({
      latitude: c.lat, longitude: c.lng,
      hourly: 'temperature_2m,precipitation,precipitation_probability,windspeed_10m,windgusts_10m,relative_humidity_2m,soil_moisture_0_to_1cm,et0_fao_evapotranspiration',
      forecast_days: 7, past_days: 2, timezone: 'Africa/Maputo'
    });
    return `${db().climateConfig.openMeteoBaseUrl}?${params.toString()}`;
  }

  async function fetchWithRetry(url, fetchImpl, retries = 2) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchImpl(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        if (attempt < retries) await sleep(250 * Math.pow(2, attempt)); // backoff (§11)
      }
    }
    throw lastErr;
  }

  let weatherReadingCounter = 9000;
  async function syncWeatherReadings(opts = {}) {
    const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    const delayMs = opts.batchDelayMs != null ? opts.batchDelayMs : 300; // §4 rate limiting
    const results = [];
    for (const field of db().fields) { // sequential batches, not one request per second
      try {
        if (db().climateConfig.liveApiEnabled) {
          if (!fetchImpl) throw new Error('no fetch implementation available');
          const json = await fetchWithRetry(buildOpenMeteoUrl(field), fetchImpl);
          const h = json.hourly;
          const n = Math.min(h.time.length, 48 + 7 * 24);
          for (let i = 0; i < n; i += 6) { // 6-hourly samples keep the store lean
            db().weatherReadings.unshift({
              id: `WR-${weatherReadingCounter++}`,
              fieldId: field.id,
              recordedAt: new Date(h.time[i]).toISOString(),
              temperatureC: h.temperature_2m[i],
              precipitationMm: h.precipitation[i],
              precipitationProbability: h.precipitation_probability[i],
              windSpeedKmh: h.windspeed_10m[i],
              windGustKmh: h.windgusts_10m[i],
              humidityPct: h.relative_humidity_2m[i],
              soilMoisture: h.soil_moisture_0_to_1cm[i],
              evapotranspiration: h.et0_fao_evapotranspiration[i],
              source: 'open_meteo',
              isForecast: new Date(h.time[i]).getTime() > Date.now()
            });
          }
        } else {
          // Demo/simulated pull: refresh the field's latest observed reading
          // with a new timestamp. Fields with no data stay empty (§11).
          const latest = db().weatherReadings
            .filter(r => r.fieldId === field.id && !r.isForecast)
            .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
          if (latest) {
            db().weatherReadings.unshift(Object.assign({}, latest, {
              id: `WR-${weatherReadingCounter++}`,
              recordedAt: new Date().toISOString()
            }));
          }
        }
        results.push({ fieldId: field.id, ok: true });
      } catch (e) {
        // §11: log the failure, keep going — other fields must not be blocked
        writeAuditLog('system (ingestion)', 'system',
          'audit_actions.INGEST_FAILED', 'Field', field.id, 'audit_meta.open_meteo_unreachable');
        results.push({ fieldId: field.id, ok: false, error: String(e && e.message || e) });
      }
      if (delayMs > 0) await sleep(delayMs);
    }
    // §4: fire danger score calculation runs right after the weather sync
    db().fields.forEach(f => computeFireDangerForField(f));
    const evaluations = db().fields.map(f => evaluateFieldClimate(f));
    writeAuditLog('system (ingestion)', 'system',
      'audit_actions.CLIMATE_SYNC', 'WeatherReading', `WSYNC-${Date.now()}`, 'audit_meta.weather_sync_done');
    return { ok: true, status: 200, data: { results, evaluations } };
  }

  async function syncFireHotspots(opts = {}) {
    const cfg = db().climateConfig;
    if (!cfg.firmsMapKey) {
      // §2.2: one-time setup step — without a MAP_KEY the job skips the live
      // pull and keeps serving existing data; it never crashes (§11).
      writeAuditLog('system (ingestion)', 'system',
        'audit_actions.INGEST_FAILED', 'FireHotspot', 'FIRMS', 'audit_meta.firms_key_missing');
      return { ok: true, status: 200, data: { skipped: true, reason: 'firms_key_missing' } };
    }
    const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    const delayMs = opts.batchDelayMs != null ? opts.batchDelayMs : 300;
    const results = [];
    for (const field of db().fields) {
      try {
        if (!cfg.liveApiEnabled) { results.push({ fieldId: field.id, ok: true, simulated: true }); continue; }
        if (!fetchImpl) throw new Error('no fetch implementation available');
        const c = parseFieldCoords(field);
        const d = cfg.firmsBufferRadiusKm / 111; // ≈ degrees per km at the equator
        const bbox = `${c.lng - d},${c.lat - d},${c.lng + d},${c.lat + d}`;
        const url = `${cfg.firmsBaseUrl}/area/csv/${cfg.firmsMapKey}/VIIRS_SNPP_NRT/${bbox}/1`;
        const res = await fetchWithRetry(url, fetchImpl);
        const text = typeof res === 'string' ? res : JSON.stringify(res);
        text.split('\n').slice(1).filter(l => l.trim()).forEach(line => {
          const cols = line.split(',');
          const lat = parseFloat(cols[0]), lng = parseFloat(cols[1]);
          if (isNaN(lat) || isNaN(lng)) return;
          const { field: near, distanceKm } = nearestField(lat, lng);
          if (distanceKm > cfg.firmsBufferRadiusKm) return; // outside all buffers
          const hsId = `HS-SAT-${lat.toFixed(3)}-${lng.toFixed(3)}-${cols[5] || ''}`;
          if (db().fireHotspots.some(h => h.id === hsId)) return; // idempotent re-pull
          db().fireHotspots.unshift({
            id: hsId, fieldId: near ? near.id : null, latitude: lat, longitude: lng,
            distanceToFieldKm: Math.round(distanceKm * 10) / 10,
            detectedAt: new Date().toISOString(),
            confidence: (cols[8] || 'nominal').toLowerCase(),
            brightness: parseFloat(cols[2]) || null,
            source: 'nasa_firms', satellite: 'viirs',
            reportedBy: null, photoUrls: null, note: null, syncStatus: 'synced'
          });
          if (near) evaluateFieldClimate(near); // fire_detected → critical, §5
        });
        results.push({ fieldId: field.id, ok: true });
      } catch (e) {
        writeAuditLog('system (ingestion)', 'system',
          'audit_actions.INGEST_FAILED', 'Field', field.id, 'audit_meta.firms_unreachable');
        results.push({ fieldId: field.id, ok: false, error: String(e && e.message || e) });
      }
      if (delayMs > 0) await sleep(delayMs);
    }
    return { ok: true, status: 200, data: { results } };
  }

  /* --- SMS recipients helper is inside sendCriticalAlertSms (§8) --- */


  /* ----------------------------------------------------------------------
     Mock API surface (mirrors BACKEND_SPEC.md §8)
     Every function returns { ok, status, data? , error? } like an HTTP response.
     ---------------------------------------------------------------------- */
  const MockAPI = {

    ROLE_TO_ROUTE,
    ROLES,
    verifyAccessToken,

    /* --- Auth (server-owned session cookie) — public, no token required --- */

    // POST /api/auth/login — employee number + workbook password. The server
    // verifies the salted scrypt hash and sets an HttpOnly signed cookie.
    async login(employeeNumber, password) {
      const res = await loginWithServer(employeeNumber, password);
      if (!res.ok) return res;
      return {
        ok: true,
        status: 200,
        data: {
          employee: res.data.employee,
          session: res.data.session,
          mustSetPin: false
        }
      };
    },

    async demoAccounts() { return getDemoAccounts(); },

    async demoLogin(selectionId) {
      const res = await demoLogin(selectionId);
      if (!res.ok) return res;
      return { ok: true, status: 200, data: { employee: res.data.employee, session: res.data.session } };
    },

    // Kept only so stale callers fail closed. The workbook has no phone numbers,
    // so OTP is intentionally disabled for this Render demo.
    async verifyOtp() {
      return { ok: false, status: 410, error: 'errors.otp_disabled' };
    },

    async logout() {
      return logoutWithServer();
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

    /* --- Climate & Fire endpoints (WEATHER_INTEGRATION_SPEC.md §5–§9) --- */

    // Ingestion jobs (§4) — invoked by the scheduler/frontend; they never
    // throw on external API failure (§11).
    async runWeatherSync(opts) { return syncWeatherReadings(opts); },
    async runFireHotspotSync(opts) { return syncFireHotspots(opts); },
    async runClimateIngestion(opts = {}) {
      const weather = await syncWeatherReadings(opts);
      const fire = await syncFireHotspots(opts);
      return { ok: true, status: 200, data: { weather: weather.data, fire: fire.data } };
    },

    // GET /climate/alerts — role-scoped per §7. Top Management is excluded:
    // it uses the aggregated summary endpoint instead.
    async listClimateAlerts(token) {
      const auth = await requireRole(token, CLIMATE_ALERT_READ_ROLES);
      if (!auth.ok) return auth;
      let alerts = db().climateAlerts.filter(a => !a.resolvedAt);
      if (auth.claims.role === 'farm_technician') {
        // Farm Technician: assigned fields ONLY (§7)
        const emp = db().employees.find(e => e.employeeNumber === auth.claims.sub);
        const mine = (emp && emp.assignedFields) || [];
        alerts = alerts.filter(a => mine.includes(a.fieldId));
      }
      const withContext = alerts.map(a => {
        const field = db().fields.find(f => f.id === a.fieldId);
        const out = Object.assign({}, a, { fieldNameKey: field ? field.nameKey : null });
        // Production Manager: crop-cycle context on each alert (§7)
        if (auth.claims.role === 'production_manager') {
          const cycle = db().cropCycles.find(c => c.fieldId === a.fieldId);
          out.cropCycleStatusKey = cycle ? cycle.statusKey : null;
        }
        return out;
      });
      return { ok: true, status: 200, data: withContext };
    },

    // GET /climate/summary — Top Management: aggregated org-wide climate/fire
    // risk summary ONLY, no per-field detail (§7).
    async getClimateOrgSummary(token) {
      const auth = await requireRole(token, ['top_management', 'administrator']);
      if (!auth.ok) return auth;
      const active = db().climateAlerts.filter(a => !a.resolvedAt);
      const bySeverity = { watch: 0, warning: 0, critical: 0 };
      const byType = {};
      active.forEach(a => {
        bySeverity[a.severity]++;
        byType[a.alertType] = (byType[a.alertType] || 0) + 1;
      });
      const fieldsWithData = new Set(db().weatherReadings.map(r => r.fieldId)).size;
      return {
        ok: true,
        status: 200,
        data: {
          totalActive: active.length,
          bySeverity,
          byType,
          unacknowledgedCritical: active.filter(a => a.severity === 'critical' && !a.acknowledgedBy).length,
          fieldsWithWeatherData: fieldsWithData,
          totalFields: db().fields.length,
          openHotspots: db().fireHotspots.filter(h => h.syncStatus !== 'pending').length
        }
      };
    },

    // POST /climate/alerts/:id/acknowledge — §9: a critical alert must not
    // scroll off a dashboard unacknowledged.
    async acknowledgeClimateAlert(token, alertId) {
      const auth = await requireRole(token, CLIMATE_ACK_ROLES);
      if (!auth.ok) return auth;
      const alert = db().climateAlerts.find(a => a.id === alertId);
      if (!alert) return { ok: false, status: 404, error: 'errors.report_not_found' };
      if (auth.claims.role === 'farm_technician') {
        const emp = db().employees.find(e => e.employeeNumber === auth.claims.sub);
        if (!emp || !emp.assignedFields.includes(alert.fieldId)) {
          return { ok: false, status: 403, error: 'errors.forbidden' };
        }
      }
      alert.acknowledgedBy = `${auth.claims.name} (${auth.claims.sub})`;
      alert.acknowledgedAt = new Date().toISOString();
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.ALERT_ACKNOWLEDGED', 'ClimateAlert', alertId, 'audit_meta.alert_acknowledged');
      return { ok: true, status: 200, data: alert };
    },

    // GET/PATCH /climate/thresholds — admin-configurable alert thresholds
    // (§5: editable in Settings, never hardcoded).
    async listClimateThresholds(token) {
      const auth = await requireRole(token, CLIMATE_THRESHOLD_ROLES);
      if (!auth.ok) return auth;
      return { ok: true, status: 200, data: db().climateAlertThresholds };
    },

    async updateClimateThreshold(token, thresholdId, patch) {
      const auth = await requireRole(token, CLIMATE_THRESHOLD_ROLES);
      if (!auth.ok) return auth;
      const row = db().climateAlertThresholds.find(r => r.id === thresholdId);
      if (!row) return { ok: false, status: 404, error: 'errors.report_not_found' };
      if (patch.value !== undefined) row.value = patch.value;
      if (patch.comparator !== undefined) row.comparator = patch.comparator;
      if (patch.appliesTo !== undefined) row.appliesTo = patch.appliesTo;
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.THRESHOLD_UPDATED', 'ClimateAlertThreshold', thresholdId, 'audit_meta.threshold_updated');
      return { ok: true, status: 200, data: row };
    },

    // GET /climate/rainfall-boreholes — Operations Support: cross-references
    // recent rainfall against existing BoreholeReading data, flagging
    // boreholes that aren't responding as expected to rain (§7).
    async getRainfallBoreholeCorrelation(token) {
      const auth = await requireRole(token, ['operations_support_lead', 'admin_manager']);
      if (!auth.ok) return auth;
      const rows = db().opsBoreholeReadings.map(r => {
        const field = db().fields.find(f => f.waterSourceKey === r.borehole);
        if (!field) return null;
        const readings = db().weatherReadings.filter(x => x.fieldId === field.id && !x.isForecast);
        if (readings.length === 0) {
          // §11: no weather data for this field — degrade, don't fabricate
          return { borehole: r.borehole, fieldId: field.id, readingM3: r.readingM3,
            avgM3: r.avgM3, recentRainMm: null, statusKey: 'climate.corr_no_data' };
        }
        const recentRainMm = Math.round(readings.reduce((s, x) => s + (x.precipitationMm || 0), 0) * 10) / 10;
        // Expected: meaningful recent rain (≥10mm) should lift the reading to
        // at least its moving average; an existing >120% anomaly stays flagged.
        const anomalous = r.status === 'v.anomalia_120';
        const notResponding = recentRainMm >= 10 && r.readingM3 < r.avgM3;
        return {
          borehole: r.borehole, fieldId: field.id, readingM3: r.readingM3, avgM3: r.avgM3,
          recentRainMm,
          statusKey: anomalous ? 'climate.corr_flag_anomaly'
            : (notResponding ? 'climate.corr_flag_no_response' : 'climate.corr_ok')
        };
      }).filter(Boolean);
      return { ok: true, status: 200, data: rows };
    },

    /* --- Manual "Report Fire / Smoke" (§2.4, §3a) ---
       Same client-generated-ID idempotency as every other field entry
       (BACKEND_SPEC.md §5). Online submit → critical alert + SMS IMMEDIATELY,
       never batched (§5). Offline submit → queued locally; the alert + SMS
       fire at the moment of sync via syncFireReports — not on the next
       scheduled evaluation cycle. --- */
    async reportFire(token, payload) {
      const auth = await requireRole(token, FIRE_REPORT_ROLES);
      if (!auth.ok) return auth;
      if (db().fireHotspots.some(h => h.id === payload.id)) {
        // Retried sync of the same client ID — "already synced", not an error
        return { ok: true, status: 200, data: { deduplicated: true, id: payload.id } };
      }
      const field = db().fields.find(f => f.id === payload.fieldId) || db().fields[0];
      const coords = parseFieldCoords(field);
      const hotspot = {
        id: payload.id, // client-generated UUID (idempotency key)
        fieldId: field ? field.id : null,
        latitude: payload.latitude != null ? payload.latitude : (coords ? coords.lat : null),
        longitude: payload.longitude != null ? payload.longitude : (coords ? coords.lng : null),
        distanceToFieldKm: 0, // human report is attributed to its field directly
        detectedAt: payload.reportedAt || new Date().toISOString(),
        confidence: 'high', // human observation
        brightness: null,
        source: 'human_report',
        satellite: null,
        reportedBy: auth.claims.sub, // server attributes the reporter, never the client
        photoUrls: payload.photoUrl ? [payload.photoUrl] : null,
        note: payload.note || null,
        severitySeen: payload.severitySeen === 'active_fire' ? 'active_fire' : 'smoke_visible',
        syncStatus: payload.offline ? 'pending' : 'synced'
      };
      db().fireHotspots.unshift(hotspot);
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.FIRE_REPORTED', 'FireHotspot', hotspot.id, 'audit_meta.fire_reported');

      if (hotspot.syncStatus === 'pending') {
        // Filed offline: queued on the device; the alert + SMS fire at sync
        // time (§5) — see syncFireReports below.
        return { ok: true, status: 201, data: { queued: true, hotspot } };
      }
      // Online: IMMEDIATE critical alert + SMS (§5) — no evaluation cycle wait
      const raised = raiseClimateAlert({
        fieldId: hotspot.fieldId, alertType: 'fire_detected', severity: 'critical',
        messageKey: 'climate.msg_fire_detected',
        messageParams: {
          km: hotspot.distanceToFieldKm,
          fieldKey: field ? field.nameKey : null,
          sourceKey: 'climate.source_human'
        },
        hotspot
      });
      return { ok: true, status: 201, data: { queued: false, hotspot, alert: raised.alert, corroborated: raised.corroborated } };
    },

    // POST /sync/fire-reports — flips queued offline fire reports to synced
    // and triggers their critical alert + SMS AT SYNC TIME (§5, §12).
    async syncFireReports(token) {
      const auth = await requireRole(token, FIRE_REPORT_ROLES);
      if (!auth.ok) return auth;
      const queued = db().fireHotspots.filter(h =>
        h.source === 'human_report' && h.syncStatus === 'pending' && h.reportedBy === auth.claims.sub);
      const raised = [];
      queued.forEach(h => {
        h.syncStatus = 'synced';
        const field = db().fields.find(f => f.id === h.fieldId);
        const res = raiseClimateAlert({
          fieldId: h.fieldId, alertType: 'fire_detected', severity: 'critical',
          messageKey: 'climate.msg_fire_detected',
          messageParams: {
            km: h.distanceToFieldKm,
            fieldKey: field ? field.nameKey : null,
            sourceKey: 'climate.source_human'
          },
          hotspot: h
        });
        raised.push({ hotspotId: h.id, alertId: res.alert.id, corroborated: res.corroborated });
      });
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.BATCH_SYNC', 'FireSyncQueue', `FIRE-BATCH-${Date.now()}`, 'audit_meta.fire_reports_synced');
      return { ok: true, status: 200, data: { synced: queued.length, alertsRaised: raised } };
    },

    /* --- AI Copilot endpoints (AI_ASSISTANT_SPEC.md §3.1, §8) --- */

    // POST /ai/sop/ingest [administrator] — ingest the full SOP text without
    // code changes (§3.1). Chunks + embeddings are produced by js/copilot.js
    // (CopilotSOP); this endpoint is the authenticated write path.
    async ingestSopDocument(token, payload) {
      const auth = await requireRole(token, ['administrator']);
      if (!auth.ok) return auth;
      const sop = global.CopilotSOP;
      if (!sop || typeof sop.chunkAndEmbed !== 'function') {
        return { ok: false, status: 500, error: 'errors.copilot_unavailable' };
      }
      const version = String(payload.version || '2.0');
      const chunks = sop.chunkAndEmbed(String(payload.text || ''), version);
      if (chunks.length === 0) {
        return { ok: false, status: 400, error: 'errors.sop_empty' };
      }
      // Upsert by (section_ref, version): re-ingesting a version replaces its chunks
      db().sopChunks = db().sopChunks.filter(c => !(c.version === version && payload.replaceVersion));
      chunks.forEach(c => db().sopChunks.push(c));
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.SOP_INGESTED', 'SopDocument', `v${version}`, 'audit_meta.sop_ingested');
      return { ok: true, status: 201, data: { ingested: chunks.length, version } };
    },

    // GET /sync/status — read-only view of the caller's own pending/synced
    // records (technician field reports; entry-role ops entries + fire reports)
    async getSyncStatus(token) {
      const auth = await requireRole(token, ['farm_technician'].concat(Object.keys(ENTRY_ROLE_UNIT)));
      if (!auth.ok) return auth;
      const sub = auth.claims.sub;
      const items = [];
      if (auth.claims.role === 'farm_technician') {
        db().fieldReports.filter(r => r.technicianId === sub).forEach(r =>
          items.push({ id: r.id, kind: 'field_report', syncStatus: r.syncStatus, submittedAt: r.submittedAt }));
      }
      db().opsEntries.filter(e => e.submittedBy === sub).forEach(e =>
        items.push({ id: e.id, kind: 'ops_entry', syncStatus: e.syncStatus, submittedAt: e.submittedAt }));
      db().fireHotspots.filter(h => h.source === 'human_report' && h.reportedBy === sub).forEach(h =>
        items.push({ id: h.id, kind: 'fire_report', syncStatus: h.syncStatus, submittedAt: h.detectedAt }));
      return { ok: true, status: 200, data: {
        pending: items.filter(i => i.syncStatus === 'pending'),
        syncedCount: items.filter(i => i.syncStatus === 'synced').length
      } };
    },

    // POST /ai/audit — write-ahead copilot query log (§8). Any authenticated
    // user logs their own queries only (user_id comes from the session claims).
    async logCopilotQuery(token, payload) {
      const auth = await requireRole(token, ROLES);
      if (!auth.ok) return auth;
      const entry = {
        id: `AILOG-${Date.now()}-${db().aiAuditLogs.length + 1}`,
        user_id: auth.claims.sub,
        prompt: String(payload.prompt || ''),
        language: payload.language || 'pt',
        used_sop_sections: payload.used_sop_sections || [],
        used_tools: payload.used_tools || [],
        response: String(payload.response || ''),
        latency_ms: payload.latency_ms || 0,
        created_at: new Date().toISOString()
      };
      db().aiAuditLogs.unshift(entry);
      // Mirror into the main AuditLog so Administration sees copilot usage in
      // the same audit surface as everything else (BACKEND_SPEC.md §7)
      writeAuditLog(`${auth.claims.name} (${auth.claims.sub})`, auth.claims.role,
        'audit_actions.COPILOT_QUERY', 'AiAuditLog', entry.id, 'audit_meta.copilot_query');
      return { ok: true, status: 201, data: entry };
    },

    // GET /ai/audit-logs [administrator]
    async listAiAuditLogs(token) {
      const auth = await requireRole(token, ['administrator']);
      if (!auth.ok) return auth;
      return { ok: true, status: 200, data: db().aiAuditLogs };
    },

    /* --- Legacy test hook removed: no browser-side token signer exists in the
           secure Render demo. --- */
    async _signTestToken() {
      return null;
    }
  };

  global.MockAPI = MockAPI;
  global.ROLE_TO_ROUTE = ROLE_TO_ROUTE;
  global.ADMIN_OPS_ENTITY_REGISTRY = ENTITY_REGISTRY;
  global.ADMIN_OPS_UNIT_LEAD_ROLE = UNIT_LEAD_ROLE;
  global.ADMIN_OPS_ENTRY_ROLE_UNIT = ENTRY_ROLE_UNIT;
  // Climate internals exported for the verification suite (unit-testing the
  // fire danger formula and alert pipeline directly, per §12 QA checklist)
  global.CLIMATE_INTERNALS = {
    computeFireDangerScore,
    evaluateFieldClimate,
    raiseClimateAlert,
    haversineKm,
    parseFieldCoords,
    getThreshold,
    sendCriticalAlertSms
  };

})(typeof window !== 'undefined' ? window : globalThis);
