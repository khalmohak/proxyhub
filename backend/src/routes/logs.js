const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /api/logs?limit=100&offset=0&proxy_id=&device_id=&status=&from=&to=&target=
router.get('/', async (req, res, next) => {
  const {
    limit    = 100,
    offset   = 0,
    proxy_id,
    device_id,
    status,
    from,
    to,
    target,
  } = req.query;

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (proxy_id)  { conditions.push(`l.proxy_id = $${idx++}`);              params.push(proxy_id);  }
  if (device_id) { conditions.push(`l.device_id = $${idx++}`);             params.push(device_id); }
  if (status)    { conditions.push(`l.status = $${idx++}`);                params.push(status);    }
  if (from)      { conditions.push(`l.created_at >= $${idx++}`);           params.push(from);      }
  if (to)        { conditions.push(`l.created_at <= $${idx++}`);           params.push(to);        }
  if (target)    { conditions.push(`l.target_host ILIKE $${idx++}`);       params.push(`%${target}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT l.*,
                p.host AS proxy_host,
                p.port AS proxy_port,
                p.label AS proxy_label
         FROM proxy_logs l
         LEFT JOIN proxies p ON l.proxy_id = p.id
         ${where}
         ORDER BY l.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, parseInt(limit), parseInt(offset)]
      ),
      pool.query(
        `SELECT COUNT(*) FROM proxy_logs l ${where}`,
        params
      ),
    ]);

    res.json({
      logs:  dataResult.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err) { next(err); }
});

// GET /api/logs/export  — CSV download
router.get('/export', async (req, res, next) => {
  const { proxy_id, device_id, status, from, to } = req.query;
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (proxy_id)  { conditions.push(`l.proxy_id = $${idx++}`);    params.push(proxy_id);  }
  if (device_id) { conditions.push(`l.device_id = $${idx++}`);   params.push(device_id); }
  if (status)    { conditions.push(`l.status = $${idx++}`);       params.push(status);    }
  if (from)      { conditions.push(`l.created_at >= $${idx++}`);  params.push(from);      }
  if (to)        { conditions.push(`l.created_at <= $${idx++}`);  params.push(to);        }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await pool.query(
      `SELECT l.id, l.created_at, l.connection_id, l.target_host, l.target_port,
              l.is_https, l.upstream_proxy, l.device_name, l.status,
              l.duration_ms, l.error_message,
              p.host AS proxy_host, p.port AS proxy_port
       FROM proxy_logs l
       LEFT JOIN proxies p ON l.proxy_id = p.id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT 50000`,
      params
    );

    const header = 'id,created_at,connection_id,target_host,target_port,is_https,proxy_host,proxy_port,device_name,status,duration_ms,error_message\n';
    const rows = result.rows.map(r =>
      [r.id, r.created_at, r.connection_id, r.target_host, r.target_port,
       r.is_https, r.proxy_host, r.proxy_port, r.device_name, r.status,
       r.duration_ms, (r.error_message || '').replace(/,/g, ';')]
      .join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="proxy-logs.csv"');
    res.send(header + rows);
  } catch (err) { next(err); }
});

module.exports = router;
