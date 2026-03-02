require('dotenv').config();
const path = require('path');
const fs   = require('fs');

const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase();

/* ════════════════════════════════════════════════════════════
   SQLite translation helpers
   ════════════════════════════════════════════════════════════ */

/**
 * Convert COUNT(*) FILTER (WHERE ...) patterns to SQLite's
 * SUM(CASE WHEN ... THEN 1 ELSE 0 END).  Uses a parenthesis-depth
 * counter so conditions containing function calls (e.g. NOW()) work.
 */
function rewriteFilters(sql) {
  const marker = /COUNT\(\*\)\s+FILTER\s*\(WHERE\s+/gi;
  let out = sql;
  let offset = 0; // accumulated length delta from previous replacements

  for (const match of sql.matchAll(marker)) {
    const condStart = match.index + match[0].length + offset;
    let depth = 1;
    let i = condStart;
    const src = out;
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      i++;
    }
    const cond = src.slice(condStart, i - 1).trim();
    const replacement = `SUM(CASE WHEN ${cond} THEN 1 ELSE 0 END)`;
    const matchStart = match.index + offset;
    const matchEnd   = i;
    out = out.slice(0, matchStart) + replacement + out.slice(matchEnd);
    offset += replacement.length - (matchEnd - matchStart);
  }
  return out;
}

/**
 * Translate a PostgreSQL SQL string to SQLite-compatible SQL.
 * All route files keep their pg-style SQL unchanged — this layer
 * adapts it transparently.
 */
function toSQLite(sql) {
  return [sql]
    // 1. FILTER aggregate first — before interval/NOW() add nested parens
    .map(rewriteFilters)
    // Flatten back to string for chained .replace() calls
    [0]
    // 2. Interval arithmetic with NOW()  (must come before plain NOW())
    .replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+hours?'/gi,
      (_, n) => `datetime('now', '-${n} hours')`)
    .replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+days?'/gi,
      (_, n) => `datetime('now', '-${n} days')`)
    .replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+minutes?'/gi,
      (_, n) => `datetime('now', '-${n} minutes')`)
    // 3. NOW() with type cast (e.g. NOW()::text)
    .replace(/NOW\(\)::\w+/gi, "datetime('now')")
    // 4. Remaining NOW()
    .replace(/\bNOW\(\)/gi, "datetime('now')")
    // 5. DATE_TRUNC('hour', col)
    .replace(/DATE_TRUNC\('hour',\s*([^)]+)\)/gi,
      (_, col) => `strftime('%Y-%m-%dT%H:00:00', ${col.trim()})`)
    // 6. Boolean NOT toggle  (SET col = NOT col)
    .replace(/=\s*NOT\s+(\w+)/gi,
      (_, col) => `= CASE WHEN ${col} = 1 THEN 0 ELSE 1 END`)
    // 7. Boolean literals in SQL conditions / defaults
    .replace(/\bDEFAULT\s+true\b/gi,  'DEFAULT 1')
    .replace(/\bDEFAULT\s+false\b/gi, 'DEFAULT 0')
    .replace(/\b=\s*true\b/gi,  '= 1')
    .replace(/\b=\s*false\b/gi, '= 0')
    // 8. ILIKE → LIKE  (SQLite LIKE is case-insensitive for ASCII)
    .replace(/\bILIKE\b/gi, 'LIKE')
    // 9. PostgreSQL type casts  (::int, ::text, ::bigint, etc.)
    .replace(/::(text|int|integer|bigint|boolean|float|numeric|real|varchar\w*|timestamptz?|jsonb?)/gi, '')
    // 10. Parameter placeholders  $1,$2 → ?
    .replace(/\$\d+/g, '?');
}

/**
 * SQLite returns booleans as 1/0 and COUNT(*) as column "COUNT(*)".
 * This function normalises rows before they reach route handlers.
 */
const BOOL_COLS = new Set(['is_active', 'is_healthy', 'is_https']);

function normaliseRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };

  for (const col of BOOL_COLS) {
    if (col in out && typeof out[col] === 'number') {
      out[col] = out[col] === 1;
    }
  }

  // Normalise COUNT(*) column name
  if ('COUNT(*)' in out && !('count' in out)) {
    out.count = out['COUNT(*)'];
  }

  // Normalise SQLite datetime strings (YYYY-MM-DD HH:MM:SS → ISO 8601)
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) {
      out[k] = v.replace(' ', 'T') + 'Z';
    }
  }

  return out;
}

/* ════════════════════════════════════════════════════════════
   SQLite adapter
   ════════════════════════════════════════════════════════════ */
function createSQLitePool() {
  const Database = require('better-sqlite3');

  const dbPath = process.env.DB_PATH
    || path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.proxyhub', 'proxyhub.db');

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');   // Better write concurrency
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL'); // Good balance of safety/speed

  console.log(`[db] SQLite: ${dbPath}`);

  return {
    type: 'sqlite',
    path: dbPath,

    query: async (sql, params = []) => {
      const sqliteSQL = toSQLite(sql);
      const hasReturning = /\bRETURNING\b/i.test(sqliteSQL);
      const isRead = /^\s*(SELECT|WITH\s)/i.test(sqliteSQL);

      // SQLite can't bind JS booleans — coerce to 1/0
      const boundParams = params.map(p => (typeof p === 'boolean' ? (p ? 1 : 0) : p));

      try {
        const stmt = db.prepare(sqliteSQL);
        let rows;
        if (isRead || hasReturning) {
          rows = stmt.all(...boundParams).map(normaliseRow);
        } else {
          stmt.run(...boundParams);
          rows = [];
        }
        return { rows };
      } catch (err) {
        // Attach the translated SQL to help with debugging
        err.message = `[SQLite] ${err.message}\nSQL: ${sqliteSQL}`;
        throw err;
      }
    },

    end: () => { try { db.close(); } catch (_) {} },
    _native: db,
  };
}

/* ════════════════════════════════════════════════════════════
   PostgreSQL adapter
   ════════════════════════════════════════════════════════════ */
function createPostgresPool() {
  const { Pool } = require('pg');

  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'proxymanager',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis:    30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[db] PostgreSQL pool error:', err.message);
  });

  console.log(`[db] PostgreSQL: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'proxymanager'}`);

  return {
    type:     'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || '5432',
    database: process.env.DB_NAME     || 'proxymanager',
    user:     process.env.DB_USER     || 'postgres',

    query: (sql, params) => pool.query(sql, params),
    end:   () => pool.end(),
    _native: pool,
  };
}

/* ════════════════════════════════════════════════════════════
   Schema definitions
   ════════════════════════════════════════════════════════════ */
const SCHEMA_SQLITE = `
  CREATE TABLE IF NOT EXISTS proxies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    host            TEXT NOT NULL,
    port            INTEGER NOT NULL,
    username        TEXT,
    password        TEXT,
    protocol        TEXT DEFAULT 'http',
    label           TEXT,
    is_active       INTEGER DEFAULT 1,
    is_healthy      INTEGER DEFAULT 1,
    last_used_at    DATETIME,
    last_checked_at DATETIME,
    total_requests  INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    resolved_ip     TEXT,
    country         TEXT,
    country_code    TEXT,
    city            TEXT,
    isp             TEXT,
    created_at      DATETIME DEFAULT (datetime('now')),
    UNIQUE(host, port)
  );

  CREATE TABLE IF NOT EXISTS devices (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    description  TEXT,
    api_key      TEXT UNIQUE NOT NULL,
    is_active    INTEGER DEFAULT 1,
    created_at   DATETIME DEFAULT (datetime('now')),
    last_used_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS proxy_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id  TEXT,
    proxy_id       INTEGER REFERENCES proxies(id) ON DELETE SET NULL,
    device_id      INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    device_name    TEXT,
    target_host    TEXT,
    target_port    INTEGER,
    is_https       INTEGER DEFAULT 0,
    upstream_proxy TEXT,
    status         TEXT DEFAULT 'success',
    error_message  TEXT,
    duration_ms    INTEGER,
    created_at     DATETIME DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_proxy_logs_created_at ON proxy_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_proxy_logs_proxy_id   ON proxy_logs(proxy_id);
  CREATE INDEX IF NOT EXISTS idx_proxy_logs_device_id  ON proxy_logs(device_id);
  CREATE INDEX IF NOT EXISTS idx_proxy_logs_status     ON proxy_logs(status);

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at DATETIME DEFAULT (datetime('now'))
  );
`;

/* ════════════════════════════════════════════════════════════
   initDB — creates schema + runs migrations
   ════════════════════════════════════════════════════════════ */
async function initDB() {
  if (pool.type === 'sqlite') {
    // Run each statement separately (better-sqlite3 doesn't support multi-statement exec via prepare)
    const stmts = SCHEMA_SQLITE.split(';').map(s => s.trim()).filter(Boolean);
    for (const s of stmts) {
      pool._native.exec(s + ';');
    }
    console.log('[db] SQLite schema ready');
  } else {
    // PostgreSQL — existing schema
    const client = await pool._native.connect();
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
          resolved_ip     VARCHAR(45),
          country         VARCHAR(100),
          country_code    VARCHAR(5),
          city            VARCHAR(100),
          isp             VARCHAR(255),
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
      // Migration-safe geo columns
      for (const col of [
        'resolved_ip VARCHAR(45)',
        'country VARCHAR(100)',
        'country_code VARCHAR(5)',
        'city VARCHAR(100)',
        'isp VARCHAR(255)',
      ]) {
        await client.query(
          `ALTER TABLE proxies ADD COLUMN IF NOT EXISTS ${col}`
        ).catch(() => {});
      }
      await client.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key        TEXT PRIMARY KEY,
          value      TEXT,
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('[db] PostgreSQL schema ready');
    } finally {
      client.release();
    }
  }
}

/* ════════════════════════════════════════════════════════════
   Instantiate and export
   ════════════════════════════════════════════════════════════ */
let pool;
if (DB_TYPE === 'sqlite') {
  pool = createSQLitePool();
} else if (DB_TYPE === 'postgres' || DB_TYPE === 'postgresql') {
  pool = createPostgresPool();
} else {
  throw new Error(`Unsupported DB_TYPE: "${DB_TYPE}". Use "sqlite" or "postgres".`);
}

module.exports = { pool, initDB };
