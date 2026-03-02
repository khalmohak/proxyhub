const express = require('express');
const crypto  = require('crypto');
const { pool } = require('../db');
const { invalidateAuthCache } = require('../middleware/auth');

const router = express.Router();

const HIDDEN_KEYS = ['admin_password_hash', 'admin_password_salt'];

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

async function upsert(key, value) {
  return pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]
  );
}

// GET /api/settings/onboarding — public
router.get('/onboarding', async (_req, res, next) => {
  try {
    const r = await pool.query("SELECT value FROM settings WHERE key = 'onboarding_complete'");
    const complete = r.rows[0]?.value === 'true';
    // Let the frontend know if password lives in env (skip password step in onboarding)
    const passwordFromEnv = !!process.env.ADMIN_PASSWORD;
    res.json({ complete, passwordFromEnv });
  } catch (err) { next(err); }
});

// POST /api/settings/setup — public (only works before onboarding_complete = true)
router.post('/setup', async (req, res, next) => {
  try {
    const existing = await pool.query("SELECT value FROM settings WHERE key = 'onboarding_complete'");
    if (existing.rows[0]?.value === 'true') {
      return res.status(400).json({ error: 'Already configured. Use the settings page to make changes.' });
    }

    const { server_name, admin_name, password, proxy_port, require_auth } = req.body;

    if (server_name)           await upsert('server_name',  server_name);
    if (admin_name)            await upsert('admin_name',   admin_name);
    if (proxy_port)            await upsert('proxy_port',   proxy_port);
    if (require_auth != null)  await upsert('require_auth', require_auth);

    // Hash and store password (skip if ADMIN_PASSWORD env var is set)
    if (password && !process.env.ADMIN_PASSWORD) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(password, salt);
      await upsert('admin_password_salt', salt);
      await upsert('admin_password_hash', hash);
    }

    await upsert('onboarding_complete', 'true');
    invalidateAuthCache();

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/settings — requires auth
router.get('/', async (_req, res, next) => {
  try {
    const r = await pool.query('SELECT key, value, updated_at FROM settings ORDER BY key');
    const map = {};
    r.rows.forEach(({ key, value }) => {
      if (!HIDDEN_KEYS.includes(key)) map[key] = value;
    });
    res.json(map);
  } catch (err) { next(err); }
});

// PUT /api/settings — requires auth
router.put('/', async (req, res, next) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (HIDDEN_KEYS.includes(key)) continue;
      await upsert(key, value);
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/settings/change-password — requires auth
router.post('/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Verify current password (env override or stored hash)
    const envPass = process.env.ADMIN_PASSWORD;
    if (envPass) {
      if (currentPassword !== envPass) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      // Can't change env-based password via UI
      return res.status(400).json({ error: 'Password is managed via ADMIN_PASSWORD environment variable' });
    }

    const hashRow = await pool.query("SELECT value FROM settings WHERE key='admin_password_hash'");
    const saltRow = await pool.query("SELECT value FROM settings WHERE key='admin_password_salt'");
    if (!hashRow.rows[0]) return res.status(400).json({ error: 'No password configured' });

    const testHash = hashPassword(currentPassword, saltRow.rows[0].value);
    try {
      const match = crypto.timingSafeEqual(
        Buffer.from(testHash, 'hex'),
        Buffer.from(hashRow.rows[0].value, 'hex')
      );
      if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    } catch {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(newPassword, newSalt);
    await upsert('admin_password_salt', newSalt);
    await upsert('admin_password_hash', newHash);

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
