'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { readWorkbook } = require('./xlsx-simple');
const { createDatabase } = require('../lib/demo-db');

const scrypt = promisify(crypto.scrypt);

const DEFAULT_INPUT = 'C:/Users/user/Downloads/Test_Accounts2.xlsx';
const ATTACHED_INPUT = 'C:/Users/user/AppData/Local/hermes/kanban/boards/farm-system/attachments/t_448d614b/Test_Accounts2.xlsx';

const ROLE_MAP = new Map([
  ['top management', 'top_management'],
  ['farm technician', 'farm_technician'],
  ['production manager', 'production_manager'],
  ['administrator', 'administrator'],
  ['administrative manager', 'admin_manager'],
  ['admin manager', 'admin_manager'],
  ['finance & compliance lead', 'finance_compliance_lead'],
  ['finance and compliance lead', 'finance_compliance_lead'],
  ['operations support lead', 'operations_support_lead'],
  ['hr & facility services lead', 'hr_facility_lead'],
  ['hr and facility services lead', 'hr_facility_lead'],
  ['staff & facility services lead', 'hr_facility_lead'],
  ['staff and facility services lead', 'hr_facility_lead'],
  ['driver', 'driver'],
  ['warehouse assistant', 'warehouse_assistant'],
  ['cook', 'cook'],
  ['cleaning assistant', 'cleaning_assistant']
]);

function parseArgs(argv) {
  const args = {
    input: fs.existsSync(DEFAULT_INPUT) ? DEFAULT_INPUT : DEFAULT_INPUT,
    dryRun: false,
    migrate: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--input') { args.input = val; i += 1; }
    else if (key === '--dry-run') args.dryRun = true;
    else if (key === '--migrate') args.migrate = true;
    else if (key === '--help') {
      console.log('Usage: node scripts/import-demo-accounts.js [--input workbook.xlsx] [--migrate] [--dry-run]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }
  return args;
}

function normalize(value) {
  return String(value == null ? '' : value).trim();
}

function roleFor(functionName) {
  const key = normalize(functionName).toLowerCase().replace(/\s+/g, ' ');
  const role = ROLE_MAP.get(key);
  if (!role) throw new Error(`Unsupported Function value: ${functionName}`);
  return role;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const keyLength = 64;
  const params = { N: 16384, r: 8, p: 1, keyLength };
  const derived = await scrypt(String(password), salt, keyLength, { N: params.N, r: params.r, p: params.p });
  return { algorithm: 'scrypt', salt, hash: derived.toString('base64url'), params };
}

function extractRows(workbookPath) {
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Required workbook missing: ${workbookPath}`);
  }
  const workbook = readWorkbook(workbookPath);
  const sheet = workbook.sheets.find(s => s.name === 'Test Accounts') || workbook.sheets[0];
  if (!sheet) throw new Error('No worksheets found in workbook.');
  const out = [];
  const seen = new Set();
  for (const row of sheet.rows) {
    const employeeNumber = normalize(row[0]);
    const functionName = normalize(row[1]);
    const password = normalize(row[2]);
    if (!/^TZ\d{8}$/i.test(employeeNumber)) continue;
    if (!functionName || !password) continue;
    const normalizedEmployee = employeeNumber.toUpperCase();
    if (seen.has(normalizedEmployee)) throw new Error(`Duplicate employee number: ${normalizedEmployee}`);
    seen.add(normalizedEmployee);
    out.push({ employeeNumber: normalizedEmployee, functionName, password });
  }
  return { sheetName: sheet.name, rows: out };
}

async function buildAccounts(rows) {
  const accounts = [];
  for (const row of rows) {
    const role = roleFor(row.functionName);
    accounts.push({
      employeeNumber: row.employeeNumber,
      name: row.functionName,
      functionName: row.functionName,
      role,
      roleKey: `roles.${role}`,
      status: 'active',
      password: await hashPassword(row.password)
    });
  }
  return accounts;
}

async function importAccounts({ input, dryRun = false, migrate = false, db = null }) {
  const { sheetName, rows } = extractRows(input);
  if (rows.length === 0) throw new Error('No usable account rows found in workbook.');
  const accounts = await buildAccounts(rows);
  if (dryRun) {
    return { ok: true, dryRun: true, sheetName, accountCount: accounts.length, roles: accounts.map(a => a.role) };
  }
  const database = db || createDatabase();
  try {
    if (migrate) await database.migrate();
    await database.upsertAccounts(accounts);
    const dbCount = await database.countAccounts();
    return { ok: true, dryRun: false, sheetName, accountCount: accounts.length, dbAccountCount: dbCount, roles: accounts.map(a => a.role) };
  } finally {
    if (!db && database.close) await database.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await importAccounts(args);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { ROLE_MAP, ATTACHED_INPUT, roleFor, extractRows, buildAccounts, importAccounts };
