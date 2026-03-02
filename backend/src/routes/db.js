const express = require('express');
const fs      = require('fs');
const { pool } = require('../db');

const router = express.Router();

// GET /api/db/status — current DB type, connection health, details
router.get('/status', async (_req, res, next) => {
  try {
    const info = { type: pool.type, connected: false };

    // Ping the database
    try {
      await pool.query('SELECT 1 AS ok');
      info.connected = true;
    } catch (e) {
      info.error = e.message;
    }

    if (pool.type === 'sqlite') {
      info.path = pool.path;
      try {
        const stat = fs.statSync(pool.path);
        info.size_bytes = stat.size;
      } catch (_) {}
    } else {
      info.host     = pool.host;
      info.port     = pool.port;
      info.database = pool.database;
      info.user     = pool.user;
    }

    res.json(info);
  } catch (err) { next(err); }
});

// POST /api/db/test — test a PostgreSQL connection without applying it
router.post('/test', async (req, res, next) => {
  const { host, port, database, user, password } = req.body;
  if (!host || !database || !user) {
    return res.status(400).json({ error: 'host, database, and user are required' });
  }

  let testPool;
  try {
    const { Pool } = require('pg');
    testPool = new Pool({
      host,
      port:     parseInt(port || '5432'),
      database,
      user,
      password: password || '',
      max:      1,
      connectionTimeoutMillis: 6000,
      idleTimeoutMillis:       1000,
    });

    const start = Date.now();
    const r     = await testPool.query('SELECT version() AS version');
    const latency = Date.now() - start;

    res.json({
      ok:         true,
      latency_ms: latency,
      version:    r.rows[0]?.version?.split(' ').slice(0, 2).join(' ') || 'PostgreSQL',
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  } finally {
    if (testPool) testPool.end().catch(() => {});
  }
});

module.exports = router;
