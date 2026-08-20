/* ==========================================================================
   GIS plot mapping — verification suite (deliverables A–D)

   Boots the REAL Express app against a pg-mem PostgreSQL harness (seeded
   from the demo-accounts workbook) and proves:
     1. Geo helpers: ring closing, validation, spherical area sanity
     2. POST /api/plots: editor roles create polygons + crop metadata;
        area is computed SERVER-side, never trusted from the client
     3. Offline idempotency: re-POSTing the same client ID is not a duplicate
     4. RBAC at the API boundary: executive roles (top_management, admin)
        can READ but get 403 on write; anonymous gets 401
     5. PATCH: boundary edit recomputes area; status allowlist enforced;
        invalid geometry rejected with a translatable error key

   Usage:  node tests/plots.test.js
           (honours TEST_ACCOUNTS_XLSX like the other suites)
   ========================================================================== */
'use strict';

const fs = require('fs');
const { ATTACHED_INPUT, extractRows } = require('../scripts/import-demo-accounts');
const { createSeededTestDb } = require('./test-db');
const { createApp } = require('../server');
const FarmGeo = require('../js/geo.js');

const WORKBOOK = process.env.TEST_ACCOUNTS_XLSX || (fs.existsSync('C:/Users/user/Downloads/Test_Accounts2.xlsx') ? 'C:/Users/user/Downloads/Test_Accounts2.xlsx' : ATTACHED_INPUT);
const PORT = Number(process.env.TEST_PORT || 3419);
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.log(`  FAIL  ${label}`); }
}

function cookieFrom(res) {
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

async function api(method, path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: Object.assign(body ? { 'content-type': 'application/json' } : {}, cookie ? { cookie } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function login(employeeNumber, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ employeeNumber, password })
  });
  return cookieFrom(res);
}

// ~1.13 ha square (0.001° side) around FLD-01, Mecuzi, Mozambique
const SQUARE = {
  type: 'Polygon',
  coordinates: [[
    [34.7210, -24.1840], [34.7220, -24.1840], [34.7220, -24.1850],
    [34.7210, -24.1850], [34.7210, -24.1840]
  ]]
};
const EXPECTED_HA = 1.13;

async function main() {
  console.log('\n=== 1. Geo helpers (shared js/geo.js) ===');
  const open = SQUARE.coordinates[0].slice(0, 4); // unclosed, as GPS capture produces
  const closed = FarmGeo.closeRing(open);
  check('walk-and-track ring is auto-closed', closed.length === 5 &&
    closed[0][0] === closed[4][0] && closed[0][1] === closed[4][1]);
  const valid = FarmGeo.validatePlotGeometry({ type: 'Polygon', coordinates: [open] });
  check('unclosed capture validates (normalizer closes it)', valid.ok === true);
  const tooFew = FarmGeo.validatePlotGeometry({ type: 'Polygon', coordinates: [[[34.72, -24.18], [34.73, -24.18]]] });
  check('two points rejected with translatable key', !tooFew.ok && tooFew.error === 'errors.geo_too_few_points');
  const badCoords = FarmGeo.validatePlotGeometry({ type: 'Polygon', coordinates: [[[999, -24.18], [34.72, -24.18], [34.72, -24.19]]] });
  check('out-of-range coordinates rejected', !badCoords.ok && badCoords.error === 'errors.geo_bad_coords');
  const ha = FarmGeo.areaHectares(SQUARE);
  check(`spherical area ≈ ${EXPECTED_HA} ha (±5%)`, Math.abs(ha - EXPECTED_HA) / EXPECTED_HA < 0.05);
  const fromCapture = FarmGeo.polygonFromCapturedLatLngs([[-24.184, 34.721], [-24.184, 34.722], [-24.185, 34.722], [-24.185, 34.721]]);
  check('client capture helper flips [lat,lng] → GeoJSON [lng,lat]',
    fromCapture.ok && fromCapture.geometry.coordinates[0][0][0] === 34.721);

  console.log('\n=== 2. API: auth boundary + editor write path ===');
  const { db } = await createSeededTestDb(WORKBOOK);
  const { app } = createApp({ db, sessionSecret: 'test-session-secret-32-characters-minimum' });
  const server = await new Promise(resolve => {
    const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
  });

  try {
    const rows = extractRows(WORKBOOK).rows;
    const pw = new Map(rows.map(r => [r.employeeNumber, r.password]));
    const cookies = {};
    for (const emp of ['TZ11244045', 'TZ12000010', 'TZ10000001', 'TZ10000099']) {
      if (pw.has(emp)) cookies[emp] = await login(emp, pw.get(emp));
    }
    const tech = cookies.TZ11244045, pm = cookies.TZ12000010, tm = cookies.TZ10000001, admin = cookies.TZ10000099;

    check('anonymous GET /api/plots -> 401', (await api('GET', '/api/plots')).status === 401);

    const create = await api('POST', '/api/plots', {
      id: 'PLOT-UUID-0001', name: 'Talhão Teste Norte', geometry: SQUARE,
      crop: { cropType: 'crops.caju_dwarf', variety: 'Anão precoce', plantingDate: '2026-01-15', stage: 'stages.flowering_maturing' }
    }, tech);
    check('technician POST -> 201 with normalized geometry + server-computed area',
      create.status === 201 && create.body.plot.areaHectares > 0 &&
      Math.abs(create.body.plot.areaHectares - EXPECTED_HA) / EXPECTED_HA < 0.05);
    check('crop metadata stored and joined on the plot',
      create.body.plot.crop && create.body.plot.crop.cropType === 'crops.caju_dwarf' &&
      create.body.plot.crop.stage === 'stages.flowering_maturing');
    check('plot attributed to the session user, never the client payload',
      create.body.plot.createdBy === 'TZ11244045');

    const dupe = await api('POST', '/api/plots', { id: 'PLOT-UUID-0001', name: 'Dup', geometry: SQUARE }, tech);
    check('re-POST same client ID -> 200 deduplicated (offline retry safe)',
      dupe.status === 200 && dupe.body.deduplicated === true);
    const list = await api('GET', '/api/plots', null, tm);
    check('executive GET sees the plot (read-only roles CAN read)',
      list.status === 200 && list.body.plots.length === 1);

    console.log('\n=== 3. RBAC write boundary (executive roles get 403) ===');
    check('top_management POST -> 403', (await api('POST', '/api/plots', { id: 'X-1', name: 'X', geometry: SQUARE }, tm)).status === 403);
    check('administrator POST -> 403', (await api('POST', '/api/plots', { id: 'X-2', name: 'X', geometry: SQUARE }, admin)).status === 403);
    check('top_management PATCH -> 403', (await api('PATCH', '/api/plots/PLOT-UUID-0001', { status: 'fallow' }, tm)).status === 403);
    check('production_manager CAN edit (PATCH status -> 200)',
      (await api('PATCH', '/api/plots/PLOT-UUID-0001', { status: 'harvest' }, pm)).status === 200);
    check('status was actually updated',
      (await api('GET', '/api/plots', null, pm)).body.plots[0].status === 'harvest');

    console.log('\n=== 4. PATCH validation ===');
    const badStatus = await api('PATCH', '/api/plots/PLOT-UUID-0001', { status: 'whatever' }, pm);
    check('unknown status -> 400 errors.plot_bad_status', badStatus.status === 400 && badStatus.body.error === 'errors.plot_bad_status');
    const badGeo = await api('PATCH', '/api/plots/PLOT-UUID-0001', { geometry: { type: 'Polygon', coordinates: [[[1, 2], [3, 4]]] } }, pm);
    check('invalid geometry -> 400 translatable key', badGeo.status === 400 && badGeo.body.error === 'errors.geo_too_few_points');
    const missing = await api('PATCH', '/api/plots/PLOT-NOPE', { status: 'fallow' }, pm);
    check('unknown plot -> 404', missing.status === 404);
    const bigger = await api('PATCH', '/api/plots/PLOT-UUID-0001', {
      geometry: { type: 'Polygon', coordinates: [[[34.721, -24.184], [34.724, -24.184], [34.724, -24.187], [34.721, -24.187]]] }
    }, pm);
    check('boundary edit recomputes area server-side (~10 ha)', bigger.status === 200 && bigger.body.plot.areaHectares > 8);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }

  console.log(`\n=========================================`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Plots test suite crashed:', err);
  process.exit(1);
});
