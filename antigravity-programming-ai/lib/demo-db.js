'use strict';

const crypto = require('crypto');
const { Pool: PgPool } = require('pg');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS demo_accounts (
  employee_number TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  function_name TEXT NOT NULL,
  role TEXT NOT NULL,
  role_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  password_algorithm TEXT NOT NULL DEFAULT 'scrypt',
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_params JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  sid_hash TEXT PRIMARY KEY,
  employee_number TEXT NOT NULL REFERENCES demo_accounts(employee_number) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  role_key TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
`;

function sslForDatabaseUrl(databaseUrl) {
  if (process.env.DATABASE_SSL === 'false' || process.env.DATABASE_SSL === '0') return false;
  if (process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1') return { rejectUnauthorized: false };
  return /sslmode=require|render\.com|oregon-postgres|singapore-postgres|frankfurt-postgres|ohio-postgres/i.test(databaseUrl)
    ? { rejectUnauthorized: false }
    : false;
}

function publicAccount(row) {
  if (!row) return null;
  return {
    employeeNumber: row.employee_number,
    name: row.name,
    functionName: row.function_name,
    role: row.role,
    roleKey: row.role_key,
    status: row.status,
    password: {
      algorithm: row.password_algorithm,
      salt: row.password_salt,
      hash: row.password_hash,
      params: typeof row.password_params === 'string' ? JSON.parse(row.password_params) : row.password_params
    }
  };
}

function hashSessionId(sessionId) {
  return crypto.createHash('sha256').update(String(sessionId)).digest('hex');
}

function createDatabase(options = {}) {
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL;
  const PoolClass = options.Pool || PgPool;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for PostgreSQL-backed demo authentication.');
  }
  const pool = options.pool || new PoolClass({
    connectionString: databaseUrl,
    ssl: options.ssl === undefined ? sslForDatabaseUrl(databaseUrl) : options.ssl,
    max: Number(process.env.PGPOOL_MAX || 5)
  });

  async function query(text, params) {
    return pool.query(text, params);
  }

  return {
    query,
    async migrate() {
      await query(SCHEMA_SQL);
    },
    async pruneExpiredSessions(now = new Date()) {
      await query('DELETE FROM sessions WHERE expires_at <= $1', [now]);
    },
    async upsertAccounts(accounts) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const account of accounts) {
          await client.query(`
            INSERT INTO demo_accounts (
              employee_number, name, function_name, role, role_key, status,
              password_algorithm, password_salt, password_hash, password_params, imported_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
            ON CONFLICT (employee_number) DO UPDATE SET
              name = EXCLUDED.name,
              function_name = EXCLUDED.function_name,
              role = EXCLUDED.role,
              role_key = EXCLUDED.role_key,
              status = EXCLUDED.status,
              password_algorithm = EXCLUDED.password_algorithm,
              password_salt = EXCLUDED.password_salt,
              password_hash = EXCLUDED.password_hash,
              password_params = EXCLUDED.password_params,
              imported_at = NOW()
          `, [
            account.employeeNumber,
            account.name,
            account.functionName,
            account.role,
            account.roleKey,
            account.status || 'active',
            account.password.algorithm,
            account.password.salt,
            account.password.hash,
            JSON.stringify(account.password.params)
          ]);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async findAccount(employeeNumber) {
      const res = await query('SELECT * FROM demo_accounts WHERE employee_number = $1', [String(employeeNumber || '').toUpperCase()]);
      return publicAccount(res.rows[0]);
    },
    async findAccountsByRoles(roles) {
      const required = Array.isArray(roles) ? roles : [];
      if (!required.length) return [];
      const res = await query('SELECT * FROM demo_accounts WHERE role = ANY($1::text[]) ORDER BY employee_number', [required]);
      return res.rows.map(publicAccount);
    },
    async countAccounts() {
      const res = await query('SELECT COUNT(*)::int AS count FROM demo_accounts');
      return Number(res.rows[0].count);
    },
    async createSession(sessionId, account, expiresAt, createdAt = new Date()) {
      await query(`
        INSERT INTO sessions (sid_hash, employee_number, name, role, role_key, status, created_at, expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        hashSessionId(sessionId), account.employeeNumber, account.name, account.role,
        account.roleKey, account.status || 'active', createdAt, expiresAt
      ]);
      return {
        id: sessionId,
        employeeNumber: account.employeeNumber,
        name: account.name,
        role: account.role,
        roleKey: account.roleKey,
        status: account.status || 'active',
        createdAt: createdAt.getTime(),
        expiresAt: expiresAt.getTime()
      };
    },
    async getSession(sessionId, now = new Date()) {
      if (!sessionId) return null;
      const res = await query(`
        SELECT employee_number, name, role, role_key, status, created_at, expires_at
        FROM sessions
        WHERE sid_hash = $1
      `, [hashSessionId(sessionId)]);
      const row = res.rows[0];
      if (!row) return null;
      if (new Date(row.expires_at) <= now) {
        await query('DELETE FROM sessions WHERE sid_hash = $1', [hashSessionId(sessionId)]);
        return null;
      }
      return {
        employeeNumber: row.employee_number,
        name: row.name,
        role: row.role,
        roleKey: row.role_key,
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
        expiresAt: new Date(row.expires_at).getTime()
      };
    },
    async deleteSession(sessionId) {
      if (!sessionId) return;
      await query('DELETE FROM sessions WHERE sid_hash = $1', [hashSessionId(sessionId)]);
    },
    async close() {
      await pool.end();
    }
  };
}

module.exports = { SCHEMA_SQL, createDatabase, hashSessionId };
