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

function createApp(options = {}) {
  const sessionSecret = requireSecret('SESSION_SECRET', options.sessionSecret);
  const db = options.db || createDatabase(options.dbOptions || {});
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
      await db.pruneExpiredSessions();
      const sid = crypto.randomBytes(32).toString('base64url');
      const now = new Date();
      const session = await db.createSession(sid, account, new Date(now.getTime() + SESSION_TTL_MS), now);
      setSessionCookie(res, sid);
      return res.status(200).json({ ok: true, employee: publicEmployee(account), session: publicEmployee(session) });
    } catch (err) {
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
