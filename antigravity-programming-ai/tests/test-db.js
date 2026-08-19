'use strict';

const { newDb } = require('pg-mem');
const { createDatabase } = require('../lib/demo-db');
const { extractRows, buildAccounts } = require('../scripts/import-demo-accounts');

async function createSeededTestDb(workbookPath) {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const pg = mem.adapters.createPg();
  const db = createDatabase({ Pool: pg.Pool, databaseUrl: 'postgres://test/test', ssl: false });
  await db.migrate();
  const { sheetName, rows } = extractRows(workbookPath);
  const accounts = await buildAccounts(rows);
  await db.upsertAccounts(accounts);
  return { db, sheetName, rows, accounts };
}

module.exports = { createSeededTestDb };
