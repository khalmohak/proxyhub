const jwt = require('jsonwebtoken');
const { pool } = require('../db');

// Cache whether auth is required to avoid a DB query on every request
let _authRequiredCache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000;

async function isAuthRequired() {
  const now = Date.now();
  if (_authRequiredCache !== null && now - _cacheTime < CACHE_TTL_MS) {
    return _authRequiredCache;
  }
  try {
    const r = await pool.query("SELECT value FROM settings WHERE key = 'onboarding_complete'");
    _authRequiredCache = r.rows[0]?.value === 'true';
    _cacheTime = now;
    return _authRequiredCache;
  } catch {
    return false;
  }
}

function invalidateAuthCache() {
  _authRequiredCache = null;
}

// Paths that never require a token
const PUBLIC = [
  { path: '/api/auth/login',         method: 'POST' },
  { path: '/api/settings/onboarding',method: 'GET'  },
  { path: '/api/settings/setup',     method: 'POST' },
  { path: '/health',                 method: 'GET'  },
];

async function authMiddleware(req, res, next) {
  const isPublic = PUBLIC.some(p => p.path === req.path && p.method === req.method);
  if (isPublic) return next();

  const required = await isAuthRequired();
  if (!required) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  try {
    const secret = process.env.JWT_SECRET || 'proxyhub-dev-secret-change-me';
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
module.exports.invalidateAuthCache = invalidateAuthCache;
