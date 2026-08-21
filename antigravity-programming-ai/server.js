'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const cookieParser = require('cookie-parser');
const { createDatabase } = require('./lib/demo-db');
const { createPlotsStore } = require('./lib/plots-store');
const FarmGeo = require('./js/geo.js');

const scrypt = promisify(crypto.scrypt);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_COOKIE = 'mecuzi_demo_session';
const SESSION_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const OPENROUTER_MODEL = 'openrouter/free';
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

async function generateOpenRouterAnswer({ apiKey, role, language, prompt, draft, citations }) {
  if (!apiKey) return null;
  const languageName = { pt: 'Mozambican Portuguese', en: 'UK English', zh: 'Traditional Chinese' }[language] || 'UK English';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://farm-system-a1v8.onrender.com',
      'X-Title': 'FARM_SYSTEM demo'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are the FARM_SYSTEM demo assistant. Reply exclusively in ${languageName} (language code: ${language}); do not translate into another language. The authenticated role is ${role}. Rewrite the grounded draft into a concise operational answer. Do not add facts, figures, permissions, users, or recommendations absent from the draft. Preserve every citation exactly. If the draft says access is forbidden or information is unavailable, preserve that meaning. Output plain text only.`
        },
        {
          role: 'user',
          content: JSON.stringify({ prompt, groundedDraft: draft, citations })
        }
      ]
    })
  });
  if (!response.ok) return null;
  const body = await response.json();
  const content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  return typeof content === 'string' && content.trim() ? content.trim() : null;
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
  app.use(express.json({ limit: '64kb' })); // plot polygons from GPS walk-and-track can carry hundreds of vertices
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

  app.post('/api/ai/compose', async (req, res, next) => {
    try {
      noStore(res);
      const session = await sessionClaims(req);
      if (!session) return res.status(401).json({ ok: false, error: 'errors.session_expired' });
      const prompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim().slice(0, 1200) : '';
      const language = ['pt', 'en', 'zh'].includes(req.body.language) ? req.body.language : 'en';
      const draft = typeof req.body.draft === 'string' ? req.body.draft.trim().slice(0, 16000) : '';
      const citations = Array.isArray(req.body.citations) ? req.body.citations.filter(c => typeof c === 'string').slice(0, 20) : [];
      if (!prompt || !draft) return res.status(400).json({ ok: false, error: 'errors.invalid_request' });
      const answer = await generateOpenRouterAnswer({
        apiKey: process.env.OPENROUTER_API_KEY,
        role: session.role,
        language,
        prompt,
        draft,
        citations
      });
      if (!answer) return res.status(503).json({ ok: false, error: 'ai.provider_unavailable' });
      return res.status(200).json({ ok: true, answer, model: OPENROUTER_MODEL });
    } catch (err) {
      return next(err);
    }
  });

  /* --- GIS plot mapping API (deliverable D) -------------------------------
     Read: any authenticated session (executive read-only view).
     Write: farm_technician / production_manager ONLY — the boundary is
     enforced here, never by hiding buttons (RBAC at the API layer).
     Client-generated plot IDs make offline capture idempotent: a retried
     POST after a connectivity drop returns the existing row, not a duplicate.
     ------------------------------------------------------------------------- */
  const plotsStore = createPlotsStore(db);
  const PLOT_EDITOR_ROLES = ['farm_technician', 'production_manager'];
  const PLOT_STATUSES = ['on-track', 'attention-needed', 'fallow', 'harvest'];

  async function sessionClaims(req) {
    return db.getSession(req.signedCookies[SESSION_COOKIE]);
  }

  function parsePlotPayload(body) {
    const name = String(body.name || '').trim();
    if (!name) return { error: 'errors.plot_name_required' };
    const check = FarmGeo.validatePlotGeometry(body.geometry);
    if (!check.ok) return { error: check.error };
    const status = body.status && PLOT_STATUSES.includes(body.status) ? body.status : 'on-track';
    return {
      name,
      geometry: check.geometry,
      // Area is ALWAYS computed server-side — the client estimate is a hint only
      areaHectares: Math.round(FarmGeo.areaHectares(check.geometry) * 100) / 100,
      status
    };
  }

  function parseCropPayload(body) {
    if (!body.crop || typeof body.crop !== 'object') return null;
    const cropType = String(body.crop.cropType || '').trim();
    if (!cropType) return null;
    return {
      cropType,
      variety: String(body.crop.variety || '').trim() || null,
      plantingDate: String(body.crop.plantingDate || '').trim() || null,
      stage: String(body.crop.stage || '').trim() || null
    };
  }

  // GET /api/plots — every authenticated role (executive dashboards read this)
  app.get('/api/plots', async (req, res, next) => {
    try {
      noStore(res);
      const session = await sessionClaims(req);
      if (!session) return res.status(401).json({ ok: false, error: 'errors.session_expired' });
      return res.status(200).json({ ok: true, plots: await plotsStore.listPlots() });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/plots — create plot polygon + crop metadata (editor roles only)
  app.post('/api/plots', async (req, res, next) => {
    try {
      noStore(res);
      const session = await sessionClaims(req);
      if (!session) return res.status(401).json({ ok: false, error: 'errors.session_expired' });
      if (!PLOT_EDITOR_ROLES.includes(session.role)) {
        return res.status(403).json({ ok: false, error: 'errors.forbidden' });
      }
      const id = String(req.body.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'errors.plot_id_required' });
      // Offline idempotency: same client ID re-posted after a retry
      const existing = await plotsStore.getPlot(id);
      if (existing) return res.status(200).json({ ok: true, deduplicated: true, plot: existing });
      const parsed = parsePlotPayload(req.body);
      if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error });
      const plot = await plotsStore.createPlot(
        Object.assign({ id, actor: session.employeeNumber }, parsed),
        parseCropPayload(req.body)
      );
      return res.status(201).json({ ok: true, plot });
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /api/plots/:id — edit boundary / status / crop metadata (editor roles)
  app.patch('/api/plots/:id', async (req, res, next) => {
    try {
      noStore(res);
      const session = await sessionClaims(req);
      if (!session) return res.status(401).json({ ok: false, error: 'errors.session_expired' });
      if (!PLOT_EDITOR_ROLES.includes(session.role)) {
        return res.status(403).json({ ok: false, error: 'errors.forbidden' });
      }
      const id = String(req.params.id || '');
      if (!(await plotsStore.getPlot(id))) {
        return res.status(404).json({ ok: false, error: 'not_found' });
      }
      const patch = {};
      if (req.body.geometry !== undefined) {
        const parsed = parsePlotPayload(Object.assign({ name: 'x' }, req.body));
        if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error });
        patch.geometry = parsed.geometry;
        patch.areaHectares = parsed.areaHectares;
      }
      if (req.body.name !== undefined) {
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ ok: false, error: 'errors.plot_name_required' });
        patch.name = name;
      }
      if (req.body.status !== undefined) {
        if (!PLOT_STATUSES.includes(req.body.status)) {
          return res.status(400).json({ ok: false, error: 'errors.plot_bad_status' });
        }
        patch.status = req.body.status;
      }
      const plot = await plotsStore.updatePlot(id, patch, parseCropPayload(req.body), session.employeeNumber);
      return res.status(200).json({ ok: true, plot });
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
