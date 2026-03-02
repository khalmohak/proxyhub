const express = require('express');
const multer  = require('multer');
const axios   = require('axios');
const { pool } = require('../db');
const { loadActiveProxies } = require('../proxy-server');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/* ─── Global sync state ──────────────────────────────────── */
let syncState = {
  running:     false,
  current:     0,
  total:       0,
  results:     [],
  startedAt:   null,
  finishedAt:  null,
  triggeredBy: null, // 'manual' | 'auto'
};

/* ─── Geo helper ─────────────────────────────────────────── */
async function fetchGeo(ip) {
  try {
    const { data } = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,isp`,
      { timeout: 6000 }
    );
    if (data.status === 'success') {
      return {
        country:      data.country     || null,
        country_code: data.countryCode || null,
        city:         data.city        || null,
        isp:          data.isp         || null,
      };
    }
  } catch (_) {}
  return {};
}

/* ─── Check one proxy: connectivity + geo ────────────────── */
async function checkProxy(proxy) {
  const start = Date.now();
  try {
    const { data } = await axios.get('https://api.ipify.org?format=json', {
      proxy: {
        protocol: proxy.protocol || 'http',
        host:     proxy.host,
        port:     proxy.port,
        ...(proxy.username ? { auth: { username: proxy.username, password: proxy.password } } : {}),
      },
      timeout: 12000,
    });
    const duration = Date.now() - start;
    const ip  = data.ip;
    const geo = await fetchGeo(ip);

    await pool.query(
      `UPDATE proxies
         SET is_healthy=true, last_checked_at=NOW(),
             resolved_ip=$2, country=$3, country_code=$4, city=$5, isp=$6
       WHERE id=$1`,
      [proxy.id, ip, geo.country, geo.country_code, geo.city, geo.isp]
    );
    return { healthy: true, ip, duration_ms: duration, ...geo };
  } catch (err) {
    await pool.query(
      `UPDATE proxies
         SET is_healthy=false, last_checked_at=NOW(),
             failed_requests=failed_requests+1
       WHERE id=$1`,
      [proxy.id]
    );
    return { healthy: false, error: err.message };
  }
}

/* ─── Background sync runner ─────────────────────────────── */
async function runSync(rows, triggeredBy = 'manual') {
  syncState = {
    running:     true,
    current:     0,
    total:       rows.length,
    results:     [],
    startedAt:   new Date().toISOString(),
    finishedAt:  null,
    triggeredBy,
  };

  for (const proxy of rows) {
    syncState.current += 1;

    let result;
    if (proxy.resolved_ip) {
      // Re-enrich geo without connectivity test
      const geo = await fetchGeo(proxy.resolved_ip);
      await pool.query(
        `UPDATE proxies SET country=$2, country_code=$3, city=$4, isp=$5, last_checked_at=NOW() WHERE id=$1`,
        [proxy.id, geo.country, geo.country_code, geo.city, geo.isp]
      );
      result = { ip: proxy.resolved_ip, synced: true, healthy: proxy.is_healthy, ...geo };
    } else {
      result = await checkProxy(proxy);
    }

    syncState.results.push({
      id:   proxy.id,
      host: proxy.host,
      port: proxy.port,
      ...result,
    });
  }

  await loadActiveProxies();

  // Save last sync time to settings
  try {
    await pool.query(
      `INSERT INTO settings (key,value,updated_at) VALUES ('last_auto_sync',NOW()::text,NOW())
       ON CONFLICT (key) DO UPDATE SET value=NOW()::text, updated_at=NOW()`
    );
  } catch (_) {}

  syncState.running    = false;
  syncState.finishedAt = new Date().toISOString();
  console.log(`[sync] Completed: ${syncState.results.filter(r=>r.healthy).length}/${syncState.total} healthy`);
}

/* Export for background scheduler */
async function runBackgroundSync() {
  if (syncState.running) return;
  const all = await pool.query('SELECT * FROM proxies WHERE is_active = true');
  if (all.rows.length === 0) return;
  await runSync(all.rows, 'auto');
}

/* ─── Routes ─────────────────────────────────────────────── */

// GET /api/proxies
router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM proxies ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/proxies
router.post('/', async (req, res, next) => {
  const { host, port, username, password, protocol = 'http', label = '' } = req.body;
  if (!host || !port) return res.status(400).json({ error: 'host and port are required' });
  try {
    const result = await pool.query(
      `INSERT INTO proxies (host, port, username, password, protocol, label)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (host, port) DO UPDATE
         SET username=EXCLUDED.username, password=EXCLUDED.password,
             protocol=EXCLUDED.protocol, label=EXCLUDED.label
       RETURNING *`,
      [host.trim(), parseInt(port), username || null, password || null, protocol, label || null]
    );
    await loadActiveProxies();
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/proxies/bulk
router.post('/bulk', upload.single('file'), async (req, res, next) => {
  let text = req.body.text || '';
  if (req.file) text = req.file.buffer.toString('utf8');
  if (!text.trim()) return res.status(400).json({ error: 'No proxy text provided' });

  const { protocol = 'http', label = '' } = req.body;
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean);
  const added  = [];
  const errors = [];

  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length < 2) { errors.push({ line, reason: 'Need at least host:port' }); continue; }
    const [host, rawPort, username, password] = parts;
    const port = parseInt(rawPort);
    if (!host || isNaN(port)) { errors.push({ line, reason: 'Invalid host or port' }); continue; }
    try {
      const r = await pool.query(
        `INSERT INTO proxies (host, port, username, password, protocol, label)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (host, port) DO UPDATE
           SET username=EXCLUDED.username, password=EXCLUDED.password
         RETURNING *`,
        [host.trim(), port, username || null, password || null, protocol, label || null]
      );
      added.push(r.rows[0]);
    } catch (err) {
      errors.push({ line, reason: err.message });
    }
  }

  await loadActiveProxies();
  res.json({ added: added.length, total: lines.length, errors });
});

// PATCH /api/proxies/:id/toggle
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE proxies SET is_active=NOT is_active WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    await loadActiveProxies();
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/proxies/:id/check
router.post('/:id/check', async (req, res, next) => {
  try {
    const r = await pool.query('SELECT * FROM proxies WHERE id=$1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    const result = await checkProxy(r.rows[0]);
    await loadActiveProxies();
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/proxies/check-all
router.post('/check-all', async (_req, res, next) => {
  try {
    const all = await pool.query('SELECT * FROM proxies WHERE is_active=true');
    const results = [];
    for (const proxy of all.rows) {
      const r = await checkProxy(proxy);
      results.push({ id: proxy.id, host: proxy.host, port: proxy.port, ...r });
    }
    await loadActiveProxies();
    res.json({ checked: results.length, results });
  } catch (err) { next(err); }
});

// POST /api/proxies/sync-metadata — kicks off async sync, returns immediately
router.post('/sync-metadata', async (req, res, next) => {
  try {
    if (syncState.running) {
      return res.json({ running: true, message: 'Sync already in progress', state: syncState });
    }
    const all = await pool.query('SELECT * FROM proxies WHERE is_active=true');
    if (all.rows.length === 0) {
      return res.json({ started: false, message: 'No active proxies to sync' });
    }
    // Fire and forget — frontend polls /sync-status
    runSync(all.rows, 'manual').catch(err => {
      console.error('[sync] Error:', err.message);
      syncState.running    = false;
      syncState.finishedAt = new Date().toISOString();
    });
    res.json({ started: true, total: all.rows.length });
  } catch (err) { next(err); }
});

// GET /api/proxies/sync-status
router.get('/sync-status', (_req, res) => {
  res.json(syncState);
});

// DELETE /api/proxies/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM proxies WHERE id=$1', [req.params.id]);
    await loadActiveProxies();
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.runBackgroundSync = runBackgroundSync;
