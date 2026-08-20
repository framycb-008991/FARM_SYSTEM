'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const cookieParser = require('cookie-parser');
const { createDatabase } = require('./lib/demo-db');

const scrypt = promisify(crypto.scrypt);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_COOKIE = 'mecuzi_demo_session';
const SESSION_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const DEMO_SELECTOR_ROLES = [
  { role: 'top_management', labelKey: 'auth.demo.option_top_management' },
  { role: 'farm_technician', labelKey: 'auth.demo.option_farm_technician' },
  { role: 'production_manager', labelKey: 'auth.demo.option_production_manager' },
  { role: 'administrator', labelKey: 'auth.demo.option_administrator' },
  { role: 'admin_manager', labelKey: 'auth.demo.option_admin_manager' },
  { role: 'driver', labelKey: 'auth.demo.option_driver' }
];

const MOCK_DEMO_ACCOUNTS = DEMO_SELECTOR_ROLES.map(item => ({
  employeeNumber: `DEMO-${item.role}`,
  name: item.labelKey,
  functionName: item.labelKey,
  role: item.role,
  roleKey: `roles.${item.role}`,
  status: 'active'
}));

function requireSecret(name, override) {
  const value = override || process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set to at least 32 characters.`);
  }
  return value;
}

function publicEmployee(account) {
  return {
    employeeNumber: account.employeeNumber,
    name: account.name,
    functionName: account.functionName || account.name,
    role: account.role,
    roleKey: account.roleKey,
    status: account.status || 'active'
  };
}

function makeRateLimiter() {
  const buckets = new Map();
  function rateKey(req, employeeNumber) {
    return `${req.ip || req.socket.remoteAddress || 'unknown'}:${String(employeeNumber || '').toUpperCase()}`;
  }
  return {
    check(req, employeeNumber) {
      const key = rateKey(req, employeeNumber);
      const now = Date.now();
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
        buckets.set(key, bucket);
      }
      if (bucket.count >= RATE_LIMIT_MAX) {
        return { limited: true, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
      }
      return { limited: false };
    },
    recordFailure(req, employeeNumber) {
      const key = rateKey(req, employeeNumber);
      const now = Date.now();
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
    },
    clear(req, employeeNumber) {
      buckets.delete(rateKey(req, employeeNumber));
    }
  };
}

async function verifyPassword(account, password) {
  const stored = account.password;
  const keyLength = stored.params && stored.params.keyLength ? stored.params.keyLength : 64;
  const opts = { N: stored.params.N, r: stored.params.r, p: stored.params.p };
  const candidate = await scrypt(String(password || ''), stored.salt, keyLength, opts);
  const expected = Buffer.from(stored.hash, 'base64url');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function setSessionCookie(res, sid) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

function noStore(res) {
  res.set('Cache-Control', 'no-store');
}

function selectorId(sessionSecret, employeeNumber) {
  return crypto.createHmac('sha256', sessionSecret)
    .update(`demo-selector:v1:${employeeNumber}`)
    .digest('base64url');
}

function createMockDatabase() {
  const accounts = MOCK_DEMO_ACCOUNTS.map(account => ({ ...account }));
  const sessions = new Map();
  return {
    async migrate() {},
    async pruneExpiredSessions(now = new Date()) {
      for (const [sid, session] of sessions) if (session.expiresAt <= now.getTime()) sessions.delete(sid);
    },
    async findAccount(employeeNumber) {
      const key = String(employeeNumber || '').toUpperCase();
      return accounts.find(account => account.employeeNumber.toUpperCase() === key) || null;
    },
    async findAccountsByRoles(roles) { return accounts.filter(account => roles.includes(account.role)); },
    async createSession(sessionId, account, expiresAt, createdAt = new Date()) {
      const session = { id: sessionId, employeeNumber: account.employeeNumber, name: account.name,
        role: account.role, roleKey: account.roleKey, status: account.status,
        createdAt: createdAt.getTime(), expiresAt: expiresAt.getTime() };
      sessions.set(sessionId, session);
      return session;
    },
    async getSession(sessionId, now = new Date()) {
      const session = sessions.get(sessionId);
      if (!session || session.expiresAt <= now.getTime()) {
        if (sessionId) sessions.delete(sessionId);
        return null;
      }
      return { ...session };
    },
    async deleteSession(sessionId) { if (sessionId) sessions.delete(sessionId); },
    async close() { sessions.clear(); }
  };
}

async function validatedDemoAccounts(db) {
  const accounts = await db.findAccountsByRoles(DEMO_SELECTOR_ROLES.map(item => item.role));
  const byRole = new Map();
  for (const account of accounts) {
    if (!byRole.has(account.role)) byRole.set(account.role, []);
    byRole.get(account.role).push(account);
  }
  const selected = [];
  for (const item of DEMO_SELECTOR_ROLES) {
    const matches = (byRole.get(item.role) || []).filter(account => account.status === 'active');
    if (matches.length !== 1 || (byRole.get(item.role) || []).length !== 1) {
      const error = new Error(`Demo selector cardinality is invalid for ${item.role}`);
      error.code = 'DEMO_SELECTOR_UNAVAILABLE';
      throw error;
    }
    selected.push({ account: matches[0], labelKey: item.labelKey });
  }
  return selected;
}

async function createServerSession(db, res, account) {
  await db.pruneExpiredSessions();
  const sid = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const session = await db.createSession(sid, account, new Date(now.getTime() + SESSION_TTL_MS), now);
  setSessionCookie(res, sid);
  return session;
}

function createApp(options = {}) {
  const sessionSecret = requireSecret('SESSION_SECRET', options.sessionSecret);
  const mockDemoAuthEnabled = process.env.MOCK_DEMO_AUTH_ENABLED === 'true' || options.mockDemoAuthEnabled === true;
  const db = options.db || (mockDemoAuthEnabled ? createMockDatabase() : createDatabase(options.dbOptions || {}));
  const rateLimit = makeRateLimiter();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser(sessionSecret));

  app.get('/healthz', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      noStore(res);
      if (mockDemoAuthEnabled) return res.status(503).json({ ok: false, error: 'errors.server_error' });
      const employeeNumber = String(req.body.employeeNumber || '').trim().toUpperCase();
      const password = String(req.body.password || req.body.pin || '');
      const limited = rateLimit.check(req, employeeNumber);
      if (limited.limited) {
        res.set('Retry-After', String(limited.retryAfterSeconds));
        return res.status(429).json({ ok: false, error: 'errors.too_many_attempts' });
      }

      const account = await db.findAccount(employeeNumber);
      if (!account || account.status !== 'active' || !(await verifyPassword(account, password))) {
        rateLimit.recordFailure(req, employeeNumber);
        return res.status(401).json({ ok: false, error: account ? 'errors.incorrect_pin' : 'errors.employee_not_found' });
      }

      rateLimit.clear(req, employeeNumber);
      const session = await createServerSession(db, res, account);
      return res.status(200).json({ ok: true, employee: publicEmployee(account), session: publicEmployee(session) });
    } catch (err) {
      return next(err);
    }
  });

  app.get('/api/demo/accounts', async (req, res, next) => {
    try {
      noStore(res);
      if (process.env.DEMO_ACCOUNT_SELECTOR_ENABLED !== 'true' && options.demoAccountSelectorEnabled !== true) {
        return res.status(404).json({ ok: false, error: 'auth.demo.unavailable' });
      }
      const accounts = await validatedDemoAccounts(db);
      return res.status(200).json({ ok: true, accounts: accounts.map(item => ({
        selectionId: selectorId(sessionSecret, item.account.employeeNumber),
        labelKey: item.labelKey
      })) });
    } catch (err) {
      if (err.code === 'DEMO_SELECTOR_UNAVAILABLE') return res.status(503).json({ ok: false, error: 'auth.demo.unavailable' });
      return next(err);
    }
  });

  app.post('/api/auth/demo-login', async (req, res, next) => {
    try {
      noStore(res);
      if (process.env.DEMO_ACCOUNT_SELECTOR_ENABLED !== 'true' && options.demoAccountSelectorEnabled !== true) {
        return res.status(404).json({ ok: false, error: 'auth.demo.unavailable' });
      }
      const selectionId = typeof req.body.selectionId === 'string' ? req.body.selectionId : '';
      const limited = rateLimit.check(req, `demo:${selectionId}`);
      if (limited.limited) {
        res.set('Retry-After', String(limited.retryAfterSeconds));
        return res.status(429).json({ ok: false, error: 'errors.too_many_attempts' });
      }
      const accounts = await validatedDemoAccounts(db);
      const selected = accounts.find(item => {
        const expected = Buffer.from(selectorId(sessionSecret, item.account.employeeNumber));
        const actual = Buffer.from(selectionId);
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
      });
      if (!selected) {
        rateLimit.recordFailure(req, `demo:${selectionId}`);
        return res.status(401).json({ ok: false, error: 'auth.demo.invalid' });
      }
      const account = await db.findAccount(selected.account.employeeNumber);
      if (!account || account.status !== 'active' || account.role !== selected.account.role) {
        rateLimit.recordFailure(req, `demo:${selectionId}`);
        return res.status(401).json({ ok: false, error: 'auth.demo.invalid' });
      }
      rateLimit.clear(req, `demo:${selectionId}`);
      const session = await createServerSession(db, res, account);
      return res.status(200).json({ ok: true, employee: publicEmployee(account), session: publicEmployee(session) });
    } catch (err) {
      if (err.code === 'DEMO_SELECTOR_UNAVAILABLE') return res.status(503).json({ ok: false, error: 'auth.demo.unavailable' });
      return next(err);
    }
  });

  app.get('/api/auth/session', async (req, res, next) => {
    try {
      noStore(res);
      const session = await db.getSession(req.signedCookies[SESSION_COOKIE]);
      if (!session) return res.status(401).json({ ok: false, error: 'errors.session_expired' });
      return res.status(200).json({ ok: true, employee: publicEmployee(session), session: publicEmployee(session) });
    } catch (err) {
      return next(err);
    }
  });

  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      noStore(res);
      await db.deleteSession(req.signedCookies[SESSION_COOKIE]);
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  app.use(['/copilot-worktrees', '/.git', '/.secrets'], (req, res) => {
    res.status(404).json({ ok: false, error: 'not_found' });
  });

  app.use(express.static(__dirname, {
    extensions: ['html'],
    index: 'index.html',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) noStore(res);
    }
  }));

  app.use((req, res) => {
    res.status(404).json({ ok: false, error: 'not_found' });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (process.env.NODE_ENV !== 'production') console.error(err.stack || err.message || err);
    return res.status(500).json({ ok: false, error: 'errors.server_error' });
  });

  return { app, db };
}

async function start() {
  const { app, db } = createApp();
  await db.migrate();
  app.listen(PORT, HOST, () => {
    console.log(`FARM_SYSTEM demo listening on ${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { createApp, verifyPassword, SESSION_COOKIE };
