require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'proxymanager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'proxymanager123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS proxies (
        id           SERIAL PRIMARY KEY,
        host         VARCHAR(255) NOT NULL,
        port         INTEGER NOT NULL,
        username     VARCHAR(255),
        password     VARCHAR(255),
        protocol     VARCHAR(10) DEFAULT 'http',
        label        VARCHAR(255),
        is_active    BOOLEAN DEFAULT true,
        is_healthy   BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        last_checked_at TIMESTAMP,
        total_requests  INTEGER DEFAULT 0,
        failed_requests INTEGER DEFAULT 0,
        created_at   TIMESTAMP DEFAULT NOW(),
        UNIQUE(host, port)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        api_key     VARCHAR(255) UNIQUE NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS proxy_logs (
        id             BIGSERIAL PRIMARY KEY,
        connection_id  VARCHAR(255),
        proxy_id       INTEGER REFERENCES proxies(id) ON DELETE SET NULL,
        device_id      INTEGER REFERENCES devices(id) ON DELETE SET NULL,
        device_name    VARCHAR(255),
        target_host    VARCHAR(1024),
        target_port    INTEGER,
        is_https       BOOLEAN DEFAULT false,
        upstream_proxy VARCHAR(255),
        status         VARCHAR(50) DEFAULT 'success',
        error_message  TEXT,
        duration_ms    INTEGER,
        created_at     TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_proxy_logs_created_at ON proxy_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_proxy_logs_proxy_id   ON proxy_logs(proxy_id);
      CREATE INDEX IF NOT EXISTS idx_proxy_logs_device_id  ON proxy_logs(device_id);
      CREATE INDEX IF NOT EXISTS idx_proxy_logs_status     ON proxy_logs(status);
    `);

    // Geo metadata columns (migration-safe: ADD COLUMN IF NOT EXISTS)
    await client.query(`ALTER TABLE proxies ADD COLUMN IF NOT EXISTS resolved_ip   VARCHAR(45)`);
    await client.query(`ALTER TABLE proxies ADD COLUMN IF NOT EXISTS country        VARCHAR(100)`);
    await client.query(`ALTER TABLE proxies ADD COLUMN IF NOT EXISTS country_code   VARCHAR(5)`);
    await client.query(`ALTER TABLE proxies ADD COLUMN IF NOT EXISTS city           VARCHAR(100)`);
    await client.query(`ALTER TABLE proxies ADD COLUMN IF NOT EXISTS isp            VARCHAR(255)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key        TEXT PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('[db] Schema ready');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
