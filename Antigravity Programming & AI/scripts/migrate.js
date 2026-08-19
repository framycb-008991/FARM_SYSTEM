'use strict';

const { createDatabase } = require('../lib/demo-db');

async function main() {
  const db = createDatabase();
  try {
    await db.migrate();
    console.log(JSON.stringify({ ok: true, migrated: ['demo_accounts', 'sessions'] }, null, 2));
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
