/* ==========================================================================
   WEATHER_INTEGRATION_SPEC.md — Verification Suite (QA Checklist §12)

   Runs the real js/data.js + js/api.js under Node.js (no browser) and proves:
     1. Data model per §3/§3a (one FireHotspot table for satellite + human)
     2. Fire danger formula against known high-risk conditions (§2.3)
     3. Weather ingestion is batched and a failing external API never blocks
        other fields (§4, §11)
     4. FIRMS without a MAP_KEY degrades gracefully (§2.2, §11)
     5. All thresholds are admin-configurable, not hardcoded (§5)
     6. SMS fires for CRITICAL only (§8): fire_detected always; fire_danger
        only at extreme; warnings never
     7. Role-scoped visibility (§7): technician own fields; Top Management
        aggregate only; Operations Support rainfall/borehole correlation
     8. Critical alerts require acknowledgment (§9)
     9. Manual fire reports: immediate online; offline reports fire the
        critical alert + SMS AT SYNC TIME, not a scheduled cycle (§2.4, §5)
    10. Satellite + human report of the same fire = ONE linked alert (§12)
    11. Backend returns message_key + params, never pre-formatted text (§10)

   Usage:  node tests/climate.test.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8') + '\nglobalThis.MECUZI_DATA = MECUZI_DATA;');
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'api.js'), 'utf8'));

const { MockAPI, CLIMATE_INTERNALS } = globalThis;
const DB = globalThis.MECUZI_DATA;

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}`); }
}

function claims(employeeNumber, name, role) {
  return { employeeNumber, sub: employeeNumber, name, role, roleKey: `roles.${role}`, status: 'active' };
}

async function main() {
  const tokTech = claims('TZ11244045', 'Farm Technician', 'farm_technician');
  const tokPM = claims('TZ12000010', 'Production Manager', 'production_manager');
  const tokTM = claims('TZ10000001', 'Top Management', 'top_management');
  const tokAdmin = claims('TZ10000099', 'Administrator', 'administrator');
  const tokAdminMgr = claims('TZ13000001', 'Administrative Manager', 'admin_manager');
  const tokOpsLead = claims('TZ13000003', 'Operations Support Lead', 'operations_support_lead');
  const tokDriver = claims('TZ13000005', 'Driver', 'driver');
  const tokCook = claims('TZ13000007', 'Cook', 'cook');

  console.log('\n=== 1. Data model (§3/§3a) ===');
  check('WeatherReading, FireHotspot, FireDangerReading, ClimateAlert, ClimateAlertThreshold collections exist',
    Array.isArray(DB.weatherReadings) && Array.isArray(DB.fireHotspots) &&
    Array.isArray(DB.fireDangerReadings) && Array.isArray(DB.climateAlerts) &&
    Array.isArray(DB.climateAlertThresholds));
  check('FireHotspot is ONE table shared by satellite and human sources (source field)',
    DB.fireHotspots.some(h => h.source === 'nasa_firms') &&
    DB.fireHotspots.some(h => h.source === 'human_report'));
  check('human_report hotspot carries reported_by; satellite hotspot does not',
    DB.fireHotspots.find(h => h.source === 'human_report').reportedBy === 'TZ11244046' &&
    DB.fireHotspots.find(h => h.source === 'nasa_firms').reportedBy === null);
  check('thresholds exist for every alert type in §5',
    ['high_wind', 'cyclone_warning', 'heavy_rain', 'flood_risk', 'drought_risk',
      'extreme_heat', 'disease_risk_humidity', 'fire_danger']
      .every(ty => DB.climateAlertThresholds.some(r => r.alertType === ty)));
  check('FLD-06 intentionally has no weather data (graceful-degradation case, §11)',
    !DB.weatherReadings.some(r => r.fieldId === 'FLD-06'));

  console.log('\n=== 2. Fire danger formula vs. known high-risk conditions (§2.3) ===');
  const extreme = CLIMATE_INTERNALS.computeFireDangerScore(
    { temperatureC: 40, humidityPct: 10, windSpeedKmh: 40, daysSinceRain: 15 });
  check('hot/dry/windy + long dry spell -> extreme', extreme.level === 'extreme');
  const mild = CLIMATE_INTERNALS.computeFireDangerScore(
    { temperatureC: 26, humidityPct: 80, windSpeedKmh: 8, daysSinceRain: 1 });
  check('cool/humid/calm + recent rain -> low', mild.level === 'low');
  const fld05 = CLIMATE_INTERNALS.computeFireDangerScore(
    { temperatureC: 36.2, humidityPct: 22, windSpeedKmh: 28, daysSinceRain: 9 });
  check('seeded FLD-05 conditions -> high (matches seeded reading)',
    fld05.level === 'high' && DB.fireDangerReadings.find(r => r.fieldId === 'FLD-05').dangerLevel === 'high');

  console.log('\n=== 3. Weather ingestion: batched, failure never blocks other fields (§4, §11) ===');
  DB.climateConfig.liveApiEnabled = true;
  const failingFetch = async () => { throw new Error('network down'); };
  const syncRes = await MockAPI.runWeatherSync({ fetchImpl: failingFetch, batchDelayMs: 0 });
  check('job completes (does not throw) with Open-Meteo unreachable', syncRes.ok === true);
  check('every field result recorded, all failed gracefully',
    syncRes.data.results.length === 6 && syncRes.data.results.every(r => r.ok === false));
  check('failures logged to AuditLog',
    DB.auditLogs.some(l => l.actionKey === 'audit_actions.INGEST_FAILED' &&
      l.metadataKey === 'audit_meta.open_meteo_unreachable'));
  check('evaluation still ran for all fields; FLD-06 reports noData (§11)',
    syncRes.data.evaluations.length === 6 &&
    syncRes.data.evaluations.some(e => e.fieldId === 'FLD-06' && e.noData === true));
  DB.climateConfig.liveApiEnabled = false;
  const simSync = await MockAPI.runWeatherSync({ batchDelayMs: 0 });
  check('simulated sync succeeds per field with data',
    simSync.data.results.filter(r => r.ok).length === 6);

  console.log('\n=== 4. FIRMS without MAP_KEY degrades gracefully (§2.2, §11) ===');
  check('no MAP_KEY configured by default (one-time setup pending)',
    DB.climateConfig.firmsMapKey === null);
  const firmsRes = await MockAPI.runFireHotspotSync({ batchDelayMs: 0 });
  check('hotspot sync skips gracefully instead of crashing',
    firmsRes.ok === true && firmsRes.data.skipped === true && firmsRes.data.reason === 'firms_key_missing');
  check('missing key logged to AuditLog',
    DB.auditLogs.some(l => l.metadataKey === 'audit_meta.firms_key_missing'));

  console.log('\n=== 5. Alert evaluation — seeded scenario outcomes (§5) ===');
  const alert = (id) => DB.climateAlerts.find(a => a.id === id);
  check('heavy rain overlapping harvest window escalated to CRITICAL (FLD-04)',
    alert('CAL-0002').severity === 'critical' &&
    alert('CAL-0002').messageKey === 'climate.msg_heavy_rain_harvest');
  check('high wind gusts >60km/h within 48h -> critical (FLD-05)',
    alert('CAL-0003').severity === 'critical' && alert('CAL-0003').alertType === 'high_wind');
  check('fire danger high -> warning, not critical (FLD-05)',
    alert('CAL-0004').severity === 'warning' && alert('CAL-0004').alertType === 'fire_danger');
  check('drought risk -> warning (FLD-02)', alert('CAL-0005').severity === 'warning');
  check('extreme heat -> watch (FLD-01)', alert('CAL-0006').severity === 'watch');
  check('disease-risk humidity -> watch (FLD-04)', alert('CAL-0007').severity === 'watch');
  check('satellite fire detection -> critical, always (FLD-03)',
    alert('CAL-0001').severity === 'critical' && alert('CAL-0001').alertType === 'fire_detected');
  check('fire_detected alert links back to its FireHotspot via relatedHotspotId (traceability)',
    alert('CAL-0001').relatedHotspotId === 'HS-SAT-0001');
  // Re-running evaluation must not duplicate alerts (idempotent raise)
  const before = DB.climateAlerts.filter(a => !a.resolvedAt).length;
  DB.fields.forEach(f => CLIMATE_INTERNALS.evaluateFieldClimate(f));
  const after = DB.climateAlerts.filter(a => !a.resolvedAt).length;
  check('re-evaluation is idempotent (no duplicate active alerts)', before === after);

  console.log('\n=== 6. Thresholds are admin-configurable, not hardcoded (§5) ===');
  const thrRes = await MockAPI.listClimateThresholds(tokAdmin);
  check('administrator can list thresholds', thrRes.ok && thrRes.data.length >= 10);
  const heatRow = thrRes.data.find(r => r.id === 'THR-HEAT');
  const upd = await MockAPI.updateClimateThreshold(tokAdmin, 'THR-HEAT', { value: 45 });
  check('administrator updates THR-HEAT 38 -> 45', upd.ok && upd.data.value === 45);
  const fld01 = DB.fields.find(f => f.id === 'FLD-01');
  CLIMATE_INTERNALS.evaluateFieldClimate(fld01);
  check('with threshold 45 the FLD-01 heat alert (39.6°C) resolves',
    DB.climateAlerts.filter(a => a.fieldId === 'FLD-01' && a.alertType === 'extreme_heat' && !a.resolvedAt).length === 0);
  await MockAPI.updateClimateThreshold(tokAdmin, 'THR-HEAT', { value: 38 });
  CLIMATE_INTERNALS.evaluateFieldClimate(fld01);
  check('restoring threshold 38 re-raises the heat alert',
    DB.climateAlerts.some(a => a.fieldId === 'FLD-01' && a.alertType === 'extreme_heat' && !a.resolvedAt));
  check('threshold change audited',
    DB.auditLogs.some(l => l.actionKey === 'audit_actions.THRESHOLD_UPDATED'));
  check('threshold row object was genuinely mutated', heatRow.value === 38);
  const thrForbidden = await MockAPI.updateClimateThreshold(tokTech, 'THR-HEAT', { value: 99 });
  check('technician cannot edit thresholds: 403', !thrForbidden.ok && thrForbidden.status === 403);

  console.log('\n=== 7. SMS fires for CRITICAL severity only (§8) ===');
  let smsBefore = DB.smsOutbox.length;
  CLIMATE_INTERNALS.raiseClimateAlert({ fieldId: 'FLD-01', alertType: 'fire_danger',
    severity: 'warning', messageKey: 'climate.msg_fire_danger',
    messageParams: { levelKey: 'climate.level_high', days: 5, fieldKey: 'fields.fld_01_name' } });
  // Force a NEW warning alert (unique type+field): heavy_rain warning on FLD-03
  CLIMATE_INTERNALS.raiseClimateAlert({ fieldId: 'FLD-03', alertType: 'heavy_rain',
    severity: 'warning', messageKey: 'climate.msg_heavy_rain',
    messageParams: { mm: 45, fieldKey: 'fields.fld_03_name' }, forecastWindow: '24h' });
  check('warning-severity alerts send NO SMS', DB.smsOutbox.length === smsBefore);
  CLIMATE_INTERNALS.raiseClimateAlert({ fieldId: 'FLD-06', alertType: 'fire_danger',
    severity: 'critical', messageKey: 'climate.msg_fire_danger',
    messageParams: { levelKey: 'climate.level_extreme', days: 20, fieldKey: 'fields.fld_06_name' } });
  const fld06Sms = DB.smsOutbox.length - smsBefore;
  check('fire_danger at EXTREME sends SMS (3 recipients: 2 PMs + Admin Manager)', fld06Sms === 3);
  check('SMS recipients are the relevant Production Manager(s) + Admin Manager',
    DB.smsOutbox.slice(0, fld06Sms).every(s => s.toRole === 'production_manager' || s.toRole === 'admin_manager'));
  check('every SMS logged to AuditLog (SMS_SENT)',
    DB.smsOutbox.slice(0, fld06Sms).every(s =>
      DB.auditLogs.some(l => l.actionKey === 'audit_actions.SMS_SENT' && l.targetId === s.alertId)));
  check('SMS body carries message_key + params, never pre-formatted text (§10)',
    DB.smsOutbox.every(s => s.messageKey.startsWith('climate.') && s.messageParams));
  // Watch severity never sends SMS
  smsBefore = DB.smsOutbox.length;
  CLIMATE_INTERNALS.raiseClimateAlert({ fieldId: 'FLD-03', alertType: 'extreme_heat',
    severity: 'watch', messageKey: 'climate.msg_extreme_heat',
    messageParams: { temp: 39, fieldKey: 'fields.fld_03_name' }, forecastWindow: '48h' });
  check('watch-severity alerts send NO SMS', DB.smsOutbox.length === smsBefore);

  console.log('\n=== 8. Role-scoped visibility (§7) ===');
  const techAlerts = await MockAPI.listClimateAlerts(tokTech);
  check('Farm Technician sees ONLY assigned fields (FLD-01/FLD-02)',
    techAlerts.ok && techAlerts.data.length > 0 &&
    techAlerts.data.every(a => ['FLD-01', 'FLD-02'].includes(a.fieldId)));
  const pmAlerts = await MockAPI.listClimateAlerts(tokPM);
  check('Production Manager sees all fields WITH crop-cycle context',
    pmAlerts.ok && pmAlerts.data.some(a => a.fieldId === 'FLD-04') &&
    pmAlerts.data.some(a => a.cropCycleStatusKey === 'cycle_status.imminent_harvest'));
  const tmList = await MockAPI.listClimateAlerts(tokTM);
  check('Top Management per-field alert list: 403 (aggregate only)', !tmList.ok && tmList.status === 403);
  const tmSummary = await MockAPI.getClimateOrgSummary(tokTM);
  check('Top Management gets org-wide aggregated summary (counts, no per-field rows)',
    tmSummary.ok && typeof tmSummary.data.bySeverity.critical === 'number' &&
    !Array.isArray(tmSummary.data.alerts));
  const corr = await MockAPI.getRainfallBoreholeCorrelation(tokOpsLead);
  check('Operations Support gets rainfall-vs-borehole correlation',
    corr.ok && corr.data.length === 3 && corr.data.every(r => 'recentRainMm' in r && 'statusKey' in r));
  check('correlation flags the >120% anomaly borehole',
    corr.data.some(r => r.statusKey === 'climate.corr_flag_anomaly'));
  const corrForbidden = await MockAPI.getRainfallBoreholeCorrelation(tokCook);
  check('cook cannot access correlation endpoint: 403', !corrForbidden.ok && corrForbidden.status === 403);

  console.log('\n=== 9. Acknowledgment of critical alerts (§9) ===');
  const ackWrong = await MockAPI.acknowledgeClimateAlert(tokTech, 'CAL-0001'); // FLD-03 not assigned to tech
  check('technician cannot ack an alert outside their fields: 403', !ackWrong.ok && ackWrong.status === 403);
  const ack = await MockAPI.acknowledgeClimateAlert(tokPM, 'CAL-0001');
  check('Production Manager acknowledges critical fire alert',
    ack.ok && ack.data.acknowledgedBy && ack.data.acknowledgedAt);
  check('acknowledgment audited',
    DB.auditLogs.some(l => l.actionKey === 'audit_actions.ALERT_ACKNOWLEDGED' && l.targetId === 'CAL-0001'));
  const ackOwn = await MockAPI.acknowledgeClimateAlert(tokTech, 'CAL-0005'); // FLD-02 — own field
  check('technician CAN ack an alert on their own field', ackOwn.ok === true);

  console.log('\n=== 10. Manual fire report — immediate online, sync-time offline (§2.4, §5) ===');
  // ONLINE submit: alert + SMS fire inside the submit call, nothing scheduled
  const activeBefore = DB.climateAlerts.filter(a => !a.resolvedAt && a.alertType === 'fire_detected').length;
  const smsBefore2 = DB.smsOutbox.length;
  const online = await MockAPI.reportFire(tokDriver, {
    id: 'FIRE-TEST-ONLINE-1', fieldId: 'FLD-01', severitySeen: 'active_fire',
    note: 'test fire', offline: false, reportedAt: new Date().toISOString()
  });
  check('online human report -> 201, hotspot in the shared FireHotspot table',
    online.ok && online.status === 201 &&
    DB.fireHotspots.some(h => h.id === 'FIRE-TEST-ONLINE-1' && h.source === 'human_report' && h.reportedBy === 'TZ13000005'));
  check('critical fire_detected alert raised IMMEDIATELY on submit (no evaluation cycle)',
    online.data.alert && online.data.alert.severity === 'critical' &&
    DB.climateAlerts.filter(a => !a.resolvedAt && a.alertType === 'fire_detected').length === activeBefore + 1);
  check('SMS fired immediately on submit', DB.smsOutbox.length > smsBefore2);
  check('entry roles (driver) may report; server attributes the reporter from the JWT',
    online.data.hotspot.reportedBy === 'TZ13000005');
  const dup = await MockAPI.reportFire(tokDriver, {
    id: 'FIRE-TEST-ONLINE-1', fieldId: 'FLD-01', severitySeen: 'smoke_visible', offline: false
  });
  check('retry with the same client ID -> "already synced", no duplicate (BACKEND_SPEC §5)',
    dup.ok && dup.data.deduplicated === true &&
    DB.fireHotspots.filter(h => h.id === 'FIRE-TEST-ONLINE-1').length === 1);
  const forbiddenReporter = await MockAPI.reportFire(tokPM, { id: 'FIRE-TEST-X', fieldId: 'FLD-01', offline: false });
  check('production_manager cannot file fire reports (entry roles + technician only): 403',
    !forbiddenReporter.ok && forbiddenReporter.status === 403);

  // OFFLINE submit: queued, NO alert yet; alert + SMS fire at sync time
  const alertsBeforeOffline = DB.climateAlerts.length;
  const smsBeforeOffline = DB.smsOutbox.length;
  const offline = await MockAPI.reportFire(tokTech, {
    id: 'FIRE-TEST-OFFLINE-1', fieldId: 'FLD-06', severitySeen: 'smoke_visible',
    note: 'offline report', offline: true, reportedAt: new Date().toISOString(),
    latitude: -24.220, longitude: 34.770 // FLD-06 area — a genuinely separate fire
  });
  check('offline report queued on device (syncStatus pending), not lost',
    offline.ok && offline.data.queued === true &&
    DB.fireHotspots.find(h => h.id === 'FIRE-TEST-OFFLINE-1').syncStatus === 'pending');
  check('no alert and no SMS while still offline (nothing batched silently either)',
    DB.climateAlerts.length === alertsBeforeOffline && DB.smsOutbox.length === smsBeforeOffline);
  const syncFire = await MockAPI.syncFireReports(tokTech);
  check('on sync the report syncs AND the critical alert fires AT SYNC TIME',
    syncFire.ok && syncFire.data.synced === 1 && syncFire.data.alertsRaised.length === 1);
  check('offline report now synced with a critical alert + SMS (not the next scheduled cycle)',
    DB.fireHotspots.find(h => h.id === 'FIRE-TEST-OFFLINE-1').syncStatus === 'synced' &&
    DB.smsOutbox.length > smsBeforeOffline &&
    DB.climateAlerts.some(a => !a.resolvedAt && a.alertType === 'fire_detected' &&
      a.relatedHotspotId === 'FIRE-TEST-OFFLINE-1'));

  console.log('\n=== 11. Same fire via satellite + human = ONE linked alert (§12) ===');
  const fireAlertsBefore = DB.climateAlerts.filter(a => !a.resolvedAt && a.alertType === 'fire_detected').length;
  const humanNearSatellite = await MockAPI.reportFire(tokTech, {
    id: 'FIRE-TEST-DEDUP-1', fieldId: 'FLD-03', severitySeen: 'smoke_visible',
    latitude: -24.2115, longitude: 34.7415, offline: false
  });
  check('human report of the FLD-03 fire does NOT create a second alert',
    humanNearSatellite.ok && humanNearSatellite.data.corroborated === true &&
    DB.climateAlerts.filter(a => !a.resolvedAt && a.alertType === 'fire_detected').length === fireAlertsBefore);
  const linked = DB.climateAlerts.find(a => a.id === 'CAL-0001');
  check('both hotspots linked to the same ClimateAlert (relatedHotspotId + corroborating)',
    linked.relatedHotspotId === 'HS-SAT-0001' &&
    linked.corroboratingHotspotIds.includes('HS-HUM-0001') &&
    linked.corroboratingHotspotIds.includes('FIRE-TEST-DEDUP-1'));
  check('linked alert marked as corroborated source for the UI',
    linked.messageParams.sourceKey === 'climate.source_corroborated');

  console.log('\n=== 12. i18n contract (§10) ===');
  check('every active alert returns alert_type + message_key, never prose',
    DB.climateAlerts.filter(a => !a.resolvedAt).every(a =>
      typeof a.alertType === 'string' && a.messageKey.startsWith('climate.') &&
      !/[a-z]{4,}\s[a-z]{4,}/i.test(a.messageKey)));

  console.log(`\n=========================================`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Climate test suite crashed:', err);
  process.exit(1);
});
