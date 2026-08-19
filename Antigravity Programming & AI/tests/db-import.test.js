/* ==========================================================================
   PostgreSQL demo account migration/import verification.

   Uses pg-mem only as a local PostgreSQL-compatible harness because this
   machine has no DATABASE_URL. Production code still uses node-postgres +
   Render's DATABASE_URL.
   ========================================================================== */
'use strict';

const fs = require('fs');
const { createSeededTestDb } = require('./test-db');
const { ATTACHED_INPUT, extractRows, importAccounts } = require('../scripts/import-demo-accounts');

const WORKBOOK = process.env.TEST_ACCOUNTS_XLSX || (fs.existsSync('C:/Users/user/Downloads/Test_Accounts2.xlsx') ? 'C:/Users/user/Downloads/Test_Accounts2.xlsx' : ATTACHED_INPUT);

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.log(`  FAIL  ${label}`); }
}

async function main() {
  console.log('\n=== PostgreSQL schema + workbook import ===');
  const parsed = extractRows(WORKBOOK);
  check('workbook rows filtered to usable TZ accounts', parsed.rows.length >= 12 && parsed.rows.every(r => /^TZ\d{8}$/.test(r.employeeNumber)));

  const { db, accounts } = await createSeededTestDb(WORKBOOK);
  try {
    const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('demo_accounts', 'sessions')");
    check('migration creates demo_accounts and sessions tables',
      ['demo_accounts', 'sessions'].every(name => tables.rows.some(row => row.table_name === name)));
    check('import upserts all workbook accounts into demo_accounts', await db.countAccounts() === accounts.length);
    check('passwords are stored as salted scrypt hashes, not workbook plaintext',
      accounts.every(a => a.password.algorithm === 'scrypt' && a.password.salt && a.password.hash && !parsed.rows.some(r => r.password === a.password.hash)));

    const top = await db.findAccount(parsed.rows[0].employeeNumber);
    check('account lookup returns server-safe role metadata', top && top.role && top.roleKey && top.password.algorithm === 'scrypt');

    const dryRun = await importAccounts({ input: WORKBOOK, dryRun: true });
    check('import script supports non-secret dry-run summary', dryRun.ok && dryRun.dryRun === true && dryRun.accountCount === accounts.length && !JSON.stringify(dryRun).includes(parsed.rows[0].password));
  } finally {
    await db.close();
  }

  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
