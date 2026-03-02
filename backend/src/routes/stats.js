const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /api/stats
router.get('/', async (_req, res, next) => {
  try {
    const [proxies, devices, logs, hourly, topProxies, topDevices] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                           AS total,
          COUNT(*) FILTER (WHERE is_active)                 AS active,
          COUNT(*) FILTER (WHERE is_healthy)                AS healthy,
          COUNT(*) FILTER (WHERE is_active AND is_healthy)  AS ready,
          SUM(total_requests)                               AS total_requests
        FROM proxies
      `),
      pool.query(`
        SELECT
          COUNT(*)                          AS total,
          COUNT(*) FILTER (WHERE is_active) AS active
        FROM devices
      `),
      pool.query(`
        SELECT
          COUNT(*)                                                               AS total,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')        AS last_hour,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')      AS last_day,
          COUNT(*) FILTER (WHERE status = 'success')                            AS success,
          COUNT(*) FILTER (WHERE status != 'success')                           AS failed
        FROM proxy_logs
      `),
      pool.query(`
        SELECT
          DATE_TRUNC('hour', created_at) AS hour,
          COUNT(*)                        AS requests,
          COUNT(*) FILTER (WHERE status = 'success')  AS success,
          COUNT(*) FILTER (WHERE status != 'success') AS failed
        FROM proxy_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour
      `),
      pool.query(`
        SELECT p.id, p.host, p.port, p.label, p.total_requests
        FROM proxies p
        ORDER BY p.total_requests DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT d.id, d.name, COUNT(l.id)::int AS requests
        FROM devices d
        LEFT JOIN proxy_logs l ON l.device_id = d.id
        GROUP BY d.id
        ORDER BY requests DESC
        LIMIT 5
      `),
    ]);

    res.json({
      proxies:    proxies.rows[0],
      devices:    devices.rows[0],
      logs:       logs.rows[0],
      hourly:     hourly.rows,
      topProxies: topProxies.rows,
      topDevices: topDevices.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
