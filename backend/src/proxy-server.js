const { Server } = require('proxy-chain');
const { pool } = require('./db');

const PROXY_PORT  = parseInt(process.env.PROXY_PORT  || '8080');
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

let activeProxies = [];
let roundRobinIdx = 0;

async function loadActiveProxies() {
  try {
    const result = await pool.query(
      'SELECT * FROM proxies WHERE is_active = true AND is_healthy = true ORDER BY id'
    );
    activeProxies = result.rows;
  } catch (err) {
    console.error('[proxy] Failed to reload proxies:', err.message);
  }
}

function getNextProxy() {
  if (activeProxies.length === 0) return null;
  const proxy = activeProxies[roundRobinIdx % activeProxies.length];
  roundRobinIdx = (roundRobinIdx + 1) % activeProxies.length;
  return proxy;
}

async function logRequest({ connectionId, proxyRow, deviceRow, targetHost, targetPort, isHttp, status, errorMessage, durationMs }) {
  try {
    await pool.query(
      `INSERT INTO proxy_logs
         (connection_id, proxy_id, device_id, device_name, target_host, target_port,
          is_https, upstream_proxy, status, error_message, duration_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        connectionId,
        proxyRow?.id    ?? null,
        deviceRow?.id   ?? null,
        deviceRow?.name ?? null,
        targetHost,
        targetPort,
        !isHttp,
        proxyRow ? `${proxyRow.host}:${proxyRow.port}` : null,
        status,
        errorMessage ?? null,
        durationMs   ?? null,
      ]
    );

    if (proxyRow) {
      await pool.query(
        `UPDATE proxies
         SET last_used_at = NOW(), total_requests = total_requests + 1
         WHERE id = $1`,
        [proxyRow.id]
      );
    }
    if (deviceRow) {
      await pool.query(
        'UPDATE devices SET last_used_at = NOW() WHERE id = $1',
        [deviceRow.id]
      );
    }
  } catch (err) {
    console.error('[proxy] Log write failed:', err.message);
  }
}

function startProxyServer() {
  loadActiveProxies();
  setInterval(loadActiveProxies, 30_000);

  const server = new Server({
    port: PROXY_PORT,
    verbose: false,

    prepareRequestFunction: async ({ request, username, hostname, port, isHttp, connectionId }) => {
      const startTime  = Date.now();
      const targetHost = hostname || request?.headers?.host || 'unknown';
      const targetPort = port || (isHttp ? 80 : 443);

      // Resolve device by API key sent as proxy username
      let deviceRow = null;
      if (username) {
        try {
          const r = await pool.query(
            'SELECT * FROM devices WHERE api_key = $1 AND is_active = true',
            [username]
          );
          deviceRow = r.rows[0] ?? null;
        } catch (_) {}
      }

      if (REQUIRE_AUTH && !deviceRow) {
        console.log(`[proxy] conn=${connectionId} REJECTED – no valid API key`);
        logRequest({ connectionId, proxyRow: null, deviceRow: null, targetHost, targetPort, isHttp, status: 'auth_failed', durationMs: Date.now() - startTime });
        return { requestAuthentication: true };
      }

      const proxyRow = getNextProxy();

      if (!proxyRow) {
        console.warn(`[proxy] conn=${connectionId} NO_PROXY for ${targetHost}`);
        logRequest({ connectionId, proxyRow: null, deviceRow, targetHost, targetPort, isHttp, status: 'no_proxy', durationMs: Date.now() - startTime });
        return { upstreamProxyUrl: null };
      }

      const upstreamProxyUrl =
        `http://${encodeURIComponent(proxyRow.username)}:${encodeURIComponent(proxyRow.password)}@${proxyRow.host}:${proxyRow.port}`;

      console.log(
        `[proxy] conn=${connectionId} ${isHttp ? 'HTTP' : 'CONNECT'} ` +
        `${targetHost}:${targetPort} → ${proxyRow.host}:${proxyRow.port} ` +
        `(device=${deviceRow?.name ?? 'anon'})`
      );

      // Fire-and-forget log
      logRequest({ connectionId, proxyRow, deviceRow, targetHost, targetPort, isHttp, status: 'success', durationMs: Date.now() - startTime });

      return { upstreamProxyUrl };
    },
  });

  server.listen(() => {
    console.log(`[proxy] Rotating proxy listening on 0.0.0.0:${PROXY_PORT}`);
    console.log(`[proxy] Auth required: ${REQUIRE_AUTH}`);
  });

  process.on('SIGINT',  () => shutdown(server));
  process.on('SIGTERM', () => shutdown(server));

  return server;
}

async function shutdown(server) {
  console.log('[proxy] Shutting down...');
  await server.close();
  process.exit(0);
}

module.exports = { startProxyServer, loadActiveProxies };
