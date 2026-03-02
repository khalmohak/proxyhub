const express = require('express');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { pool } = require('../db');

const router = express.Router();

function getJwtSecret() {
  return process.env.JWT_SECRET || 'proxyhub-dev-secret-change-me';
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, storedHash, salt) {
  const testHash = hashPassword(password, salt);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(testHash,   'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    // ADMIN_PASSWORD env var takes priority (useful for Docker / env-only setups)
    const envPass = process.env.ADMIN_PASSWORD;
    if (envPass) {
      if (password !== envPass) return res.status(401).json({ error: 'Invalid password' });
    } else {
      const hashRow = await pool.query("SELECT value FROM settings WHERE key = 'admin_password_hash'");
      const saltRow = await pool.query("SELECT value FROM settings WHERE key = 'admin_password_salt'");
      if (!hashRow.rows[0]) return res.status(401).json({ error: 'No password configured — complete onboarding first.' });
      if (!verifyPassword(password, hashRow.rows[0].value, saltRow.rows[0].value)) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    const nameRow = await pool.query("SELECT value FROM settings WHERE key = 'server_name'");
    const serverName = nameRow.rows[0]?.value || 'ProxyHub';
    const adminName  = (await pool.query("SELECT value FROM settings WHERE key = 'admin_name'")).rows[0]?.value || 'Admin';

    const token = jwt.sign({ serverName, adminName }, getJwtSecret(), { expiresIn: '7d' });
    res.json({ token, serverName, adminName, expiresIn: '7d' });
  } catch (err) { next(err); }
});

// GET /api/auth/me  — validate token + return identity
router.get('/me', async (req, res, next) => {
  try {
    const nameRow  = await pool.query("SELECT value FROM settings WHERE key = 'server_name'");
    const adminRow = await pool.query("SELECT value FROM settings WHERE key = 'admin_name'");
    res.json({
      ok:         true,
      serverName: nameRow.rows[0]?.value  || 'ProxyHub',
      adminName:  adminRow.rows[0]?.value || 'Admin',
    });
  } catch (err) { next(err); }
});

module.exports = router;
